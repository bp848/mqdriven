// Database-aligned Types for mqdriven ERP System
// Based on actual Supabase schema

export type Page =
  | 'analysis_dashboard'
  | 'sales_dashboard' | 'sales_leads' | 'sales_customers' | 'sales_pipeline'
  | 'sales_estimates' | 'quote_center' | 'sales_orders' | 'project_management' | 'sales_billing' | 'analysis_ranking'
  | 'purchasing_orders' | 'purchasing_invoices' | 'purchasing_payments'
  | 'inventory_management' | 'manufacturing_orders' | 'manufacturing_progress' | 'manufacturing_cost'
  | 'hr_attendance' | 'hr_man_hours' | 'hr_labor_cost'
  | 'approval_list' | 'approval_form_expense' | 'approval_form_transport' | 'approval_form_leave'
  | 'approval_form_approval' | 'approval_form_daily' | 'approval_form_weekly'
  | 'accounting_journal' | 'accounting_general_ledger' | 'accounting_trial_balance'
  | 'accounting_tax_summary' | 'accounting_period_closing' | 'accounting_business_plan'
  | 'ai_business_consultant'
  | 'ai_market_research'
  | 'ai_transcription'
  | 'admin_audit_log' | 'admin_journal_queue' | 'admin_user_management' | 'admin_route_management'
  | 'admin_master_management' | 'admin_bug_reports' | 'admin_action_console' | 'settings'
  | 'bulletin_board' | 'knowledge_base' | 'meeting_minutes' | 'my_schedule' | 'fax_ocr_intake'
  | 'accounting_dashboard' | 'accounting_journal_review'
  | 'accounting_payables' | 'accounting_receivables' | 'accounting_cash_schedule'
  | 'accounting_expense_analysis'
  | 'accounting_approved_applications'
  | 'accounting_approved_unhandled'
  | 'accounting_approved_expense'
  | 'accounting_approved_transport'
  | 'accounting_approved_leave'
  | 'accounting_approved_apl'
  | 'accounting_approved_dly'
  | 'accounting_approved_wkr'
  | 'document_creation_tools'
  | 'proposal_ai'
  | 'pdf_editing_tools'
  | 'dtp_tools'
  | 'prompt_management'
  | 'newsletter'
  | 'simple_estimates'
  | 'print_estimate_app'
  | 'strac_analysis';

// Allow loose typing for legacy camelCase usage across the app.
export interface LooseRecord {
  [key: string]: any;
}

// Enums based on database constraints
export enum JobStatus {
  Pending = '保留',
  InProgress = '進行中',
  Completed = '完了',
  Cancelled = 'キャンセル',
}

export enum InvoiceStatus {
  Uninvoiced = '未請求',
  Invoiced = '請求済',
  Paid = '入金済',
}

export enum LeadStatus {
  Untouched = '未対応',
  New = '新規',
  Contacted = 'コンタクト済',
  Qualified = '有望',
  Disqualified = '失注',
  Converted = '商談化',
  Closed = 'クローズ',
}

export enum PurchaseOrderStatus {
  Ordered = '発注済',
  Received = '受領済',
  Cancelled = 'キャンセル',
}

export enum ManufacturingStatus {
  OrderReceived = '受注',
  DataCheck = 'データチェック',
  Prepress = '製版',
  Printing = '印刷',
  Finishing = '加工',
  AwaitingShipment = '出荷待ち',
  Delivered = '納品済',
}

export enum EstimateStatus {
  Draft = '見積中',
  Ordered = '受注',
  Lost = '失注',
}

export enum BugReportStatus {
  Open = '未対応',
  InProgress = '対応中',
  Closed = '完了',
}

export enum InboxItemStatus {
  Processing = 'processing',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Error = 'error',
}

// Database-aligned interfaces
export interface User extends LooseRecord {
  id: string;
  name: string;
  nameKana?: string;
  email?: string;
  employee_number?: string;
  department_id?: string;
  position_id?: string;
  created_at?: string;
  role?: string;
  can_use_anything_analysis?: boolean;
  auth_user_id?: string;
  start_date?: string;
  end_date?: string;
  user_code?: string;
  is_active?: boolean;
}

export interface Customer extends LooseRecord {
  id: string;
  customer_code?: string;
  customer_name?: string;
  customer_name_kana?: string;
  post_no?: string;
  address_1?: string;
  address_2?: string;
  phone_number?: string;
  fax?: string;
  closing_day?: string;
  monthly_plan?: string;
  pay_day?: string;
  recovery_method?: string;
  pay_money?: string;
  drawing_memo?: string;
  drawing_date?: string;
  bill_payment_day?: string;
  user_id?: string;
  bill_pay?: string;
  credit_sales_pay?: string;
  tax_fraction?: string;
  tax_in_flag?: string;
  budget_flag?: string;
  create_id?: string;
  create_date?: string;
  update_id?: string;
  update_date?: string;
  start_date?: string;
  end_date?: string;
  customer_rank?: string;
  customer_division?: string;
  sales_type?: string;
  support_company_flag?: string;
  note?: string;
  bank_name?: string;
  account_name_kana?: string;
  branch_name?: string;
  branch_code?: string;
  account_no?: string;
  name2?: string;
  created_at?: string;
  customer_contact_info?: string;
  representative_name?: string;
  website_url?: string;
  zip_code?: string;
  info_sales_activity?: string;
  representative?: string;
  representative_title?: string;
  received_by_employee_code?: string;
  business_event?: string;
  ai_analysis?: string;
}

export interface Lead extends LooseRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  message?: string;
  status?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
  assigned_to?: string;
  // Additional fields from database
  lead_source?: string;
  lead_status?: string;
  lead_score?: number;
  conversion_probability?: number;
  expected_close_date?: string;
  estimated_value?: number;
  actual_value?: number;
  lost_reason?: string;
  notes?: string;
  tags?: string | string[];
  contact_frequency?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  lead_owner?: string;
  campaign_id?: string;
  form_id?: string;
  page_url?: string;
  referrer_url?: string;
  search_keywords?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_medium?: string;
  utm_source?: string;
  utm_term?: string;
  visit_count?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  screen_resolution?: string;
  viewport_size?: string;
  language?: string;
  timezone?: string;
  session_id?: string;
  page_load_time?: number;
  time_on_page?: number;
  cta_source?: string;
  scroll_depth?: string;
  sections_viewed?: string;
  print_types?: string;
  user_agent?: string;
  country?: string;
  city?: string;
  region?: string;
  employees?: string;
  budget?: string;
  timeline?: string;
  inquiry_type?: string;
  ai_investigation?: string;
  ai_draft_proposal?: string;
  estimate_sent_at?: string;
}

export interface Estimate extends LooseRecord {
  id: string;
  estimates_id?: string;
  project_id?: string;
  pattern_no?: string;
  pattern_name?: string;
  delivery_place?: string;
  transaction_method?: string;
  expiration_date?: string;
  specification?: string;
  copies?: string | number;
  unit_price?: string | number;
  tax_rate?: string | number;
  note?: string;
  fraction?: string;
  approval1?: string;
  approval2?: string;
  approval3?: string;
  approval4?: string;
  approval_status1?: string;
  approval_status2?: string;
  approval_status3?: string;
  approval_status4?: string;
  subtotal?: string | number;
  consumption?: string | number;
  total?: string | number;
  valiable_cost?: string | number;
  delivery_date?: string;
  create_date?: string;
  create_id?: string;
  update_date?: string;
  update_id?: string;
  status?: string;
  // Additional fields for frontend
  estimateNumber?: number;
  customerName?: string;
  title?: string;
  displayName?: string;
  projectName?: string;
  items?: EstimateItem[];
  taxAmount?: number;
  variable_cost_amount?: number;
  mqAmount?: number;
  mqRate?: number;
  detail_count?: number;
  currency?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_primary_for_project?: boolean;
  valid_until?: string;
  version?: number;
  userId?: string;
}

export interface EstimateItem extends LooseRecord {
  division?: string;
  content?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  price?: number;
  name?: string;
  description?: string;
  subtotal?: number;
}

export interface Project extends LooseRecord {
  id: string;
  project_code?: string;
  customer_code?: string;
  customer_id?: string;
  sales_user_code?: string;
  sales_user_id?: string;
  estimate_id?: string;
  estimate_code?: string;
  order_id?: string;
  order_code?: string;
  project_name?: string;
  project_status?: string;
  classification_id?: string;
  section_code_id?: string;
  product_class_id?: string;
  create_date?: string;
  create_user_id?: string;
  create_user_code?: string;
  update_date?: string;
  update_user_id?: string;
  update_user_code?: string;
  project_id?: string;
  updated_at?: string;
  amount?: number;
  subamount?: number;
  total_cost?: number;
  delivery_date?: string;
  quantity?: string | number;
}

export interface Job extends LooseRecord {
  id: string;
  jobNumber?: number;
  projectCode?: string | number | null;
  clientName?: string;
  customerId?: string | null;
  customerCode?: string | null;
  title?: string;
  status?: JobStatus;
  dueDate?: string;
  quantity?: number;
  paperType?: string;
  finishing?: string;
  details?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Additional interfaces from database
export interface ApplicationCode extends LooseRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// 莨夊ｨ医せ繝・・繧ｿ繧ｹ縺ｮ譏守｢ｺ縺ｪ螳夂ｾｩ
export enum AccountingStatus {
  NONE = 'none',              // 未生成
  DRAFT = 'draft',            // 仕訳下書き
  POSTED = 'posted',          // 仕訳確定
}

// 逕ｳ隲九せ繝・・繧ｿ繧ｹ
export enum ApplicationStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',      // 讌ｭ蜍呎価隱肴ｸ医∩
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface Application extends LooseRecord {
  id: string;
  applicantId?: string;
  applicant_id?: string;
  applicationCodeId?: string;
  application_code_id?: string;
  formData?: any;
  status?: ApplicationStatus | string;
  accountingStatus?: AccountingStatus;
  accounting_status?: AccountingStatus;
  handlingStatus?: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  currentLevel?: number;
  approverId?: string | null;
  rejectionReason?: string | null;
  approvalRouteId?: string;
  createdAt?: string;
  updatedAt?: string | null;
  documentUrl?: string | null;
}

// 豁｣縺励＞豬√ｌ縺ｮ蝙句ｮ夂ｾｩ
export interface ApplicationWithDetails extends Application {
  id: string;
  application_code_id?: string;
  applicant_id?: string;
  applicant?: User;
  application_code?: ApplicationCode;
  applicationCode?: ApplicationCode;
  status?: ApplicationStatus | string;  // 讌ｭ蜍吶せ繝・・繧ｿ繧ｹ
  current_level?: number;
  approver_id?: string;
  rejection_reason?: string;
  approval_route_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  formData?: any;
  accounting_status?: AccountingStatus;  // DB: accounting_status
  accountingStatus?: AccountingStatus;   // UI: accountingStatus (camel)
  journalEntry?: {
    id: string;
    status: 'draft' | 'posted';
    date?: string;
    lines?: JournalEntryLine[];
  };
}

export interface ApprovalRoute extends LooseRecord {
  id: string;
  name: string;
  route_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface AccountItem extends LooseRecord {
  id: string;
  code: string;
  name: string;
  account_type?: string;
  parent_id?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder extends LooseRecord {
  id: string;
  order_number?: string;
  supplier_id?: string;
  status?: PurchaseOrderStatus;
  total_amount?: number;
  order_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem extends LooseRecord {
  id: string;
  item_code?: string;
  name?: string;
  description?: string;
  quantity_on_hand?: number;
  reorder_level?: number;
  unit_cost?: number;
  location?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Employee extends LooseRecord {
  id: string;
  user_id?: string;
  employee_number?: string;
  name: string;
  department_id?: string;
  position_id?: string;
  hire_date?: string;
  termination_date?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Department extends LooseRecord {
  id: string;
  name: string;
  parent_id?: string;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRecipient extends LooseRecord {
  id: string;
  name?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MasterAccountItem extends LooseRecord {
  id: string;
  code: string;
  name: string;
  category?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AllocationDivision extends LooseRecord {
  id: string;
  name: string;
  description?: string;
  allocation_rules?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Title extends LooseRecord {
  id: string;
  name: string;
  level?: number;
  department_id?: string;
  responsibilities?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectBudgetSummary extends LooseRecord {
  project_id?: string;
  project_name?: string;
  budgeted_amount?: number;
  actual_amount?: number;
  variance_amount?: number;
  variance_percentage?: number;
  period?: string;
}

export interface DailyReportPrefill {
  project_id?: string;
  work_description?: string;
  hours_worked?: number;
  tasks_completed?: string[];
  challenges?: string;
  next_day_plan?: string;
}

export interface Invoice extends LooseRecord {
  id: string;
  invoice_code?: string;
  order_id?: string;
  project_id?: string;
  invoice_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceData extends LooseRecord {
  vendorName?: string;
  invoiceDate?: string;
  totalAmount?: number;
  description?: string;
  costType?: 'V' | 'F';
  account?: string;
  relatedCustomer?: string;
  project?: string;
}

export interface InboxItem {
  id: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  status: InboxItemStatus;
  extractedData: InvoiceData | null;
  errorMessage: string | null;
  createdAt: string;
}

// UI-specific types
export interface Toast {
  id?: string | number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ConfirmationDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export interface BugReport extends LooseRecord {
  id: string;
  title?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: BugReportStatus;
  reporter_id?: string;
  assignee_id?: string;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string;
}

// AI-related types
export interface CompanyAnalysis {
  summary?: string;
  swot?: string;
  painPointsAndNeeds?: string;
  suggestedActions?: string;
  sources?: Array<{
    uri: string;
    title?: string;
  }>;
}

export interface CompanyInvestigation {
  company_name?: string;
  industry?: string;
  size?: string;
  location?: string;
  founded?: string;
  website?: string;
  description?: string;
  key_people?: string[];
  products_services?: string[];
  financials?: string;
  recent_news?: string;
}

// Email service types
export interface SMTPEmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

// Meeting assistant types
export interface MeetingTranscript {
  id: string;
  meeting_id?: string;
  transcript_text: string;
  summary?: string;
  action_items?: string[];
  participants?: string[];
  duration?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  organizer_id?: string;
  participants?: string[];
  meeting_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Employee user type (combination of User and Employee)
export interface EmployeeUser extends User {
  employee_number?: string;
  department_id?: string;
  position_id?: string;
  department_name?: string;
  position_name?: string;
}

// Journal entry types
export interface DraftJournalEntry {
  batchId: string;
  date: string;
  description: string;
  status: 'draft' | 'posted';
  debitAccount: string;
  creditAccount: string;
  debitAmount: number | null;
  creditAmount: number | null;
  source: string;
  confidence: number;
}

export interface JournalEntry extends LooseRecord {
  application_id?: string;
  reference_id?: string;
  batch_id?: string;
  id: string | number;
  entry_number?: string;
  entry_date?: string;
  date?: string;
  description?: string;
  status?: string;
  total_debit?: number;
  total_credit?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine extends LooseRecord {
  id: string | number;
  journal_entry_id?: string;
  account_id?: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit_amount?: number;
  credit_amount?: number;
  created_at?: string;
}

// Helper types
export type TabId = 'approvals' | 'drafts' | 'submitted' | 'completed';

// Legacy/extended types used across the UI.
export interface SortConfig extends LooseRecord {
  key: string;
  direction: 'asc' | 'desc';
}

export interface JobCreationPayload extends LooseRecord {
  status?: JobStatus;
  invoiceStatus?: InvoiceStatus;
  manufacturingStatus?: ManufacturingStatus;
  clientName?: string;
  customerId?: string | null;
  customerCode?: string | null;
  title?: string;
  quantity?: number;
  paperType?: string;
  finishing?: string;
  details?: string;
  dueDate?: string;
  price?: number;
  variableCost?: number;
  initialOrder?: {
    orderDate: string;
    quantity: number;
    unitPrice: number;
  };
}

export interface GeneralLedgerEntry extends LooseRecord {
  id: string;
  accountId?: string | null;
  date?: string;
  description?: string;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  jobId?: string | null;
  voucherNo?: string | null;
  partner?: string | null;
  type?: string | null;
}

export interface BusinessCardContact extends LooseRecord {
  companyName?: string;
  personName?: string;
  personNameKana?: string;
  department?: string;
  title?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  website?: string;
  note?: string;
}

export interface CustomerInfo extends LooseRecord {
  id?: string;
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  address?: string;
  phoneNumber?: string;
  memo?: string;
  updatedAt?: string;
}

export interface AISuggestions extends LooseRecord {
  summary?: string;
  suggestions?: string[];
}

export interface CompanyInvestigation extends LooseRecord {
  summary?: string;
  sources?: { uri: string; title: string }[];
}

export interface AIJournalSuggestion extends LooseRecord {
  debitAccount?: string;
  creditAccount?: string;
  amount?: number;
  confidence?: number;
  reasoning?: string;
}

export interface LeadScore extends LooseRecord {
  score?: number;
  rationale?: string;
}

export interface BusinessPlan extends LooseRecord {
  id?: string;
  title?: string;
  content?: string;
  createdAt?: string;
}

export interface BulletinThread extends LooseRecord {
  id: string;
  title?: string;
  body?: string;
  authorId?: string;
  authorName?: string;
  authorDepartment?: string | null;
  tags?: string[];
  pinned?: boolean;
  assigneeIds?: string[];
  createdAt?: string;
}

export interface KnowledgeArticle extends LooseRecord {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ClosingChecklistItem extends LooseRecord {
  id: string;
  title?: string;
  status?: string;
}

export interface PayableItem extends LooseRecord {
  id: string;
  supplier?: string;
  category?: string | null;
  amount: number;
  paidAmount: number;
  date?: string;
  due?: string;
  status: 'outstanding' | 'partially_paid' | 'paid' | string;
  method?: string | null;
  invoiceImage?: string | null;
  journalLineId?: string | null;
}

export interface ReceivableItem extends LooseRecord {
  id: string;
  customer?: string;
  category?: string | null;
  amount: number;
  paidAmount: number;
  date?: string;
  due?: string;
  status: 'outstanding' | 'partially_paid' | 'paid' | string;
  journalLineId?: string | null;
}

export interface CashScheduleData extends LooseRecord {
  date: string;
  opening_balance: number;
  inflows: number;
  outflows: number;
  closing_balance: number;
}

export interface CustomProposalContent extends LooseRecord {
  title?: string;
  content?: string;
}

export interface LeadProposalPackage extends LooseRecord {
  proposal?: CustomProposalContent;
  summary?: string;
}

export interface MarketResearchReport extends LooseRecord {
  summary?: string;
  sources?: { uri: string; title: string }[];
}

export interface ProposalFormData extends LooseRecord {
  id?: string;
  title?: string;
  slides?: any[];
}

export interface ProposalSlideGraph extends LooseRecord {
  type?: string;
  data?: any;
}

export interface ProposalPresentation extends LooseRecord {
  id?: string;
  title?: string;
  slides?: any[];
}

export interface CustomerBudgetSummary extends LooseRecord {
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  totalBudget?: number;
  totalActual?: number;
  totalCost?: number;
  projectCount?: number;
}

export interface ProjectBudgetFilter extends LooseRecord {
  startDate?: string;
  endDate?: string;
}

export interface BulletinComment extends LooseRecord {
  id: string;
  postId?: string;
  authorId?: string;
  authorName?: string;
  authorDepartment?: string | null;
  body?: string;
  createdAt?: string;
}

export interface CalendarEvent extends LooseRecord {
  id: string;
  userId?: string;
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  source?: string | null;
  googleEventId?: string | null;
  updatedBySource?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FaxIntake extends LooseRecord {
  id: string;
  status?: string;
  file_path?: string;
  filePath?: string;
  uploaded_at?: string;
}

export interface BankAccountInfo extends LooseRecord {
  bankName?: string;
  branchName?: string;
  accountType?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export enum ProjectStatus {
  Draft = 'draft',
  New = 'new',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Archived = 'archived',
}

export interface ProposalSource extends LooseRecord {
  uri: string;
  title: string;
}

export interface ProposalGenerationResult extends LooseRecord {
  presentation: ProposalPresentation;
  sources?: ProposalSource[] | null;
}

export interface AnalysisResult extends LooseRecord {
  id?: string;
  summary?: string;
  createdAt?: string;
}

export interface AnalysisHistory extends LooseRecord {
  id?: string;
  query?: string;
  result?: AnalysisResult;
  createdAt?: string;
}

export interface DailyReportData extends LooseRecord {
  reportDate?: string;
  startTime?: string;
  endTime?: string;
  customerName?: string;
  activityContent?: string;
  nextDayPlan?: string;
}

export interface ScheduleItem extends LooseRecord {
  id: string;
  start: string;
  end: string;
  description: string;
}

export interface InvoiceItem extends LooseRecord {
  id?: string;
  invoiceId?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
}

export interface EstimateDetail extends LooseRecord {
  id?: string | null;
  detailId?: string | null;
  estimateId: string;
  itemName: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  variableCost: number | null;
  mqAmount?: number | null;
  mqRate?: number | null;
  note?: string | null;
}


// AI見積もり用型
export interface PrintSpec {
  clientName: string;
  projectName: string;
  category: string;
  quantity: number;
  size: string;
  paperType: string;
  pages: number;
  colors: '4/4' | '4/0' | '1/1' | '1/0';
  finishing: string[];
  requestedDelivery: string;
}

export interface StrategyOption {
  id: 'must_win' | 'average' | 'profit_max';
  label: string;
  pq: number; // 売上高 (Price * Quantity)
  vq: number; // 変動費計 (Variable cost * Quantity)
  mq: number; // 限界利益 (Marginal Profit)
  f: number;  // 固定費配分 (Fixed cost allocation)
  g: number;  // 経常利益 (Gain)
  mRatio: number; // 限界利益率
  estimatedLeadTime: string;
  probability: number;
  description: string;
}

export interface EstimationResult {
  options: StrategyOption[];
  aiReasoning: string;
  co2Reduction: number;
  comparisonWithPast: {
    averagePrice: number;
    differencePercentage: number;
  };
}

// AI見積もりアプリ用の型
export interface MockClient {
  id: string;
  name: string;
  pastOrders: number;
  reliability: 'High' | 'Normal' | 'New';
}

export interface PastEstimate {
  id: string;
  clientName: string;
  projectName: string;
  date: string;
  totalAmount: number;
  specs: {
    category: string;
    quantity: number;
    size: string;
    paperType: string;
    pages: number;
    colors: string;
  };
}

// STRAC分析アプリ用の型
export interface SaleRecord {
  id: string;
  customerName: string;
  productName: string;
  salesRep: string;
  estPQ: number; // 見積売上
  estVQ: number; // 見積変動費
  estMQ: number; // 見積限界利益
  finalPQ: number; // 確定売上
  finalVQ: number; // 確定変動費
  finalMQ: number; // 確定限界利益
  materialCost?: number;   // 変動費内訳: 材料費
  outsourcingCost?: number; // 変動費内訳: 外注費
  deadline: string;
  lastUpdated: string;
  status: string;
  industry?: string; // 業種
}

export interface FixedCostBreakdown {
  labor: number;   // 人件費
  rent: number;    // 地代家賃
  other: number;   // その他固定費
}

export interface SummaryStats {
  totalSales: number;
  totalVariableCost: number;
  totalMaterialCost: number;
  totalOutsourcingCost: number;
  totalProfit: number;
  avgMarginRatio: number;
  count: number;
  fixedCost: number;
  fixedCostBreakdown: FixedCostBreakdown;
  netGain: number;
  // 顧客分析
  uniqueCustomerCount: number;
  repeatCustomerCount: number;
  repeatRate: number;
}

// Quote Center Types
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
  specialProcessing?: string; // 特殊加工選択
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

export const MAIN_CATEGORIES = [
  { id: 'print-book', label: '印刷・製本（冊子系）', icon: '📚' },
  { id: 'print-sheet', label: '印刷（ペラ物）', icon: '📄' },
  { id: 'business-card', label: '名刺', icon: '📇' },
  { id: 'envelope', label: '封筒', icon: '✉️' },
  { id: 'display', label: '備品・表示物', icon: '📛' },
  { id: 'logistics-ops', label: '配送・発送代行', icon: '🚚' },
  { id: 'shipping-cost', label: '送料（単純送料）', icon: '📦' },
  { id: 'postage', label: '郵便料金', icon: '📮' },
  { id: 'storage', label: '保管費', icon: '🏢' },
  { id: 'warehouse', label: '倉庫・在庫管理', icon: '🏬' },
  { id: 'manuscript', label: '原稿料', icon: '✍️' },
  { id: 'web-ops', label: 'Web更新・運用', icon: '🌐' },
  { id: 'system-fee', label: 'システム利用・サイト利用', icon: '💻' },
  { id: 'adjustment', label: '調整・値引/値増', icon: '⚖️' },
  { id: 'other-service', label: 'その他サービス', icon: '✨' },
];

export const SUB_CATEGORIES = [
  '冊子/雑誌/機関誌/社内報', 'チラシ', 'カタログ', 'ポスター',
  'はがき/年賀状', '表彰状', 'カード', '組織図/資料',
  '名札', 'ネームプレート', '写真/額装'
];

export const KEYWORD_MAP: Record<string, string> = {
  '名刺': 'business-card',
  '名札': 'display', 'ネームプレート': 'display', '額縁': 'display', '写真': 'display',
  '封筒': 'envelope', '長3': 'envelope', '角2': 'envelope',
  '社内報': 'print-book', '機関誌': 'print-book', '報告書': 'print-book', '製本': 'print-book',
  'チラシ': 'print-sheet', 'ポスター': 'print-sheet', '表彰状': 'print-sheet', '年賀状': 'print-sheet',
  '物流': 'logistics-ops', '発送費': 'logistics-ops', '発送代行': 'logistics-ops',
  '送料': 'shipping-cost',
  '郵便': 'postage', '第三種': 'postage',
  '保管費': 'storage',
  '倉庫': 'warehouse', '在庫管理': 'warehouse',
  '原稿料': 'manuscript',
  'ホームページ': 'web-ops', '更新': 'web-ops', '管理費': 'web-ops',
  '発注サイト': 'system-fee'
};

export const BOOK_SIZES = ['A4', 'B5', 'A5', 'AB判', '四六判', '文庫', '新書', 'A3', 'カスタム'];
export const BINDING_OPTIONS = ['無線綴じ', '中綴じ', '上製本', '平綴じ', 'リング製本', 'なし（ペラ）'];
export const PAPER_TYPES = ['上質 70kg', '上質 90kg', 'コート 110kg', 'マットコート 110kg', 'アートポスト 180kg', '書籍用紙 72.5kg'];
export const COLOR_OPTIONS = ['本文モノクロ / 表紙カラー', '全ページフルカラー', '全ページモノクロ'];
export const SPECIAL_PROCESSING_OPTIONS = ['なし', 'PP加工（グロス）', 'PP加工（マット）', '箔押し', 'エンボス加工', '穴あけ', '折り加工'];
