import { getSupabase } from './supabaseClient';
import { sendApprovalNotification, sendApprovalRouteCreatedNotification } from './notificationService';
import type { PostgrestError } from '@supabase/supabase-js';
import {
    EmployeeUser,
    Job,
    JobCreationPayload,
    JobStatus,
    Project,
    Customer,
    CustomerInfo,
    JournalEntry,
    User,
    AccountItem,
    Lead,
    ApprovalRoute,
    PurchaseOrder,
    InventoryItem,
    Toast,
    ConfirmationDialogProps,
    BugReport,
    Estimate,
    EstimateDetail,
    ApplicationWithDetails,
    Application,
    Invoice,
    InboxItem,
    InvoiceData,
    InboxItemStatus,
    ApplicationCode,
    BugReportStatus,
    ManufacturingStatus,
    InvoiceItem,
    EstimateStatus,
    MasterAccountItem,
    PaymentRecipient,
    Department,
    InvoiceStatus,
    LeadStatus,
    PurchaseOrderStatus,
    AllocationDivision,
    Title,
    FaxIntake,
    ProjectBudgetSummary,
    ProjectBudgetFilter,
    BulletinThread,
    BulletinComment,
    DraftJournalEntry,
    PayableItem,
    ReceivableItem,
    CashScheduleData,
    GeneralLedgerEntry,
} from '../types';
import type { CalendarEvent } from '../types';

type SupabaseClient = ReturnType<typeof getSupabase>;

const jobStatusValues = new Set<string>(Object.values(JobStatus));
const poStatusValues = new Set<string>(Object.values(PurchaseOrderStatus));

const mapProjectStatus = (status?: string | null): JobStatus => {
    if (status && jobStatusValues.has(status)) {
        return status as JobStatus;
    }
    return JobStatus.InProgress;
};

const mapOrderStatus = (status?: string | null): PurchaseOrderStatus => {
    if (status && poStatusValues.has(status)) {
        return status as PurchaseOrderStatus;
    }
    // Fallback to the standard “発注済” state so UI badges remain consistent.
    return PurchaseOrderStatus.Ordered;
};

const toNumberOrNull = (value: unknown): number | null => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const toStringOrNull = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const dbProjectToProject = (row: any): Project => ({
    id: row.id,
    projectCode: toStringOrNull(row.project_code),
    customerCode: toStringOrNull(row.customer_code),
    customerId: toStringOrNull(row.customer_id),
    salesUserCode: toStringOrNull(row.sales_user_code),
    salesUserId: toStringOrNull(row.sales_user_id),
    estimateId: toStringOrNull(row.estimate_id),
    estimateCode: toStringOrNull(row.estimate_code),
    orderId: toStringOrNull(row.order_id),
    orderCode: toStringOrNull(row.order_code),
    projectName: row.project_name ?? '',
    projectStatus: toStringOrNull(row.project_status ?? row.status),
    classificationId: toStringOrNull(row.classification_id),
    sectionCodeId: toStringOrNull(row.section_code_id),
    productClassId: toStringOrNull(row.product_class_id),
    createDate: row.create_date ?? row.created_at ?? null,
    createUserId: toStringOrNull(row.create_user_id),
    createUserCode: toStringOrNull(row.create_user_code),
    updateDate: row.update_date ?? null,
    updateUserId: toStringOrNull(row.update_user_id),
    updateUserCode: toStringOrNull(row.update_user_code),
    projectId: toStringOrNull(row.project_id),
    updatedAt: row.updated_at ?? null,
    amount: toNumberOrNull(row.amount),
    subamount: toNumberOrNull(row.subamount),
    totalCost: toNumberOrNull(row.total_cost),
    deliveryDate: row.delivery_date ?? row.due_date ?? null,
    quantity: row.quantity ?? null,
    isActive: row.is_active ?? null,
});

const resolveEnvValue = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        const value = (import.meta.env as Record<string, string | undefined>)[key];
        if (value !== undefined) return value;
    }
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        return process.env[key];
    }
    return undefined;
};

const getFaxOcrFunctionName = (): string =>
    resolveEnvValue('VITE_FAX_OCR_FUNCTION')
    || resolveEnvValue('FAX_OCR_FUNCTION')
    || 'fax-ocr-intake';
const getFaxOcrEndpoint = (): string | undefined =>
    resolveEnvValue('VITE_FAX_OCR_ENDPOINT')
    || resolveEnvValue('FAX_OCR_ENDPOINT');
const FAX_STORAGE_BUCKET =
    resolveEnvValue('VITE_FAX_INTAKE_BUCKET')
    || resolveEnvValue('FAX_INTAKE_BUCKET')
    || 'fax-intakes';

const normalizeLookupKey = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const key = String(value).trim();
    return key.length > 0 ? key : null;
};

const collectUniqueIds = (values: Array<string | null | undefined>): string[] => {
    const ids = new Set<string>();
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) ids.add(trimmed);
    }
    return Array.from(ids);
};

const mapDbBulletinComment = (row: any): BulletinComment => ({
    id: row.id,
    postId: row.thread_id || row.postId || row.post_id || '',
    authorId: row.author_id ?? row.user_id ?? '',
    authorName: row.author?.name ?? row.user?.name ?? row.author_name ?? '不明なユーザー',
    authorDepartment:
        row.author?.department ??
        row.author?.department_id ??
        row.user?.department ??
        row.user?.department_id ??
        row.author_department ??
        null,
    body: row.body ?? row.content ?? '',
    createdAt: row.created_at,
});

const mapDbBulletinThread = (row: any): BulletinThread => ({
    id: row.id,
    title: row.title ?? row.subject ?? '',
    body: row.body ?? row.content ?? '',
    authorId: row.author_id ?? row.created_by ?? '',
    authorName: row.author?.name ?? row.author_name ?? '不明なユーザー',
    authorDepartment:
        row.author?.department ??
        row.author?.department_id ??
        row.author_department ??
        null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    pinned: Boolean(row.pinned),
    assigneeIds: Array.isArray(row.assignee_ids)
        ? row.assignee_ids
        : Array.isArray(row.post_assignments)
            ? row.post_assignments.map((item: any) => item?.user_id).filter((id: any) => typeof id === 'string')
            : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: Array.isArray(row.comments)
        ? row.comments.map(mapDbBulletinComment)
        : Array.isArray(row.post_comments)
            ? row.post_comments.map(mapDbBulletinComment)
            : [],
    dueDate: row.due_date ?? null,
    isTask: row.is_task ?? false,
    completed: row.completed ?? false,
});

const BULLETIN_THREAD_SELECT = `
    *,
    author:author_id (
        id,
        name,
        department:department_id
    ),
    comments:bulletin_comments (
        id,
        thread_id,
        body,
        author_id,
        created_at,
        author:author_id (
            id,
            name,
            department:department_id
        )
    )
`;

const PAYMENT_RECIPIENT_SELECT = `
id,
recipient_code,
company_name,
recipient_name,
phone_number,
bank_name,
bank_branch,
branch_name,
account_type,
account_number,
bank_account_number,
account_holder
`;
const PAYMENT_RECIPIENT_LEGACY_SELECT = `
id,
recipient_code,
company_name,
recipient_name,
phone_number,
bank_name,
bank_branch,
bank_account_type,
bank_account_number
`;

const isMissingColumnError = (error?: PostgrestError | null) =>
    Boolean(error?.message && /column.+does not exist/i.test(error.message));

const mapDbPaymentRecipient = (record: any): PaymentRecipient => {
    const bankBranch = record.bank_branch ?? null;
    const accountNumber = record.bank_account_number ?? record.account_number ?? null;
    const accountType = record.bank_account_type ?? record.account_type ?? null;
    return {
        id: record.id,
        recipientCode: record.recipient_code,
        companyName: record.company_name,
        recipientName: record.recipient_name,
        phoneNumber: record.phone_number ?? null,
        bankName: record.bank_name ?? null,
        branchName: record.branch_name ?? record.bank_branch ?? null,
        accountNumber,
        bankBranch,
        bankAccountNumber: accountNumber,
        bankAccountType: accountType,
        invoiceRegistrationNumber: record.invoice_registration_number ?? null,
    };
};

const buildPaymentRecipientPayload = (item: Partial<PaymentRecipient>) => ({
    recipient_code: item.recipientCode,
    company_name: item.companyName,
    recipient_name: item.recipientName,
    phone_number: item.phoneNumber ?? null,
    bank_name: item.bankName ?? null,
    branch_name: item.branchName ?? item.bankBranch ?? null,
    bank_branch: item.bankBranch ?? item.branchName ?? null,
    account_type: item.bankAccountType ?? null,
    account_number: item.accountNumber ?? item.bankAccountNumber ?? null,
    bank_account_number: item.bankAccountNumber ?? item.accountNumber ?? null,
    account_holder: (item as any)?.accountHolder ?? item.recipientName ?? item.companyName ?? null,
});

const buildLegacyPaymentRecipientPayload = (item: Partial<PaymentRecipient>) => ({
    recipient_code: item.recipientCode,
    company_name: item.companyName,
    recipient_name: item.recipientName,
    phone_number: item.phoneNumber ?? null,
    bank_name: item.bankName ?? null,
    bank_branch: item.bankBranch ?? item.branchName ?? null,
    bank_account_type: item.bankAccountType ?? null,
    bank_account_number: item.bankAccountNumber ?? item.accountNumber ?? null,
});

// Mappers from snake_case (DB) to camelCase (JS)
const dbJobToJob = (project: any): Job => ({
    id: project.id,
    jobNumber: typeof project.project_code === 'number'
        ? project.project_code
        : parseInt(project.project_code, 10) || 0,
    projectCode: project.project_code ?? null,
    clientName: project.customer_name || project.client_name || project.customer_code || '',
    customerId: project.customer_id ?? null,
    customerCode: project.customer_code ?? null,
    title: project.project_name || project.title || '',
    status: mapProjectStatus(project.project_status || project.status),
    dueDate: project.delivery_date || project.due_date || '',
    quantity: Number(project.quantity ?? 0),
    paperType: project.paper_type || '',
    finishing: project.finishing || '',
    details: project.details || project.project_summary || '',
    createdAt: project.create_date || project.created_at || new Date().toISOString(),
    price: Number(project.amount ?? project.price ?? 0),
    variableCost: Number(project.variable_cost ?? project.subamount ?? 0),
    totalQuantity: Number(project.quantity ?? 0),
    totalAmount: Number(project.amount ?? project.price ?? 0),
    totalCost: Number(project.variable_cost ?? project.subamount ?? 0),
    grossMargin: Number(project.amount ?? project.price ?? 0) - Number(project.variable_cost ?? project.subamount ?? 0),
    invoiceStatus: project.invoice_status || InvoiceStatus.Uninvoiced,
    invoicedAt: project.invoiced_at ?? null,
    paidAt: project.paid_at ?? null,
    readyToInvoice: Boolean(project.ready_to_invoice),
    invoiceId: project.invoice_id ?? null,
    manufacturingStatus: project.manufacturing_status || ManufacturingStatus.OrderReceived,
});

const jobToDbJob = (job: Partial<Job>): any => {
    const row: Record<string, any> = {};
    if (job.jobNumber !== undefined) row.project_code = job.jobNumber;
    if (job.customerId !== undefined) row.customer_id = job.customerId;
    if (job.customerCode !== undefined) {
        row.customer_code = job.customerCode;
    } else if (job.clientName !== undefined) {
        row.customer_code = job.clientName;
    }
    if (job.title !== undefined) row.project_name = job.title;
    if (job.status !== undefined) row.project_status = job.status;
    if (job.createdAt) row.create_date = job.createdAt;
    if (job.dueDate) row.delivery_date = job.dueDate;
    if (job.quantity !== undefined) row.quantity = job.quantity;
    if (job.price !== undefined) row.amount = job.price;
    if (job.variableCost !== undefined) row.subamount = job.variableCost;
    return row;
};

const fetchNextProjectCode = async (supabase: SupabaseClient): Promise<number> => {
    const { data, error } = await supabase.rpc('next_project_code');
    if (!error && data !== null && data !== undefined) {
        const value =
            typeof data === 'object' && data !== null && 'project_code' in data
                ? Number((data as any).project_code)
                : Number(data);
        if (Number.isFinite(value)) return value;
    } else if (error) {
        console.warn('next_project_code RPC unavailable. Falling back to manual query.', error.message);
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
        .from('projects')
        .select('project_code')
        .order('project_code', { ascending: false })
        .limit(1);
    ensureSupabaseSuccess(fallbackError, 'Failed to determine next project code');
    const fallbackRow = Array.isArray(fallbackRows) && fallbackRows.length > 0 ? fallbackRows[0] : null;
    const currentMax = fallbackRow?.project_code ? Number(fallbackRow.project_code) : 0;
    const next = Number.isFinite(currentMax) ? currentMax + 1 : 1;
    return next;
};

const insertInitialOrder = async (
    supabase: SupabaseClient,
    projectCode: number | string,
    clientName: string,
    initialOrder: JobCreationPayload['initialOrder']
): Promise<void> => {
    const totalAmount = Number(initialOrder.unitPrice * initialOrder.quantity);
    const orderPayload: Record<string, any> = {
        client_custmer: clientName,
        project_code: String(projectCode),
        order_date: initialOrder.orderDate,
        quantity: initialOrder.quantity,
        amount: totalAmount,
        subamount: totalAmount,
        total_cost: totalAmount,
        approval_status1: PurchaseOrderStatus.Ordered,
    };
    const { error } = await supabase.from('orders').insert(orderPayload);
    if (error) {
        throw formatSupabaseError('Failed to create initial order for project', error);
    }
};

const dbOrderToPurchaseOrder = (order: any): PurchaseOrder => {
    const quantity = Number(order.quantity ?? order.copies ?? 0);
    const rawAmount = order.amount ?? order.subamount ?? order.total_amount ?? 0;
    const totalAmount = Number(rawAmount);
    const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;
    const projectCode = order.project_code || order.order_code || '';
    const normalizeNumber = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
    };

    return {
        id: order.id,
        supplierName: order.client_custmer || order.customer_name || '',
        paymentRecipientId: order.payment_recipient_id ?? null,
        itemName: projectCode,
        projectId: order.project_id ?? null,
        projectCode,
        orderCode: order.order_code ?? null,
        orderDate: order.order_date || order.create_date || '',
        quantity,
        unitPrice: Number(unitPrice ?? 0),
        amount: Number.isFinite(totalAmount) ? totalAmount : null,
        subamount: normalizeNumber(order.subamount ?? order.total_amount),
        copies: normalizeNumber(order.copies),
        totalCost: normalizeNumber(order.total_cost),
        status: mapOrderStatus(order.approval_status1 || order.status),
        raw: order,
    };
};

const dbCustomerToCustomer = (dbCustomer: any): Customer => ({
    id: dbCustomer.id,
    customerCode: dbCustomer.customer_code,
    customerName: dbCustomer.customer_name,
    customerNameKana: dbCustomer.customer_name_kana,
    representative: dbCustomer.representative ?? dbCustomer.representative_name ?? null,
    representativeTitle: dbCustomer.representative_title ?? null,
    phoneNumber: dbCustomer.phone_number,
    address1: dbCustomer.address_1,
    companyContent: dbCustomer.company_content,
    annualSales: dbCustomer.annual_sales,
    employeesCount: dbCustomer.employees_count,
    note: dbCustomer.note,
    infoSalesActivity: dbCustomer.info_sales_activity,
    infoRequirements: dbCustomer.info_requirements,
    infoHistory: dbCustomer.info_history,
    createdAt: dbCustomer.created_at,
    postNo: dbCustomer.post_no,
    address2: dbCustomer.address_2,
    fax: dbCustomer.fax,
    closingDay: dbCustomer.closing_day,
    monthlyPlan: dbCustomer.monthly_plan,
    payDay: dbCustomer.pay_day,
    recoveryMethod: dbCustomer.recovery_method,
    userId: dbCustomer.user_id,
    name2: dbCustomer.name2,
    websiteUrl: dbCustomer.website_url,
    zipCode: dbCustomer.zip_code,
    foundationDate: dbCustomer.foundation_date,
    capital: dbCustomer.capital,
    customerRank: dbCustomer.customer_rank,
    customerDivision: dbCustomer.customer_division,
    salesType: dbCustomer.sales_type,
    creditLimit: dbCustomer.credit_limit,
    payMoney: dbCustomer.pay_money,
    bankName: dbCustomer.bank_name,
    branchName: dbCustomer.branch_name,
    accountNo: dbCustomer.account_no,
    salesUserCode: dbCustomer.sales_user_code,
    startDate: dbCustomer.start_date,
    endDate: dbCustomer.end_date,
    drawingDate: dbCustomer.drawing_date,
    salesGoal: dbCustomer.sales_goal,
    infoSalesIdeas: dbCustomer.info_sales_ideas,
    customerContactInfo: dbCustomer.customer_contact_info,
    aiAnalysis: dbCustomer.ai_analysis,
    businessEvent: dbCustomer.business_event ?? null,
    receivedByEmployeeCode: dbCustomer.received_by_employee_code ?? null,
});

const CUSTOMER_FIELD_OVERRIDES: Partial<Record<keyof Customer, string>> = {
    address1: 'address_1',
    address2: 'address_2',
    representative: 'representative_name',
    representativeTitle: 'representative_title',
};

const IMMUTABLE_CUSTOMER_FIELDS: (keyof Customer)[] = ['id', 'createdAt'];

const customerToDbCustomer = (customer: Partial<Customer>): any => {
    const dbData: { [key: string]: any } = {};
    for (const key in customer) {
        const camelKey = key as keyof Customer;
        if (IMMUTABLE_CUSTOMER_FIELDS.includes(camelKey)) {
            continue;
        }
        if (camelKey === 'infoSalesActivity') continue;
        const snakeKey = CUSTOMER_FIELD_OVERRIDES[camelKey] ?? camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = customer[camelKey];
    }
    return dbData;
};

const dbCustomerInfoToCustomerInfo = (row: any): CustomerInfo => ({
    id: row.id,
    rank: row.rank ?? null,
    phoneNumber: row.phone_number ?? null,
    faxNumber: row.fax_number ?? null,
    introducer: row.introducer ?? null,
    introductionDetail: row.introduction_detail ?? null,
    previousPerson: row.previous_person ?? null,
    salesTrends: row.sales_trends ?? null,
    grossProfit: row.gross_profit ?? null,
    grossProfitByProduct: row.gross_profit_by_product ?? null,
    companyContent: row.company_content ?? null,
    keyPerson: row.key_person ?? null,
    orderRate: row.order_rate ?? null,
    generalNewspaperCoverage: row.general_newspaper_coverage ?? null,
    specialtyMagazineCoverage: row.specialty_magazine_coverage ?? null,
    industryNewspaperCoverage: row.industry_newspaper_coverage ?? null,
    chamberOfCommerce: row.chamber_of_commerce ?? null,
    correspondenceEducation: row.correspondence_education ?? null,
    otherMedia: row.other_media ?? null,
    codeNo: row.code_no ?? null,
    businessResult: row.business_result ?? null,
    companyFeatures: row.company_features ?? null,
    customerTrends: row.customer_trends ?? null,
    incidents: row.incidents ?? null,
    competitors: row.competitors ?? null,
    competitorMeasures: row.competitor_measures ?? null,
    salesTarget: row.sales_target ?? null,
    businessSummary: row.business_summary ?? null,
    externalItems: row.external_items ?? null,
    internalItems: row.internal_items ?? null,
    quotationPoints: row.quotation_points ?? null,
    orderProcess: row.order_process ?? null,
    mainProducts: row.main_products ?? null,
    totalOrderAmount: row.total_order_amount ?? null,
    needsAndIssues: row.needs_and_issues ?? null,
    competitorInfo: row.competitor_info ?? null,
    employeeCount: row.employee_count ?? null,
    businessStartYear: row.business_start_year ?? null,
    creditLimit: row.credit_limit ?? null,
    personInCharge: row.person_in_charge ?? null,
    closingDate: row.closing_date ?? null,
    paymentDate: row.payment_date ?? null,
    paymentTerms: row.payment_terms ?? null,
    companyName: row.company_name ?? null,
    address: row.address ?? null,
    representativeName: row.representative_name ?? null,
    establishmentYear: row.establishment_year ?? null,
    capital: row.capital ?? null,
    annualSales: row.annual_sales ?? null,
    keyPersonInfo: row.key_person_info ?? null,
    customerContactInfo: row.customer_contact_info ?? null,
    orgChart: row.org_chart ?? null,
    pq: row.pq ?? null,
    vq: row.vq ?? null,
    mq: row.mq ?? null,
    mRate: row.m_rate ?? null,
    accidentHistory: row.accident_history ?? null,
    customerVoice: row.customer_voice ?? null,
    annualActionPlan: row.annual_action_plan ?? null,
    lostOrders: row.lost_orders ?? null,
    growthPotential: row.growth_potential ?? null,
    requirements: row.requirements ?? null,
    other: row.other ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
});

const customerInfoToDbCustomerInfo = (info: Partial<CustomerInfo>): Record<string, any> => {
    const dbData: Record<string, any> = {};
    for (const key in info) {
        const camelKey = key as keyof CustomerInfo;
        if (camelKey === 'id' || camelKey === 'createdAt' || camelKey === 'updatedAt') continue;
        const value = info[camelKey];
        if (value === undefined) continue;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = value === '' ? null : value;
    }
    return dbData;
};

const ensureCustomerInfoRecord = async (supabase: SupabaseClient, customerId: string): Promise<CustomerInfo> => {
    if (!customerId) {
        throw new Error('Customer ID is required to load customer info');
    }
    const { data, error } = await supabase
        .from('customers_info')
        .select('*')
        .eq('id', customerId)
        .limit(1);
    ensureSupabaseSuccess(error, 'Failed to fetch customer info');
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (row) {
        return dbCustomerInfoToCustomerInfo(row);
    }
    const timestamp = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
        .from('customers_info')
        .insert({ id: customerId, created_at: timestamp, updated_at: timestamp })
        .select()
        .single();
    ensureSupabaseSuccess(insertError, 'Failed to initialize customer info');
    return dbCustomerInfoToCustomerInfo(inserted);
};

const parseJsonColumn = (value: any) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
};

const mapFaxIntakeFromDb = (row: any, publicUrl?: string): FaxIntake => ({
    id: row.id,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    filePath: row.file_path,
    fileName: row.file_name,
    fileMimeType: row.file_mime_type,
    fileSize: Number(row.file_size ?? 0),
    fileUrl: publicUrl,
    ocrStatus: (row.ocr_status ?? 'pending') as FaxIntake['ocrStatus'],
    ocrErrorMessage: row.ocr_error_message,
    ocrRawText: row.ocr_raw_text,
    ocrJson: parseJsonColumn(row.ocr_json),
    docType: (row.doc_type ?? 'unknown') as FaxIntake['docType'],
    sourceChannel: 'fax',
    linkedProjectId: row.linked_project_id,
    linkedOrderId: row.linked_order_id,
    linkedEstimateId: row.linked_estimate_id,
    status: (row.status ?? 'draft') as FaxIntake['status'],
    notes: row.notes,
});

const buildFaxIntakeUpdates = (
    changes: Partial<{
        docType: FaxIntake['docType'];
        notes: string | null;
        linkedProjectId: string | null;
        linkedOrderId: string | null;
        linkedEstimateId: string | null;
        status: FaxIntake['status'];
        ocrStatus: FaxIntake['ocrStatus'];
        ocrRawText: string | null;
        ocrJson: any | null;
        ocrErrorMessage: string | null;
    }>
): Record<string, any> => {
    const updates: Record<string, any> = {};
    if (changes.docType !== undefined) updates.doc_type = changes.docType;
    if (changes.notes !== undefined) updates.notes = changes.notes ?? null;
    if (changes.linkedProjectId !== undefined) updates.linked_project_id = changes.linkedProjectId;
    if (changes.linkedOrderId !== undefined) updates.linked_order_id = changes.linkedOrderId;
    if (changes.linkedEstimateId !== undefined) updates.linked_estimate_id = changes.linkedEstimateId;
    if (changes.status !== undefined) updates.status = changes.status;
    if (changes.ocrStatus !== undefined) updates.ocr_status = changes.ocrStatus;
    if (changes.ocrRawText !== undefined) updates.ocr_raw_text = changes.ocrRawText;
    if (changes.ocrJson !== undefined) updates.ocr_json = changes.ocrJson ?? null;
    if (changes.ocrErrorMessage !== undefined) updates.ocr_error_message = changes.ocrErrorMessage;
    return updates;
};

type FaxIntakeUpdateChanges = Parameters<typeof buildFaxIntakeUpdates>[0];

const dbLeadToLead = (dbLead: any): Lead => {
    let aiInvestigation: any = undefined;

    if (dbLead.ai_investigation) {
        let raw = dbLead.ai_investigation as any;
        // ai_investigation が JSON 文字列として保存されている場合も考慮
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw);
            } catch {
                raw = null;
            }
        }

        if (raw && typeof raw === 'object') {
            aiInvestigation = {
                summary: raw.summary,
                sources: Array.isArray(raw.sources) ? raw.sources : [],
            };
        }
    }

    return {
        id: dbLead.id,
        status: dbLead.status,
        createdAt: dbLead.created_at,
        name: dbLead.name,
        email: dbLead.email,
        phone: dbLead.phone,
        company: dbLead.company,
        source: dbLead.source,
        tags: dbLead.tags,
        message: dbLead.message,
        updatedAt: dbLead.updated_at,
        referrer: dbLead.referrer,
        referrerUrl: dbLead.referrer_url,
        landingPageUrl: dbLead.landing_page_url,
        searchKeywords: dbLead.search_keywords,
        utmSource: dbLead.utm_source,
        utmMedium: dbLead.utm_medium,
        utmCampaign: dbLead.utm_campaign,
        utmTerm: dbLead.utm_term,
        utmContent: dbLead.utm_content,
        userAgent: dbLead.user_agent,
        ipAddress: dbLead.ip_address,
        deviceType: dbLead.device_type,
        browserName: dbLead.browser_name,
        osName: dbLead.os_name,
        country: dbLead.country,
        city: dbLead.city,
        region: dbLead.region,
        employees: dbLead.employees,
        budget: dbLead.budget,
        timeline: dbLead.timeline,
        inquiryType: dbLead.inquiry_type,
        inquiryTypes: dbLead.inquiry_types,
        infoSalesActivity: dbLead.info_sales_activity,
        score: dbLead.score,
        aiAnalysisReport: dbLead.ai_analysis_report,
        aiDraftProposal: dbLead.ai_draft_proposal,
        aiInvestigation,
    };
};

const leadToDbLead = (lead: Partial<Lead>): any => {
    const dbData: { [key: string]: any } = {};
    for (const key in lead) {
        const camelKey = key as keyof Lead;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = lead[camelKey];
    }
    return dbData;
};

const dbBugReportToBugReport = (dbReport: any): BugReport => ({
    id: dbReport.id,
    reporterName: dbReport.reporter_name,
    reportType: dbReport.report_type,
    summary: dbReport.summary,
    description: dbReport.description,
    status: dbReport.status,
    createdAt: dbReport.created_at,
});

const bugReportToDbBugReport = (report: Partial<BugReport>): any => ({
    reporter_name: report.reporterName,
    report_type: report.reportType,
    summary: report.summary,
    description: report.description,
    status: report.status,
});

const dbApplicationCodeToApplicationCode = (d: any): ApplicationCode => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    createdAt: d.created_at,
});

const dbApplicationToApplication = (app: any): Application => ({
    id: app.id,
    applicantId: app.applicant_id,
    applicationCodeId: app.application_code_id,
    formData: app.form_data,
    documentUrl: app.document_url ?? app.form_data?.documentUrl ?? null,
    status: app.status,
    submittedAt: app.submitted_at,
    approvedAt: app.approved_at,
    rejectedAt: app.rejected_at,
    currentLevel: typeof app.current_level === 'number' ? app.current_level : (app.current_level ? Number(app.current_level) : 0),
    approverId: app.approver_id,
    rejectionReason: app.rejection_reason,
    approvalRouteId: app.approval_route_id || '',
    createdAt: app.created_at,
    updatedAt: app.updated_at,
});

const dbApprovalRouteToApprovalRoute = (d: any): ApprovalRoute => ({
    id: d.id,
    name: d.name,
    routeData: {
        steps: (d.route_data?.steps || []).map((s: any) => ({
            approverId: s.approver_id,
        })),
    },
    createdAt: d.created_at,
});

const dbApplicationDraftToApplication = (draft: any): Application => ({
    id: draft.id,
    applicantId: draft.applicant_id,
    applicationCodeId: draft.application_code_id,
    formData: draft.form_data,
    documentUrl: draft.form_data?.documentUrl ?? null,
    status: 'draft',
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    currentLevel: 0,
    approverId: null,
    rejectionReason: null,
    approvalRouteId: draft.approval_route_id || '',
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
});

const fetchApplicationCodesByIds = async (
    supabase: SupabaseClient,
    ids: string[],
): Promise<Map<string, ApplicationCode>> => {
    const map = new Map<string, ApplicationCode>();
    if (ids.length === 0) return map;

    const { data, error } = await supabase.from('application_codes').select('*').in('id', ids);
    if (error) {
        console.warn('Failed to fetch application codes for drafts', error);
        return map;
    }

    (data || []).forEach((row: any) => {
        if (row?.id) {
            map.set(row.id, dbApplicationCodeToApplicationCode(row));
        }
    });
    return map;
};

const fetchApprovalRoutesByIds = async (
    supabase: SupabaseClient,
    ids: string[],
): Promise<Map<string, ApprovalRoute>> => {
    const map = new Map<string, ApprovalRoute>();
    if (ids.length === 0) return map;

    const { data, error } = await supabase.from('approval_routes').select('*').in('id', ids);
    if (error) {
        console.warn('Failed to fetch approval routes for drafts', error);
        return map;
    }

    (data || []).forEach((row: any) => {
        if (row?.id) {
            map.set(row.id, dbApprovalRouteToApprovalRoute(row));
        }
    });

    return map;
};

const extractApproverIdsFromRoute = (route?: ApprovalRoute): string[] => {
    if (!route?.routeData?.steps?.length) return [];
    return route.routeData.steps
        .map(step => step.approverId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
};

const fetchRouteApproverIds = async (supabase: SupabaseClient, routeId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('approval_routes')
        .select('route_data')
        .eq('id', routeId)
        .single();
    ensureSupabaseSuccess(error, 'Failed to fetch approval route definition');
    const steps = data?.route_data?.steps || [];
    return steps
        .map((step: any) => step?.approver_id ?? step?.approverId)
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
};

const resolveApprovalRouteApprovers = async (supabase: SupabaseClient, app: ApplicationWithDetails): Promise<string[]> => {
    const inline = extractApproverIdsFromRoute(app.approvalRoute);
    if (inline.length) return inline;
    if (!app.approvalRouteId) return [];
    return fetchRouteApproverIds(supabase, app.approvalRouteId);
};


export const isSupabaseUnavailableError = (error: any): boolean => {
    if (!error) return false;
    const message = typeof error === 'string' ? error : error.message || error.details || error.error_description;
    if (!message) return false;
    return /fetch failed/i.test(message) || /failed to fetch/i.test(message) || /network/i.test(message);
};

const formatSupabaseError = (context: string, error?: PostgrestError | null): Error => {
    if (!error) return new Error(context);
    const codePart = error.code ? `[${error.code}] ` : '';
    const detailsPart = error.details ? ` ${error.details}` : '';
    const hintPart = error.hint ? ` ${error.hint}` : '';
    const message = error.message || JSON.stringify(error);
    return new Error(`${context}: ${codePart}${message}${detailsPart}${hintPart}`.trim());
};

const ensureSupabaseSuccess = (error: PostgrestError | null, context: string): void => {
    if (error) {
        throw formatSupabaseError(context, error);
    }
};

// --- Data Service Functions ---

export const getProjects = async (): Promise<Project[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('update_date', { ascending: false })
        .order('project_code', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch projects');
    return (data || []).map(dbProjectToProject);
};

export const getJobs = async (): Promise<Job[]> => {
    const supabase = getSupabase();
    const [
        { data: projectRows, error: projectError },
        { data: customerRows, error: customerError },
    ] = await Promise.all([
        supabase.from('projects').select('*').order('project_code', { ascending: false }),
        supabase.from('customers').select('id, customer_code, customer_name'),
    ]);

    if (projectError) throw formatSupabaseError('Failed to fetch jobs', projectError);
    if (customerError) console.warn('Failed to fetch customers for job mapping:', customerError.message);

    const customerById = new Map<string, { customer_name: string; customer_code: string | null }>();
    const customerByCode = new Map<string, { customer_name: string; customer_code: string | null }>();
    (customerRows || []).forEach(customer => {
        const idKey = normalizeLookupKey(customer.id);
        const codeKey = normalizeLookupKey(customer.customer_code);
        if (!idKey && !codeKey) return;
        const payload = {
            customer_name: customer.customer_name,
            customer_code: codeKey,
        };
        if (idKey) {
            customerById.set(idKey, payload);
        }
        if (codeKey) {
            customerByCode.set(codeKey, payload);
        }
    });

    return (projectRows || []).map(project => {
        const baseJob = dbJobToJob(project);
        const projectCustomerId = normalizeLookupKey(project.customer_id);
        const projectCustomerCode = normalizeLookupKey(project.customer_code);
        const customerInfo =
            (projectCustomerId && customerById.get(projectCustomerId)) ||
            (projectCustomerCode && customerByCode.get(projectCustomerCode)) ||
            null;

        return {
            ...baseJob,
            clientName: customerInfo?.customer_name || baseJob.clientName,
            customerCode: customerInfo?.customer_code || baseJob.customerCode,
        };
    });
};

const fetchPurchaseOrdersWithFilters = async (filters: ProjectBudgetFilter = {}): Promise<PurchaseOrder[]> => {
    const supabase = getSupabase();
    let query = supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });

    if (filters.startDate) {
        query = query.gte('order_date', filters.startDate);
    }
    if (filters.endDate) {
        query = query.lte('order_date', filters.endDate);
    }

    const { data, error } = await query;
    ensureSupabaseSuccess(error, 'Failed to fetch purchase orders');
    return (data || []).map(dbOrderToPurchaseOrder);
};

const normalizeProjectKey = (job: Job): string | null => {
    if (job.projectCode) return String(job.projectCode);
    if (job.jobNumber) return String(job.jobNumber);
    return null;
};

const toNumberOrZero = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const refreshProjectFinancialTotals = async (
    supabase: SupabaseClient,
    projectCode: string | number,
): Promise<void> => {
    const { data: orderRows, error: ordersError } = await supabase
        .from('orders')
        .select('quantity, amount, subamount, total_cost, approval_status1')
        .eq('project_code', String(projectCode));
    ensureSupabaseSuccess(ordersError, 'Failed to load orders for project financial sync');

    const totals = (orderRows || []).reduce(
        (agg, order) => {
            if (order.approval_status1 === PurchaseOrderStatus.Cancelled) {
                return agg;
            }
            agg.quantity += toNumberOrZero(order.quantity);
            agg.amount += toNumberOrZero(order.amount ?? order.total_cost ?? order.subamount);
            agg.cost += toNumberOrZero(order.total_cost ?? order.subamount ?? order.amount);
            return agg;
        },
        { quantity: 0, amount: 0, cost: 0 },
    );

    const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
            quantity: totals.quantity,
            amount: totals.amount,
            subamount: totals.cost,
            total_cost: totals.cost,
        })
        .eq('project_code', String(projectCode));
    ensureSupabaseSuccess(projectUpdateError, 'Failed to sync project financial totals');
};

export const getProjectBudgetSummaries = async (filters: ProjectBudgetFilter = {}): Promise<ProjectBudgetSummary[]> => {
    const supabase = getSupabase();
    const [jobs, purchaseOrders] = await Promise.all([
        getJobs(),
        fetchPurchaseOrdersWithFilters(filters),
    ]);

    const ordersByProject = purchaseOrders.reduce<Map<string, PurchaseOrder[]>>((acc, order) => {
        if (order.status === PurchaseOrderStatus.Cancelled) return acc;
        const key = normalizeLookupKey(order.projectCode) || normalizeLookupKey(order.itemName);
        if (!key) return acc;
        if (!acc.has(key)) {
            acc.set(key, []);
        }
        acc.get(key)!.push(order);
        return acc;
    }, new Map());

    const summaries: ProjectBudgetSummary[] = [];
    const syncPayloads: Array<{ id: string; data: Record<string, any> }> = [];

    jobs.forEach(job => {
        const projectKey = normalizeProjectKey(job);
        const relatedOrders = projectKey ? ordersByProject.get(projectKey) ?? [] : [];
        const totals = relatedOrders.reduce(
            (agg, order) => {
                const quantity = toNumberOrZero(order.quantity);
                const unitPrice = toNumberOrZero(order.unitPrice);
                const revenueSource = order.amount ?? order.subamount ?? unitPrice * quantity;
                const costSource = order.totalCost ?? order.subamount ?? order.amount;
                agg.quantity += quantity;
                agg.revenue += toNumberOrZero(revenueSource);
                agg.cost += toNumberOrZero(costSource);
                return agg;
            },
            { quantity: 0, revenue: 0, cost: 0 }
        );

        const totalQuantity = totals.quantity || job.totalQuantity || job.quantity || 0;
        const totalAmount = totals.revenue || job.totalAmount || job.price || 0;
        const totalCost = totals.cost || job.totalCost || job.variableCost || 0;
        const grossMargin = totalAmount - totalCost;

        const summary: ProjectBudgetSummary = {
            ...job,
            totalQuantity,
            totalAmount,
            totalCost,
            grossMargin,
            orderCount: relatedOrders.length,
            orderTotalQuantity: totals.quantity,
            orderTotalAmount: totals.revenue,
            orderTotalCost: totals.cost,
            orders: relatedOrders,
        };

        summaries.push(summary);

        const projectTotalsOutOfSync =
            Math.abs((job.totalQuantity ?? 0) - totalQuantity) >= 1 ||
            Math.abs((job.totalAmount ?? 0) - totalAmount) >= 1 ||
            Math.abs((job.totalCost ?? 0) - totalCost) >= 1;

        if (projectTotalsOutOfSync && job.id) {
            syncPayloads.push({
                id: job.id,
                data: {
                    quantity: totalQuantity,
                    amount: totalAmount,
                    subamount: totalCost,
                    total_cost: totalCost,
                },
            });
        }
    });

    if (syncPayloads.length) {
        await Promise.all(
            syncPayloads.map(payload =>
                supabase.from('projects').update(payload.data).eq('id', payload.id),
            ),
        );
    }

    return summaries;
};

export const getJobsWithAggregation = async (): Promise<Job[]> => {
    return getProjectBudgetSummaries();
};

export const addJob = async (jobData: JobCreationPayload): Promise<Job> => {
    const supabase = getSupabase();
    const projectCode = await fetchNextProjectCode(supabase);
    const payload = { ...jobData, jobNumber: projectCode, createdAt: new Date().toISOString() };
    const dbJob = jobToDbJob(payload);
    const { data, error } = await supabase.from('projects').insert(dbJob).select().single();
    ensureSupabaseSuccess(error, 'Failed to add job');

    try {
        await insertInitialOrder(supabase, projectCode, jobData.clientName, jobData.initialOrder);
        await refreshProjectFinancialTotals(supabase, projectCode);
    } catch (orderError) {
        // Attempt to keep data consistent by removing the orphaned project.
        await supabase.from('projects').delete().eq('id', data?.id);
        throw orderError;
    }

    return dbJobToJob(data);
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('projects').update(jobToDbJob(updates)).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update job');
    return dbJobToJob(data);
};

export const deleteJob = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to delete job');
};

export const getCustomers = async (): Promise<Customer[]> => {
    const supabase = getSupabase();
    // 新しいものを上に表示するため created_at 降順で取得
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch customers');
    const customers = (data || []).map(dbCustomerToCustomer);
    console.log('[dataService] customers fetched', { count: customers.length });
    return customers;
};

export const addCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
    const supabase = getSupabase();
    const payload: Partial<Customer> = {
        ...customerData,
        createdAt: customerData.createdAt ?? new Date().toISOString(),
    };
    const { data, error } = await supabase
        .from('customers')
        .insert(customerToDbCustomer(payload))
        .select()
        .single();
    ensureSupabaseSuccess(error, 'Failed to add customer');
    return dbCustomerToCustomer(data);
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('customers').update(customerToDbCustomer(updates)).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update customer');
    return dbCustomerToCustomer(data);
};

export const getCustomerInfo = async (customerId: string): Promise<CustomerInfo> => {
    const supabase = getSupabase();
    return ensureCustomerInfoRecord(supabase, customerId);
};

export const saveCustomerInfo = async (customerId: string, updates: Partial<CustomerInfo>): Promise<CustomerInfo> => {
    if (!customerId) {
        throw new Error('Customer ID is required to save customer info');
    }
    const supabase = getSupabase();
    await ensureCustomerInfoRecord(supabase, customerId);
    const payload = customerInfoToDbCustomerInfo(updates);
    const { data, error } = await supabase
        .from('customers_info')
        .update(payload)
        .eq('id', customerId)
        .select()
        .single();
    ensureSupabaseSuccess(error, 'Failed to update customer info');
    return dbCustomerInfoToCustomerInfo(data);
};


export const getJournalEntries = async (): Promise<JournalEntry[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch journal entries');
    return data || [];
};

export const addJournalEntry = async (entryData: Omit<JournalEntry, 'id'|'date'>): Promise<JournalEntry> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('journal_entries').insert(entryData).select().single();
    ensureSupabaseSuccess(error, 'Failed to add journal entry');
    return data;
};

const fetchUsersDirectly = async (supabase: SupabaseClient): Promise<EmployeeUser[]> => {
    const [
        { data: userRows, error: userError },
        { data: departmentRows, error: departmentError },
        { data: titleRows, error: titleError },
    ] = await Promise.all([
        supabase
            .from('users')
            .select('id, name, email, role, created_at, department_id, position_id, is_active')
            .order('name', { ascending: true }),
        supabase.from('departments').select('id, name'),
        supabase.from('employee_titles').select('id, name'),
    ]);

    if (userError) throw formatSupabaseError('Failed to fetch users', userError);
    if (departmentError) console.warn('Failed to fetch departments for user mapping:', departmentError.message);
    if (titleError) console.warn('Failed to fetch titles for user mapping:', titleError.message);

    const departmentMap = new Map<string, string>();
    (departmentRows || []).forEach((dept: any) => {
        if (dept?.id) {
            departmentMap.set(dept.id, dept.name || '');
        }
    });

    const titleMap = new Map<string, string>();
    (titleRows || []).forEach((title: any) => {
        if (title?.id) {
            titleMap.set(title.id, title.name || '');
        }
    });

    return (userRows || []).map((user: any) => {
        const role: 'admin' | 'user' = user.role === 'admin' ? 'admin' : 'user';
        const departmentName = user.department_id ? departmentMap.get(user.department_id) || null : null;
        const titleName = user.position_id ? titleMap.get(user.position_id) || null : null;

        return {
            id: user.id,
            name: user.name || '（未設定）',
            department: departmentName,
            title: titleName,
            email: user.email || '',
            role,
            createdAt: user.created_at,
            isActive: user.is_active === null || user.is_active === undefined ? true : Boolean(user.is_active),
        };
    });
};

export async function getUsers(): Promise<EmployeeUser[]> {
    const supabase = getSupabase();
    try {
        return await fetchUsersDirectly(supabase);
    } catch (error: any) {
        if (isSupabaseUnavailableError(error)) {
            throw new Error('Failed to fetch users: network error communicating with the database.');
        }
        throw error;
    }
}

export const addUser = async (userData: { name: string, email: string | null, role: 'admin' | 'user', isActive?: boolean }): Promise<void> => {
    const supabase = getSupabase();
    const basePayload: Record<string, any> = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
    };
    const payloadWithIsActive = {
        ...basePayload,
        is_active: userData.isActive ?? true,
    };

    const { error } = await supabase.from('users').insert(payloadWithIsActive);
    if (error) {
        if (isMissingColumnError(error)) {
            const { error: retryError } = await supabase.from('users').insert(basePayload);
            if (retryError) {
                throw formatSupabaseError('Failed to add user (user must exist in auth.users)', retryError);
            }
            return;
        }
        throw formatSupabaseError('Failed to add user (user must exist in auth.users)', error);
    }
};

export const updateUser = async (id: string, updates: Partial<EmployeeUser>): Promise<void> => {
    const supabase = getSupabase();
    const basePayload: Record<string, any> = {
        name: updates.name,
        email: updates.email,
        role: updates.role,
    };
    if (updates.isActive !== undefined) {
        (basePayload as any).is_active = updates.isActive;
    }

    const { error: userError } = await supabase.from('users').update(basePayload).eq('id', id);
    if (userError) throw formatSupabaseError('Failed to update user', userError);
};

export const deleteUser = async (userId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('users').delete().eq('id', userId);
    ensureSupabaseSuccess(error, 'Failed to delete user');
};

export const getLeads = async (): Promise<Lead[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch leads');
    return (data || []).map(dbLeadToLead);
};

export const addLead = async (leadData: Partial<Lead>): Promise<Lead> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('leads').insert(leadToDbLead(leadData)).select().single();
    ensureSupabaseSuccess(error, 'Failed to add lead');
    return dbLeadToLead(data);
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const supabase = getSupabase();
    const { updatedAt, ...restOfUpdates } = updates;
    const { data, error } = await supabase.from('leads').update(leadToDbLead(restOfUpdates)).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update lead');
    return dbLeadToLead(data);
};

export const deleteLead = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('leads').delete().eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to delete lead');
};

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('approval_routes').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch approval routes');
    return (data || []).map(dbApprovalRouteToApprovalRoute);
};
export const addApprovalRoute = async (routeData: any): Promise<ApprovalRoute> => {
    const supabase = getSupabase();
    const steps = (routeData.routeData?.steps ?? []).map((s: any) => ({ approver_id: s.approverId }));
    const dbRouteData = { name: routeData.name, route_data: { steps } };
    const { data, error } = await supabase.from('approval_routes').insert(dbRouteData).select().single();
    ensureSupabaseSuccess(error, 'Failed to add approval route');
    const createdRoute = dbApprovalRouteToApprovalRoute(data);
    try {
        await sendApprovalRouteCreatedNotification(createdRoute);
    } catch (notificationError) {
        console.warn('Failed to send approval route notification', notificationError);
    }
    return createdRoute;
};
export const updateApprovalRoute = async (id: string, updates: Partial<ApprovalRoute>): Promise<ApprovalRoute> => {
    const supabase = getSupabase();
    const dbUpdates = { name: updates.name, route_data: { steps: updates.routeData!.steps.map(s => ({ approver_id: s.approverId }))}};
    const { data, error } = await supabase.from('approval_routes').update(dbUpdates).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update approval route');
    return dbApprovalRouteToApprovalRoute(data);
};
export const deleteApprovalRoute = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('approval_routes').delete().eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to delete approval route');
};

export const getApprovedApplications = async (): Promise<ApplicationWithDetails[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('applications')
        .select(`*, applicant:applicant_id(*), application_code:application_code_id(*), approval_route:approval_route_id(*)`)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });
        
    ensureSupabaseSuccess(error, 'Failed to fetch approved applications');
    return (data || []).map(app => ({
        ...dbApplicationToApplication(app),
        applicant: app.applicant,
        applicationCode: app.application_code ? dbApplicationCodeToApplicationCode(app.application_code) : undefined,
        approvalRoute: app.approval_route ? dbApprovalRouteToApprovalRoute(app.approval_route) : undefined,
    }));
};


export const getApplications = async (currentUser: User | null): Promise<ApplicationWithDetails[]> => {
    if (!currentUser) return [];

    const supabase = getSupabase();
    const applicationsQuery = supabase
        .from('applications')
        .select(
            `*, applicant:applicant_id(*), application_code:application_code_id(*), approval_route:approval_route_id(*)`
        )
        .or(`applicant_id.eq.${currentUser.id},approver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

    const draftsQuery = supabase
        .from('application_drafts')
        .select('*')
        .eq('applicant_id', currentUser.id)
        .order('updated_at', { ascending: false });

    const [{ data: activeApps, error: applicationsError }, { data: draftApps, error: draftsError }] = await Promise.all([
        applicationsQuery,
        draftsQuery,
    ]);

    ensureSupabaseSuccess(applicationsError, 'Failed to fetch applications');

    let draftRows = draftApps || [];
    if (draftsError) {
        if (draftsError.code === 'PGRST200') {
            console.warn(
                'Missing Supabase relationship metadata for application_drafts; retrying without implicit joins.',
                draftsError,
            );
            const { data: fallbackDrafts, error: fallbackError } = await supabase
                .from('application_drafts')
                .select('id, applicant_id, application_code_id, approval_route_id, form_data, created_at, updated_at')
                .eq('applicant_id', currentUser.id)
                .order('updated_at', { ascending: false });
            ensureSupabaseSuccess(fallbackError, 'Failed to fetch application drafts');
            draftRows = fallbackDrafts || [];
        } else {
            ensureSupabaseSuccess(draftsError, 'Failed to fetch application drafts');
        }
    }

    let draftCodeMap = new Map<string, ApplicationCode>();
    let draftRouteMap = new Map<string, ApprovalRoute>();
    if (draftRows.length > 0) {
        const codeIds = collectUniqueIds(draftRows.map((draft: any) => draft.application_code_id));
        const routeIds = collectUniqueIds(draftRows.map((draft: any) => draft.approval_route_id));
        [draftCodeMap, draftRouteMap] = await Promise.all([
            fetchApplicationCodesByIds(supabase, codeIds),
            fetchApprovalRoutesByIds(supabase, routeIds),
        ]);
    }

    const mappedApplications = (activeApps || []).map(app => ({
        ...dbApplicationToApplication(app),
        applicant: app.applicant,
        applicationCode: app.application_code ? dbApplicationCodeToApplicationCode(app.application_code) : undefined,
        approvalRoute: app.approval_route ? dbApprovalRouteToApprovalRoute(app.approval_route) : undefined,
    }));

    const mappedDrafts = draftRows.map(draft => {
        const baseDraft = dbApplicationDraftToApplication(draft);
        const applicationCode = draft.application_code
            ? dbApplicationCodeToApplicationCode(draft.application_code)
            : draftCodeMap.get(baseDraft.applicationCodeId);
        const approvalRoute = draft.approval_route
            ? dbApprovalRouteToApprovalRoute(draft.approval_route)
            : (baseDraft.approvalRouteId ? draftRouteMap.get(baseDraft.approvalRouteId) : undefined);

        return {
            ...baseDraft,
            applicant: draft.applicant || currentUser,
            applicationCode,
            approvalRoute,
        };
    });

    return [...mappedApplications, ...mappedDrafts].sort((a, b) => {
        const toTime = (value?: string | null) => (value ? new Date(value).getTime() : 0);
        return toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt);
    });
};
export const getApplicationCodes = async (): Promise<ApplicationCode[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('application_codes').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch application codes');
    return (data || []).map(dbApplicationCodeToApplicationCode);
};
export const submitApplication = async (appData: any, applicantId: string): Promise<Application> => {
    const supabase = getSupabase();

    const { data: routeData, error: routeError } = await supabase.from('approval_routes').select('route_data').eq('id', appData.approvalRouteId).single();
    if (routeError) throw formatSupabaseError('承認ルートの取得に失敗しました', routeError);
    if (!routeData?.route_data?.steps || routeData.route_data.steps.length === 0) throw new Error('選択された承認ルートに承認者が設定されていません。');

    const firstApproverId = routeData.route_data.steps[0].approver_id;

    const { data, error } = await supabase.from('applications').insert({
        application_code_id: appData.applicationCodeId,
        form_data: appData.formData,
        approval_route_id: appData.approvalRouteId,
        document_url: appData.documentUrl ?? appData.formData?.documentUrl ?? null,
        applicant_id: applicantId, status: 'pending_approval', submitted_at: new Date().toISOString(), current_level: 1, approver_id: firstApproverId,
    }).select().single();

    ensureSupabaseSuccess(error, 'Failed to submit application');

    const createdApplication = dbApplicationToApplication(data);

    try {
        await sendApprovalNotification({
            type: 'submitted',
            application: createdApplication,
            recipientUserId: firstApproverId,
            metadata: {
                applicationCodeId: createdApplication.applicationCodeId,
                currentLevel: createdApplication.currentLevel,
                approvalRouteId: createdApplication.approvalRouteId,
            },
        });
    } catch (notificationError) {
        console.warn('Failed to send submission notification', notificationError);
    }

    return createdApplication;
};

const findExistingDraftId = async (applicationCodeId: string, applicantId: string): Promise<string | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('application_drafts')
        .select('id')
        .eq('application_code_id', applicationCodeId)
        .eq('applicant_id', applicantId)
        .order('updated_at', { ascending: false })
        .limit(1);

    ensureSupabaseSuccess(error, 'Failed to look up existing draft');
    if (!data || data.length === 0) return null;
    return data[0].id;
};

export const getApplicationDraft = async (applicationCodeId: string, applicantId: string): Promise<Application | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('application_drafts')
        .select('*')
        .eq('application_code_id', applicationCodeId)
        .eq('applicant_id', applicantId)
        .order('updated_at', { ascending: false })
        .limit(1);

    ensureSupabaseSuccess(error, 'Failed to fetch application draft');
    if (!data || data.length === 0) return null;
    return dbApplicationDraftToApplication(data[0]);
};

export const updateApplication = async (id: string, updates: { applicantId?: string }): Promise<ApplicationWithDetails> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('applications')
        .update({
            applicant_id: updates.applicantId,
        })
        .eq('id', id)
        .select(`
            *,
            applicant:applicant_id(*),
            application_code:application_code_id(*),
            approval_route:approval_route_id(*)
        `)
        .single();

    ensureSupabaseSuccess(error, 'Failed to update application');

    return {
        ...dbApplicationToApplication(data),
        applicant: data.applicant,
        applicationCode: data.application_code ? dbApplicationCodeToApplicationCode(data.application_code) : undefined,
        approvalRoute: data.approval_route ? dbApprovalRouteToApprovalRoute(data.approval_route) : undefined,
    };
};

export const saveApplicationDraft = async (appData: any, applicantId: string): Promise<Application> => {
    if (!appData?.applicationCodeId) {
        throw new Error('applicationCodeId is required to save drafts.');
    }

    const supabase = getSupabase();
    const existingDraftId = await findExistingDraftId(appData.applicationCodeId, applicantId);
    const now = new Date().toISOString();
    const sanitizedApprovalRouteId =
        typeof appData.approvalRouteId === 'string' && appData.approvalRouteId.trim().length > 0
            ? appData.approvalRouteId
            : null;

    const draftUpdate = {
        form_data: appData.formData,
        approval_route_id: sanitizedApprovalRouteId,
        updated_at: now,
    };

    if (existingDraftId) {
        const { data, error } = await supabase
            .from('application_drafts')
            .update(draftUpdate)
            .eq('id', existingDraftId)
            .select()
            .single();

        ensureSupabaseSuccess(error, 'Failed to update draft');
        return dbApplicationDraftToApplication(data);
    }

    const { data, error } = await supabase
        .from('application_drafts')
        .insert({
            application_code_id: appData.applicationCodeId,
            applicant_id: applicantId,
            ...draftUpdate,
            created_at: now,
        })
        .select()
        .single();

    ensureSupabaseSuccess(error, 'Failed to save draft');
    return dbApplicationDraftToApplication(data);
};

export const clearApplicationDraft = async (applicationCodeId: string, applicantId: string): Promise<void> => {
    const draftId = await findExistingDraftId(applicationCodeId, applicantId);
    if (!draftId) return;

    const supabase = getSupabase();
    const { error } = await supabase.from('application_drafts').delete().eq('id', draftId);
    ensureSupabaseSuccess(error, 'Failed to clear application draft');
};

export const deleteApplicationDraft = async (draftId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('application_drafts').delete().eq('id', draftId);
    ensureSupabaseSuccess(error, 'Failed to delete application draft');
};

interface BulletinThreadInput {
    title: string;
    body: string;
    tags?: string[];
    pinned?: boolean;
    assigneeIds?: string[];
    isTask?: boolean;
    dueDate?: string | null;
    completed?: boolean;
}

export const getBulletinThreads = async (options?: { limit?: number }): Promise<BulletinThread[]> => {
    const supabase = getSupabase();
    const selectColumns = `
        id,
        title,
        content,
        visibility,
        is_task,
        due_date,
        created_at,
        updated_at,
        created_by,
        completed,
        post_assignments (
            user_id
        ),
        post_comments (
            id,
            post_id,
            content,
            user_id,
            created_at
        )
    `;

    let postsQuery = supabase
        .from('posts')
        .select(selectColumns)
        .order('updated_at', { ascending: false });

    if (options?.limit) {
        postsQuery = postsQuery.limit(options.limit);
    }

    const { data: postData, error: postError } = await postsQuery;
    if (!postError) {
        return (postData || []).map(mapDbBulletinThread);
    }

    console.warn('Falling back to legacy bulletin_threads query:', postError?.message || postError);

    let query = supabase
        .from('bulletin_threads')
        .select(BULLETIN_THREAD_SELECT)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    ensureSupabaseSuccess(error, 'Failed to fetch bulletin threads');
    return (data || []).map(mapDbBulletinThread);
};

export const createBulletinThread = async (
    input: BulletinThreadInput,
    author: EmployeeUser,
    supabaseClient?: SupabaseClient
): Promise<BulletinThread> => {
    const supabase = supabaseClient ?? getSupabase();
    const visibility = (input.assigneeIds?.length ?? 0) > 0 ? 'assigned' : 'all';
    const { data: createdId, error } = await supabase.rpc('create_post', {
        p_title: input.title,
        p_content: input.body,
        p_visibility: visibility,
        p_is_task: input.isTask ?? false,
        p_due_date: input.dueDate ?? null,
        p_assignees: input.assigneeIds ?? [],
        p_created_by: author.id,
    });

    if (!error && createdId) {
        const { data: createdRow, error: fetchError } = await supabase
            .from('posts')
            .select(`
                id,
                title,
                content,
                visibility,
                is_task,
                due_date,
                created_at,
                updated_at,
                created_by,
                completed,
                post_assignments (
                    user_id
                ),
                post_comments (
                    id,
                    post_id,
                    content,
                    user_id,
                    created_at
                )
            `)
            .eq('id', createdId)
            .single();
        ensureSupabaseSuccess(fetchError, 'Failed to fetch created post');
        const mapped = mapDbBulletinThread(createdRow);
        return {
            ...mapped,
            authorName: mapped.authorName || author.name,
            authorDepartment: mapped.authorDepartment ?? author.department ?? null,
        };
    }

    console.warn('Falling back to legacy bulletin_threads insert:', error?.message || error);

    const payload = {
        title: input.title,
        body: input.body,
        tags: input.tags ?? [],
        pinned: input.pinned ?? false,
        assignee_ids: input.assigneeIds ?? [],
        author_id: author.id,
    };
    const { data: legacyData, error: legacyError } = await supabase
        .from('bulletin_threads')
        .insert(payload)
        .select(BULLETIN_THREAD_SELECT)
        .single();
    ensureSupabaseSuccess(legacyError, 'Failed to create bulletin thread');
    const mappedLegacy = mapDbBulletinThread(legacyData);
    return {
        ...mappedLegacy,
        authorName: mappedLegacy.authorName || author.name,
        authorDepartment: mappedLegacy.authorDepartment ?? author.department ?? null,
    };
};

export const updateBulletinThread = async (
    threadId: string,
    input: Partial<BulletinThreadInput>
): Promise<BulletinThread> => {
    const supabase = getSupabase();
    const updates: Record<string, any> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.body !== undefined) updates.content = input.body;
    if (input.isTask !== undefined) updates.is_task = input.isTask;
    if (input.dueDate !== undefined) updates.due_date = input.dueDate;
    if (input.completed !== undefined) updates.completed = input.completed;

    const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', threadId)
        .select(`
            id,
            title,
            content,
            visibility,
            is_task,
            due_date,
            created_at,
            updated_at,
            created_by,
            completed,
            post_assignments (
                user_id
            ),
            post_comments (
                id,
                post_id,
                content,
                user_id,
                created_at
            )
        `)
        .single();
    if (!error && data) {
        return mapDbBulletinThread(data);
    }

    console.warn('Falling back to legacy bulletin_threads update:', error?.message || error);

    const legacyUpdates: Record<string, any> = {};
    if (input.title !== undefined) legacyUpdates.title = input.title;
    if (input.body !== undefined) legacyUpdates.body = input.body;
    if (input.tags !== undefined) legacyUpdates.tags = input.tags;
    if (input.pinned !== undefined) legacyUpdates.pinned = input.pinned;
    if (input.assigneeIds !== undefined) legacyUpdates.assignee_ids = input.assigneeIds;

    const { data: legacyData, error: legacyError } = await supabase
        .from('bulletin_threads')
        .update(legacyUpdates)
        .eq('id', threadId)
        .select(BULLETIN_THREAD_SELECT)
        .single();
    ensureSupabaseSuccess(legacyError, 'Failed to update bulletin thread');
    return mapDbBulletinThread(legacyData);
};

export const deleteBulletinThread = async (threadId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('posts').delete().eq('id', threadId);
    if (!error) return;

    console.warn('Falling back to legacy bulletin_threads delete:', error?.message || error);
    const { error: legacyError } = await supabase.from('bulletin_threads').delete().eq('id', threadId);
    ensureSupabaseSuccess(legacyError, 'Failed to delete bulletin thread');
};

export const addBulletinComment = async (
    threadId: string,
    body: string,
    author: EmployeeUser
): Promise<BulletinComment> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('post_comments')
        .insert({
            post_id: threadId,
            content: body,
            user_id: author.id,
        })
        .select(`
            id,
            post_id,
            content,
            user_id,
            created_at
        `)
        .single();
    if (!error && data) {
        const mapped = mapDbBulletinComment(data);
        return {
            ...mapped,
            authorName: author.name ?? mapped.authorName,
            authorDepartment: author.department ?? mapped.authorDepartment ?? null,
        };
    }

    console.warn('Falling back to legacy bulletin_comments insert:', error?.message || error);

    const { data: legacyData, error: legacyError } = await supabase
        .from('bulletin_comments')
        .insert({
            thread_id: threadId,
            body,
            author_id: author.id,
        })
        .select(`
            id,
            thread_id,
            body,
            author_id,
            created_at,
            author:author_id (
                id,
                name,
                department
            )
        `)
        .single();
    ensureSupabaseSuccess(legacyError, 'Failed to add bulletin comment');
    const mappedLegacy = mapDbBulletinComment(legacyData);
    return {
        ...mappedLegacy,
        authorName: author.name ?? mappedLegacy.authorName,
        authorDepartment: author.department ?? mappedLegacy.authorDepartment ?? null,
    };
};
export const approveApplication = async (app: ApplicationWithDetails, currentUser: User): Promise<void> => {
    if (app.approverId !== currentUser.id) {
        throw new Error('この申請を承認する権限がありません。');
    }
    if (app.status !== 'pending_approval') {
        throw new Error('承認待ちの申請ではありません。');
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const currentLevel = app.currentLevel && app.currentLevel > 0 ? app.currentLevel : 1;
    const approverSequence = await resolveApprovalRouteApprovers(supabase, app);
    const totalSteps = approverSequence.length || currentLevel || 1;
    const isFinalStep = approverSequence.length === 0 || currentLevel >= totalSteps;

    const updates: Record<string, any> = {
        updated_at: now,
        rejection_reason: null,
        rejected_at: null,
    };

    let nextLevel = currentLevel;
    let nextApproverId: string | null = null;

    if (isFinalStep) {
        updates.status = 'approved';
        updates.approved_at = now;
        updates.current_level = currentLevel;
        updates.approver_id = currentUser.id;
    } else {
        nextLevel = currentLevel + 1;
        nextApproverId = approverSequence[nextLevel - 1] ?? null;
        if (!nextApproverId) {
            throw new Error('承認ルートの設定に問題があります。');
        }
        updates.status = 'pending_approval';
        updates.current_level = nextLevel;
        updates.approver_id = nextApproverId;
        updates.approved_at = null;
    }

    const { error } = await supabase.from('applications').update(updates).eq('id', app.id);
    ensureSupabaseSuccess(error, 'Failed to approve application');

    const updatedApplication: ApplicationWithDetails = {
        ...app,
        status: updates.status,
        approvedAt: isFinalStep ? now : null,
        rejectedAt: null,
        rejectionReason: null,
        currentLevel: updates.current_level ?? currentLevel,
        approverId: updates.approver_id ?? app.approverId,
        updatedAt: now,
    };

    try {
        if (isFinalStep) {
            await sendApprovalNotification({
                type: 'approved',
                application: updatedApplication,
                recipientUserId: updatedApplication.applicantId,
                recipientEmail: app.applicant?.email ?? null,
                metadata: {
                    applicationCodeId: updatedApplication.applicationCodeId,
                    approvalRouteId: updatedApplication.approvalRouteId,
                    approvedAt: now,
                },
            });
        } else if (nextApproverId) {
            await sendApprovalNotification({
                type: 'step_forward',
                application: updatedApplication,
                recipientUserId: nextApproverId,
                metadata: {
                    applicationCodeId: updatedApplication.applicationCodeId,
                    approvalRouteId: updatedApplication.approvalRouteId,
                    currentLevel: updatedApplication.currentLevel,
                },
            });
        }
    } catch (notificationError) {
        console.warn('Failed to send approval notification', notificationError);
    }
};
export const rejectApplication = async (app: ApplicationWithDetails, reason: string, currentUser: User): Promise<void> => {
    if (app.approverId !== currentUser.id) {
        throw new Error('この申請を差し戻す権限がありません。');
    }
    if (app.status !== 'pending_approval') {
        throw new Error('承認待ちの申請ではありません。');
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const currentLevel = app.currentLevel && app.currentLevel > 0 ? app.currentLevel : 1;
    const rejectionReason = reason ?? '';

    const { error } = await supabase
        .from('applications')
        .update({
            status: 'rejected',
            rejected_at: now,
            rejection_reason: rejectionReason,
            approver_id: currentUser.id,
            current_level: currentLevel,
            approved_at: null,
            updated_at: now,
        })
        .eq('id', app.id);
    ensureSupabaseSuccess(error, 'Failed to reject application');

    const updatedApplication: ApplicationWithDetails = {
        ...app,
        status: 'rejected',
        rejectedAt: now,
        rejectionReason,
        approverId: currentUser.id,
        approvedAt: null,
        currentLevel,
        updatedAt: now,
    };

    try {
        await sendApprovalNotification({
            type: 'rejected',
            application: updatedApplication,
            recipientUserId: updatedApplication.applicantId,
            recipientEmail: app.applicant?.email ?? null,
            metadata: {
                applicationCodeId: updatedApplication.applicationCodeId,
                approvalRouteId: updatedApplication.approvalRouteId,
                reason: rejectionReason,
            },
        });
    } catch (notificationError) {
        console.warn('Failed to send rejection notification', notificationError);
    }
};

export const cancelApplication = async (app: ApplicationWithDetails, currentUser: User): Promise<void> => {
    if (app.applicantId !== currentUser.id) {
        throw new Error('自分が申請した案件のみ取り消せます。');
    }
    if (app.status !== 'pending_approval') {
        throw new Error('承認待ちの申請のみ取り消せます。');
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('applications')
        .update({
            status: 'cancelled',
            approver_id: null,
            rejection_reason: '申請者による取り消し',
            rejected_at: now,
            approved_at: null,
        })
        .eq('id', app.id)
        .eq('applicant_id', currentUser.id);
    ensureSupabaseSuccess(error, 'Failed to cancel application');
};

export const getAccountItems = async (): Promise<AccountItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('account_items').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch account items');
    return (data || []).map(d => ({ ...d, sortOrder: d.sort_order, categoryCode: d.category_code, createdAt: d.created_at, updatedAt: d.updated_at, isActive: d.is_active }));
};

export const getActiveAccountItems = async (): Promise<MasterAccountItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('account_items').select('id, code, name, category_code').eq('is_active', true).order('sort_order', { nullsFirst: false }).order('code');
    ensureSupabaseSuccess(error, 'Failed to fetch active account items');
    return (data || []).map(d => ({ ...d, id: d.id, code: d.code, name: d.name, categoryCode: d.category_code }));
};

export const saveAccountItem = async (item: Partial<AccountItem>): Promise<void> => {
    const supabase = getSupabase();
    const dbItem = { code: item.code, name: item.name, category_code: item.categoryCode, is_active: item.isActive, sort_order: item.sortOrder };
    const { error } = await supabase.from('account_items').upsert({ id: item.id, ...dbItem });
    ensureSupabaseSuccess(error, '勘定科目の保存に失敗しました');
};

export const deactivateAccountItem = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('account_items').update({ is_active: false }).eq('id', id);
    ensureSupabaseSuccess(error, '勘定科目の無効化に失敗しました');
};

export const getPaymentRecipients = async (q?: string): Promise<PaymentRecipient[]> => {
    const supabase = getSupabase();
    const buildQuery = (columns: string) => {
        let query = supabase
            .from('payment_recipients')
            .select(columns)
            .order('company_name', { ascending: true })
            .order('recipient_name', { ascending: true });
        if (q && q.trim()) {
            query = query.ilike('company_name', `%${q}%`);
        }
        return query.limit(1000);
    };

    let { data, error } = await buildQuery(PAYMENT_RECIPIENT_SELECT);
    if (error && isMissingColumnError(error)) {
        console.warn('payment_recipients table missing extended columns; falling back to legacy schema');
        ({ data, error } = await buildQuery(PAYMENT_RECIPIENT_LEGACY_SELECT));
    }
    ensureSupabaseSuccess(error, 'Failed to fetch payment recipients');
    return (data || []).map(mapDbPaymentRecipient);
};

export const savePaymentRecipient = async (item: Partial<PaymentRecipient>): Promise<void> => {
    const supabase = getSupabase();
    const payload = buildPaymentRecipientPayload(item);
    const { error } = await supabase.from('payment_recipients').upsert({ id: item.id, ...payload });
    if (error && isMissingColumnError(error)) {
        console.warn('payment_recipients table missing extended columns; retrying save with legacy payload');
        const legacyPayload = buildLegacyPaymentRecipientPayload(item);
        const { error: fallbackError } = await supabase
            .from('payment_recipients')
            .upsert({ id: item.id, ...legacyPayload });
        ensureSupabaseSuccess(fallbackError, '支払先の保存に失敗しました');
        return;
    }
    ensureSupabaseSuccess(error, '支払先の保存に失敗しました');
};

export const getGeneralLedger = async (accountId: string, period: { start: string, end: string }): Promise<GeneralLedgerEntry[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_general_ledger', {
        p_account_id: accountId,
        p_start_date: period.start,
        p_end_date: period.end,
    });

    ensureSupabaseSuccess(error, 'Failed to fetch general ledger entries');

    if (!data) {
        return [];
    }

    return (data as any[]).map(row => ({
        id: row.id,
        date: row.date,
        voucherNo: row.voucher_no,
        description: row.description,
        partner: row.partner,
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        // The 'type' is for UI display only and can be derived on the client
        type: row.debit > 0 ? '借' : (row.credit > 0 ? '貸' : '繰'),
    }));
};


export const createPaymentRecipient = async (item: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
    if (!item.companyName && !item.recipientName) {
        throw new Error('支払先の名称を入力してください。');
    }
    const supabase = getSupabase();
    const hydratedItem: Partial<PaymentRecipient> = {
        ...item,
        recipientCode: item.recipientCode || `PR-${Date.now()}`,
        companyName: item.companyName ?? item.recipientName ?? '',
        recipientName: item.recipientName ?? item.companyName ?? '',
    };
    const payload = buildPaymentRecipientPayload(hydratedItem);
    const selectClause = PAYMENT_RECIPIENT_SELECT;
    let { data, error } = await supabase
        .from('payment_recipients')
        .insert(payload)
        .select(selectClause)
        .single();

    if (error && isMissingColumnError(error)) {
        console.warn('payment_recipients table missing extended columns; retrying insert with legacy payload');
        const legacyPayload = buildLegacyPaymentRecipientPayload(hydratedItem);
        ({ data, error } = await supabase
            .from('payment_recipients')
            .insert(legacyPayload)
            .select(PAYMENT_RECIPIENT_LEGACY_SELECT)
            .single());
    }

    ensureSupabaseSuccess(error, '支払先の登録に失敗しました');
    return mapDbPaymentRecipient(data);
};

export const deletePaymentRecipient = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('payment_recipients').delete().eq('id', id);
    ensureSupabaseSuccess(error, '支払先の削除に失敗しました');
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('allocation_divisions').select('*').order('name');
    ensureSupabaseSuccess(error, '振分区分の取得に失敗しました');
    return (data || []).map(d => ({...d, createdAt: d.created_at, isActive: d.is_active}));
};

export const saveAllocationDivision = async (item: Partial<AllocationDivision>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    ensureSupabaseSuccess(error, '振分区分の保存に失敗しました');
};

export const deleteAllocationDivision = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').delete().eq('id', id);
    ensureSupabaseSuccess(error, '振分区分の削除に失敗しました');
};

export const getDepartments = async (): Promise<Department[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('departments').select('id, name').order('name');
    ensureSupabaseSuccess(error, 'Failed to fetch departments');
    return data as Department[];
};

export const saveDepartment = async (item: Partial<Department>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('departments').upsert({ id: item.id, name: item.name });
    ensureSupabaseSuccess(error, '部署の保存に失敗しました');
};

export const deleteDepartment = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('departments').delete().eq('id', id);
    ensureSupabaseSuccess(error, '部署の削除に失敗しました');
};

export const getTitles = async (): Promise<Title[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('employee_titles').select('*').order('name');
    ensureSupabaseSuccess(error, '役職の取得に失敗しました');
    return (data || []).map(d => ({...d, createdAt: d.created_at, isActive: d.is_active}));
};

export const saveTitle = async (item: Partial<Title>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    ensureSupabaseSuccess(error, '役職の保存に失敗しました');
};

export const deleteTitle = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').delete().eq('id', id);
    ensureSupabaseSuccess(error, '役職の削除に失敗しました');
};


export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    return fetchPurchaseOrdersWithFilters();
};

export const addPurchaseOrder = async (order: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const supabase = getSupabase();
    const insertPayload = {
        client_custmer: order.supplierName,
        payment_recipient_id: order.paymentRecipientId ?? null,
        project_code: order.itemName,
        order_date: order.orderDate,
        quantity: order.quantity,
        amount: order.unitPrice * order.quantity,
        approval_status1: order.status,
    };
    const { data, error } = await supabase.from('orders').insert(insertPayload).select().single();
    ensureSupabaseSuccess(error, 'Failed to add purchase order');
    return dbOrderToPurchaseOrder(data);
};


export const getInventoryItems = async (): Promise<InventoryItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    ensureSupabaseSuccess(error, 'Failed to fetch inventory items');
    return (data || []).map(d => ({ ...d, unitPrice: d.unit_price }));
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').insert({
        name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice
    }).select().single();
    ensureSupabaseSuccess(error, 'Failed to add inventory item');
    return data as InventoryItem;
}

export const updateInventoryItem = async (id: string, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').update({
        name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice
    }).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update inventory item');
    return data as InventoryItem;
}


export const getBugReports = async (): Promise<BugReport[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', {ascending: false});
    ensureSupabaseSuccess(error, 'Failed to fetch bug reports');
    return (data || []).map(dbBugReportToBugReport);
};
export const addBugReport = async (report: any): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('bug_reports').insert({ ...bugReportToDbBugReport(report), status: '未対応' });
    ensureSupabaseSuccess(error, 'Failed to add bug report');
};
export const updateBugReport = async (id: string, updates: Partial<BugReport>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('bug_reports').update(bugReportToDbBugReport(updates)).eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to update bug report');
};

const mapEstimateStatus = (code?: string | null): EstimateStatus => {
    switch ((code ?? '').toString()) {
        case '2':
            return EstimateStatus.Ordered;
        case '9':
            return EstimateStatus.Lost;
        default:
            return EstimateStatus.Draft;
    }
};

const estimateStatusToCode = (status?: EstimateStatus | string | null): string => {
    if (!status) return '0';
    if (status === EstimateStatus.Ordered || status === '2') return '2';
    if (status === EstimateStatus.Lost || status === '9') return '9';
    if (status === EstimateStatus.Draft) return '0';
    return typeof status === 'string' ? status : '0';
};

const generateEstimateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `est-${Date.now()}`;
};

const mapEstimateRow = (row: any): Estimate => {
    const copies = toNumberOrNull(row.copies);
    const unitPrice = toNumberOrNull(row.unit_price);
    const subtotal = toNumberOrNull(row.subtotal) ?? (copies !== null && unitPrice !== null ? copies * unitPrice : null);
    const taxRate = toNumberOrNull(row.tax_rate);
    const taxAmount = toNumberOrNull(row.consumption) ?? (subtotal !== null && taxRate !== null ? Math.floor(subtotal * (taxRate / 100)) : null);
    const total = toNumberOrNull(row.total) ?? (subtotal !== null && taxAmount !== null ? subtotal + taxAmount : subtotal ?? 0);
    const salesAmount = toNumberOrNull(row.sales_amount) ?? subtotal ?? null;
    const variableCostAmount = toNumberOrNull(row.variable_cost_amount ?? row.variable_cost_num ?? row.detail_variable_cost_num);
    const mqAmount = toNumberOrNull(row.mq_amount);
    const mqRate = toNumberOrNull(row.mq_rate);
    const detailCount = toNumberOrNull(row.detail_count);
    const mqMissingReason = toStringOrNull(row.mq_missing_reason);
    const statusLabel = row.status_label ?? null;
    const projectName = toStringOrNull(row.project_name);
    const customerNameResolved =
        toStringOrNull(row.customer_name) ||
        (row.project_id ? `案件${row.project_id}` : null);
    const displayName =
        toStringOrNull(row.display_name) ||
        projectName ||
        toStringOrNull(row.pattern_name) ||
        toStringOrNull(row.specification) ||
        (row.estimates_id ? `見積#${row.estimates_id}` : '見積');

    return {
        id: row.estimates_id ?? row.id ?? generateEstimateId(),
        estimateNumber: Number(row.pattern_no ?? row.estimates_id ?? 0) || 0,
        customerName: customerNameResolved ?? '未設定',
        title: row.pattern_name ?? row.specification ?? '見積',
        displayName,
        projectName,
        items: [
            {
                division: 'その他',
                content: row.specification ?? row.pattern_name ?? '見積',
                quantity: copies ?? 0,
                unit: '式',
                unitPrice: unitPrice ?? 0,
                price: subtotal ?? total ?? 0,
                cost: 0,
                costRate: 0,
                subtotal: subtotal ?? total ?? 0,
            },
        ],
        total: total ?? 0,
        deliveryDate: row.delivery_date ?? row.expiration_date ?? '',
        paymentTerms: row.transaction_method ?? '',
        deliveryMethod: row.delivery_place ?? '',
        notes: row.note ?? '',
        status: mapEstimateStatus(row.status),
        version: Number(row.pattern_no ?? 1) || 1,
        userId: row.create_id ?? '',
        createdAt: row.create_date ?? new Date().toISOString(),
        updatedAt: row.update_date ?? row.create_date ?? new Date().toISOString(),
        subtotal: subtotal ?? undefined,
        taxTotal: taxAmount ?? undefined,
        grandTotal: total ?? undefined,
        deliveryTerms: row.specification ?? undefined,
        projectId: row.project_id ?? null,
        patternNo: row.pattern_no ?? null,
        expirationDate: row.expiration_date ?? null,
        taxRate: taxRate ?? null,
        consumption: taxAmount ?? null,
        rawStatusCode: row.status ?? null,
        copies: copies ?? null,
        unitPrice: unitPrice ?? null,
        salesAmount,
        variableCostAmount,
        mqAmount,
        mqRate,
        mqMissingReason: (mqMissingReason as 'OK' | 'A' | 'B' | null) ?? null,
        detailCount,
        statusLabel,
        raw: row,
    };
};

const mapEstimateDetailRow = (row: any): EstimateDetail => {
    const quantity = toNumberOrNull(row.quantity ?? row.quantity_num);
    const unitPrice = toNumberOrNull(row.unit_price ?? row.unit_price_num);
    const amount = toNumberOrNull(row.amount ?? row.sales_amount);
    const variableCost = toNumberOrNull(row.variable_cost ?? row.valiable_cost ?? row.variable_cost_amount);
    const mqAmount =
        toNumberOrNull(row.mq_amount) ??
        (amount !== null && variableCost !== null ? amount - variableCost : null);
    const mqRate =
        toNumberOrNull(row.mq_rate) ??
        (amount && amount > 0 && variableCost !== null ? (amount - variableCost) / amount : null);

    return {
        id: row.id ?? row.detail_id ?? row.detailId ?? null,
        detailId: row.detail_id ?? row.detailId ?? null,
        estimateId: row.estimate_id ?? row.estimateId ?? '',
        itemName: row.item_name ?? row.name ?? '',
        quantity,
        unitPrice,
        amount: amount ?? (quantity !== null && unitPrice !== null ? quantity * unitPrice : null),
        variableCost,
        mqAmount,
        mqRate,
        note: row.note ?? null,
    };
};

const buildEstimatePayload = (estimateData: Partial<Estimate>, mode: 'insert' | 'update' = 'insert') => {
    const rawCopies = Number(estimateData.copies ?? estimateData.items?.[0]?.quantity ?? 0);
    const rawUnitPrice = Number(estimateData.unitPrice ?? estimateData.items?.[0]?.unitPrice ?? 0);
    const rawTaxRate = estimateData.taxRate ?? 10;

    const copies = Number.isFinite(rawCopies) ? rawCopies : 0;
    const unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : 0;
    const taxRate = Number.isFinite(rawTaxRate as number) ? Number(rawTaxRate) : 10;

    const subtotal =
        typeof estimateData.subtotal === 'number' && Number.isFinite(estimateData.subtotal)
            ? estimateData.subtotal
            : copies * unitPrice;
    const taxAmount =
        typeof estimateData.consumption === 'number' && Number.isFinite(estimateData.consumption)
            ? estimateData.consumption
            : Math.floor(subtotal * (taxRate / 100));
    const total =
        typeof estimateData.total === 'number' && Number.isFinite(estimateData.total)
            ? estimateData.total
            : typeof estimateData.grandTotal === 'number' && Number.isFinite(estimateData.grandTotal)
                ? estimateData.grandTotal
                : subtotal + taxAmount;

    const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0;
    const safeTaxAmount = Number.isFinite(taxAmount) ? taxAmount : 0;
    const safeTotal = Number.isFinite(total) ? total : safeSubtotal + safeTaxAmount;

    const payload: any = {
        project_id: estimateData.projectId ?? estimateData.customerName ?? null,
        pattern_no: estimateData.patternNo ?? (estimateData.version ? String(estimateData.version) : null),
        pattern_name: estimateData.title ?? null,
        delivery_place: estimateData.deliveryMethod ?? null,
        transaction_method: estimateData.paymentTerms ?? null,
        expiration_date: estimateData.expirationDate ?? null,
        specification: estimateData.deliveryTerms ?? estimateData.notes ?? null,
        copies: Number.isFinite(copies) ? String(copies) : null,
        unit_price: Number.isFinite(unitPrice) ? String(unitPrice) : null,
        tax_rate: Number.isFinite(taxRate) ? String(taxRate) : null,
        note: estimateData.notes ?? null,
        fraction: null,
        approval1: null,
        approval2: null,
        approval3: null,
        approval4: null,
        approval_status1: null,
        approval_status2: null,
        approval_status3: null,
        approval_status4: null,
        order_flg: null,
        consumption: Number.isFinite(safeTaxAmount) ? String(safeTaxAmount) : null,
        total: Number.isFinite(safeTotal) ? String(safeTotal) : null,
        repayment_id: null,
        repayment_comment: null,
        page_cnt: null,
        size: null,
        binding: null,
        valiable_cost: null,
        margin: null,
        margin_rate: null,
        margin_approval_flag: null,
        applicant_id: null,
        estimate_end_date: null,
        receiving_end_date: null,
        order_end_date: null,
        completion_end_date: null,
        claim_end_date: null,
        delivery_date: estimateData.deliveryDate ?? null,
        status: estimateStatusToCode(estimateData.status),
        subtotal: safeSubtotal,
    };

    if (mode === 'insert') {
        payload.estimates_id = estimateData.id ?? generateEstimateId();
        payload.create_id = estimateData.userId ?? null;
        payload.create_date = estimateData.createdAt ?? new Date().toISOString();
    }
    payload.update_id = estimateData.userId ?? null;
    payload.update_date = estimateData.updatedAt ?? new Date().toISOString();

    return payload;
};

export const getEstimates = async (): Promise<Estimate[]> => {
    const { rows } = await getEstimatesPage(1, 1000);
    return rows;
};

export const getEstimatesPage = async (page: number, pageSize: number): Promise<{ rows: Estimate[]; totalCount: number; }> => {
    const supabase = getSupabase();
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
        .from('estimates_list_view')
        .select('*', { count: 'exact' })
        .order('delivery_date', { ascending: false, nullsFirst: false })
        .order('update_date', { ascending: false, nullsFirst: false })
        .range(from, to);
    ensureSupabaseSuccess(error, 'Failed to fetch estimates');
    return {
        rows: (data || []).map(mapEstimateRow),
        totalCount: count ?? 0,
    };
};

export const getEstimateDetails = async (estimateId: string): Promise<EstimateDetail[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('estimate_details_list_view')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('detail_id', { ascending: true });
    ensureSupabaseSuccess(error, 'Failed to fetch estimate details');
    return (data || []).map(mapEstimateDetailRow);
};

export const addEstimateDetail = async (detail: Partial<EstimateDetail> & { estimateId: string }): Promise<void> => {
    const supabase = getSupabase();
    const payload: any = {
        estimate_id: detail.estimateId,
        item_name: detail.itemName,
        quantity: detail.quantity,
        unit_price: detail.unitPrice,
        amount: detail.amount ?? (detail.quantity !== undefined && detail.unitPrice !== undefined ? Number(detail.quantity) * Number(detail.unitPrice) : null),
        valiable_cost: detail.variableCost ?? detail.variableCost === 0 ? detail.variableCost : null,
        variable_cost: detail.variableCost ?? detail.variableCost === 0 ? detail.variableCost : null,
        note: detail.note ?? null,
    };
    const { error } = await supabase.from('estimate_details').insert(payload);
    ensureSupabaseSuccess(error, 'Failed to add estimate detail');
};

export const updateEstimateDetail = async (detailId: string, updates: Partial<EstimateDetail>): Promise<void> => {
    const supabase = getSupabase();
    const payload: any = {};
    if (updates.itemName !== undefined) payload.item_name = updates.itemName;
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.unitPrice !== undefined) payload.unit_price = updates.unitPrice;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.variableCost !== undefined) {
        payload.valiable_cost = updates.variableCost;
        payload.variable_cost = updates.variableCost;
    }
    if (updates.note !== undefined) payload.note = updates.note;
    const { error } = await supabase.from('estimate_details').update(payload).eq('detail_id', detailId);
    ensureSupabaseSuccess(error, 'Failed to update estimate detail');
};

export const deleteEstimateDetail = async (detailId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('estimate_details').delete().eq('detail_id', detailId);
    ensureSupabaseSuccess(error, 'Failed to delete estimate detail');
};

// --- Calendar (system) ---
const apiFetch = async (path: string, init?: RequestInit) => {
    const resp = await fetch(path, init);
    let data: any = null;
    try {
        data = await resp.json();
    } catch {
        /* noop */
    }
    if (!resp.ok) {
        const message = data?.error || `API request failed (${resp.status})`;
        throw new Error(message);
    }
    return data;
};

export const getCalendarEvents = async (userId: string): Promise<CalendarEvent[]> => {
    const data = await apiFetch(`/api/calendar/events?user_id=${encodeURIComponent(userId)}`);
    const events = data?.events ?? [];
    return events.map((ev: any) => ({
        id: ev.id,
        userId: ev.user_id,
        title: ev.title,
        description: ev.description ?? null,
        startAt: ev.start_at,
        endAt: ev.end_at,
        allDay: Boolean(ev.all_day),
        source: ev.source ?? null,
        googleEventId: ev.google_event_id ?? null,
        updatedBySource: ev.updated_by_source ?? null,
        createdAt: ev.created_at ?? null,
        updatedAt: ev.updated_at ?? null,
    }));
};

export const saveCalendarEvent = async (payload: Partial<CalendarEvent> & { userId: string }): Promise<CalendarEvent> => {
    const body = {
        id: payload.id,
        user_id: payload.userId,
        title: payload.title ?? '予定',
        description: payload.description ?? null,
        start_at: payload.startAt,
        end_at: payload.endAt ?? payload.startAt,
        all_day: !!payload.allDay,
        source: payload.source ?? 'system',
        google_event_id: payload.googleEventId ?? null,
        updated_by_source: payload.updatedBySource ?? 'system',
    };
    const data = await apiFetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const ev = data?.event;
    return {
        id: ev.id,
        userId: ev.user_id,
        title: ev.title,
        description: ev.description ?? null,
        startAt: ev.start_at,
        endAt: ev.end_at,
        allDay: Boolean(ev.all_day),
        source: ev.source ?? null,
        googleEventId: ev.google_event_id ?? null,
        updatedBySource: ev.updated_by_source ?? null,
        createdAt: ev.created_at ?? null,
        updatedAt: ev.updated_at ?? null,
    };
};

export const deleteCalendarEvent = async (id: string, userId?: string): Promise<void> => {
    const url = userId ? `/api/calendar/events/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}` : `/api/calendar/events/${encodeURIComponent(id)}`;
    await apiFetch(url, { method: 'DELETE' });
};

export const syncSystemCalendarToGoogle = async (userId: string, opts?: { timeMin?: string; timeMax?: string; }) => {
    const body: any = { user_id: userId };
    if (opts?.timeMin) body.timeMin = opts.timeMin;
    if (opts?.timeMax) body.timeMax = opts.timeMax;
    return apiFetch('/api/google/calendar/sync-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
};

export const pullGoogleCalendarToSystem = async (userId: string, opts?: { timeMin?: string; timeMax?: string; }) => {
    const body: any = { user_id: userId };
    if (opts?.timeMin) body.timeMin = opts.timeMin;
    if (opts?.timeMax) body.timeMax = opts.timeMax;
    return apiFetch('/api/google/calendar/pull-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
};

export const addEstimate = async (estimateData: Partial<Estimate>): Promise<void> => {
    const supabase = getSupabase();
    const payload = buildEstimatePayload(estimateData, 'insert');
    const { error } = await supabase.from('estimates').insert(payload);
    ensureSupabaseSuccess(error, 'Failed to add estimate');
};

export const updateEstimate = async (id: string, updates: Partial<Estimate>): Promise<Estimate> => {
    const supabase = getSupabase();
    const payload = buildEstimatePayload({ ...updates, id }, 'update');
    const { data, error } = await supabase.from('estimates').update(payload).eq('estimates_id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update estimate');
    return mapEstimateRow(data);
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice> => {
    const supabase = getSupabase();
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.paidAt) dbUpdates.paid_at = updates.paidAt;
    
    const { data, error } = await supabase.from('invoices').update(dbUpdates).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update invoice');
    return data;
};


// --- Implemented Functions ---

export const getInvoices = async (): Promise<Invoice[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('invoices').select('*, items:invoice_items(*)').order('invoice_date', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch invoices');
    return (data || []).map(inv => ({
        id: inv.id, invoiceNo: inv.invoice_no, invoiceDate: inv.invoice_date, dueDate: inv.due_date, customerName: inv.customer_name,
        subtotalAmount: inv.subtotal_amount, taxAmount: inv.tax_amount, totalAmount: inv.total_amount, status: inv.status,
        createdAt: inv.created_at, paidAt: inv.paid_at,
        items: inv.items.map((item: any) => ({
            id: item.id, invoiceId: item.invoice_id, jobId: item.job_id, description: item.description,
            quantity: item.quantity, unit: item.unit, unitPrice: item.unit_price, lineTotal: item.line_total, sortIndex: item.sort_index
        }))
    }));
};

export const createInvoiceFromJobs = async (jobIds: string[]): Promise<{ invoiceNo: string }> => {
    const supabase = getSupabase();

    // This is a placeholder implementation.
    // In a real scenario, you would call an RPC function or a Supabase Edge Function
    // to handle the complex logic of invoice creation in a transaction.

    const { data: jobs, error: jobsError } = await supabase
        .from('projects')
        .select('id, customer_name, amount')
        .in('id', jobIds);

    ensureSupabaseSuccess(jobsError, 'Failed to fetch jobs for invoicing');

    if (!jobs || jobs.length === 0) {
        throw new Error('No valid jobs found for invoicing.');
    }

    const customerName = jobs[0].customer_name;
    if (!jobs.every(j => j.customer_name === customerName)) {
        throw new Error('All jobs must belong to the same customer to be invoiced together.');
    }

    const invoiceNo = `INV-${Date.now()}`;
    const invoiceDate = new Date().toISOString().split('T')[0];
    const subtotalAmount = jobs.reduce((sum, job) => sum + (job.amount || 0), 0);
    const taxAmount = subtotalAmount * 0.1; // Assuming 10% tax
    const totalAmount = subtotalAmount + taxAmount;

    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            invoice_no: invoiceNo,
            invoice_date: invoiceDate,
            customer_name: customerName,
            subtotal_amount: subtotalAmount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            status: 'draft',
        })
        .select('id')
        .single();
    
    ensureSupabaseSuccess(invoiceError, 'Failed to create invoice header');

    const invoiceItems = jobs.map((job, index) => ({
        invoice_id: invoice.id,
        job_id: job.id,
        description: `Job #${job.id}`,
        quantity: 1,
        unit: '式',
        unit_price: job.amount || 0,
        line_total: job.amount || 0,
        sort_index: index,
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
    ensureSupabaseSuccess(itemsError, 'Failed to create invoice items');

    return { invoiceNo };
};

export const getDraftJournalEntries = async (): Promise<DraftJournalEntry[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_journal_drafts');

    ensureSupabaseSuccess(error, '仕訳下書きの取得に失敗しました。');

    // The RPC returns data in the shape of DraftJournalEntry[], so we can cast it.
    return (data as any[] as DraftJournalEntry[]) || [];
};

export const approveJournalBatch = async (batchId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('approve_journal_batch', {
        p_batch_id: batchId
    });

    ensureSupabaseSuccess(error, 'Failed to approve journal batch');
};

export const getFaxIntakes = async (): Promise<FaxIntake[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('fax_intakes')
        .select('*')
        .neq('status', 'deleted')
        .order('uploaded_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to load fax intakes');

    return (data || []).map(row => {
        const { data: urlData } = supabase.storage.from(FAX_STORAGE_BUCKET).getPublicUrl(row.file_path);
        return mapFaxIntakeFromDb(row, urlData?.publicUrl);
    });
};

export const getFaxIntakeById = async (id: string): Promise<FaxIntake | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('fax_intakes')
        .select('*')
        .eq('id', id)
        .single();
    if (error && error.code === 'PGRST116') {
        return null;
    }
    ensureSupabaseSuccess(error, 'Failed to load fax intake');
    if (!data) return null;
    const { data: urlData } = supabase.storage.from(FAX_STORAGE_BUCKET).getPublicUrl(data.file_path);
    return mapFaxIntakeFromDb(data, urlData?.publicUrl);
};

export const createFaxIntake = async (payload: {
    filePath: string;
    fileName: string;
    fileMimeType: string;
    fileSize: number;
    docType: FaxIntake['docType'];
    notes?: string;
    uploadedBy: string;
}): Promise<FaxIntake> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('fax_intakes')
        .insert({
            uploaded_by: payload.uploadedBy,
            file_path: payload.filePath,
            file_name: payload.fileName,
            file_mime_type: payload.fileMimeType,
            file_size: payload.fileSize,
            doc_type: payload.docType,
            notes: payload.notes ?? null,
            ocr_status: 'pending',
            status: 'draft',
        })
        .select('*')
        .single();
    ensureSupabaseSuccess(error, 'Failed to create fax intake');
    const { data: urlData } = supabase.storage.from(FAX_STORAGE_BUCKET).getPublicUrl(data.file_path);
    return mapFaxIntakeFromDb(data, urlData?.publicUrl);
};

export const updateFaxIntake = async (
    id: string,
    changes: FaxIntakeUpdateChanges,
): Promise<void> => {
    const supabase = getSupabase();
    const updates = buildFaxIntakeUpdates(changes);
    if (Object.keys(updates).length === 0) {
        return;
    }

    const { error } = await supabase
        .from('fax_intakes')
        .update(updates)
        .eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to update fax intake');
};

export const deleteFaxIntake = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('fax_intakes')
        .update({ status: 'deleted' })
        .eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to delete fax intake');
};

export const requestFaxOcr = async (intake: FaxIntake): Promise<void> => {
    const payload = {
        intakeId: intake.id,
        filePath: intake.filePath,
        docType: intake.docType,
    };

    const endpoint = getFaxOcrEndpoint();
    try {
        if (endpoint && typeof fetch !== 'undefined') {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to trigger fax OCR endpoint');
            }
            return;
        }

        const supabase = getSupabase();
        const { error } = await supabase.functions.invoke(getFaxOcrFunctionName(), { body: payload });
        if (error) {
            throw new Error(error.message || 'Failed to invoke fax OCR function');
        }
    } catch (err) {
        console.error('[FaxOCR] Failed to trigger OCR workflow', err);
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Failed to trigger fax OCR workflow');
    }
};

export const uploadFile = async (
    file: File | Blob,
    bucket = FAX_STORAGE_BUCKET,
): Promise<{ path: string; publicUrl?: string }> => {
    const supabase = getSupabase();
    const safeBucket = bucket || FAX_STORAGE_BUCKET;
    const filename = file instanceof File ? file.name : `blob-${Date.now()}.bin`;
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const rawExtension = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
    const safeExtension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '');
    const extension = safeExtension || 'bin';
    const filePath = `public/${uniqueId}.${extension}`;
    const { data, error } = await supabase.storage.from(safeBucket).upload(filePath, file);
    if (error) {
        throw formatSupabaseError(`Failed to upload to ${safeBucket}`, error as unknown as PostgrestError);
    }
    const { data: urlData } = supabase.storage.from(safeBucket).getPublicUrl(data.path);
    return { path: data.path, publicUrl: urlData?.publicUrl };
};


export const getInboxItems = async (): Promise<InboxItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inbox_items').select('*').order('created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch inbox items');

    return (data || []).map(item => {
        const { data: urlData } = supabase.storage.from('inbox').getPublicUrl(item.file_path);
        return {
            id: item.id, fileUrl: urlData.publicUrl, extractedData: item.extracted_data, errorMessage: item.error_message,
            createdAt: item.created_at, fileName: item.file_name, filePath: item.file_path, mimeType: item.mime_type, status: item.status,
        }
    });
};

export const addInboxItem = async (item: Omit<InboxItem, 'id' | 'createdAt' | 'fileUrl'>): Promise<InboxItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inbox_items').insert({
        file_name: item.fileName, file_path: item.filePath, mime_type: item.mimeType, status: item.status,
        extracted_data: item.extractedData, error_message: item.errorMessage,
    }).select().single();
    ensureSupabaseSuccess(error, 'Failed to add inbox item');
    return data as InboxItem;
};

export const updateInboxItem = async (id: string, updates: Partial<InboxItem>): Promise<InboxItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inbox_items').update({
        status: updates.status, extracted_data: updates.extractedData,
    }).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update inbox item');
    
    const { data: urlData } = supabase.storage.from('inbox').getPublicUrl(data.file_path);
    return { ...data, fileUrl: urlData.publicUrl, extractedData: data.extracted_data } as InboxItem;
};

export const deleteInboxItem = async (itemToDelete: InboxItem): Promise<void> => {
    const supabase = getSupabase();
    const { error: storageError } = await supabase.storage.from('inbox').remove([itemToDelete.filePath]);
    if (storageError) console.error("Storage deletion failed, proceeding with DB deletion:", storageError);

    const { error: dbError } = await supabase.from('inbox_items').delete().eq('id', itemToDelete.id);
    if (dbError) throw formatSupabaseError('Failed to delete inbox item from DB', dbError);
};

export const updateJobReadyToInvoice = async (jobId: string, value: boolean): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('jobs').update({ ready_to_invoice: value }).eq('id', jobId);
    ensureSupabaseSuccess(error, 'Failed to update job ready status');
};

export const getPayables = async (filters: { status?: string, startDate?: string, endDate?: string }): Promise<PayableItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_payables', {
        p_status: filters.status,
        p_due_date_start: filters.startDate,
        p_due_date_end: filters.endDate,
    });

    ensureSupabaseSuccess(error, 'Failed to fetch payables');
    return (data || []).map((row: any) => ({
        id: row.id,
        supplier: row.supplier,
        category: row.category ?? null,
        amount: Number(row.amount ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
        date: row.date ?? '',
        due: row.due_date ?? '',
        status: (row.status ?? 'outstanding') as PayableItem['status'],
        method: row.method ?? null,
        invoiceImage: row.invoice_img ?? null,
        journalLineId: row.journal_line_id ?? null,
    }));
};

export const getReceivables = async (filters: { status?: string, startDate?: string, endDate?: string }): Promise<ReceivableItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_receivables', {
        p_status: filters.status,
        p_due_date_start: filters.startDate,
        p_due_date_end: filters.endDate,
    });

    ensureSupabaseSuccess(error, 'Failed to fetch receivables');
    return (data || []).map((row: any) => ({
        id: row.id,
        customer: row.customer,
        category: row.category ?? null,
        amount: Number(row.amount ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
        date: row.date ?? '',
        due_date: row.due_date ?? '',
        status: (row.status ?? 'outstanding') as ReceivableItem['status'],
        journalLineId: row.journal_line_id ?? null,
    }));
};

export const getCashSchedule = async (period: { startDate: string, endDate: string }): Promise<CashScheduleData[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_cash_schedule', {
        p_start_date: period.startDate,
        p_end_date: period.endDate,
    });

    ensureSupabaseSuccess(error, 'Failed to fetch cash schedule');
    return (data || []).map((row: any) => ({
        date: row.date,
        opening_balance: Number(row.opening_balance ?? 0),
        inflows: Number(row.inflows ?? 0),
        outflows: Number(row.outflows ?? 0),
        closing_balance: Number(row.closing_balance ?? 0),
    }));
};
