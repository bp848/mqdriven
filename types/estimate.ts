// types/estimate.ts
export interface EstimateItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  subtotal: number;
}

export interface Estimate {
  id: string;
  documentNumber: string;
  documentType: 'estimate' | 'invoice';
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'paid' | 'overdue';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  title: string;
  content: EstimateItem[];
  notes: string;
  emailSentAt?: string;
  emailOpenedAt?: string;
  emailOpenCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEstimateRequest {
  leadId: string;
  documentType: 'estimate' | 'invoice';
  status: Estimate['status'];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  title: string;
  content: EstimateItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  notes: string;
  createdBy: string;
}

export interface EstimateFilters {
  status?: Estimate['status'];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
}
