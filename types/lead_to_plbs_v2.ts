export type LeadStatusV2 = 'new' | 'qualified' | 'proposal' | 'won' | 'lost';

export interface LeadV2 {
  id: string;
  leadCode: string;
  customerId: string | null;
  title: string;
  status: LeadStatusV2;
  source?: string | null;
  ownerId?: string | null;
  expectedCloseDate?: string | null;
  expectedAmount?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatusV2 = 'planning' | 'in_progress' | 'delivery' | 'done' | 'canceled';
export type DeliveryStatusV2 = 'not_started' | 'in_progress' | 'delivered' | 'delayed';

export interface ProjectV2 {
  id: string;
  projectCode: string;
  leadId?: string | null;
  customerId: string;
  projectName: string;
  status: ProjectStatusV2;
  deliveryStatus: DeliveryStatusV2;
  budgetSales: number;
  budgetCost: number;
  baselineMqRate?: number | null;
  dueDate?: string | null;
  deliveryDate?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBudgetV2 {
  id: string;
  projectId: string;
  periodStart: string;
  periodEnd: string;
  budgetSales: number;
  budgetCost: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EstimateStatusV2 = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'canceled';

export interface EstimateItemV2 {
  id: string;
  estimateId: string;
  lineNo: number;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  variableCost: number;
  taxRate?: number | null;
  salesAmount: number;
  mqAmount: number;
  mqRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateV2 {
  id: string;
  projectId: string;
  leadId?: string | null;
  estimateNumber: string;
  version: number;
  status: EstimateStatusV2;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  validUntil?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  variableCostAmount?: number | null;
  mqAmount?: number | null;
  mqRate?: number | null;
  detailCount?: number | null;
  isPrimaryForProject?: boolean;
}

export type OrderTypeV2 = 'sales' | 'purchase' | 'subcontract' | 'internal';
export type OrderStatusV2 = 'ordered' | 'in_progress' | 'delivered' | 'invoiced' | 'closed' | 'cancelled';

export interface OrderV2 {
  id: string;
  projectId: string;
  estimateId?: string | null;
  orderCode: string;
  orderType: OrderTypeV2;
  orderDate: string;
  deliveryDate?: string | null;
  quantity: number;
  unitPrice: number;
  salesAmount: number;
  variableCostAmount: number;
  mqAmount: number;
  mqRate: number | null;
  status: OrderStatusV2;
  costConfirmed: boolean;
  costConfirmedAt?: string | null;
  costConfirmedBy?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatusV2 = 'draft' | 'issued' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceV2 {
  id: string;
  invoiceCode: string;
  projectId: string;
  orderId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number;
  taxAmount: number;
  salesAmount: number;
  status: InvoiceStatusV2;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReceivableStatusV2 = 'outstanding' | 'partially_paid' | 'paid' | 'overdue';
export type PayableStatusV2 = 'outstanding' | 'partially_paid' | 'paid' | 'overdue';

export interface ReceivableV2 {
  id: string;
  invoiceId?: string | null;
  projectId: string;
  customerId?: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: ReceivableStatusV2;
  lastPaymentDate?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptV2 {
  id: string;
  receivableId: string;
  paymentDate: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  memo?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface PayableV2 {
  id: string;
  projectId: string;
  supplierId?: string | null;
  orderId?: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: PayableStatusV2;
  lastPaymentDate?: string | null;
  description?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisbursementV2 {
  id: string;
  payableId: string;
  paymentDate: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  memo?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface ProjectFinancialsView {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerId: string;
  status: ProjectStatusV2;
  deliveryStatus: DeliveryStatusV2;
  dueDate?: string | null;
  budgetSales: number;
  budgetCost: number;
  primaryEstimateId?: string | null;
  forecastSales?: number | null;
  forecastCost?: number | null;
  forecastMqRate?: number | null;
  salesActual: number;
  costActual: number;
  mqAmount: number;
  mqRate?: number | null;
  salesVariance: number;
  costVariance: number;
  estimateStatus?: EstimateStatusV2;
  estimatedDeliveryDate?: string | null;
}

export interface LeadToCashRow {
  leadId: string;
  leadCode: string;
  leadStatus: LeadStatusV2;
  expectedCloseDate?: string | null;
  expectedAmount?: number | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  projectStatus?: ProjectStatusV2 | null;
  estimateId?: string | null;
  estimateStatus?: EstimateStatusV2 | null;
  firstOrderDate?: string | null;
  lastOrderDate?: string | null;
  firstInvoiceDate?: string | null;
  lastInvoiceDate?: string | null;
  salesActual?: number | null;
  costActual?: number | null;
  mqAmount?: number | null;
  mqRate?: number | null;
}
