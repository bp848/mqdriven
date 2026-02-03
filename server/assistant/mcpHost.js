function parseServers() {
  const raw = process.env.MCP_SERVERS;
  if (!raw) return [{ name: 'google', kind: 'mock' }];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
    return [{ name: 'google', kind: 'mock' }];
  } catch {
    return [{ name: 'google', kind: 'mock' }];
  }
}

class McpHost {
  constructor() {
    this.servers = parseServers();
  }

  hasRealGoogle() {
    return this.servers.some((server) => server.name === 'google' && server.kind === 'stdio');
  }

  async calendar_today() {
    return {
      items: [
        { title: '朝礼・環境整備', time: '08:20-09:30' },
        { title: 'ミーティング', time: '09:30-10:00' },
        { title: '10号機', time: '10:00-13:00' },
      ],
      source: this.hasRealGoogle() ? 'google(mcp)' : 'mock',
    };
  }

  async drive_search(query) {
    return {
      hits: [
        {
          title: `【手順書】${query}（サンプル）`,
          snippet:
            '1) 対象ファイルをアップロード\n2) OCR実行\n3) 結果を確認\n4) 保存を確定\n',
          url: '',
        },
      ],
      source: this.hasRealGoogle() ? 'google(mcp)' : 'mock',
    };
  }

  async drive_suggest_path(context) {
    return {
      suggestedPath: 'Google Drive / 共有ドライブ / 業務AI / 受領資料 / 2026-02',
      suggestedName: `【${new Date().toISOString().slice(0, 10)}】${context || '成果物'}.pdf`,
      note: '保存ボタンで確定（人間の最終承認）',
    };
  }

  async gmail_draft(to, subject, body) {
    return { ok: true, draftId: 'mock-draft', to, subject, body };
  }
}

const mcpHostSingleton = new McpHost();

module.exports = {
  McpHost,
  mcpHostSingleton,
};
