export type ViewState = 'landing' | 'edit' | 'dashboard' | 'formal';

export interface QuoteFormData {
  customerName: string;
  salesStaff: string;
  mainCategory: string; // 主カテゴリ（15種）
  subCategory: string;  // 副カテゴリ（成果物タイプ）
  title: string;
  periodStart?: string; // 対象期間（開始）
  periodEnd?: string;   // 対象期間（終了）
  pages: number;
  size: string;
  coverPaper: string;
  innerPaper: string;
  color: string;
  binding: string;
  quantity: number;
  markup: number;
  specialProcessing?: string; // Added to support special processing selections in forms
  rawInput?: string;
  imageInput?: string;
}

export interface QuoteResultData {
  pq: number; // 見積PQ（売価）
  vq: number; // 見積VQ（変動費）
  mq: number; // 見積MQ（粗利）
  profitMargin: number;
  costBreakdown: { item: string; cost: number }[];
  formalItems: { name: string; qty: number; unit: string; unitPrice: number; amount: number }[];
  internalNotes: string;
  estimatedProductionDays: number;
  logisticsInfo: string;
  confidence: 'high' | 'medium' | 'low';
}
