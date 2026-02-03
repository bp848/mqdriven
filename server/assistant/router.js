const express = require('express');
const multer = require('multer');
const { handleChat, runTool } = require('./llmOrchestrator');
const { mcpHostSingleton: mcp } = require('./mcpHost');

const upload = multer({ storage: multer.memoryStorage() });

const assistantRouter = express.Router();

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

module.exports = {
  assistantRouter,
};
