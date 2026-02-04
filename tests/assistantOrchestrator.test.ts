import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-log-'));

const loadEventLog = () => {
  const modulePath = path.resolve(process.cwd(), 'server', 'assistant', 'eventLog.js');
  delete require.cache[modulePath];
  return require(modulePath) as typeof import('../server/assistant/eventLog.js');
};

const loadOrchestrator = () => {
  const eventLogPath = path.resolve(process.cwd(), 'server', 'assistant', 'eventLog.js');
  delete require.cache[eventLogPath];
  const modulePath = path.resolve(process.cwd(), 'server', 'assistant', 'llmOrchestrator.js');
  delete require.cache[modulePath];
  return require(modulePath) as typeof import('../server/assistant/llmOrchestrator.js');
};

let tempDir = '';

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  delete process.env.ASSISTANT_LOG_DIR;
  tempDir = '';
});

describe('assistant event log', () => {
  it('appends and reads events for today', () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { appendEvent, readEventsForToday } = loadEventLog();
    appendEvent({ ts: Date.now(), userId: 'u1', type: 'test', payload: { ok: true } });

    const events = readEventsForToday();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('test');
  });
});

describe('assistant orchestrator', () => {
  it('responds with schedule actions', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { handleChat } = loadOrchestrator();
    const response = await handleChat({ headers: {} }, '今日の予定を教えて', []);

    expect(response.assistantText).toContain('今日の予定');
    expect(response.actions?.some((action) => action.tool === 'ocr_image')).toBe(true);
  });

  it('logs calendar read actions', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { handleChat } = loadOrchestrator();
    const { readEventsForToday } = loadEventLog();

    await handleChat({ headers: {} }, '今日の予定を教えて', []);

    const events = readEventsForToday();
    expect(events.some((entry) => entry.type === 'calendar_read')).toBe(true);
  });

  it('runs OCR tool and returns preview', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { runTool } = loadOrchestrator();
    const response = await runTool({ headers: {} }, 'ocr_image', { fileName: 'sample.pdf' });

    expect(response.preview?.draft?.content).toContain('sample.pdf');
    expect(response.actions?.some((action) => action.tool === 'finalize_save')).toBe(true);
  });

  it('logs mail draft actions', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { runTool } = loadOrchestrator();
    const { readEventsForToday } = loadEventLog();

    await runTool({ headers: {} }, 'gmail_draft', { to: 'test@example.com', subject: '日報', body: '本文' });

    const events = readEventsForToday();
    expect(events.some((entry) => entry.type === 'mail_draft')).toBe(true);
  });
});
