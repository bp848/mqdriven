// Database-aligned Types for mqdriven ERP System
// Based on actual Supabase schema

export type Page =
  | 'sales_dashboard' | 'sales_leads' | 'sales_customers' | 'sales_pipeline'
  | 'sales_estimates' | 'sales_orders' | 'project_management' | 'sales_billing' | 'analysis_ranking'
  | 'purchasing_orders' | 'purchasing_invoices' | 'purchasing_payments'
  | 'inventory_management' | 'manufacturing_orders' | 'manufacturing_progress' | 'manufacturing_cost'
  | 'hr_attendance' | 'hr_man_hours' | 'hr_labor_cost'
  | 'approval_list' | 'approval_form_expense' | 'approval_form_transport' | 'approval_form_leave'
  | 'approval_form_approval' | 'approval_form_daily' | 'approval_form_weekly'
  | 'accounting_journal' | 'accounting_general_ledger' | 'accounting_trial_balance'
  | 'accounting_tax_summary' | 'accounting_period_closing' | 'accounting_business_plan'
  | 'ai_business_consultant'
  | 'ai_market_research'
  | 'admin_audit_log' | 'admin_journal_queue' | 'admin_user_management' | 'admin_route_management'
  | 'admin_master_management' | 'admin_bug_reports' | 'admin_action_console' | 'settings'
  | 'bulletin_board' | 'knowledge_base' | 'meeting_minutes' | 'my_schedule' | 'fax_ocr_intake'
  | 'accounting_dashboard' | 'accounting_journal_review'
  | 'accounting_payables' | 'accounting_receivables' | 'accounting_cash_schedule'
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
  | 'simple_estimates';

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

// Database-aligned interfaces
export interface User {
  id: string;
  name: string;
  email?: string;
  employee_number?: string;
  department_id?: string;
  position_id?: string;
  created_at: string;
  role: string;
  can_use_anything_analysis?: boolean;
  auth_user_id?: string;
  start_date?: string;
  end_date?: string;
  user_code?: string;
  is_active?: boolean;
}

export interface Customer {
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

export interface Lead {
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
  tags?: string;
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

export interface Estimate {
  id: string;
  estimates_id?: string;
  project_id?: string;
  pattern_no?: string;
  pattern_name?: string;
  delivery_place?: string;
  transaction_method?: string;
  expiration_date?: string;
  specification?: string;
  copies?: string;
  unit_price?: string;
  tax_rate?: string;
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
  subtotal?: string;
  consumption?: string;
  total?: string;
  valiable_cost?: string;
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

export interface EstimateItem {
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

export interface Project {
  id: string;
  project_code: string;
  customer_code: string;
  customer_id?: string;
  sales_user_code?: string;
  sales_user_id?: string;
  estimate_id?: string;
  estimate_code?: string;
  order_id?: string;
  order_code?: string;
  project_name: string;
  project_status: string;
  classification_id?: string;
  section_code_id?: string;
  product_class_id?: string;
  create_date: string;
  create_user_id?: string;
  create_user_code: string;
  update_date: string;
  update_user_id?: string;
  update_user_code?: string;
  project_id?: string;
  updated_at?: string;
  amount?: number;
  subamount?: number;
  total_cost?: number;
  delivery_date?: string;
  quantity?: string;
}

export interface Job {
  id: string;
  jobNumber: number;
  projectCode?: string | number | null;
  clientName: string;
  customerId?: string | null;
  customerCode?: string | null;
  title: string;
  status: JobStatus;
  dueDate: string;
  quantity: number;
  paperType: string;
  finishing: string;
  details: string;
  createdAt: string;
  updatedAt: string;
}

// Additional interfaces from database
export interface ApplicationCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApplicationWithDetails {
  id: string;
  application_code_id?: string;
  applicant_id?: string;
  applicant?: User;
  application_code?: ApplicationCode;
  status?: string;
  current_level?: number;
  approver_id?: string;
  rejection_reason?: string;
  approval_route_id?: string;
  created_at?: string;
  updated_at?: string;
  formData?: any;
}

export interface ApprovalRoute {
  id: string;
  name: string;
  route_data: any;
  created_at?: string;
  updated_at?: string;
}

export interface AccountItem {
  id: string;
  code: string;
  name: string;
  account_type: string;
  parent_id?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id?: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  order_date: string;
  expected_delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  description?: string;
  quantity_on_hand: number;
  reorder_level: number;
  unit_cost: number;
  location?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
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

export interface Department {
  id: string;
  name: string;
  parent_id?: string;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRecipient {
  id: string;
  name: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MasterAccountItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AllocationDivision {
  id: string;
  name: string;
  description?: string;
  allocation_rules?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Title {
  id: string;
  name: string;
  level?: number;
  department_id?: string;
  responsibilities?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectBudgetSummary {
  project_id: string;
  project_name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percentage: number;
  period: string;
}

export interface DailyReportPrefill {
  project_id?: string;
  work_description?: string;
  hours_worked?: number;
  tasks_completed?: string[];
  challenges?: string;
  next_day_plan?: string;
}

export interface Invoice {
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

// UI-specific types
export interface Toast {
  id?: string;
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

export interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: BugReportStatus;
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
export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status?: string;
  total_debit: number;
  total_credit: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit_amount?: number;
  credit_amount?: number;
  created_at?: string;
}

// Helper types
export type TabId = 'approvals' | 'drafts' | 'submitted' | 'completed';

export default types;
