export type Page =
  | 'analysis_dashboard' | 'sales_dashboard' | 'sales_leads' | 'sales_customers' | 'sales_pipeline'
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
  | 'bulletin_board' | 'meeting_minutes' | 'my_schedule' | 'fax_ocr_intake'
  | 'accounting_dashboard' | 'accounting_journal_review'
  | 'accounting_payables' | 'accounting_receivables' | 'accounting_cash_schedule'
  | 'accounting_approved_applications'
  | 'document_creation_tools'
  | 'proposal_ai'
  | 'pdf_editing_tools'
  | 'dtp_tools'
  | 'prompt_management';

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
  price: number;
  variableCost: number;
  totalQuantity?: number;
  totalAmount?: number;
  totalCost?: number;
  grossMargin?: number;
  invoiceStatus: InvoiceStatus;
  invoicedAt?: string | null;
  paidAt?: string | null;
  readyToInvoice?: boolean;
  invoiceId?: string | null;
  manufacturingStatus?: ManufacturingStatus;
}

export interface Project {
  id: string;
  projectCode: string | null;
  customerCode: string | null;
  customerId: string | null;
  salesUserCode: string | null;
  salesUserId: string | null;
  estimateId: string | null;
  estimateCode: string | null;
  orderId: string | null;
  orderCode: string | null;
  projectName: string;
  projectStatus: string | null;
  classificationId: string | null;
  sectionCodeId: string | null;
  productClassId: string | null;
  createDate: string | null;
  createUserId: string | null;
  createUserCode: string | null;
  updateDate: string | null;
  updateUserId: string | null;
  updateUserCode: string | null;
  projectId: string | null;
  updatedAt: string | null;
  amount: number | null;
  subamount: number | null;
  totalCost: number | null;
  deliveryDate: string | null;
  quantity: string | number | null;
  isActive?: boolean | null;
}

export interface JobCreationPayload {
  status: JobStatus;
  invoiceStatus: InvoiceStatus;
  manufacturingStatus: ManufacturingStatus;
  clientName: string;
  customerId: string | null;
  customerCode: string | null;
  title: string;
  quantity: number;
  paperType: string;
  finishing: string;
  details: string;
  dueDate: string;
  price: number;
  variableCost: number;
  initialOrder: {
    orderDate: string;
    quantity: number;
    unitPrice: number;
  };
}

export interface JournalEntry {
  id: number;
  date: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
}

export interface GeneralLedgerEntry {
  id: string;
  accountId?: string | null;
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  jobId?: string | null;
  voucherNo?: string | null;
  partner?: string | null;
  type?: string | null;
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
  isActive?: boolean | null;
}

export interface Customer {
  id: string;
  customerCode?: string;
  customerName: string;
  customerNameKana?: string;
  representative?: string;
  representativeTitle?: string | null;
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
  isActive?: boolean | null;
  businessEvent?: string | null; // 名刺取得イベントなど
  receivedByEmployeeCode?: string | null; // 名刺受領者（社員番号やID）
}

export interface BusinessCardContact {
  companyName?: string;
  personName?: string;
  personNameKana?: string;
  department?: string;
  title?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  faxNumber?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  websiteUrl?: string;
  notes?: string;
  recipientEmployeeCode?: string; // 名刺右上などに手書きされた受領者の社員番号
}

export interface BankAccountInfo {
  bankName?: string | null;
  branchName?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
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

export interface CalendarEvent {
    id: string;
    userId: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    allDay: boolean;
    source?: string | null;
    googleEventId?: string | null;
    updatedBySource?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
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
    invoiceNumber?: string | null;
    registrationNumber?: string | null;
    dueDate?: string | null;
    subtotalAmount?: number | null;
    taxAmount?: number | null;
    totalNet?: number | null;
    totalGross?: number | null;
    lineItems?: InvoiceItem[] | null;
    expenseDraft?: Record<string, any> | null;
    bankAccount?: BankAccountInfo | null;
    matchedPaymentRecipientId?: string | null;
    matchedCustomerId?: string | null;
    paymentRecipientName?: string | null;
    paymentRecipientId?: string | null;
    paymentRecipientCode?: string | null;
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

export interface Estimate {
    id: string;
    estimateNumber: number;
    customerName: string;
    title: string;
    displayName?: string | null;
    projectName?: string | null;
    items: EstimateItem[];
    total: number;
    deliveryDate: string;
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
    deliveryTerms?: string;
    projectId?: string | null;
    patternNo?: string | null;
    expirationDate?: string | null;
    taxRate?: number | null;
    consumption?: number | null;
    rawStatusCode?: string | null;
    copies?: number | null;
    unitPrice?: number | null;
    salesAmount?: number | null;
    variableCostAmount?: number | null;
    mqAmount?: number | null;
    mqRate?: number | null;
    mqMissingReason?: 'OK' | 'A' | 'B' | null;
    detailCount?: number | null;
    statusLabel?: string | null;
    raw?: Record<string, any>;
}

export interface EstimateDetail {
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
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    currentLevel: number;
    approverId: string | null;
    rejectionReason: string | null;
    approvalRouteId: string;
    createdAt: string;
    updatedAt?: string | null;
    documentUrl?: string | null;
}

export interface ApplicationWithDetails extends Application {
    applicant?: User;
    applicationCode?: ApplicationCode;
    approvalRoute?: ApprovalRoute;
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
  categoryCode?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  mqCode?: string | Record<string, any> | null;
}

export interface PurchaseOrder {
  id: string;
  supplierName: string;
  itemName: string;
  orderDate: string;
  quantity?: number;
  unitPrice?: number;
  status: PurchaseOrderStatus;
  projectCode?: string | null;
  projectId?: string | null;
  paymentRecipientId?: string | null;
  amount?: number | null;
  subamount?: number | null;
  totalCost?: number | null;
  raw?: Record<string, any>;
  orderCode?: string | null;
  copies?: number | null;
}

export interface ProjectBudgetFilter {
    startDate?: string;
    endDate?: string;
    status?: JobStatus;
    customerId?: string;
}

export interface ProjectBudgetSummary extends Job {
    totalQuantity: number;
    totalAmount: number;
    totalCost: number;
    grossMargin: number;
    orderCount: number;
    orderTotalQuantity: number;
    orderTotalAmount: number;
    orderTotalCost: number;
    orders: PurchaseOrder[];
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

export interface BulletinComment {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    authorDepartment: string | null;
    body: string;
    createdAt: string;
}

export interface BulletinThread {
    id: string;
    title: string;
    body: string;
    authorId: string;
    authorName: string;
    authorDepartment: string | null;
    tags: string[];
    assigneeIds: string[];
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    comments: BulletinComment[];
    dueDate?: string;
    isTask?: boolean;
    completed?: boolean;
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
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
    amountExclTax?: number;
    taxRate?: number;
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

export type FaxIntakeStatus = 'draft' | 'ready' | 'linked' | 'deleted';
export type FaxIntakeDocType = 'order' | 'estimate' | 'vendor_invoice' | 'unknown';
export type FaxIntakeOcrStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface FaxIntake {
    id: string;
    uploadedBy: string;
    uploadedAt: string;
    filePath: string;
    fileName: string;
    fileMimeType: string;
    fileSize: number;
    fileUrl?: string;
    ocrStatus: FaxIntakeOcrStatus;
    ocrErrorMessage?: string | null;
    ocrRawText?: string | null;
    ocrJson?: any;
    docType: FaxIntakeDocType;
    sourceChannel: string;
    linkedProjectId?: string | null;
    linkedOrderId?: string | null;
    linkedEstimateId?: string | null;
    status: FaxIntakeStatus;
    notes?: string | null;
}

export interface MasterAccountItem {
  id: string;
  code: string;
  name: string;
  categoryCode?: string | null;
}

export interface PaymentRecipient {
  id: string;
  recipientCode: string;
  companyName: string | null;
  recipientName: string | null;
  phoneNumber?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  accountNumber?: string | null;
  invoiceRegistrationNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
}

export type PayableStatus = 'outstanding' | 'partially_paid' | 'paid';
export type ReceivableStatus = 'outstanding' | 'partially_paid' | 'paid';

export interface PayableItem {
    id: string;
    supplier: string;
    category: string | null;
    amount: number;
    paidAmount: number;
    date: string;
    due: string;
    status: PayableStatus;
    method?: string | null;
    invoiceImage?: string | null;
    journalLineId?: string | null;
}

export interface ReceivableItem {
    id: string;
    customer: string;
    category: string | null;
    amount: number;
    paidAmount: number;
    date: string;
    due_date: string;
    status: ReceivableStatus;
    journalLineId?: string | null;
}

export interface CashScheduleData {
    date: string;
    opening_balance: number;
    inflows: number;
    outflows: number;
    closing_balance: number;
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

export interface DraftJournalEntry {
  batchId: string;
  entryId: string;
  source: string;
  date: string;
  description: string;
  status: 'draft' | 'posted';
  lines: {
    lineId: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }[];
  debitAccount?: string;
  debitAmount?: number;
  creditAccount?: string;
  creditAmount?: number;
  confidence?: number;
}

export interface ProposalFormData {
  purpose: string;
  referenceInfo: string;
  targetIndustry: string;
  customerName: string;
  salesRepName: string;
  pageCount: number;
  graphCount: number;
  imageCount: number;
  deepResearch: boolean;
}

export type ProposalGraphType = 'bar' | 'line' | 'pie';

export interface ProposalGraphDataPoint {
  name: string;
  value: number;
}

export interface ProposalSlideGraph {
  type: ProposalGraphType;
  dataDescription: string;
  data: ProposalGraphDataPoint[];
}

export interface ProposalSlideImage {
  description: string;
}

export interface ProposalSlide {
  title: string;
  content: string[];
  graph?: ProposalSlideGraph;
  image?: ProposalSlideImage;
  imageUrl?: string;
  evidence?: string;
  speakerNotes: string;
}

export interface ProposalPresentation {
  title: string;
  slides: ProposalSlide[];
}

export interface ProposalSource {
  title: string;
  uri: string;
}

export interface ProposalGenerationResult {
  presentation: ProposalPresentation;
  sources: ProposalSource[] | null;
}
