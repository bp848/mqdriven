const { McpClientManager, parseMcpServers } = require('../mcp/mcpClient');

const mockCalendarItems = [
  { title: '朝礼・環境整備', time: '08:20-09:30' },
  { title: 'ミーティング', time: '09:30-10:00' },
  { title: '10号機', time: '10:00-13:00' },
];
const mockGmailMessages = [
  {
    id: 'mock-1',
    threadId: 'mock-thread-1',
    from: 'テスト担当 <test@example.com>',
    subject: 'テスト問い合わせ',
    snippet: 'お世話になります。見積もりについて相談したいです。',
    date: new Date().toISOString(),
    body: 'お世話になります。見積もりについて相談したいです。詳細を教えてください。',
  },
];

const extractTextContent = (result) => {
  if (!result?.content) return '';
  return result.content
    .map((block) => {
      if (block?.type === 'text' && typeof block.text === 'string') return block.text;
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const getStructuredArray = (structured, keys) => {
  if (!structured || typeof structured !== 'object') return null;
  for (const key of keys) {
    const value = structured[key];
    if (Array.isArray(value)) return value;
  }
  return null;
};

const formatTimeRange = (startValue, endValue) => {
  if (!startValue && !endValue) return '';
  const format = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toTimeString().slice(0, 5);
  };
  const start = format(startValue);
  const end = format(endValue);
  if (start && end) return `${start}-${end}`;
  return start || end;
};

const normalizeCalendarItems = (result) => {
  const structured = result?.structuredContent || null;
  const items = getStructuredArray(structured, ['items', 'events']);
  if (!items) return null;
  return items.map((item) => {
    const title = item.summary || item.title || item.subject || '（無題）';
    const start = item.start?.dateTime || item.start?.date || item.start;
    const end = item.end?.dateTime || item.end?.date || item.end;
    const time = formatTimeRange(start, end);
    return { title, time };
  });
};

const normalizeDriveHits = (result) => {
  const structured = result?.structuredContent || null;
  const items = getStructuredArray(structured, ['files', 'items', 'hits']);
  if (!items) return null;
  return items.map((item) => ({
    title: item.name || item.title || '（無題）',
    snippet: item.description || item.summary || '',
    url: item.url || item.webViewLink || '',
  }));
};

const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
};

const normalizeGmailList = (result) => {
  const structured = result?.structuredContent || null;
  const items = getStructuredArray(structured, ['messages', 'items', 'threads']);
  if (!items) return null;
  return items.map((item) => ({
    id: item.id || item.messageId || '',
    threadId: item.threadId || item.thread_id || item.id || '',
    from: item.from || item.sender || item.author || '',
    subject: item.subject || item.title || '',
    snippet: item.snippet || item.preview || '',
    date: item.date || item.internalDate || item.receivedAt || '',
  }));
};

const normalizeGmailMessage = (result) => {
  const structured = result?.structuredContent || null;
  if (!structured || typeof structured !== 'object') return null;
  const payload = structured.message || structured;
  if (!payload || typeof payload !== 'object') return null;
  return {
    id: payload.id || payload.messageId || '',
    threadId: payload.threadId || payload.thread_id || payload.id || '',
    from: payload.from || payload.sender || payload.author || '',
    subject: payload.subject || payload.title || '',
    snippet: payload.snippet || payload.preview || '',
    date: payload.date || payload.internalDate || payload.receivedAt || '',
    body: payload.body || payload.text || payload.content || '',
  };
};

class McpHost {
  constructor() {
    this.servers = parseMcpServers(process.env.MCP_SERVERS);
    this.manager = new McpClientManager(this.servers);
  }

  hasRealGoogle() {
    return this.manager.hasServer('google');
  }

  async callGoogleTool(name, args) {
    if (!this.hasRealGoogle()) return null;
    try {
      return await this.manager.callTool('google', name, args);
    } catch {
      return null;
    }
  }

  async calendar_today() {
    if (!this.hasRealGoogle()) {
      return { items: mockCalendarItems, source: 'mock' };
    }
    const { timeMin, timeMax } = getTodayRange();
    const result = await this.callGoogleTool('calendar.list', { timeMin, timeMax });
    const items = normalizeCalendarItems(result);
    if (items) {
      return { items, source: 'google(mcp)' };
    }
    return { items: mockCalendarItems, source: 'mock' };
  }

  async drive_search(query) {
    if (!this.hasRealGoogle()) {
      return {
        hits: [
          {
            title: `【手順書】${query}（サンプル）`,
            snippet:
              '1) 対象ファイルをアップロード\n2) OCR実行\n3) 結果を確認\n4) 保存を確定\n',
            url: '',
          },
        ],
        source: 'mock',
      };
    }
    const result = await this.callGoogleTool('drive.search', { query });
    const hits = normalizeDriveHits(result);
    if (hits) {
      return { hits, source: 'google(mcp)' };
    }
    const text = extractTextContent(result);
    if (text) {
      return { hits: [{ title: text, snippet: '', url: '' }], source: 'google(mcp)' };
    }
    return { hits: [], source: 'google(mcp)' };
  }

  async drive_suggest_path(context) {
    return {
      suggestedPath: 'Google Drive / 共有ドライブ / 業務AI / 受領資料 / 2026-02',
      suggestedName: `【${new Date().toISOString().slice(0, 10)}】${context || '成果物'}.pdf`,
      note: '保存ボタンで確定（人間の最終承認）',
    };
  }

  async gmail_draft(to, subject, body) {
    if (!this.hasRealGoogle()) {
      return { ok: true, draftId: 'mock-draft', to, subject, body };
    }
    const result = await this.callGoogleTool('gmail.create_draft', { to, subject, body });
    if (!result) {
      return { ok: false, draftId: '', to, subject, body };
    }
    const structured = result.structuredContent || {};
    const draftId = structured.draftId || structured.id || '';
    return { ok: !result.isError, draftId, to, subject, body };
  }

  async gmail_list(query, maxResults) {
    if (!this.hasRealGoogle()) {
      return { messages: mockGmailMessages, source: 'mock' };
    }
    const result = await this.callGoogleTool('gmail.list', { query, maxResults });
    const messages = normalizeGmailList(result);
    if (messages) {
      return { messages, source: 'google(mcp)' };
    }
    const text = extractTextContent(result);
    if (text) {
      return {
        messages: [{ id: '', threadId: '', from: '', subject: text, snippet: '', date: '' }],
        source: 'google(mcp)',
      };
    }
    return { messages: [], source: 'google(mcp)' };
  }

  async gmail_get(messageId) {
    if (!this.hasRealGoogle()) {
      const match = mockGmailMessages.find((message) => message.id === messageId);
      return { message: match || mockGmailMessages[0], source: 'mock' };
    }
    const result = await this.callGoogleTool('gmail.get', { id: messageId });
    const message = normalizeGmailMessage(result);
    if (message) {
      return { message, source: 'google(mcp)' };
    }
    return { message: null, source: 'google(mcp)' };
  }

  async gmail_send_draft(draftId) {
    if (!this.hasRealGoogle()) {
      return { ok: true, draftId: draftId || 'mock-draft' };
    }
    const result = await this.callGoogleTool('gmail.send_draft', { draftId });
    const structured = result?.structuredContent || {};
    const sentId = structured.id || draftId || '';
    return { ok: !result?.isError, draftId: sentId };
  }
}

const mcpHostSingleton = new McpHost();

module.exports = {
  McpHost,
  mcpHostSingleton,
};
