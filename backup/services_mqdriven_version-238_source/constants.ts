import { Job, JobStatus, InvoiceStatus, Employee, JournalEntry, Customer, PurchaseOrder, PurchaseOrderStatus } from './types';

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