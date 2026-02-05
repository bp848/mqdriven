const express = require('express');
const multer = require('multer');
const { handleChat, runTool } = require('./llmOrchestrator');
const { mcpHostSingleton: mcp } = require('./mcpHost');
const { appendEvent } = require('./eventLog');
const {
  clearConversation,
  loadConversation,
  maybeSaveConversation,
  saveConversation,
} = require('./conversationStore');

const upload = multer({ storage: multer.memoryStorage() });

const USER_ID_HEADER = 'x-user-id';

const getUserId = (req) => {
  const raw = req?.headers?.[USER_ID_HEADER];
  if (Array.isArray(raw)) return raw[0]?.trim() || null;
  if (typeof raw === 'string') return raw.trim() || null;
  return null;
};

const getUserIdOrUnknown = (req) => getUserId(req) ?? 'unknown-user';

const ensureSupabase = (supabase, res) => {
  if (!supabase) {
    res.status(503).json({ error: 'Supabase not configured' });
    return null;
  }
  return supabase;
};

const createAssistantRouter = (supabase) => {
  const assistantRouter = express.Router();

  assistantRouter.get('/today', async (_req, res) => {
    const today = await mcp.calendar_today();
    res.json({ items: today.items });
  });

  assistantRouter.get('/history', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ error: 'x-user-id header is required' });
      return;
    }
    const client = ensureSupabase(supabase, res);
    if (!client) return;
    const limit = req.query?.limit ? Number(req.query.limit) : 50;
    try {
      const messages = await loadConversation(client, userId, limit);
      res.json({ messages });
    } catch (error) {
      console.error('[assistant] failed to load history', error);
      res.status(500).json({ error: 'Failed to load conversation history' });
    }
  });

  assistantRouter.delete('/history', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ error: 'x-user-id header is required' });
      return;
    }
    const client = ensureSupabase(supabase, res);
    if (!client) return;
    try {
      await clearConversation(client, userId);
      res.json({ cleared: true });
    } catch (error) {
      console.error('[assistant] failed to clear history', error);
      res.status(500).json({ error: 'Failed to clear conversation history' });
    }
  });

  assistantRouter.post('/save', express.json(), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ error: 'x-user-id header is required' });
      return;
    }
    const client = ensureSupabase(supabase, res);
    if (!client) return;
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const result = await saveConversation(client, userId, messages);
      res.json(result);
    } catch (error) {
      console.error('[assistant] failed to save conversation', error);
      res.status(500).json({ error: 'Failed to save conversation' });
    }
  });

  assistantRouter.post('/chat', upload.array('files'), async (req, res) => {
    const message = String(req.body?.message ?? '');
    const files = (req.files ?? []).map((file) => ({ name: file.originalname }));
    const out = await handleChat(req, message, files);
    const userId = getUserId(req);
    if (userId && supabase) {
      const now = Date.now();
      const transcript = [];
      if (message.trim()) {
        transcript.push({ role: 'user', text: message, ts: now });
      }
      if (out?.assistantText) {
        transcript.push({ role: 'assistant', text: out.assistantText, ts: now + 1 });
      }
      await maybeSaveConversation(supabase, userId, transcript);
    }
    res.json(out);
  });

  assistantRouter.post('/action', express.json(), async (req, res) => {
    const tool = String(req.body?.tool ?? '');
    const args = req.body?.args ?? {};
    const out = await runTool(req, tool, args);
    res.json(out);
  });

  assistantRouter.get('/gmail/inbox', async (req, res) => {
    const userId = getUserIdOrUnknown(req);
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
    const userId = getUserIdOrUnknown(req);
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
    const userId = getUserIdOrUnknown(req);
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
    const userId = getUserIdOrUnknown(req);
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

  return assistantRouter;
};

module.exports = {
  createAssistantRouter,
};
