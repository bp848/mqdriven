const express = require('express');
const multer = require('multer');
const { handleChat, runTool } = require('./llmOrchestrator');
const { mcpHostSingleton: mcp } = require('./mcpHost');
const { appendEvent } = require('./eventLog');

const upload = multer({ storage: multer.memoryStorage() });

const assistantRouter = express.Router();
const USER_ID_HEADER = 'x-user-id';

const getUserId = (req) => req?.headers?.[USER_ID_HEADER] || 'unknown-user';

assistantRouter.get('/today', async (_req, res) => {
  const today = await mcp.calendar_today();
  res.json({ items: today.items });
});

assistantRouter.post('/chat', upload.array('files'), async (req, res) => {
  const message = String(req.body?.message ?? '');
  const files = (req.files ?? []).map((file) => ({ name: file.originalname }));
  const out = await handleChat(req, message, files);
  res.json(out);
});

assistantRouter.post('/action', express.json(), async (req, res) => {
  const tool = String(req.body?.tool ?? '');
  const args = req.body?.args ?? {};
  const out = await runTool(req, tool, args);
  res.json(out);
});

assistantRouter.get('/gmail/inbox', async (req, res) => {
  const userId = getUserId(req);
  const query = typeof req.query?.query === 'string' ? req.query.query : '';
  const maxResultsRaw = req.query?.maxResults;
  const maxResults = maxResultsRaw ? Number(maxResultsRaw) : undefined;
  const result = await mcp.gmail_list(query, Number.isFinite(maxResults) ? maxResults : undefined);
  appendEvent({
    ts: Date.now(),
    userId,
    type: 'mail_read',
    payload: { source: result.source, query },
  });
  res.json(result);
});

assistantRouter.get('/gmail/message/:id', async (req, res) => {
  const userId = getUserId(req);
  const messageId = String(req.params.id || '');
  const result = await mcp.gmail_get(messageId);
  appendEvent({
    ts: Date.now(),
    userId,
    type: 'mail_read',
    payload: { source: result.source, messageId },
  });
  res.json(result);
});

assistantRouter.post('/gmail/reply-draft', express.json(), async (req, res) => {
  const userId = getUserId(req);
  const to = String(req.body?.to || '');
  const subject = String(req.body?.subject || '');
  const body = String(req.body?.body || '');
  const result = await mcp.gmail_draft(to, subject, body);
  appendEvent({
    ts: Date.now(),
    userId,
    type: 'mail_draft',
    payload: { to, subject },
  });
  res.json(result);
});

assistantRouter.post('/gmail/send-draft', express.json(), async (req, res) => {
  const userId = getUserId(req);
  const draftId = String(req.body?.draftId || '');
  const result = await mcp.gmail_send_draft(draftId);
  appendEvent({
    ts: Date.now(),
    userId,
    type: 'mail_send',
    payload: { draftId },
  });
  res.json(result);
});

module.exports = {
  assistantRouter,
};
