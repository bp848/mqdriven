export interface QuoteFormData {
  title: string;
  pages: number;
  size: string;
  coverPaper: string;
  innerPaper: string;
  color: string;
  binding: string;
  quantity: number;
  specialProcessing: string;
  markup: number;
}

export interface CostBreakdownItem {
  item: string;
  cost: number;
}

export interface QuoteResultData {
  suggestedRetailPrice: number;
  internalTotalCost: number;
  profitMargin: number;
  costBreakdown: CostBreakdownItem[];
  internalNotes: string;
  estimatedProductionDays: number;
}
