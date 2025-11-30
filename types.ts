export type Page =
  | 'analysis_dashboard' | 'my_schedule'
  | 'sales_dashboard' | 'sales_leads' | 'sales_customers' | 'sales_pipeline'
  | 'sales_estimates' | 'sales_orders' | 'sales_billing' | 'fax_ocr_intake' | 'analysis_ranking'
  | 'purchasing_orders' | 'purchasing_invoices' | 'purchasing_payments'
  | 'inventory_management' | 'manufacturing_orders' | 'manufacturing_progress' | 'manufacturing_cost'
  | 'hr_attendance' | 'hr_man_hours' | 'hr_labor_cost'
  | 'approval_list' | 'approval_form_expense' | 'approval_form_transport' | 'approval_form_leave'
  | 'approval_form_approval' | 'approval_form_daily' | 'approval_form_weekly'
  | 'accounting_journal' | 'accounting_general_ledger' | 'accounting_trial_balance'
  | 'accounting_tax_summary' | 'accounting_period_closing' | 'accounting_business_plan'
  | 'business_support_proposal'
  | 'bulletin_board'
  | 'meeting_minutes'
  | 'ai_business_consultant'
  | 'ai_market_research'
  | 'admin_audit_log' | 'admin_journal_queue' | 'admin_user_management' | 'admin_route_management'
  | 'admin_master_management' | 'admin_action_console' | 'settings';

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
}

export interface MeetingSummary {
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
}

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


export interface Job {
  id: string;
  jobNumber: number;
  projectCode?: string | null;
  clientName: string;
  customerId?: string | null;
  customerCode?: string | null;
  totalQuantity?: number;
  totalAmount?: number;
  totalCost?: number;
  grossMargin?: number;
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
}

export interface JobOrderInput {
  orderDate: string;
  quantity: number;
  unitPrice: number;
}

export interface JobCreationPayload extends Omit<Job, 'id' | 'createdAt' | 'jobNumber'> {
  initialOrder: JobOrderInput;
}

export interface ProjectBudgetSummary extends Job {
  orderCount: number;
  orderTotalQuantity: number;
  orderTotalAmount: number;
  orderTotalCost: number;
  orders: PurchaseOrder[];
}

export interface ProjectBudgetFilter {
  startDate?: string;
  endDate?: string;
}

export enum ProjectStatus {
  Draft = 'Draft',
  New = 'New',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Archived = 'Archived',
}

export interface ProjectAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  category?: string;
}

export interface Project {
  id: string;
  projectName: string;
  customerName: string;
  overview?: string;
  extracted_details?: string;
  status: ProjectStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  attachments?: ProjectAttachment[];
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
}

export interface EmployeeUser {
  id: string;
  name: string;
  department: string | null;
  title: string | null;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface BulletinComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorDepartment?: string | null;
  body: string;
  createdAt: string;
}

export interface BulletinPost {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorDepartment?: string | null;
  tags?: string[];
  pinned?: boolean;
  assigneeIds?: string[];
  createdAt: string;
  updatedAt: string;
  comments?: BulletinComment[];
}

export type BulletinThread = BulletinPost & {
  comments: BulletinComment[];
};

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

export interface CustomerInfo {
  id: string;
  rank: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  introducer: string | null;
  introductionDetail: string | null;
  previousPerson: string | null;
  salesTrends: string | null;
  grossProfit: string | null;
  grossProfitByProduct: string | null;
  companyContent: string | null;
  keyPerson: string | null;
  orderRate: string | null;
  generalNewspaperCoverage: string | null;
  specialtyMagazineCoverage: string | null;
  industryNewspaperCoverage: string | null;
  chamberOfCommerce: string | null;
  correspondenceEducation: string | null;
  otherMedia: string | null;
  codeNo: string | null;
  businessResult: string | null;
  companyFeatures: string | null;
  customerTrends: string | null;
  incidents: string | null;
  competitors: string | null;
  competitorMeasures: string | null;
  salesTarget: string | null;
  businessSummary: string | null;
  externalItems: string | null;
  internalItems: string | null;
  quotationPoints: string | null;
  orderProcess: string | null;
  mainProducts: string | null;
  totalOrderAmount: string | null;
  needsAndIssues: string | null;
  competitorInfo: string | null;
  employeeCount: string | null;
  businessStartYear: string | null;
  creditLimit: string | null;
  personInCharge: string | null;
  closingDate: string | null;
  paymentDate: string | null;
  paymentTerms: string | null;
  companyName: string | null;
  address: string | null;
  representativeName: string | null;
  establishmentYear: string | null;
  capital: string | null;
  annualSales: string | null;
  keyPersonInfo: string | null;
  customerContactInfo: string | null;
  orgChart: string | null;
  pq: string | null;
  vq: string | null;
  mq: string | null;
  mRate: string | null;
  accidentHistory: string | null;
  customerVoice: string | null;
  annualActionPlan: string | null;
  lostOrders: string | null;
  growthPotential: string | null;
  requirements: string | null;
  other: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
    id: string;
    userId: string;
    viewpoint: string;
    createdAt: string;
    result: AnalysisResult;
}

export interface BankAccountInfo {
    bankName: string;
    branchName: string;
    accountType: string;
    accountNumber: string;
}

export interface OcrExpenseLine {
    lineDate?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    amountExclTax?: number;
    taxRate?: number;
    customerName?: string;
    projectName?: string;
}

export interface OcrExpenseDraft {
    supplierName?: string;
    registrationNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    totalGross?: number;
    totalNet?: number;
    taxAmount?: number;
    paymentRecipientId?: string;
    paymentRecipientName?: string;
    bankAccount?: Partial<BankAccountInfo>;
    lines?: OcrExpenseLine[];
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
    dueDate?: string;
    subtotalAmount?: number;
    taxAmount?: number;
    registrationNumber?: string;
    paymentRecipientName?: string;
    bankAccount?: Partial<BankAccountInfo>;
    lineItems?: OcrExpenseLine[];
    expenseDraft?: OcrExpenseDraft | null;
    matchedCustomerId?: string | null;
    matchedCustomerName?: string | null;
    matchedPaymentRecipientId?: string | null;
    matchedPaymentRecipientName?: string | null;
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
    price: number;
    cost: number;
    costRate: number;
    subtotal: number;
    name?: string;
    qty?: number;
    taxAmount?: number;
    total?: number;
}

export type EstimateLineItem = EstimateItem;

export interface Estimate {
    id: string;
    estimateNumber: number;
    customerName: string;
    title: string;
    items: EstimateItem[];
    total: number;
    deliveryDate: string;
    deliveryTerms?: string;
    paymentTerms: string;
    deliveryMethod: string;
    notes: string;
    status: EstimateStatus;
    version: number;
    userId: string;
    user?: User;
    createdAt: string;
    updatedAt: string;
    subtotal?: number;
    taxTotal?: number;
    grandTotal?: number;
}

export interface Lead {
    id: string;
    status: LeadStatus;
    createdAt: string;
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
    documentUrl?: string | null;
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

export interface ApplicationNotificationEmail {
    id: string;
    applicationId: string;
    subject: string;
    body: string;
    sentAt: string;
    recipient?: string;
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
    categoryCode: string | null;
    isActive?: boolean;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    mqCode?: Record<string, string>;
}

export interface PurchaseOrder {
    id: string;
    supplierName: string;
    paymentRecipientId?: string | null;
    itemName: string;
    projectId?: string | null;
    projectCode?: string | null;
    orderCode?: string | null;
    orderDate: string;
    quantity: number;
    unitPrice: number;
    amount?: number | null;
    subamount?: number | null;
    copies?: number | null;
    totalCost?: number | null;
    status: PurchaseOrderStatus;
    raw?: Record<string, any>;
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

export interface FaxIntake {
  id: string;
  uploadedBy: string;
  uploadedAt: string;
  filePath: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  fileUrl?: string;
  ocrStatus: 'pending' | 'processing' | 'done' | 'failed';
  ocrErrorMessage?: string | null;
  ocrRawText?: string | null;
  ocrJson?: any | null;
  docType: 'order' | 'estimate' | 'vendor_invoice' | 'unknown';
  sourceChannel: 'fax';
  linkedProjectId?: string | null;
  linkedOrderId?: string | null;
  linkedEstimateId?: string | null;
  status: 'draft' | 'ready' | 'linked' | 'deleted';
  notes?: string | null;
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
  phoneNumber?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  accountNumber?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  bankAccountType?: string | null;
  invoiceRegistrationNumber?: string | null;
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

export interface ScheduleItem {
    id: string;
    start: string;
    end: string;
    description: string;
}

export interface DailyReportData {
    reportDate: string;
    startTime: string;
    endTime: string;
    customerName: string;
    activityContent: string;
    nextDayPlan: string;
    pqGoal: string;
    pqCurrent: string;
    pqLastYear: string;
    mqGoal: string;
    mqCurrent: string;
    mqLastYear: string;
    planItems: ScheduleItem[];
    actualItems: ScheduleItem[];
    comments: string[];
}

export interface DailyReportPrefill extends Partial<DailyReportData> {
    id: string;
}
