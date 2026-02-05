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

  it('summarizes GWS data and logs actions', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { handleChat } = loadOrchestrator();
    const { readEventsForToday } = loadEventLog();

    const response = await handleChat({ headers: {} }, 'GWSのまとめを教えて', []);

    expect(response.assistantText).toContain('GWSの最新状況');
    expect(response.assistantText).toContain('受信メール');
    expect(response.assistantText).toContain('Drive検索');
    expect(response.actions?.some((action) => action.tool === 'gmail_inbox')).toBe(true);

    const events = readEventsForToday();
    expect(events.some((entry) => entry.type === 'calendar_read')).toBe(true);
    expect(events.some((entry) => entry.type === 'mail_read')).toBe(true);
    expect(events.some((entry) => entry.type === 'drive_search')).toBe(true);
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

  it('lists inbox and provides message actions', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { runTool } = loadOrchestrator();
    const response = await runTool({ headers: {} }, 'gmail_inbox', {});

    expect(response.assistantText).toContain('受信メール');
    expect(response.actions?.some((action) => action.tool === 'gmail_get')).toBe(true);
  });

  it('runs GWS summary tool', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { runTool } = loadOrchestrator();
    const response = await runTool({ headers: {} }, 'gws_summary', {});

    expect(response.assistantText).toContain('GWSの最新状況');
    expect(response.actions?.some((action) => action.tool === 'gmail_inbox')).toBe(true);
  });

  it('retrieves a gmail message by id', async () => {
    tempDir = createTempDir();
    process.env.ASSISTANT_LOG_DIR = tempDir;

    const { runTool } = loadOrchestrator();
    const response = await runTool({ headers: {} }, 'gmail_get', { messageId: 'mock-1' });

    expect(response.assistantText).toContain('メール詳細');
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
