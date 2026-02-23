# Supabase-First MCP Gateway Architecture

## 概要
MQDrivenプロジェクトは、**Supabase-First MCP Gateway Architecture** を採用しました。
これは、AIエージェント（Cursor, Claude Desktopなど）がデータベースを操作する際、直接SQLを叩くのではなく、**専用のMCPサーバー（Gateway）** を介して安全かつ確実な操作を行う構成です。

## フォルダ構成
- `mcp-server/`: MCPサーバーのソースコード
  - `src/index.ts`: サーバーのエントリーポイント
  - `.env`: サーバー用の環境変数（**Service Role Key**などの機密情報を含む）
- `supabase/migrations/`: データベース定義（SQL）の正本
  - `20260218120000_consolidate_customer_budget_view.sql`: 顧客別予算集計ビューの定義

## クイックスタート

### 1. データベースの更新
Supabase CLIを使用して、最新のマイグレーションを適用してください。
```bash
supabase db push
# または、ローカル開発環境の場合:
# supabase start
```

### 2. MCPサーバーのセットアップ
```bash
cd mcp-server
npm install
cp .env.example .env
# .env ファイルを開き、SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください
npm run build
```

### 3. AIエージェントとの連携
CursorやClaude Desktopの設定ファイルに以下を追加します。

**Windows (Cursor):**
```json
"mcpServers": {
  "mqdriven-gateway": {
    "command": "node",
    "args": ["c:\\Users\\ishij\\OneDrive\\Documents\\GitHub\\mqdriven\\mcp-server\\build\\index.js"],
    "env": {
      "SUPABASE_URL": "あなたのSupabase URL",
      "SUPABASE_SERVICE_ROLE_KEY": "あなたのService Role Key"
    }
  }
}
```

## メリット
1.  **セキュリティ向上**: フロントエンドの `Anon Key` とは別に、サーバーサイド専用の `Service Role Key` をMCPサーバーのみで管理します。
2.  **AIの誤操作防止**: AIは「任意のSQL」を実行するのではなく、「定義されたツール（例: `get_customer_budget_summary`）」のみを使用できます。
3.  **スキーマ管理の一元化**: 散らばっていたSQLファイルを `supabase/migrations` に集約しました。

## 既存のWindsurf/MCP構成との関係

プロジェクト内には、`server/assistant/mcpHost.js` を中心とした **「アプリケーション自体がMCPを使用する」** 既存の実装が含まれています（Google Calendar連携など）。これらは新しいGatewayとは以下のように共存します：

| コンポーネント | ディレクトリ | 役割 | ユーザー |
| :--- | :--- | :--- | :--- |
| **MQDriven Gateway** <br>(新規提案) | `mcp-server/` | DB管理、分析、開発支援 | **Cursor / Claude / AI** |
| **App MCP Host** <br>(既存実装) | `server/mcp/` | アプリ機能としての外部連携<br>(Google Cal/Drive等) | **Webアプリケーション** |

### 統合のポイント
既存の `server/` ディレクトリで `npm install` を実行し、`@modelcontextprotocol/sdk` を追加することで、アプリケーション側のMCP機能も正常に動作するように復元しました。
