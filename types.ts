

export type Page =
  | 'analysis_dashboard'
  | 'sales_leads'
  | 'sales_customers'
  | 'sales_pipeline'
  | 'sales_delivery'
  | 'sales_estimates'
  | 'sales_orders'
  | 'sales_billing'
  | 'analysis_ranking'
  | 'purchasing_orders'
  | 'purchasing_invoices'
  | 'purchasing_payments'
  | 'purchasing_suppliers'
  | 'inventory_management'
  | 'manufacturing_orders'
  | 'manufacturing_progress'
  | 'manufacturing_cost'
  | 'hr_attendance'
  | 'hr_man_hours'
  | 'hr_labor_cost'
  | 'hr_org_chart'
  | 'approval_list'
  | 'approval_form_expense'
  | 'approval_form_transport'
  | 'approval_form_leave'
  | 'approval_form_approval'
  | 'approval_form_daily'
  | 'approval_form_weekly'
  | 'report_other'
  | 'accounting_journal'
  | 'accounting_general_ledger'
  | 'accounting_trial_balance'
  | 'accounting_tax_summary'
  | 'accounting_period_closing'
  | 'accounting_business_plan'
  | 'business_support_proposal'
  | 'ai_business_consultant'
  | 'ai_market_research'
  | 'ai_live_chat'
  | 'ai_anything_analysis'
  | 'estimate_creation'
  | 'project_list'
  | 'project_creation'
  | 'admin_audit_log'
  | 'admin_journal_queue'
  | 'admin_user_management'
  | 'admin_route_management'
  | 'admin_master_management'
  | 'admin_bug_reports'
  | 'settings';

export type UUID = string;

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

export enum ProjectStatus {
  Draft = '下書き',
  New = '新規',
  InProgress = '進行中',
  Completed = '完了',
  Cancelled = 'キャンセル',
  Archived = 'アーカイブ済',
}

export enum BugReportStatus {
    Open = '未対応',
    InProgress = '対応中',
    Closed = '完了',
}


export interface Job {
  id: string;
  jobNumber: number;
  clientName: string; // Deprecate - use projectName/customerId for lookup
  title: string;
  status: JobStatus;
  dueDate: string;
  quantity: number;
  paperType: string;
  finishing: string;
  details: string;
  createdAt: string;
  price: number;
  variableCost: number;
  invoiceStatus: InvoiceStatus;
  invoicedAt?: string | null;
  paidAt?: string | null;
  readyToInvoice?: boolean;
  invoiceId?: string | null;
  manufacturingStatus?: ManufacturingStatus;
  projectId?: string; // New: Link to project
  projectName?: string; // New: Derived from project for convenience
  userId?: string;
  customerId?: string;
}

export interface JournalEntry {
  id: number;
  date: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: 'admin' | 'user';
  createdAt: string;
  canUseAnythingAnalysis?: boolean;
}

export interface EmployeeUser {
  id: string;
  name: string;
  department: string | null;
  title: string | null;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  canUseAnythingAnalysis?: boolean;
}

export interface Customer {
  id: string;
  customerCode?: string;
  customerName: string;
  customerNameKana?: string;
  representative?: string;
  phoneNumber?: string;
  address1?: string;
  companyContent?: string;
  annualSales?: string;
  employeesCount?: string;
  note?: string;
  infoSalesActivity?: string;
  infoRequirements?: string;
  infoHistory?: string;
  createdAt: string;
  postNo?: string;
  address2?: string;
  fax?: string;
  closingDay?: string;
  monthlyPlan?: string;
  payDay?: string;
  recoveryMethod?: string;
  userId?: string;
  name2?: string;
  websiteUrl?: string;
  zipCode?: string;
  foundationDate?: string;
  capital?: string;
  customerRank?: string;
  customerDivision?: string;
  salesType?: string;
  creditLimit?: string;
  payMoney?: string;
  bankName?: string;
  branchName?: string;
  accountNo?: string;
  salesUserCode?: string;
  startDate?: string;
  endDate?: string;
  drawingDate?: string;
  salesGoal?: string;
  infoSalesIdeas?: string;
  customerContactInfo?: string; // for mailto
  aiAnalysis?: CompanyAnalysis | null;
  isActive?: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface AISuggestions {
    title: string;
    quantity: number;
    paperType: string;
    finishing: string;
    details: string;
    price: number;
    variableCost: number;
}

export interface CompanyAnalysis {
    swot: string;
    painPointsAndNeeds: string;
    suggestedActions: string;
    proposalEmail: {
        subject: string;
        body: string;
    };
    sources?: { uri: string; title: string; }[];
}

export interface CompanyInvestigation {
    summary: string;
    sources: {
        uri: string;
        title: string;
    }[];
}

export interface InvoiceData {
    vendorName: string;
    invoiceDate: string;
    totalAmount: number;
    description: string;
    costType: 'V' | 'F';
    account: string;
    relatedCustomer?: string;
    project?: string;
    allocationDivision?: string;
}

export interface AIJournalSuggestion {
    account: string;
    description: string;
    debit: number;
    credit: number;
}

export interface ApplicationCode {
    id: string;
    code: string;
    name: string;
    description: string;
    createdAt: string;
}

export interface EstimateItem {
    division: '用紙代' | 'デザイン・DTP代' | '刷版代' | '印刷代' | '加工代' | 'その他' | '初期費用' | '月額費用';
    content: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    price: number; // calculated price
    cost: number;
    costRate: number;
    subtotal: number;
}

// NEW: Estimate creation specific types
export type PostalMethod = 'inhouse_print' | 'outsourced_label';
export type PostalStatus = 'preparing' | 'shipped' | 'delivered';
export type MailOpenStatus = 'opened' | 'unopened' | 'forwarded';

export interface TrackingInfo {
  trackId: UUID;
  mailStatus: MailOpenStatus;     // 🟢 opened / 🟡 unopened / 🔵 forwarded
  lastEventAt?: string;           // ISO8601
  firstOpenedAt?: string;         // ISO8601
  totalOpens: number;
  totalClicks: number;
}

export interface PostalInfo {
  method: PostalMethod;
  status: PostalStatus;
  toName: string;
  toCompany?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address1?: string;
  address2?: string;
  phone?: string;
  labelPreviewSvg?: string;       // 宛名ラベルSVG（プレビュー用）
}

export interface EstimateLineItem {
  id?: string;
  estimateId?: string;
  sku?: string;
  name: string;
  description?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  taxRate?: number; // 0.1 = 10%
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  sortIndex?: number;
}

export interface ExtractedParty {
  company?: string;
  department?: string;
  title?: string;
  person?: string;
  email?: string;
  tel?: string;
  address?: string;
  domain?: string;
  confidence?: number; // 0-1
}

export interface EstimateDraft {
  draftId: UUID;
  sourceSummary?: string; // 解析要約
  customerCandidates: ExtractedParty[];
  subjectCandidates: string[];
  paymentTerms?: string;
  deliveryTerms?: string;
  deliveryMethod?: string;
  currency: 'JPY';
  taxInclusive?: boolean;
  dueDate?: string; // ISO
  items: EstimateLineItem[];
  notes?: string;
}

export interface Estimate {
    id: UUID;
    estimateNumber: number; // Auto-generated display number
    customerName: string;
    title: string; // Subject for estimate
    items: EstimateLineItem[]; // Changed from EstimateItem[]
    // total: number; // Subtotal before tax - Removed as `subtotal` field exists
    deliveryDate: string;
    paymentTerms: string;
    deliveryTerms?: string; // Added from EstimateDraft
    deliveryMethod: string;
    notes: string;
    status: EstimateStatus;
    version: number;
    userId: string;
    user?: User;
    createdAt: string;
    updatedAt: string;
    projectId?: string; 
    projectName?: string;
    // NEW: Fields for tracking and postal
    subtotal: number; // Recalculated subtotal (no tax)
    taxTotal: number; // Recalculated tax total
    grandTotal: number; // Recalculated grand total (with tax)
    taxInclusive?: boolean; // Added for tax calculation logic
    pdfUrl?: string; // URL to the generated PDF
    tracking?: TrackingInfo;
    postal?: PostalInfo;
}

export interface ProjectAttachment {
  id: UUID;
  projectId: UUID;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  category: string;
  createdAt: string;
}

export interface Project {
  id: UUID;
  projectName: string;
  customerName: string;
  customerId?: string;
  status: ProjectStatus;
  overview: string; // AI generated summary
  extracted_details: string; // AI extracted key details
  createdAt: string;
  updatedAt: string;
  userId: string;
  attachments?: ProjectAttachment[];
  relatedEstimates?: Partial<Estimate>[];
  relatedJobs?: Partial<Job>[];
  isActive?: boolean;
}

export interface Lead {
    id: string;
    status: LeadStatus;
    createdAt: string; // 受信日時として利用
    name: string;
    email: string | null;
    phone: string | null;
    company: string;
    source: string | null;
    tags: string[] | null;
    message: string | null;
    updatedAt: string | null;
    referrer: string | null;
    referrerUrl: string | null;
    landingPageUrl: string | null;
    searchKeywords: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    deviceType: string | null;
    browserName: string | null;
    osName: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    employees: string | null;
    budget: string | null;
    timeline: string | null;
    inquiryType: string | null;
    inquiryTypes: string[] | null;
    infoSalesActivity: string | null;
    score?: number;
    aiAnalysisReport?: string;
    aiDraftProposal?: string;
    aiInvestigation?: CompanyInvestigation;
}

export interface ApprovalRoute {
    id: string;
    name: string;
    routeData: {
        steps: { approverId: string }[];
    };
    createdAt: string;
}

export interface Application {
    id: string;
    applicantId: string;
    applicationCodeId: string;
    formData: any;
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    currentLevel: number;
    approverId: string | null;
    rejectionReason: string | null;
    approvalRouteId: string;
    createdAt: string;
    updatedAt?: string | null;
}

export interface ApplicationWithDetails extends Application {
    applicant?: User;
    applicationCode?: ApplicationCode;
    approvalRoute?: ApprovalRoute;
}

export interface ApplicationNotificationRecipient {
    id: string;
    name: string;
    email: string;
}

export type ApplicationNotificationAudience = 'approval_route' | 'applicant';

export interface ApplicationNotificationEmail {
    id: string;
    applicationId: string;
    applicationCodeId: string;
    audience: ApplicationNotificationAudience;
    subject: string;
    body: string;
    recipients: ApplicationNotificationRecipient[];
    sentAt: string;
    status: Application['status'];
}

export interface Employee {
    id: string;
    name: string;
    department: string;
    title: string;
    hireDate: string;
    salary: number;
    createdAt: string;
}

export interface AccountItem {
    id: string;
    code: string;
    name: string;
    categoryCode: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    mqCode: MQCode;
}

export interface MQCode {
    p: string;
    v: string;
    m: string;
    q: string;
    f: string;
    g: string;
}

export interface PurchaseOrder {
    id: string;
    supplierName: string;
    itemName: string;
    orderDate: string;
    quantity: number;
    unitPrice: number;
    status: PurchaseOrderStatus;
}

export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
}

export interface BusinessPlan {
    name: string;
    headers: string[];
    items: {
        name: string;
        totalValue: number | string;
        data: {
            type: '目標' | '実績' | '前年';
            monthly: (number | string)[];
            cumulative: (number | string)[];
        }[];
    }[];
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}
  
export interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}

export interface LeadScore {
    score: number;
    rationale: string;
}

export interface BugReport {
  id: string;
  reporterName: string;
  reportType: 'bug' | 'improvement';
  summary: string;
  description: string;
  status: BugReportStatus;
  createdAt: string;
}

export interface ClosingChecklistItem {
    id: string;
    description: string;
    count: number;
    status: 'ok' | 'needs_review';
    actionPage?: Page;
}

export interface InvoiceItem {
    id: string;
    invoiceId: string;
    jobId?: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    sortIndex: number;
}

export interface Invoice {
    id: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate?: string;
    customerName: string;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    status: 'draft' | 'issued' | 'paid' | 'void';
    createdAt: string;
    paidAt?: string;
    items?: InvoiceItem[];
}

export enum InboxItemStatus {
  Processing = 'processing',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Error = 'error',
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

export interface MasterAccountItem {
  id: string;
  code: string;
  name: string;
  categoryCode: string | null;
}

export interface PaymentRecipient {
  id: string;
  recipientCode: string;
  companyName: string | null;
  recipientName: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: '普通' | '当座' | null;
  bankAccountNumber?: string | null;
  myNumber?: string | null;
  isActive?: boolean;
  allocationTargets?: { id: string; name: string }[];
}

export interface Department {
  id: string;
  name: string;
}

export interface CustomProposalContent {
  coverTitle: string;
  businessUnderstanding: string;
  challenges: string;
  proposal: string;
  conclusion: string;
}

export interface LeadProposalPackage {
  isSalesLead: boolean;
  reason: string;
  proposal?: CustomProposalContent;
  estimate?: EstimateItem[];
}

export interface AllocationDivision {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface Title {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface MarketResearchReport {
  title: string;
  summary: string;
  trends: string[];
  competitorAnalysis: string;
  opportunities: string[];
  threats: string[];
  sources?: { uri: string; title: string; }[];
}

export interface GeneratedEmailContent {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export interface EmailEnvelope {
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  subject: string;
  bodyText: string;    // 開封ピクセル/追跡URL付与前の本文
  bodyHtml?: string;   // 同上
  attachments?: { filename: string; url: string }[];
}

// New types for "Anything Analysis"
export interface AnalysisResult {
    title: string;
    summary: string;
    table: {
        headers: string[];
        rows: string[][];
    };
    chart: {
        type: 'bar' | 'line';
        data: { name: string; value: number }[];
    };
}

export interface AnalysisHistory {
    id: UUID;
    userId: UUID;
    viewpoint: string;
    dataSources: {
        filenames: string[];
        urls: string[];
    };
    result: AnalysisResult;
    createdAt: string;
}