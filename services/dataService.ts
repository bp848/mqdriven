import { getSupabase, getSupabaseFunctionHeaders } from './supabaseClient';
import { sendApprovalNotification, sendApprovalRouteCreatedNotification } from './notificationService';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import {
    EmployeeUser,
    AccountingStatus,
    Job,
    JobCreationPayload,
    JobStatus,
    Project,
    Customer,
    CustomerInfo,
    JournalEntry,
    JournalEntryLine,
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
    CustomerBudgetSummary,
    AnalysisHistory,
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
    // Fallback to the standard 窶懃匱豕ｨ貂遺・state so UI badges remain consistent.
    return PurchaseOrderStatus.Ordered;
};

const parseNumericValue = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const cleaned = String(value)
        .trim()
        .replace(/[ﾂ･・･蜀・]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^\d.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
};

const toNumberOrNull = (value: unknown): number | null => parseNumericValue(value);
const toNumberOrZero = (value: unknown): number => parseNumericValue(value) ?? 0;

const toStringOrNull = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const dbProjectToProject = (row: any): Project => ({
    id: row.id,
    projectCode: toStringOrNull(row.project_code),
    customerCode: toStringOrNull(row.customer_code ?? row.customer?.customer_code),
    customerName: toStringOrNull(row.customer_name ?? row.customer?.customer_name),
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

const DEFAULT_RINGI_BUCKET =
    resolveEnvValue('VITE_RINGI_BUCKET')
    || resolveEnvValue('NEXT_PUBLIC_RINGI_BUCKET')
    || resolveEnvValue('RINGI_BUCKET')
    || 'ringi';

const normalizeLookupKey = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const key = String(value).trim();
    return key.length > 0 ? key : null;
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const filterUuidValues = (values: string[]): string[] => values.filter(v => UUID_REGEX.test(v));

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
    authorName: row.author?.name ?? row.user?.name ?? row.author_name ?? '荳肴・縺ｪ繝ｦ繝ｼ繧ｶ繝ｼ',
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
    authorName: row.author?.name ?? row.author_name ?? '荳肴・縺ｪ繝ｦ繝ｼ繧ｶ繝ｼ',
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
const dbJobToJob = (project: any): Job => {
    const quantity = toNumberOrNull(project.quantity) ?? 0;
    const amount = toNumberOrNull(project.amount) ?? 0;
    const totalCost = toNumberOrNull(project.total_cost) ?? 0;

    return {
        id: project.id,
        jobNumber: typeof project.project_code === 'number'
            ? project.project_code
            : parseInt(project.project_code, 10) || 0,
        projectCode: project.project_code ?? null,
        clientName: project.customer_name || project.customer_code || '未設定',
        customerId: project.customer_id ?? null,
        customerCode: project.customer_code ?? null,
        title: project.project_name || '',
        status: mapProjectStatus(project.project_status || project.status),
        dueDate: project.delivery_date || '',
        quantity,
        paperType: '',
        finishing: '',
        details: '',
        createdAt: project.create_date || project.created_at || new Date().toISOString(),
        price: amount,
        variableCost: totalCost,
        totalQuantity: quantity,
        totalAmount: amount,
        totalCost,
        grossMargin: amount - totalCost,
        invoiceStatus: InvoiceStatus.Uninvoiced,
        invoicedAt: null,
        paidAt: null,
        readyToInvoice: false,
        invoiceId: null,
        manufacturingStatus: ManufacturingStatus.OrderReceived,
    };
};

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
    const quantity = toNumberOrZero(order.quantity ?? order.quantity_num ?? order.copies ?? 0);
    const salesAmount = toNumberOrNull(
        order.sales_amount ?? order.sales_amount_num ?? order.order_amount_num ?? order.amount ?? order.subamount ?? order.total_amount,
    );
    const unitPriceExplicit = toNumberOrNull(order.unit_price ?? order.unit_price_num);
    const rawAmount = salesAmount ?? toNumberOrNull(order.amount ?? order.subamount ?? order.total_amount);
    const computedAmount = rawAmount ?? (unitPriceExplicit !== null ? unitPriceExplicit * quantity : null);
    const unitPrice =
        unitPriceExplicit ?? (quantity > 0 && computedAmount !== null ? computedAmount / quantity : computedAmount ?? null);
    const costAmount = toNumberOrNull(
        order.variable_cost_amount ?? order.variable_cost_num ?? order.total_cost ?? order.subamount ?? order.amount,
    );
    const projectCode = order.project_code || order.order_code || order.project_id || '';

    return {
        id: order.id ?? order.order_id,
        supplierName: order.client_custmer || order.customer_name || '',
        paymentRecipientId: order.payment_recipient_id ?? null,
        itemName: projectCode,
        projectId: order.project_id ?? null,
        projectCode,
        orderCode: order.order_code ?? null,
        orderDate: order.order_date || order.create_date || '',
        quantity,
        unitPrice: unitPrice ?? 0,
        amount: computedAmount ?? 0,
        subamount: toNumberOrNull(order.subamount ?? order.total_amount),
        copies: toNumberOrNull(order.copies),
        totalCost: costAmount ?? 0,
        status: mapOrderStatus(order.approval_status1 || order.status || order.status_label),
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
        const snakeKey = CUSTOMER_FIELD_OVERRIDES[camelKey] ?? String(camelKey).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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
        const snakeKey = String(camelKey).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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
        // ai_investigation 縺・JSON 譁・ｭ怜・縺ｨ縺励※菫晏ｭ倥＆繧後※縺・ｋ蝣ｴ蜷医ｂ閠・・
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
        assignedTo: dbLead.assigned_to ?? null,
        statusUpdatedAt: dbLead.status_updated_at ?? null,
        estimateSentAt: dbLead.estimate_sent_at ?? null,
        estimateSentBy: dbLead.estimate_sent_by ?? null,
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
        const snakeKey = String(camelKey).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = lead[camelKey];
    }
    return dbData;
};

const extractMissingColumnName = (message: string | undefined | null): string | null => {
    if (!message) return null;
    const candidates = [
        /Could not find the '([^']+)' column/i,
        /column "([^"]+)" of relation/i,
        /column ([a-zA-Z0-9_]+) does not exist/i,
        /column "([^"]+)" does not exist/i,
    ];
    for (const pattern of candidates) {
        const match = message.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
};

const stripMissingColumns = (payload: Record<string, any>, error: PostgrestError): boolean => {
    const missing = extractMissingColumnName(error.message);
    if (!missing) return false;
    if (!(missing in payload)) return false;
    delete payload[missing];
    return true;
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

const normalizeAccountingStatus = (value: any): AccountingStatus => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw === 'drafted' || raw === 'draft') return AccountingStatus.DRAFT;
    if (raw === 'posted') return AccountingStatus.POSTED;
    // 'pending'は未定義値（データ不整合）なのでNONEに正規化
    if (raw === 'pending') return AccountingStatus.NONE;
    return AccountingStatus.NONE;
};

const dbApplicationToApplication = (app: any): Application => ({
    id: app.id,
    applicantId: app.applicant_id,
    applicationCodeId: app.application_code_id,
    formData: app.form_data,
    documentUrl: app.document_url ?? app.form_data?.documentUrl ?? null,
    status: app.status,
    accountingStatus: normalizeAccountingStatus(app.accounting_status),
    accounting_status: normalizeAccountingStatus(app.accounting_status),
    handlingStatus: app.handling_status ?? 'unhandled',
    handlingUpdatedAt: app.handling_updated_at ?? null,
    handlingUpdatedBy: app.handling_updated_by ?? null,
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

    // Try the enhanced query first (with relationship), fallback to basic query
    let projectRows: any[] = [];
    let projectError: any = null;

    try {
        // Use basic query without relationship since customers() doesn't exist
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('update_date', { ascending: false })
            .order('project_code', { ascending: false });

        if (error) throw error;
        projectRows = data || [];
    } catch (err) {
        console.error('Error fetching projects:', err);
        projectRows = [];
    }

    const { data: customerRows, error: customerError } = await supabase
        .from('customers')
        .select('id, customer_code, customer_name');

    if (customerError) console.warn('Failed to fetch customers for project mapping:', customerError.message);

    const customerById = new Map<string, { customer_name: string; customer_code: string | null }>();
    const customerByCode = new Map<string, { customer_name: string; customer_code: string | null }>();
    (customerRows || []).forEach(customer => {
        const idKey = normalizeLookupKey(customer.id);
        const codeKey = normalizeLookupKey(customer.customer_code);
        if (!idKey && !codeKey) return;
        const payload = {
            customer_name: customer.customer_name || '未設定',
            customer_code: codeKey,
        };
        if (idKey) customerById.set(idKey, payload);
        if (codeKey) customerByCode.set(codeKey, payload);
    });

    return (projectRows || []).map(project => {
        // Check if customer data is already included from the relationship query
        if (project.customers) {
            const merged = {
                ...project,
                customer_name: project.customers.customer_name ?? project.customer_name ?? null,
                customer_code: project.customers.customer_code ?? project.customer_code ?? null,
            };
            return dbProjectToProject(merged);
        }

        // Fallback to manual lookup
        const projectCustomerId = normalizeLookupKey(project.customer_id);
        const projectCustomerCode = normalizeLookupKey(project.customer_code);
        const customerInfo =
            (projectCustomerId && customerById.get(projectCustomerId)) ||
            (projectCustomerCode && customerByCode.get(projectCustomerCode)) ||
            null;

        const merged = {
            ...project,
            customer_name: customerInfo?.customer_name ?? project.customer_name ?? null,
            customer_code: customerInfo?.customer_code ?? project.customer_code ?? null,
        };

        return dbProjectToProject(merged);
    });
};

export const getJobs = async (): Promise<Job[]> => {
    const supabase = getSupabase();
    const [
        { data: projectRows, error: projectError },
        { data: customerRows, error: customerError },
    ] = await Promise.all([
        supabase.from('projects').select('*').order('updated_at', { ascending: false }),
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
            customer_name: customer.customer_name || '未設定',
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

    // Prefer orders_list_view for cleaned numeric fields; fallback to raw table if unavailable.
    const tryView = async () => {
        let viewQuery = supabase.from('orders_list_view').select('*').order('order_date', { ascending: false });
        if (filters.startDate) viewQuery = viewQuery.gte('order_date', filters.startDate);
        if (filters.endDate) viewQuery = viewQuery.lte('order_date', filters.endDate);
        const { data, error } = await viewQuery;
        if (error) {
            console.warn('[fetchPurchaseOrdersWithFilters] orders_list_view unavailable, falling back to orders table', error.message);
            return null;
        }
        return data;
    };

    const viewRows = await tryView();
    if (viewRows) {
        return viewRows.map(dbOrderToPurchaseOrder);
    }

    let tableQuery = supabase.from('orders').select('*').order('order_date', { ascending: false });
    if (filters.startDate) tableQuery = tableQuery.gte('order_date', filters.startDate);
    if (filters.endDate) tableQuery = tableQuery.lte('order_date', filters.endDate);

    const { data, error } = await tableQuery;
    ensureSupabaseSuccess(error, 'Failed to fetch purchase orders');
    return (data || []).map(dbOrderToPurchaseOrder);
};

const normalizeProjectKey = (job: Job): string | null => {
    if (job.projectCode) return String(job.projectCode);
    if (job.jobNumber) return String(job.jobNumber);
    return null;
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

const fetchProjectFinancialView = async (): Promise<any[] | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('project_financials_view').select('*');
    if (error) {
        console.warn('[getProjectBudgetSummaries] project_financials_view unavailable, falling back to legacy aggregation', error.message);
        return null;
    }
    return data || [];
};

const mapFinancialRowToSummary = (
    row: any,
    relatedOrders: PurchaseOrder[],
    customerLookup?: Map<string, { name: string; code: string | null }>,
): ProjectBudgetSummary => {
    const projectCodeText = toStringOrNull(row.project_code);
    const projectId = toStringOrNull(row.project_id);
    const totals = relatedOrders.reduce(
        (agg, order) => {
            const quantity = toNumberOrZero(order.quantity);
            const unitPrice = toNumberOrZero(order.unitPrice);
            const revenueSource = toNumberOrZero(order.amount ?? order.subamount ?? unitPrice * quantity);
            const costSource = toNumberOrZero(order.totalCost ?? order.subamount ?? order.amount);
            agg.quantity += quantity;
            agg.revenue += revenueSource;
            agg.cost += costSource;
            return agg;
        },
        { quantity: 0, revenue: 0, cost: 0 }
    );

    const salesActual = toNumberOrZero(row.sales_actual ?? row.sales_amount);
    const costActual = toNumberOrZero(row.cost_actual ?? row.variable_cost_amount);
    const totalAmount = salesActual || totals.revenue;
    const totalCost = costActual || totals.cost;
    const jobNumber =
        typeof row.project_code === 'number'
            ? row.project_code
            : parseInt(projectCodeText || '', 10) || 0;

    const customerId = row.customer_id ?? null;
    const customerCode = row.customer_code ?? null;
    const customerName =
        (customerId && customerLookup?.get(String(customerId))?.name) ||
        (customerCode && customerLookup?.get(String(customerCode))?.name) ||
        row.customer_name ||
        row.customer_id ||
        '未設定';

    return {
        id: projectId ?? row.id ?? projectCodeText ?? String(jobNumber),
        jobNumber,
        projectCode: projectCodeText,
        clientName: customerName,
        customerId,
        customerCode,
        title: row.project_name ?? '',
        status: mapProjectStatus(row.status),
        dueDate: row.due_date || row.estimated_delivery_date || '',
        quantity: totals.quantity,
        paperType: '',
        finishing: '',
        details: '',
        createdAt: row.created_at || new Date().toISOString(),
        price: totalAmount,
        variableCost: totalCost,
        totalQuantity: totals.quantity,
        totalAmount,
        totalCost,
        grossMargin: totalAmount - totalCost,
        invoiceStatus: InvoiceStatus.Uninvoiced,
        invoicedAt: null,
        paidAt: null,
        readyToInvoice: false,
        invoiceId: null,
        manufacturingStatus: ManufacturingStatus.OrderReceived,
        orderCount: relatedOrders.length,
        orderTotalQuantity: totals.quantity,
        orderTotalAmount: totals.revenue,
        orderTotalCost: totals.cost,
        orders: relatedOrders,
    };
};

export const getProjectBudgetSummaries = async (filters: ProjectBudgetFilter = {}): Promise<ProjectBudgetSummary[]> => {
    const supabase = getSupabase();
    const [
        financialRows,
        purchaseOrders,
        customersData,
    ] = await Promise.all([
        fetchProjectFinancialView(),
        fetchPurchaseOrdersWithFilters(filters),
        supabase.from('customers').select('id, customer_code, customer_name'),
    ]);

    const customerLookup = new Map<string, { name: string; code: string | null }>();
    if (!customersData.error && Array.isArray(customersData.data)) {
        customersData.data.forEach((row: any) => {
            const idKey = normalizeLookupKey(row.id);
            const codeKey = normalizeLookupKey(row.customer_code);
            const value = { name: row.customer_name || '未設定', code: row.customer_code ?? null };
            if (idKey) customerLookup.set(idKey, value);
            if (codeKey) customerLookup.set(codeKey, value);
        });
    } else if (customersData.error) {
        console.warn('[getProjectBudgetSummaries] failed to fetch customers for lookup', customersData.error);
    }

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

    if (financialRows) {
        return financialRows.map(row => {
            const projectKey = normalizeLookupKey(row.project_code) || normalizeLookupKey(row.project_id);
            const relatedOrders = projectKey ? ordersByProject.get(projectKey) ?? [] : [];
            return mapFinancialRowToSummary(row, relatedOrders, customerLookup);
        });
    }

    // Legacy fallback: aggregate from projects + orders
    const jobs = await getJobs();
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

export const getJobsWithAggregation = async (): Promise<ProjectBudgetSummary[]> => {
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

export const getCustomerBudgetSummaries = async (): Promise<CustomerBudgetSummary[]> => {
    const supabase = getSupabase();

    try {
        // 譁ｹ譯・: 鬘ｧ螳｢蛻･莠育ｮ励ン繝･繝ｼ繧剃ｽｿ逕ｨ
        const { data, error } = await supabase
            .from('customer_budget_summary_view')
            .select('*')
            .order('total_budget', { ascending: false });

        if (!error && data && data.length > 0) {
            return data.map(mapCustomerBudgetSummary);
        }
    } catch (err) {
        console.warn('Customer budget view not available, using fallback:', err.message);
    }

    // Fallback: calculate manually when view is unavailable.
    return await calculateCustomerBudgetsManually();
};

const calculateCustomerBudgetsManually = async (): Promise<CustomerBudgetSummary[]> => {
    const supabase = getSupabase();

    // Load projects and customers.
    const [
        { data: projectRows, error: projectsError },
        { data: customerRows, error: customersError },
    ] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('customers').select('*'),
    ]);
    ensureSupabaseSuccess(projectsError, 'Failed to load projects for customer budgets');
    ensureSupabaseSuccess(customersError, 'Failed to load customers for customer budgets');
    const projects = projectRows || [];
    const customers = customerRows || [];

    // Collect project IDs.
    const projectIds = projects.map((p: any) => p.id).filter(Boolean);
    const validProjectIds = filterUuidValues(projectIds);
    const { data: orderRows, error: ordersError } = validProjectIds.length
        ? await supabase
            .from('orders')
            .select('id, project_id, amount, order_date, create_date')
            .in('project_id', validProjectIds)
        : { data: [], error: null };
    ensureSupabaseSuccess(ordersError as any, 'Failed to load orders for customer budgets');
    const orders = orderRows || [];

    // Build customer lookup.
    const customerMap = new Map<any, any>();
    customers.forEach((customer: any) => {
        customerMap.set(customer.id, customer);
        if (customer.customer_code) {
            customerMap.set(customer.customer_code, customer);
        }
    });

    const projectByCustomer = new Map<any, any[]>();
    projects.forEach((project: any) => {
        const customerKey = project.customer_id || project.customer_code;
        if (!customerKey) return;

        if (!projectByCustomer.has(customerKey)) {
            projectByCustomer.set(customerKey, []);
        }
        projectByCustomer.get(customerKey).push(project);
    });

    const ordersByProject = new Map<any, any[]>();
    orders.forEach((order: any) => {
        if (!ordersByProject.has(order.project_id)) {
            ordersByProject.set(order.project_id, []);
        }
        ordersByProject.get(order.project_id).push(order);
    });

    // 鬘ｧ螳｢蛻･髮・ｨ医ｒ菴懈・
    const customerBudgets: CustomerBudgetSummary[] = [];

    for (const [customerKey, customerProjects] of projectByCustomer) {
        const customer = customerMap.get(customerKey);
        if (!customer) continue;

        let totalBudget = 0;
        let totalActual = 0;
        let totalCost = 0;
        let projectCount = customerProjects.length;

        customerProjects.forEach((project: any) => {
            totalBudget += project.amount || 0;
            totalCost += project.total_cost || 0;

            const projectOrders = ordersByProject.get(project.id) || [];
            projectOrders.forEach((order: any) => {
                totalActual += order.amount || 0;
            });
        });

        const profitMargin = totalBudget > 0 ? ((totalBudget - totalCost) / totalBudget) * 100 : 0;
        const achievementRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

        customerBudgets.push({
            customerId: customer.id,
            customerCode: customer.customer_code,
            customerName: customer.customer_name,
            totalBudget,
            totalActual,
            totalCost,
            profitMargin,
            achievementRate,
            projectCount,
            projects: customerProjects.map((p: any) => ({
                id: p.id,
                projectCode: p.project_code,
                projectName: p.project_name,
                budget: p.amount || 0,
                actualCost: p.total_cost || 0,
                orders: (ordersByProject.get(p.id) || []).map((o: any) => ({
                    id: o.id,
                    amount: o.amount || 0,
                    orderDate: o.order_date || o.create_date || '',
                }))
            }))
        });
    }

    return customerBudgets.sort((a, b) => b.totalBudget - a.totalBudget);
};

const mapCustomerBudgetSummary = (row: any): CustomerBudgetSummary => ({
    customerId: row.customer_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    totalBudget: row.total_budget,
    totalActual: row.total_actual,
    totalCost: row.total_cost,
    profitMargin: row.profit_margin,
    achievementRate: row.achievement_rate,
    projectCount: row.project_count,
    projects: row.projects || []
});

export const getCustomers = async (): Promise<Customer[]> => {
    const supabase = getSupabase();
    // Fetch customers ordered by latest created_at.
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


export const getJournalEntries = async (status?: string): Promise<JournalEntry[]> => {
    const supabase = getSupabase();
    const targetStatus = status || 'posted';
    // publicスキーマのVIEW経由でaccounting.journal_batchesにアクセス
    const { data: batches, error: batchesError } = await supabase
        .from('v_journal_batches')
        .select('id, status')
        .eq('status', targetStatus);

    if (batchesError) {
        console.warn('Failed to fetch journal batches:', batchesError);
        return [];
    }

    if (!batches || batches.length === 0) {
        return [];
    }

    const batchIds = batches.map(b => b.id).filter(Boolean);
    if (batchIds.length === 0) {
        return [];
    }

    // 明示的にカラムを指定し、リレーションを推測させない
    const { data: entries, error: entriesError } = await supabase
        .from('v_journal_entries')
        .select('id, batch_id, entry_date, description, created_at')
        .in('batch_id', batchIds)
        .order('entry_date', { ascending: false });

    if (entriesError) {
        console.error('Failed to fetch journal entries:', entriesError);
        // エラーをスローせず、空配列を返す（既存の動作を維持）
        return [];
    }

    const batchStatusMap = new Map<string, string>();
    batches.forEach(batch => {
        batchStatusMap.set(batch.id, batch.status);
    });

    return (entries || []).map(entry => ({
        ...entry,
        date: entry.entry_date,
        status: batchStatusMap.get(entry.batch_id) || targetStatus,
    })) as JournalEntry[];
};

export const getJournalEntriesByStatus = async (status: string): Promise<JournalEntry[]> => {
    const supabase = getSupabase();
    // publicスキーマのVIEW経由でaccounting.journal_batchesにアクセス
    const { data: batches, error: batchesError } = await supabase
        .from('v_journal_batches')
        .select('id, status')
        .eq('status', status);

    if (batchesError) {
        console.warn('Failed to fetch journal batches:', batchesError);
        return [];
    }

    if (!batches || batches.length === 0) {
        return [];
    }

    const batchIds = batches.map(b => b.id).filter(Boolean);
    const { data: entries, error: entriesError } = await supabase
        .from('v_journal_entries')
        .select('id, batch_id, entry_date, description, created_at')
        .in('batch_id', batchIds)
        .order('created_at', { ascending: false });
    ensureSupabaseSuccess(entriesError, 'Failed to fetch journal entries');

    if (!entries || entries.length === 0) {
        return [];
    }

    const entryIds = entries.map(e => e.id).filter(Boolean);
    const { data: lines, error: linesError } = await supabase
        .from('v_journal_lines')
        .select('id, journal_entry_id, account_id, debit, credit, description')
        .in('journal_entry_id', entryIds);

    if (linesError) {
        console.warn('Failed to fetch journal entry lines:', linesError);
    }

    const linesByEntryId = new Map<string, JournalEntryLine[]>();
    (lines || []).forEach(line => {
        const entryId = String(line.journal_entry_id || '');
        if (!linesByEntryId.has(entryId)) {
            linesByEntryId.set(entryId, []);
        }
        linesByEntryId.get(entryId)!.push({
            id: line.id,
            journal_entry_id: line.journal_entry_id,
            account_id: line.account_id,
            debit_amount: line.debit,
            credit_amount: line.credit,
            description: line.description,
        });
    });

    const batchStatusMap = new Map<string, string>();
    batches.forEach(batch => {
        batchStatusMap.set(batch.id, batch.status);
    });

    return (entries || []).map(entry => ({
        ...entry,
        date: entry.entry_date,
        status: batchStatusMap.get(entry.batch_id) || status,
        lines: linesByEntryId.get(String(entry.id)) || [],
    })) as JournalEntry[];
};

export const updateJournalEntryStatus = async (journalEntryId: string, status: string): Promise<void> => {
    const supabase = getSupabase();
    // まずjournal_entryを取得
    const { data: entry, error: entryError } = await supabase
        .from('v_journal_entries')
        .select('id, batch_id')
        .eq('id', journalEntryId)
        .single();
    ensureSupabaseSuccess(entryError, 'Failed to fetch journal entry');

    // batch_idからsource_application_idを取得
    const { data: batch, error: batchFetchError } = await supabase
        .from('v_journal_batches')
        .select('id, source_application_id')
        .eq('id', entry.batch_id)
        .single();
    if (batchFetchError) {
        console.warn('Failed to fetch journal batch:', batchFetchError);
    }

    // journal_batchesのstatusを更新
    const { error: batchError } = await supabase
        .from('v_journal_batches')
        .update({
            status,
            posted_at: status === 'posted' ? new Date().toISOString() : null,
        })
        .eq('id', entry.batch_id);
    ensureSupabaseSuccess(batchError, 'Failed to update journal batch status');

    const sourceApplicationId = batch?.source_application_id;
    if (sourceApplicationId && (status === 'posted' || status === 'draft')) {
        const { error: appError } = await supabase
            .from('applications')
            .update({ accounting_status: status })
            .eq('id', sourceApplicationId);
        ensureSupabaseSuccess(appError, 'Failed to update application accounting status');
    }
};

export const addJournalEntry = async (entryData: Omit<JournalEntry, 'id' | 'date'>): Promise<JournalEntry> => {
    const supabase = getSupabase();
    // publicスキーマのVIEW経由でaccounting.journal_batchesにアクセス
    // まずjournal_batchを作成
    const { data: batch, error: batchError } = await supabase
        .from('v_journal_batches')
        .insert({
            status: 'draft',
            created_by: entryData.created_by || null,
        })
        .select('id')
        .single();
    ensureSupabaseSuccess(batchError, 'Failed to create journal batch');

    // journal_entryを作成
    const entryDate = entryData.date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('v_journal_entries')
        .insert({
            batch_id: batch.id,
            entry_date: entryDate,
            description: entryData.description || null,
        })
        .select('id, batch_id, entry_date, description, created_at')
        .single();
    ensureSupabaseSuccess(error, 'Failed to add journal entry');

    return {
        ...data,
        date: data.entry_date,
        status: 'draft',
    } as JournalEntry;
};

const fetchUsersDirectly = async (supabase: SupabaseClient): Promise<EmployeeUser[]> => {
    // Try sequential queries instead of parallel to avoid network congestion
    console.log('[dataService] Fetching users data...');

    let userRows, departmentRows, titleRows;
    let userError, departmentError, titleError;

    try {
        // First fetch users
        console.log('[dataService] Fetching users...');
        const result = await supabase
            .from('users')
            .select('id, name, email, role, created_at, department_id, position_id, is_active')
            .order('name', { ascending: true });
        userRows = result.data;
        userError = result.error;

        if (userError) {
            console.error('[dataService] Users query failed:', userError);
            throw formatSupabaseError('Failed to fetch users', userError);
        }
        console.log(`[dataService] Successfully fetched ${userRows?.length || 0} users`);

        // Then fetch departments
        console.log('[dataService] Fetching departments...');
        const deptResult = await supabase.from('departments').select('id, name');
        departmentRows = deptResult.data;
        departmentError = deptResult.error;

        if (departmentError) {
            console.warn('[dataService] Failed to fetch departments for user mapping:', departmentError.message);
        } else {
            console.log(`[dataService] Successfully fetched ${departmentRows?.length || 0} departments`);
        }

        // Finally fetch titles
        console.log('[dataService] Fetching employee titles...');
        const titleResult = await supabase.from('employee_titles').select('id, name');
        titleRows = titleResult.data;
        titleError = titleResult.error;

        if (titleError) {
            console.warn('[dataService] Failed to fetch titles for user mapping:', titleError.message);
        } else {
            console.log(`[dataService] Successfully fetched ${titleRows?.length || 0} titles`);
        }

    } catch (error) {
        console.error('[dataService] Database query failed:', error);
        throw error;
    }

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
            name: user.name || '未設定',
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

    // Add retry logic with exponential backoff
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[dataService] Attempting to fetch users (attempt ${attempt}/${maxRetries})`);
            return await fetchUsersDirectly(supabase);
        } catch (error: any) {
            console.error(`[dataService] Attempt ${attempt} failed:`, error);

            // Check if it's a network error that might be retryable
            if (isSupabaseUnavailableError(error) && attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`[dataService] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // If it's the last attempt or not a retryable error, throw the appropriate error
            if (isSupabaseUnavailableError(error)) {
                throw new Error('Failed to fetch users: network error communicating with the database.');
            }
            throw error;
        }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Failed to fetch users: maximum retries exceeded');
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
    const payload = leadToDbLead(leadData) as Record<string, any>;
    let lastError: PostgrestError | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('leads').insert(payload).select().single();
        if (!error) return dbLeadToLead(data);

        lastError = error;
        if (isMissingColumnError(error) && stripMissingColumns(payload, error)) {
            continue;
        }
        throw formatSupabaseError('Failed to add lead', error);
    }

    throw formatSupabaseError('Failed to add lead', lastError);
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const supabase = getSupabase();
    const { updatedAt, ...restOfUpdates } = updates;
    const payload = leadToDbLead(restOfUpdates) as Record<string, any>;
    let lastError: PostgrestError | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select().single();
        if (!error) return dbLeadToLead(data);

        lastError = error;
        if (isMissingColumnError(error) && stripMissingColumns(payload, error)) {
            continue;
        }
        throw formatSupabaseError('Failed to update lead', error);
    }

    throw formatSupabaseError('Failed to update lead', lastError);
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
    const dbUpdates = { name: updates.name, route_data: { steps: updates.routeData!.steps.map(s => ({ approver_id: s.approverId })) } };
    const { data, error } = await supabase.from('approval_routes').update(dbUpdates).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update approval route');
    return dbApprovalRouteToApprovalRoute(data);
};
export const deleteApprovalRoute = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('approval_routes').delete().eq('id', id);
    ensureSupabaseSuccess(error, 'Failed to delete approval route');
};

export const getApprovedApplications = async (codes?: string[]): Promise<ApplicationWithDetails[]> => {
    const supabase = getSupabase();
    const query = supabase
        .from('applications')
        .select(`*, applicant:applicant_id(*), application_code:application_code_id(*), approval_route:approval_route_id(*)`)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });
    if (codes && codes.length) {
        query.in('application_code.code', codes);
    }
    const { data, error } = await query;

    ensureSupabaseSuccess(error, 'Failed to fetch approved applications');

    const apps = data || [];
    const mapAppsWithoutJournal = () =>
        apps.map(app => ({
            ...dbApplicationToApplication(app),
            applicant: app.applicant,
            application_code: app.application_code,
            applicationCode: app.application_code,
        }));
    const appIds = apps.map(app => app.id).filter(Boolean);
    if (appIds.length === 0) {
        return mapAppsWithoutJournal();
    }

    // publicスキーマのVIEW経由でaccounting.journal_batchesにアクセス
    const { data: batches, error: batchesError } = await supabase
        .from('v_journal_batches')
        .select('id, source_application_id, status')
        .in('source_application_id', appIds);
    ensureSupabaseSuccess(batchesError, 'Failed to fetch journal batches for approved applications');

    const batchIdToAppId = new Map<string, string>();
    const batchIdToStatus = new Map<string, string>();
    (batches || []).forEach(batch => {
        if (!batch?.id || !batch.source_application_id) return;
        batchIdToAppId.set(batch.id, batch.source_application_id);
        batchIdToStatus.set(batch.id, batch.status || 'draft');
    });

    const batchIds = Array.from(batchIdToAppId.keys());
    if (batchIds.length === 0) {
        return mapAppsWithoutJournal();
    }

    // accountingスキーマのjournal_entriesテーブルを使用
    const { data: journalEntries, error: journalError } = await supabase
        .from('v_journal_entries')
        .select('id, batch_id, entry_date, description, created_at')
        .in('batch_id', batchIds);
    ensureSupabaseSuccess(journalError, 'Failed to fetch journal entries for approved applications');

    const entryByAppId = new Map<string, JournalEntry>();
    (journalEntries || []).forEach(entry => {
        if (!entry?.batch_id) return;
        const applicationId = batchIdToAppId.get(entry.batch_id);
        if (!applicationId) return;
        const journalEntry = {
            ...entry,
            date: entry.entry_date,
            status: batchIdToStatus.get(entry.batch_id) || 'draft',
        } as JournalEntry;
        journalEntry.reference_id = applicationId;
        const existing = entryByAppId.get(applicationId);
        if (!existing) {
            entryByAppId.set(applicationId, journalEntry);
            return;
        }
        const existingTime = existing?.created_at ? new Date(existing.created_at).getTime() : 0;
        const nextTime = journalEntry?.created_at ? new Date(journalEntry.created_at).getTime() : 0;
        if (nextTime >= existingTime) {
            entryByAppId.set(applicationId, journalEntry);
        }
    });

    const entryIds = Array.from(entryByAppId.values()).map(entry => entry.id).filter(Boolean);
    const linesByEntryId = new Map<string, any[]>();
    if (entryIds.length > 0) {
        // publicスキーマのVIEW経由でaccounting.journal_linesにアクセス
        const { data: journalLines, error: linesError } = await supabase
            .from('v_journal_lines')
            .select('id, journal_entry_id, account_id, debit, credit, description')
            .in('journal_entry_id', entryIds);
        ensureSupabaseSuccess(linesError, 'Failed to fetch journal entry lines');

        // account_idからaccount情報を別途取得
        const accountIds = [...new Set((journalLines || []).map(l => l.account_id).filter(Boolean))];
        const accountMap = new Map<string, { code: string; name: string }>();
        if (accountIds.length > 0) {
            const { data: accounts } = await supabase
                .from('chart_of_accounts')
                .select('id, code, name')
                .in('id', accountIds);
            (accounts || []).forEach(acc => {
                accountMap.set(acc.id, { code: acc.code, name: acc.name });
            });
        }

        (journalLines || []).forEach(line => {
            const key = String(line.journal_entry_id || '');
            if (!key) return;
            if (!linesByEntryId.has(key)) {
                linesByEntryId.set(key, []);
            }
            const acc = accountMap.get(line.account_id);
            linesByEntryId.get(key)!.push({
                ...line,
                accounts: acc || null,
            });
        });
    }

    return apps.map(app => {
        const base = dbApplicationToApplication(app) as ApplicationWithDetails;
        const entry = entryByAppId.get(app.id);
        const normalizedStatus = entry ? normalizeAccountingStatus(entry.status || 'draft') : AccountingStatus.NONE;
        const lines = entry ? (linesByEntryId.get(String(entry.id)) || []) : [];
        const mappedCode = app.application_code ? dbApplicationCodeToApplicationCode(app.application_code) : undefined;
        const mappedLines: JournalEntryLine[] = lines.map(line => ({
            id: line.id,
            journal_entry_id: line.journal_entry_id,
            account_id: line.account_id,
            account_code: line.accounts?.code ?? line.account_code,
            account_name: line.accounts?.name ?? line.account_name,
            description: line.description ?? undefined,
            debit_amount: line.debit ?? line.debit_amount ?? undefined,
            credit_amount: line.credit ?? line.credit_amount ?? undefined,
            created_at: line.created_at ?? undefined,
        }));

        return {
            ...base,
            applicant: app.applicant as User | undefined,
            application_code: mappedCode,
            applicationCode: mappedCode,
            accountingStatus: normalizedStatus,
            accounting_status: normalizedStatus,
            journalEntry: entry
                ? {
                    id: entry.id,
                    status: entry.status,
                    date: entry.date,
                    lines: mappedLines,
                }
                : undefined,
        } as ApplicationWithDetails;
    });
};

export const updateApplicationAccountingStatus = async (
    applicationId: string,
    status: string
): Promise<void> => {
    if (!applicationId) throw new Error('applicationId is required');
    if (!status) throw new Error('status is required');

    const supabase = getSupabase();
    const { error } = await supabase
        .from('applications')
        .update({ accounting_status: status })
        .eq('id', applicationId);

    ensureSupabaseSuccess(error, 'Failed to update accounting status');
};

export const setApplicationHandlingStatus = async (
    applicationId: string,
    userId: string,
    handlingStatus: string,
): Promise<void> => {
    if (!applicationId) throw new Error('applicationId is required');
    if (!userId) throw new Error('userId is required');
    if (!handlingStatus) throw new Error('handlingStatus is required');

    const supabase = getSupabase();
    const { error } = await supabase.rpc('set_application_handling_status', {
        p_application_id: applicationId,
        p_user_id: userId,
        p_handling_status: handlingStatus,
    });
    ensureSupabaseSuccess(error, 'Failed to update handling status');
};

export const syncApprovedLeaveToCalendars = async (): Promise<{ created: number; skipped: number; }> => {
    const supabase = getSupabase();

    const [{ data: users, error: usersError }, { data: applications, error: appsError }] = await Promise.all([
        supabase.from('employee_users').select('id, name, email'),
        supabase
            .from('applications')
            .select('id, applicant_id, applicant:applicant_id(name), form_data, application_code:application_code_id(code)')
            .eq('status', 'approved')
            .eq('application_code.code', 'LEV'),
    ]);

    ensureSupabaseSuccess(usersError, 'Failed to fetch users for calendar sync');
    ensureSupabaseSuccess(appsError, 'Failed to fetch approved leave applications');

    const safeUsers = (users || []).filter(u => u.id);
    const leaveApps = (applications || []).filter(app => app.id);
    if (!safeUsers.length || !leaveApps.length) {
        return { created: 0, skipped: 0 };
    }

    const toKey = (appId: string, userId: string) => `leave-${appId}-${userId}`;
    const keys = leaveApps.flatMap(app => safeUsers.map(u => toKey(app.id, u.id)));

    const { data: existing, error: existingError } = await supabase
        .from('calendar_events')
        .select('id, user_id, google_event_id')
        .in('google_event_id', keys);
    ensureSupabaseSuccess(existingError, 'Failed to fetch existing leave events');

    const existingSet = new Set<string>();
    (existing || []).forEach(row => {
        if (row.google_event_id) existingSet.add(row.google_event_id);
    });

    const buildDateIso = (value: string | null | undefined) => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 10);
    };

    const rows: any[] = [];
    for (const app of leaveApps) {
        const start = buildDateIso(app.form_data?.startDate);
        const end = buildDateIso(app.form_data?.endDate ?? app.form_data?.startDate);
        if (!start || !end) continue;
        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate = new Date(`${end}T00:00:00.000Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1); // all-day end is exclusive

        const leaveType = app.form_data?.leaveType || '莨第嚊';
        const applicantField: any = (app as any).applicant;
        const applicantName =
            (!Array.isArray(applicantField) ? applicantField?.name : applicantField?.[0]?.name) || '逕ｳ隲玖・ｸ肴・';

        for (const user of safeUsers) {
            const key = toKey(app.id, user.id);
            if (existingSet.has(key)) continue;
            rows.push({
                user_id: user.id,
                title: `縲蝉ｼ第嚊縲・{applicantName} (${leaveType})`,
                description: `application_id=${app.id}`,
                start_at: startDate.toISOString(),
                end_at: endDate.toISOString(),
                all_day: true,
                source: 'system',
                updated_by_source: 'system',
                google_event_id: key, // reuse to dedupe
            });
        }
    }

    if (!rows.length) {
        return { created: 0, skipped: leaveApps.length };
    }

    const { error: insertError } = await supabase.from('calendar_events').insert(rows);
    ensureSupabaseSuccess(insertError, 'Failed to insert leave events into calendar');

    return { created: rows.length, skipped: leaveApps.length * safeUsers.length - rows.length };
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
    console.log('[submitApplication] payload', { applicationCodeId: appData.applicationCodeId, applicantId });
    const supabase = getSupabase();

    // Ensure the session is available.
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
        throw new Error('セッションがありません。再ログインしてください。');
    }

    const { data: routeData, error: routeError } = await supabase.from('approval_routes').select('route_data').eq('id', appData.approvalRouteId).single();
    if (routeError) {
        console.error('[submitApplication] 謇ｿ隱阪Ν繝ｼ繝亥叙蠕励お繝ｩ繝ｼ:', routeError);
        throw formatSupabaseError('謇ｿ隱阪Ν繝ｼ繝医・蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆', routeError);
    }
    if (!routeData?.route_data?.steps || routeData.route_data.steps.length === 0) {
        throw new Error('承認ルートに承認者が設定されていません。');
    }

    const firstApproverId = routeData.route_data.steps[0].approver_id;
    console.log('[submitApplication] 蛻晄悄謇ｿ隱崎・', firstApproverId);

    const applicationData = {
        application_code_id: appData.applicationCodeId,
        form_data: appData.formData,
        approval_route_id: appData.approvalRouteId,
        document_url: appData.documentUrl ?? appData.formData?.documentUrl ?? null,
        applicant_id: applicantId,
        status: 'pending_approval',
        submitted_at: new Date().toISOString(),
        current_level: 1,
        approver_id: firstApproverId,
    };

    console.log('[submitApplication] 逕ｳ隲九ョ繝ｼ繧ｿ:', applicationData);

    const { data, error } = await supabase.from('applications').insert(applicationData).select().single();

    if (error) {
        console.error('[submitApplication] 逕ｳ隲狗匳骭ｲ繧ｨ繝ｩ繝ｼ:', error);
        throw formatSupabaseError('逕ｳ隲九・逋ｻ骭ｲ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', error);
    }

    console.log('[submitApplication] 逕ｳ隲狗匳骭ｲ謌仙粥:', data);
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
            throw new Error('承認ルートの承認者が見つかりません。');
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
            // 承認時にaccounting_statusをdraftに更新（仕訳生成前）
            // 仕訳が生成されれば後でupdateJournalEntryStatusで更新されるが、
            // 生成失敗時でも会計処理待ち状態を明確にする
            const { error: statusError } = await supabase
                .from('applications')
                .update({ accounting_status: 'draft' })
                .eq('id', app.id);
            if (statusError) {
                console.warn('Failed to update accounting_status on approval:', statusError);
            }

            // 承認時に自動で仕分けプレビューを生成
            try {
                await generateJournalLinesFromApplication(updatedApplication.id);
                // 仕訳生成成功時は既にaccounting_status='draft'なので更新不要
            } catch (journalError) {
                console.warn('Failed to auto-generate journal lines on approval:', journalError);
                // 仕分け生成の失敗は通知しない（手動で後から生成可能）
                // accounting_statusは'draft'のまま（会計処理待ち状態）
            }

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
        throw new Error('この申請を却下する権限がありません。');
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
        throw new Error('この申請を取り下げる権限がありません。');
    }
    if (app.status !== 'pending_approval') {
        throw new Error('承認待ちの申請のみ取り下げ可能です。');
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('applications')
        .update({
            status: 'cancelled',
            approver_id: null,
            rejection_reason: '逕ｳ隲玖・↓繧医ｋ蜿悶ｊ豸医＠',
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
    ensureSupabaseSuccess(error, '蜍伜ｮ夂ｧ醍岼縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
};

export const deactivateAccountItem = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('account_items').update({ is_active: false }).eq('id', id);
    ensureSupabaseSuccess(error, '蜍伜ｮ夂ｧ醍岼縺ｮ辟｡蜉ｹ蛹悶↓螟ｱ謨励＠縺ｾ縺励◆');
};

// Debug helper for payment recipients with service role.
export const debugPaymentRecipientsWithServiceRole = async (): Promise<PaymentRecipient[]> => {
    console.log('[debugPaymentRecipientsWithServiceRole] Running service role diagnostics');

    // 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｭ繝ｼ縺ｧ譁ｰ縺励＞繧ｯ繝ｩ繧､繧｢繝ｳ繝医ｒ菴懈・
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
        console.error('[debugPaymentRecipientsWithServiceRole] 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｭ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ');
        return [];
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
            },
        },
    });

    try {
        const { data, error } = await serviceClient
            .from('payment_recipients')
            .select('id,recipient_code,company_name,recipient_name')
            .limit(10);

        if (error) {
            console.error('[debugPaymentRecipientsWithServiceRole] 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｯ繧ｨ繝ｪ繧ｨ繝ｩ繝ｼ:', error);
            return [];
        }

        console.log(`[debugPaymentRecipientsWithServiceRole] 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ縺ｧ蜿門ｾ・ ${data?.length || 0}莉ｶ`, data);
        return (data || []).map(mapDbPaymentRecipient);
    } catch (err) {
        console.error('[debugPaymentRecipientsWithServiceRole] 萓句､・', err);
        return [];
    }
};

export const getPaymentRecipients = async (q?: string): Promise<PaymentRecipient[]> => {
    console.log(`[getPaymentRecipients] 髢句ｧ・- 讀懃ｴ｢繧ｯ繧ｨ繝ｪ: "${q}"`);
    const supabase = getSupabase();

    // Ensure the session is available.
    const { data: authData } = await supabase.auth.getSession();
    console.log(`[getPaymentRecipients] 隱崎ｨｼ迥ｶ諷・`, {
        hasSession: !!authData.session,
        userId: authData.session?.user?.id,
        userEmail: authData.session?.user?.email
    });

    const buildQuery = (columns: string) => {
        let query = supabase
            .from('payment_recipients')
            .select(columns)
            .order('company_name', { ascending: true })
            .order('recipient_name', { ascending: true });

        // 讀懃ｴ｢繧ｯ繧ｨ繝ｪ縺後≠繧句ｴ蜷医・隍・焚繧ｫ繝ｩ繝繧貞ｯｾ雎｡縺ｫ讀懃ｴ｢
        if (q && q.trim()) {
            const searchTerm = `%${q.trim()}%`;
            query = query.or(`company_name.ilike.${searchTerm},recipient_name.ilike.${searchTerm},recipient_code.ilike.${searchTerm}`);
            console.log(`[getPaymentRecipients] 讀懃ｴ｢譚｡莉ｶ驕ｩ逕ｨ: ${searchTerm}`);
        }

        return query.limit(1000);
    };

    console.log('[getPaymentRecipients] Querying payment recipients');
    let { data, error } = await buildQuery(PAYMENT_RECIPIENT_SELECT);

    if (error && isMissingColumnError(error)) {
        console.warn('payment_recipients table missing extended columns; falling back to legacy schema', error);
        console.log('[getPaymentRecipients] Retrying with legacy schema');
        ({ data, error } = await buildQuery(PAYMENT_RECIPIENT_LEGACY_SELECT));
    }

    if (error) {
        console.error(`[getPaymentRecipients] 繧ｨ繝ｩ繝ｼ:`, error);
        throw error;
    }

    const result = (data || []).map(mapDbPaymentRecipient);
    console.log(`[getPaymentRecipients] 螳御ｺ・- 蜿門ｾ嶺ｻｶ謨ｰ: ${result.length}莉ｶ`, {
        searchQuery: q,
        rawDataCount: data?.length || 0,
        firstFewItems: result.slice(0, 3).map(r => ({ id: r.id, name: r.companyName || r.recipientName }))
    });
    return result;
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
        ensureSupabaseSuccess(fallbackError, '謾ｯ謇募・縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
    } else {
        ensureSupabaseSuccess(error, '謾ｯ謇募・縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
    }
};

export const getGeneralLedger = async (accountId: string, dateRange: { start: string; end: string }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_general_ledger', {
        p_account_id: accountId,
        p_start_date: dateRange.start,
        p_end_date: dateRange.end,
    });

    ensureSupabaseSuccess(error, 'Failed to fetch general ledger');

    // 繧ｬ繝ｼ繝峨Ξ繝ｼ繝ｫ・嗔osted莉戊ｨｳ縺ｮ縺ｿ繧定ｨｱ蜿ｯ
    const postedData = (data || []).filter(entry =>
        entry.status === 'posted' &&
        entry.accounting_status === 'posted'
    );

    return postedData.map(row => ({
        id: row.id,
        date: row.date,
        voucherNo: row.voucher_no,
        description: row.description,
        partner: row.partner,
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        // The 'type' is for UI display only and can be derived on the client
        type: row.debit > 0 ? '借方' : (row.credit > 0 ? '貸方' : 'その他'),
    }));
};


export const createPaymentRecipient = async (item: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
    if (!item.companyName && !item.recipientName) {
        throw new Error('支払先名を入力してください。');
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

    ensureSupabaseSuccess(error, '謾ｯ謇募・縺ｮ逋ｻ骭ｲ縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
    return mapDbPaymentRecipient(data);
};

export const deletePaymentRecipient = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('payment_recipients').delete().eq('id', id);
    ensureSupabaseSuccess(error, '謾ｯ謇募・縺ｮ蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
};

// Analysis history helpers (legacy/no-op fallbacks).
export const getAnalysisHistory = async (): Promise<AnalysisHistory[]> => {
    return [];
};

export const addAnalysisHistory = async (_entry: AnalysisHistory): Promise<void> => {
    return;
};

// Project creation fallback (no-op placeholder for UI callers).
export const addProject = async (_project: Partial<Project>, _files?: any[]): Promise<Project | null> => {
    return null;
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('allocation_divisions').select('*').order('name');
    ensureSupabaseSuccess(error, '謖ｯ蛻・玄蛻・・蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆');
    return (data || []).map(d => ({ ...d, createdAt: d.created_at, isActive: d.is_active }));
};

export const saveAllocationDivision = async (item: Partial<AllocationDivision>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    ensureSupabaseSuccess(error, '謖ｯ蛻・玄蛻・・菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
};

export const deleteAllocationDivision = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').delete().eq('id', id);
    ensureSupabaseSuccess(error, '謖ｯ蛻・玄蛻・・蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
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
    ensureSupabaseSuccess(error, '驛ｨ鄂ｲ縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
};

export const deleteDepartment = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('departments').delete().eq('id', id);
    ensureSupabaseSuccess(error, '驛ｨ鄂ｲ縺ｮ蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
};

export const getTitles = async (): Promise<Title[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('employee_titles').select('*').order('name');
    ensureSupabaseSuccess(error, '蠖ｹ閨ｷ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆');
    return (data || []).map(d => ({ ...d, createdAt: d.created_at, isActive: d.is_active }));
};

export const saveTitle = async (item: Partial<Title>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    ensureSupabaseSuccess(error, '蠖ｹ閨ｷ縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆');
};

export const deleteTitle = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').delete().eq('id', id);
    ensureSupabaseSuccess(error, '蠖ｹ閨ｷ縺ｮ蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
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
    const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch bug reports');
    return (data || []).map(dbBugReportToBugReport);
};
export const addBugReport = async (report: any): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('bug_reports')
        .insert({ ...bugReportToDbBugReport(report), status: BugReportStatus.Open });
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
    // Handle all database fields with proper fallbacks
    const copies = toNumberOrNull(row.copies);
    const unitPrice = toNumberOrNull(row.unit_price);
    const subtotal = toNumberOrNull(row.subtotal) ?? (copies !== null && unitPrice !== null ? copies * unitPrice : null);
    const taxRate = toNumberOrNull(row.tax_rate);
    const taxAmount = toNumberOrNull(row.tax_amount ?? row.consumption);
    const total = toNumberOrNull(row.total) ?? (subtotal !== null && taxAmount !== null ? subtotal + taxAmount : subtotal ?? 0);
    const variableCostAmount = toNumberOrNull(row.valiable_cost ?? row.variable_cost_amount);
    const mqAmount = toNumberOrNull(row.mq_amount);
    const mqRate = toNumberOrNull(row.mq_rate);
    const detailCount = toNumberOrNull(row.detail_count);

    // Project and customer names
    const projectName = toStringOrNull(row.project_name) || toStringOrNull(row.pattern_name);
    const customerName = toStringOrNull(row.customer_name) || projectName || `鬘ｧ螳｢${row.estimates_id || row.id || '荳肴・'}`;

    // Display name
    const displayName = projectName || toStringOrNull(row.specification) || `隕狗ｩ・${row.estimates_id || row.id}`;

    // Dates
    const createdAt = toStringOrNull(row.created_at) || toStringOrNull(row.create_date) || new Date().toISOString();
    const updatedAt = toStringOrNull(row.updated_at) || toStringOrNull(row.update_date) || createdAt;

    // Status mapping
    const status = toStringOrNull(row.status) || 'draft';

    console.log('Mapping estimate:', {
        id: row.estimates_id || row.id,
        projectName,
        customerName,
        status,
        total
    });

    return {
        id: toStringOrNull(row.estimates_id) || toStringOrNull(row.id) || generateEstimateId(),
        estimates_id: toStringOrNull(row.estimates_id),
        project_id: toStringOrNull(row.project_id),
        pattern_no: toStringOrNull(row.pattern_no),
        pattern_name: toStringOrNull(row.pattern_name),
        delivery_place: toStringOrNull(row.delivery_place),
        transaction_method: toStringOrNull(row.transaction_method),
        expiration_date: toStringOrNull(row.expiration_date),
        specification: toStringOrNull(row.specification),
        copies: toStringOrNull(row.copies),
        unit_price: toStringOrNull(row.unit_price),
        tax_rate: toStringOrNull(row.tax_rate),
        note: toStringOrNull(row.note),
        fraction: toStringOrNull(row.fraction),
        approval1: toStringOrNull(row.approval1),
        approval2: toStringOrNull(row.approval2),
        approval3: toStringOrNull(row.approval3),
        approval4: toStringOrNull(row.approval4),
        approval_status1: toStringOrNull(row.approval_status1),
        approval_status2: toStringOrNull(row.approval_status2),
        approval_status3: toStringOrNull(row.approval_status3),
        approval_status4: toStringOrNull(row.approval_status4),
        subtotal: toStringOrNull(row.subtotal),
        consumption: toStringOrNull(row.consumption),
        total: toStringOrNull(row.total),
        valiable_cost: toStringOrNull(row.valiable_cost),
        delivery_date: toStringOrNull(row.delivery_date),
        create_date: toStringOrNull(row.create_date),
        create_id: toStringOrNull(row.create_id),
        update_date: toStringOrNull(row.update_date),
        update_id: toStringOrNull(row.update_id),
        status: status,

        // Frontend fields
        estimateNumber: toNumberOrNull(row.estimate_number ?? row.pattern_no) || 0,
        customerName,
        title: toStringOrNull(row.pattern_name) || toStringOrNull(row.specification) || '見積',
        displayName,
        projectName,
        items: [{
            division: 'その他',
            content: toStringOrNull(row.specification) || toStringOrNull(row.pattern_name) || '見積',
            quantity: copies || 0,
            unit: '式',
            unitPrice: unitPrice || 0,
            price: subtotal || total || 0,
        }],
        taxAmount: taxAmount || 0,
        variable_cost_amount: variableCostAmount || 0,
        mqAmount: mqAmount || 0,
        mqRate: mqRate || 0,
        detail_count: detailCount || 0,
        currency: 'JPY',
        notes: toStringOrNull(row.note),
        created_by: toStringOrNull(row.created_by) || toStringOrNull(row.create_id),
        created_at: createdAt,
        updated_at: updatedAt,
        is_primary_for_project: true,
        valid_until: toStringOrNull(row.valid_until),
        version: toNumberOrNull(row.version) || 1,
        userId: toStringOrNull(row.created_by) || toStringOrNull(row.create_id),
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
    const supabase = getSupabase();

    // 蠑ｷ蛻ｶJOIN: estimates竊恥rojects竊団ustomers
    const { data, error } = await supabase
        .from('estimates')
        .select(`
            *,
            project:projects(id, project_code, project_name, customer_id, customer_code),
            customer:customers!inner(id, customer_name, customer_code)
        `)
        .order('create_date', { ascending: false })
        .limit(200);

    if (error) {
        console.warn('Direct JOIN failed, trying fallback:', error);

        // Fallback: fetch estimates without joins.
        const { data: estimates, error: estimatesError } = await supabase
            .from('estimates')
            .select('*')
            .order('create_date', { ascending: false })
            .limit(200);

        if (estimatesError) throw estimatesError;
        if (!estimates || estimates.length === 0) return [];

        // Fetch projects for lookup.
        const { data: projects } = await supabase
            .from('projects')
            .select('id, project_code, project_name, customer_id, customer_code');

        // Fetch customers for lookup.
        const { data: customers } = await supabase
            .from('customers')
            .select('id, customer_name, customer_code');

        const projectMap = (projects || []).reduce((acc, project) => {
            acc[project.id] = project;
            if (project.project_code) acc[project.project_code] = project;
            return acc;
        }, {} as Record<string, any>);

        const customerMap = (customers || []).reduce((acc, customer) => {
            acc[customer.id] = customer;
            if (customer.customer_code) acc[customer.customer_code] = customer;
            return acc;
        }, {} as Record<string, any>);

        return estimates.map(estimate => {
            const project = projectMap[estimate.project_id] || projectMap[estimate.project_code];
            const customer = project ?
                customerMap[project.customer_id] || customerMap[project.customer_code] :
                null;

            return mapEstimateRow({
                ...estimate,
                project_name: estimate.project_name || project?.project_name,
                customer_name: estimate.customer_name || customer?.customer_name,
            });
        });
    }

    // Map JOIN results.
    return (data || []).map(row => ({
        ...row,
        project_name: row.project?.project_name,
        customer_name: row.customer?.customer_name || '未設定',
    }));
};

export const getEstimatesPage = async (page: number, pageSize: number): Promise<{ rows: Estimate[]; totalCount: number; }> => {
    const supabase = getSupabase();
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;

    // 蜆ｪ蜈・ 鬘ｧ螳｢蜷・譯井ｻｶ蜷阪′隗｣豎ｺ貂医∩縺ｮ繝薙Η繝ｼ繧貞茜逕ｨ
    console.log('Fetching from estimates_working_view...');
    const { data, error, count } = await supabase
        .from('estimates_working_view')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    console.log('Estimates query result:', { error, dataLength: data?.length, count });

    if (!error && data && data.length > 0) {
        return {
            rows: (data || []).map(mapEstimateRow),
            totalCount: count ?? 0,
        };
    }

    console.warn('estimates_list_view not available - please create the database view. Using fallback query. Error:', error);

    const { data: fallbackRows, error: fallbackError, count: fallbackCount } = await supabase
        .from('estimates')
        .select(`
            estimates_id,
            pattern_no,
            pattern_name,
            specification,
            copies,
            unit_price,
            tax_rate,
            total,
            subtotal,
            consumption,
            delivery_date,
            expiration_date,
            delivery_place,
            transaction_method,
            note,
            status,
            create_date,
            update_date,
            project_id
        `, { count: 'exact' })
        .order('create_date', { ascending: false })
        .range(from, to);

    if (fallbackError) {
        console.error('Page query fallback error:', fallbackError);
        throw fallbackError;
    }

    // Build project lookup by project_id / project_code / id.
    let projectMap: Record<string, any> = {};
    {
        const { data: projects, error: projectError } = await supabase
            .from('projects')
            .select('id, project_id, project_name, customer_id, customer_code, project_code');

        if (projectError) {
            console.error('繝励Ο繧ｸ繧ｧ繧ｯ繝域､懃ｴ｢繧ｨ繝ｩ繝ｼ:', projectError);
        } else {
            projectMap = (projects || []).reduce((acc, project) => {
                const keys = [
                    normalizeLookupKey(project.project_id),
                    normalizeLookupKey(project.id),
                    normalizeLookupKey(project.project_code),
                ].filter(Boolean) as string[];
                keys.forEach((k) => { if (k) acc[k] = project; });
                return acc;
            }, {} as Record<string, any>);
        }
    }

    let customerMap: Record<string, any> = {};
    {
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, customer_name, customer_code');

        if (customerError) {
            console.error('鬘ｧ螳｢讀懃ｴ｢繧ｨ繝ｩ繝ｼ:', customerError);
        } else {
            customerMap = (customers || []).reduce((acc, customer) => {
                const keys = [
                    normalizeLookupKey(customer.id),
                    normalizeLookupKey(customer.customer_code),
                ].filter(Boolean) as string[];
                keys.forEach((k) => { if (k) acc[k] = customer; });
                return acc;
            }, {} as Record<string, any>);
        }
    }

    const enrichedRows = (fallbackRows || []).map(row => {
        const project = projectMap[normalizeLookupKey(row.project_id) ?? ''];
        const customer = project ? customerMap[normalizeLookupKey(project?.customer_id) ?? ''] : undefined;
        return {
            ...row,
            project_name: project?.project_name ?? null,
            customer_name: customer?.customer_name ?? null,
        };
    });

    return {
        rows: enrichedRows.map(mapEstimateRow),
        totalCount: fallbackCount ?? 0,
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
class FunctionTimeoutError extends Error {
    constructor(message = 'Function invocation timed out') {
        super(message);
        this.name = 'FunctionTimeoutError';
    }
}

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new FunctionTimeoutError()), timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
    }
};

const invokeFunction = async <T = any>(name: string, options?: { body?: any; headers?: Record<string, string> }) => {
    const supabase = getSupabase();
    const defaultHeaders = await getSupabaseFunctionHeaders(supabase);
    const mergedHeaders = options?.headers?.Authorization
        ? { ...options.headers }
        : { ...defaultHeaders, ...(options?.headers || {}) };
    const invokeOptions = options ? { ...options, headers: mergedHeaders } : { headers: mergedHeaders };
    const { data, error } = await withTimeout(supabase.functions.invoke<T>(name, invokeOptions), 12000);
    if (error) {
        throw new Error(error.message || 'Function invocation failed');
    }
    return data as T;
};

export const getCalendarEvents = async (userId: string): Promise<CalendarEvent[]> => {
    const data = await invokeFunction<{ events?: any[] }>('calendar-events', {
        body: { action: 'list', user_id: userId },
    });
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
        action: 'upsert',
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
    const data = await invokeFunction<{ event: any }>('calendar-events', { body });
    const ev = data?.event;
    if (!ev) throw new Error('Failed to save calendar event');
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
    const body: any = { action: 'delete', id };
    if (userId) body.user_id = userId;
    await invokeFunction('calendar-events', { body });
};

export const syncSystemCalendarToGoogle = async (userId: string, opts?: { timeMin?: string; timeMax?: string; }) => {
    const body: any = { user_id: userId, action: 'push' };
    if (opts?.timeMin) body.timeMin = opts.timeMin;
    if (opts?.timeMax) body.timeMax = opts.timeMax;
    return invokeFunction('google-calendar-sync', { body });
};

export const pullGoogleCalendarToSystem = async (userId: string, opts?: { timeMin?: string; timeMax?: string; }) => {
    const body: any = { user_id: userId, action: 'pull' };
    if (opts?.timeMin) body.timeMin = opts.timeMin;
    if (opts?.timeMax) body.timeMax = opts.timeMax;
    return invokeFunction('google-calendar-sync', { body });
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
        .in('id', filterUuidValues(jobIds));

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
    // publicスキーマのVIEW経由でaccounting.journal_batchesにアクセス
    const { data: batches, error: batchesError } = await supabase
        .from('v_journal_batches')
        .select('id, status')
        .eq('status', 'draft');

    if (batchesError) {
        console.warn('Failed to fetch journal batches:', batchesError);
        return [];
    }

    if (!batches || batches.length === 0) {
        return [];
    }

    const batchIds = batches.map(b => b.id).filter(Boolean);
    const { data: entries, error: entriesError } = await supabase
        .from('v_journal_entries')
        .select('id, batch_id, entry_date, description')
        .in('batch_id', batchIds)
        .order('entry_date', { ascending: false });

    ensureSupabaseSuccess(entriesError, '仕訳下書きの取得に失敗しました。');

    if (!entries || entries.length === 0) {
        return [];
    }

    const entryIds = entries.map(e => e.id).filter(Boolean);
    const { data: lines, error: linesError } = await supabase
        .from('v_journal_lines')
        .select('journal_entry_id, account_id, debit, credit, description')
        .in('journal_entry_id', entryIds);

    if (linesError) {
        console.warn('Failed to fetch journal entry lines:', linesError);
    }

    // account_idからaccount情報を別途取得
    const accountIds = [...new Set((lines || []).map(l => l.account_id).filter(Boolean))];
    const accountMap = new Map<string, { code: string; name: string }>();
    if (accountIds.length > 0) {
        const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, code, name')
            .in('id', accountIds);
        (accounts || []).forEach(acc => {
            accountMap.set(acc.id, { code: acc.code, name: acc.name });
        });
    }

    const linesByEntryId = new Map<string, any[]>();
    (lines || []).forEach(line => {
        const entryId = String(line.journal_entry_id || '');
        if (!linesByEntryId.has(entryId)) {
            linesByEntryId.set(entryId, []);
        }
        const acc = accountMap.get(line.account_id);
        linesByEntryId.get(entryId)!.push({
            ...line,
            accounts: acc || null,
        });
    });

    // Transform to DraftJournalEntry format
    return entries
        .filter(entry => {
            const entryLines = linesByEntryId.get(String(entry.id)) || [];
            return entryLines.length > 0;
        })
        .map((entry: any) => {
            const entryLines = linesByEntryId.get(String(entry.id)) || [];
            const debitLine = entryLines.find((l: any) => (l.debit || l.debit_amount) > 0);
            const creditLine = entryLines.find((l: any) => (l.credit || l.credit_amount) > 0);

            return {
                batchId: entry.batch_id || entry.id,
                date: entry.entry_date || entry.date,
                description: entry.description,
                status: 'draft',
                debitAccount: debitLine?.accounts?.name || debitLine?.account_items?.name || '未設定',
                creditAccount: creditLine?.accounts?.name || creditLine?.account_items?.name || '未設定',
                debitAmount: debitLine?.debit || debitLine?.debit_amount || null,
                creditAmount: creditLine?.credit || creditLine?.credit_amount || null,
                source: 'application',
                confidence: entryLines.length > 0 ? 0.8 : 0,
            };
        });
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
        const headers = await getSupabaseFunctionHeaders(supabase);
        const { error } = await supabase.functions.invoke(getFaxOcrFunctionName(), { body: payload, headers });
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

const parseStorageObjectRef = (rawUrl?: string | null): { bucket: string; path: string } | null => {
    if (!rawUrl) return null;
    try {
        const { pathname } = new URL(rawUrl);
        const segments = pathname.split('/').filter(Boolean);
        const objectIndex = segments.indexOf('object');
        if (objectIndex === -1 || segments.length <= objectIndex + 1) return null;

        let bucket = segments[objectIndex + 1];
        let pathStart = objectIndex + 2;

        if (['public', 'sign', 'auth', 'authenticated'].includes(bucket)) {
            bucket = segments[objectIndex + 2];
            pathStart = objectIndex + 3;
        }

        if (!bucket) return null;
        const path = segments.slice(pathStart).join('/');
        if (!path) return null;
        return { bucket, path };
    } catch {
        return null;
    }
};

export const resolveAttachmentUrl = async (
    publicUrl?: string | null,
    storagePath?: string | null,
    options?: { expiresIn?: number; fallbackBucket?: string },
): Promise<string | null> => {
    const trimmedUrl = publicUrl?.trim() || null;
    const trimmedPath = storagePath?.trim() || null;

    const parsed = parseStorageObjectRef(trimmedUrl);
    const bucket = parsed?.bucket || (trimmedPath ? (options?.fallbackBucket || DEFAULT_RINGI_BUCKET) : null);
    const path = parsed?.path || trimmedPath;

    if (!bucket || !path) {
        return trimmedUrl;
    }

    try {
        const { data, error } = await getSupabase()
            .storage
            .from(bucket)
            .createSignedUrl(path, options?.expiresIn ?? 3600);

        if (error) {
            console.warn('[storage] Failed to create signed URL', error);
            return trimmedUrl;
        }

        return data?.signedUrl || trimmedUrl;
    } catch (err) {
        console.warn('[storage] Unexpected error while resolving attachment URL', err);
        return trimmedUrl;
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

export const generateJournalLinesFromApplication = async (
    applicationId: string,
    userId?: string
): Promise<{ journalEntryId: string; lines: any[] }> => {
    const supabase = getSupabase();

    // RPCで作成/取得（既存でもエラーにしない）
    const { data, error } = await supabase.rpc('generate_journal_lines_from_application', {
        p_application_id: applicationId,
        p_user_id: userId || null,
    });

    if (error) {
        throw new Error(`Failed to generate journal lines: ${error.message}`);
    }

    if (!data || data.length === 0) {
        throw new Error('No journal lines were generated');
    }

    const journalEntryId = (data as any)[0].journal_entry_id;
    const lines = (data as any).map((row: any) => ({
        id: row.line_id,
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        debitAmount: Number(row.debit_amount || 0),
        creditAmount: Number(row.credit_amount || 0),
        description: row.description,
    }));

    // 仕訳生成成功時にaccounting_statusをdraftに更新
    // （承認時に既に更新されている場合もあるが、二重更新は問題ない）
    const { error: statusError } = await supabase
        .from('applications')
        .update({ accounting_status: 'draft' })
        .eq('id', applicationId);
    if (statusError) {
        console.warn('Failed to update accounting_status after journal generation:', statusError);
        // エラーでも処理は続行（仕訳は生成済み）
    }

    return { journalEntryId, lines };
};

// Legacy alias used by older screens.
export const createJournalFromApplication = async (
    applicationId: string,
    _userId?: string
): Promise<{ journalEntryId: string; lines: any[] }> => {
    return generateJournalLinesFromApplication(applicationId);
};

// VIEW-based data fetching functions for accounting pages
export const getJournalBookData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_journal_book').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch journal book data');
    return data || [];
};

export const getGeneralLedgerData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_general_ledger').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch general ledger data');
    return data || [];
};

export const getTrialBalanceData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_trial_balance').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch trial balance data');
    return data || [];
};

export const getTaxSummaryData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_tax_summary').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch tax summary data');
    return data || [];
};

// Management stub data functions
export const getInventoryData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_inventory_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch inventory data');
    return data || [];
};

export const getManufacturingData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_manufacturing_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch manufacturing data');
    return data || [];
};

export const getPurchasingData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_purchasing_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch purchasing data');
    return data || [];
};

export const getAttendanceData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_attendance_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch attendance data');
    return data || [];
};

export const getManHoursData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_man_hours_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch man-hours data');
    return data || [];
};

export const getLaborCostData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_labor_cost_stub').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch labor cost data');
    return data || [];
};

// Expense analysis data functions
// 仕様: docs/accounting/expense-analysis-view-spec.md
// 
// 経費分析用のVIEWデータ取得関数群
// - v_expense_lines: 仕訳明細1行 = 1レコード（費用勘定のみ）
// - v_expense_by_month_*: 月単位の集計ビュー
// 
// 注意: posted判定のフィルタリングが必要な場合は、利用側で batch_status='posted' を適用すること
// 例: .eq('batch_status', 'posted')

/**
 * 経費明細データを取得
 * @returns 費用勘定に該当する仕訳明細の配列（amount = debit - credit）
 * @see docs/accounting/expense-analysis-view-spec.md
 */
export const getExpenseLinesData = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_expense_lines').select('*').order('occurred_on', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch expense lines data');
    return data || [];
};

/**
 * 月次×勘定科目別の経費集計データを取得
 * @returns 月単位で勘定科目ごとに集計された経費データ
 * @see docs/accounting/expense-analysis-view-spec.md
 */
export const getExpenseByMonthAccount = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_expense_by_month_account').select('*').order('month', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch expense by month and account data');
    return data || [];
};

/**
 * 月次×仕入先別の経費集計データを取得
 * @returns 月単位で仕入先ごとに集計された経費データ
 * @see docs/accounting/expense-analysis-view-spec.md
 */
export const getExpenseByMonthSupplier = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_expense_by_month_supplier').select('*').order('month', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch expense by month and supplier data');
    return data || [];
};

/**
 * 月次×プロジェクト別の経費集計データを取得
 * @returns 月単位でプロジェクトごとに集計された経費データ
 * @see docs/accounting/expense-analysis-view-spec.md
 */
export const getExpenseByMonthProject = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_expense_by_month_project').select('*').order('month', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch expense by month and project data');
    return data || [];
};

/**
 * ワークフローイベントデータを取得（申請→承認→仕訳起票のトレース）
 * @returns ワークフローイベントの配列
 * @see docs/accounting/expense-analysis-view-spec.md
 */
export const getExpenseWorkflowEvents = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_expense_workflow_events').select('*').order('workflow_created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch expense workflow events data');
    return data || [];
};

// Application analysis data functions
/**
 * 日別申請作成数を取得（直近30日）
 * @returns 日別の申請作成数と申請者数
 */
export const getApplicationsDailyCreation = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_applications_daily_creation').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch applications daily creation data');
    return data || [];
};

/**
 * ステータス別申請件数を取得
 * @returns ステータス別の申請件数と割合
 */
export const getApplicationsByStatus = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_applications_by_status').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch applications by status data');
    return data || [];
};

/**
 * 会計処理ステータス別申請件数を取得
 * @returns 会計処理ステータス別の申請件数と割合
 */
export const getApplicationsByAccountingStatus = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_applications_by_accounting_status').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch applications by accounting status data');
    return data || [];
};

/**
 * 提出→承認の平均所要時間を取得（直近90日、SLA分析用）
 * @returns 日別の提出数、承認数、平均所要時間（時間・日数）
 */
export const getApplicationsApprovalSLA = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_applications_approval_sla').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch applications approval SLA data');
    return data || [];
};

/**
 * データ品質チェック結果を取得
 * @returns データ整合性チェックの結果（submitted_at/status整合性、approved_at/rejected_at相互排他など）
 */
export const getApplicationsDataQuality = async (): Promise<any[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('v_applications_data_quality').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch applications data quality data');
    return data || [];
};

// ============================================================
// accounting スキーマへのアクセス用VIEW関数
// PostgRESTはpublicスキーマのみ公開するため、v_* VIEWを経由
// ============================================================

interface PaginationOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
}

const DEFAULT_LIMIT = 100;

export const getJournalBatches = async (options?: PaginationOptions): Promise<any[]> => {
    const supabase = getSupabase();
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'created_at';
    const ascending = options?.ascending ?? false;

    const { data, error } = await supabase
        .from('v_journal_batches')
        .select('*')
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);
    ensureSupabaseSuccess(error, 'Failed to fetch journal batches');
    return data || [];
};

export const getJournalEntriesPaginated = async (batchId?: string, options?: PaginationOptions): Promise<any[]> => {
    const supabase = getSupabase();
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'entry_date';
    const ascending = options?.ascending ?? false;

    let query = supabase.from('v_journal_entries').select('*');
    if (batchId) {
        query = query.eq('batch_id', batchId);
    }
    const { data, error } = await query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);
    ensureSupabaseSuccess(error, 'Failed to fetch journal entries');
    return data || [];
};

export const getJournalLines = async (journalEntryId?: string, options?: PaginationOptions): Promise<any[]> => {
    const supabase = getSupabase();
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'created_at';
    const ascending = options?.ascending ?? false;

    let query = supabase.from('v_journal_lines').select('*');
    if (journalEntryId) {
        query = query.eq('journal_entry_id', journalEntryId);
    }
    const { data, error } = await query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);
    ensureSupabaseSuccess(error, 'Failed to fetch journal lines');
    return data || [];
};

export const getAccounts = async (includeInactive?: boolean): Promise<any[]> => {
    const supabase = getSupabase();
    let query = supabase.from('v_accounts').select('*');
    if (!includeInactive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('sort_order', { ascending: true });
    ensureSupabaseSuccess(error, 'Failed to fetch accounts');
    return data || [];
};

// ============================================================
// accounting 更新系RPC関数
// VIEW経由の更新は制限があるため、SECURITY DEFINER RPCを使用
// ============================================================

export const postJournalBatch = async (batchId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('post_journal_batch', { p_batch_id: batchId });
    ensureSupabaseSuccess(error, 'Failed to post journal batch');
};

export const createJournalBatch = async (
    sourceApplicationId?: string,
    createdBy?: string
): Promise<string> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('create_journal_batch', {
        p_source_application_id: sourceApplicationId ?? null,
        p_created_by: createdBy ?? null,
    });
    ensureSupabaseSuccess(error, 'Failed to create journal batch');
    return data as string;
};

export const createJournalEntry = async (
    batchId: string,
    entryDate: string,
    description?: string
): Promise<string> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('create_journal_entry', {
        p_batch_id: batchId,
        p_entry_date: entryDate,
        p_description: description ?? null,
    });
    ensureSupabaseSuccess(error, 'Failed to create journal entry');
    return data as string;
};

export const addJournalLine = async (
    journalEntryId: string,
    accountId: string,
    debit: number = 0,
    credit: number = 0,
    description?: string,
    projectId?: string
): Promise<string> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('add_journal_line', {
        p_journal_entry_id: journalEntryId,
        p_account_id: accountId,
        p_debit: debit,
        p_credit: credit,
        p_description: description ?? null,
        p_project_id: projectId ?? null,
    });
    ensureSupabaseSuccess(error, 'Failed to add journal line');
    return data as string;
};

export const createJournalFromAiSelection = async (params: {
    applicationId: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    description?: string;
    reasoning?: string;
    confidence?: number;
    createdBy?: string;
}): Promise<{ proposalId: string; runId: string; batchId: string; journalEntryId: string }> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('rpc_create_journal_from_ai_selection', {
        p_application_id: params.applicationId,
        p_debit_account_id: params.debitAccountId,
        p_credit_account_id: params.creditAccountId,
        p_amount: params.amount,
        p_description: params.description ?? null,
        p_reasoning: params.reasoning ?? null,
        p_confidence: params.confidence ?? null,
        p_created_by: params.createdBy ?? null,
    });
    ensureSupabaseSuccess(error, 'Failed to create journal from AI selection');

    const result = data as any;
    return {
        proposalId: result.proposal_id,
        runId: result.run_id,
        batchId: result.batch_id,
        journalEntryId: result.journal_entry_id,
    };
};
