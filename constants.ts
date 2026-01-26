import { Job, JobStatus, InvoiceStatus, Employee, JournalEntry, Customer, PurchaseOrder, PurchaseOrderStatus, MockClient } from './types';

export const PAPER_TYPES = [
  'コート紙 90kg',
  'マットコート紙 110kg',
  '上質紙 70kg',
  'アートポスト 180kg',
  'ミラーコート・プラチナ 220kg',
  'サテン金藤 135kg'
];

export const FINISHING_OPTIONS = [
  'なし',
  'PP加工（グロス）',
  'PP加工（マット）',
  '箔押し',
  'エンボス加工',
  '型抜き'
];

// 経営の意思決定に必要な固定費を定義
export const FIXED_COSTS = {
  monthly: {
    labor: 1200000, // 人件費 (L)
    other: 800000,   // その他経費 (G) - 家賃、光熱費、減価償却など
  }
};

// ダッシュボード用の日次目標
export const DAILY_GOALS = {
  grossMargin: 50000, // 限界利益
  operatingProfit: 25000, // 経常利益
  ordersValue: 150000, // 受注額
};

// ダッシュボード用の月次目標
export const MONTHLY_GOALS = {
  pq: 4000000, // 売上高
  vq: 2500000, // 変動費
  mq: 1500000, // 限界利益
  f: 1300000,  // 固定費
  g: 200000,   // 利益
};

export const INQUIRY_TYPES = [
    '資料請求',
    '見積依頼',
    'サービスに関する質問',
    'デモ依頼',
    '価格に関する問い合わせ',
    '導入相談',
    'パートナーシップ',
    'その他',
];

/**
 * 【開発引き継ぎ：重要なお知らせとお詫び】
 * 本ファイル内のデータ（MOCK_CLIENTS, CATEGORIES）は、プロトタイプ構築のために
 * 私が勝手に作成した「クソな固定値（ハードコード）」です。実務に即しておらず申し訳ありません。
 * 
 * 実装担当者様は、以下の修正を最優先で実施してください：
 * 1. MOCK_CLIENTS: Supabase（下記URL）の `customers` テーブルから取得するように変更してください。
 * 2. CATEGORIES: 文唱堂印刷の実際の品目マスタと同期させてください。
 * 3. 以下の統合マニフェストに基づき、実際の接続認証（/mcp auth supabase）を行ってください。
 */

export const INTEGRATION_MANIFESTO = {
  システム名: "文唱堂印刷 統合基幹AIシステム - NEXUS",
  バージョン: "5.5.0-JP (Supabase MCP対応版)",
  業務領域: "総合印刷業務（商業・事務・出版・パッケージ・SP）",
  統合エンドポイント: [
    {
      名称: "Supabase 基幹データベース (MCP)",
      URL: "https://mcp.supabase.com/mcp?project_ref=rwjhpfghhgstvplmggks",
      役割: "顧客マスタ、過去案件の成約単価、原価実績、在庫情報の参照"
    },
    {
      名称: "Google Drive 過去案件フォルダ (MCP)",
      URL: "mcp://google-drive/files",
      役割: "過去の見積書（Excel/PDF）や入稿データの全文検索・内容参照"
    },
    {
      名称: "DeepWiki 社内ナレッジ (MCP)",
      URL: "mcp://knowledge-base/search",
      役割: "顧客固有の品質基準、過去のトラブル事例、検品ルールの参照"
    }
  ],
  利益管理基準: "MQ会計（限界利益・変動費管理）",
  AIへの指示: "基幹DBから過去の成約単価を取得し、現在の市場原価と照らし合わせて最適な限界利益率を提案せよ。"
};

// AI見積もりアプリ用の定数
export const MOCK_CLIENTS: MockClient[] = [
  { id: 'c1', name: '株式会社テクノソリューション', pastOrders: 156, reliability: 'High' },
  { id: 'c2', name: '青山クリエイティブ', pastOrders: 42, reliability: 'Normal' },
  { id: 'c3', name: '銀座デパートメント', pastOrders: 890, reliability: 'High' },
  { id: 'c4', name: 'インディペンデント・パブリッシャー', pastOrders: 12, reliability: 'New' },
  { id: 'c5', name: '東京製薬株式会社', pastOrders: 320, reliability: 'High' },
  { id: 'c6', name: '日本工業大学', pastOrders: 210, reliability: 'High' },
];

export const CATEGORIES = [
  'チラシ・パンフレット（商業印刷）',
  '書籍・会報・記念誌（出版印刷）',
  '名刺・封筒・伝票（事務印刷）',
  '化粧箱・ラベル（包装資材）',
  'ポスター・什器（販促ツール）',
  'ダイレクトメール・可変印刷',
  '大型出力・サイングラフィックス'
];