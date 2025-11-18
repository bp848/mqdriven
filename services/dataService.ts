import { getSupabase } from './supabaseClient';
import { sendApprovalNotification } from './notificationService';
import type { PostgrestError } from '@supabase/supabase-js';
import {
    EmployeeUser,
    Job,
    JobCreationPayload,
    JobStatus,
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
} from '../types';

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

const PAYMENT_RECIPIENT_SELECT = `
    id,
    recipient_code,
    company_name,
    recipient_name,
    phone_number,
    bank_name,
    bank_branch,
    bank_account_type,
    bank_account_number,
    invoice_registration_number
`;
const PAYMENT_RECIPIENT_LEGACY_SELECT = 'id, recipient_code, company_name, recipient_name';

const isMissingColumnError = (error?: PostgrestError | null) =>
    Boolean(error?.message && /column.+does not exist/i.test(error.message));

const mapDbPaymentRecipient = (record: any): PaymentRecipient => {
    const branch = record?.bank_branch ?? record?.branch_name ?? null;
    const accountNumber = record?.bank_account_number ?? record?.account_number ?? null;
    const accountType = record?.bank_account_type ?? record?.bankAccountType ?? null;
    return {
        id: record.id,
        recipientCode: record.recipient_code,
        companyName: record.company_name,
        recipientName: record.recipient_name,
        phoneNumber: record.phone_number ?? null,
        bankName: record.bank_name ?? null,
        branchName: branch,
        bankBranch: branch,
        accountNumber,
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
    bank_branch: item.bankBranch ?? item.branchName ?? null,
    bank_account_type: item.bankAccountType ?? null,
    bank_account_number: item.bankAccountNumber ?? item.accountNumber ?? null,
    invoice_registration_number: item.invoiceRegistrationNumber ?? null,
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
    representative: dbCustomer.representative,
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
});

const customerToDbCustomer = (customer: Partial<Customer>): any => {
    const dbData: { [key: string]: any } = {};
    for (const key in customer) {
        const camelKey = key as keyof Customer;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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

type JobSalesSummary = { amount: number; quantity: number };
type JobCostSummary = { cost: number; quantity: number; amount: number };

const fetchJobSalesSummaries = async (): Promise<Map<string, JobSalesSummary>> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('invoice_items')
        .select('job_id, quantity, line_total');

    ensureSupabaseSuccess(error, 'Failed to fetch invoice items for aggregation');

    const summaries = new Map<string, JobSalesSummary>();
    (data || []).forEach(item => {
        const jobId = item?.job_id;
        if (!jobId) return;
        const summary = summaries.get(jobId) || { amount: 0, quantity: 0 };
        summary.amount += Number(item.line_total ?? 0) || 0;
        summary.quantity += Number(item.quantity ?? 0) || 0;
        summaries.set(jobId, summary);
    });
    return summaries;
};

const fetchJobCostSummaries = async (): Promise<Map<string, JobCostSummary>> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('orders')
        .select('project_code, quantity, total_cost, subamount, amount');

    ensureSupabaseSuccess(error, 'Failed to fetch purchase orders for aggregation');

    const summaries = new Map<string, JobCostSummary>();
    (data || []).forEach(order => {
        const projectCode = order?.project_code ? String(order.project_code) : null;
        if (!projectCode) return;
        const summary = summaries.get(projectCode) || { cost: 0, quantity: 0, amount: 0 };
        summary.amount += Number(order.amount ?? order.subamount ?? order.total_cost ?? 0) || 0;
        summary.cost += Number(order.total_cost ?? order.subamount ?? order.amount ?? 0) || 0;
        summary.quantity += Number(order.quantity ?? 0) || 0;
        summaries.set(projectCode, summary);
    });
    return summaries;
};

export const getJobsWithAggregation = async (): Promise<Job[]> => {
    const jobs = await getJobs();

    let salesSummaries: Map<string, JobSalesSummary> | null = null;
    let costSummaries: Map<string, JobCostSummary> | null = null;

    try {
        [salesSummaries, costSummaries] = await Promise.all([
            fetchJobSalesSummaries(),
            fetchJobCostSummaries(),
        ]);
    } catch (error) {
        console.error('Failed to aggregate job totals. Falling back to raw jobs.', error);
        return jobs;
    }

    return jobs.map(job => {
        const sales = salesSummaries?.get(job.id);
        const costKey = job.projectCode ? String(job.projectCode) : job.jobNumber ? String(job.jobNumber) : '';
        const cost = costKey ? costSummaries?.get(costKey) : undefined;

        const totalQuantity = sales?.quantity ?? cost?.quantity ?? job.totalQuantity ?? job.quantity ?? 0;
        const totalAmount = sales?.amount ?? cost?.amount ?? job.totalAmount ?? job.price ?? 0;
        const totalCost = cost?.cost ?? job.totalCost ?? job.variableCost ?? 0;

        return {
            ...job,
            totalQuantity,
            totalAmount,
            totalCost,
            grossMargin: totalAmount - totalCost,
        };
    });
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
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch customers');
    return (data || []).map(dbCustomerToCustomer);
};

export const addCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('customers').insert(customerToDbCustomer(customerData)).select().single();
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
    payload.updated_at = new Date().toISOString();
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

export async function getUsers(): Promise<EmployeeUser[]> {
    const supabase = getSupabase();
    const [
        { data: userRows, error: userError },
        { data: departmentRows, error: departmentError },
        { data: titleRows, error: titleError },
    ] = await Promise.all([
        supabase
            .from('users')
            .select('id, name, email, role, created_at, department_id, position_id')
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
        };
    });
}

export const addUser = async (userData: { name: string, email: string | null, role: 'admin' | 'user' }): Promise<void> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').insert({ email: userData.email, name: userData.name, role: userData.role }).select().single();
    if (error) {
        throw formatSupabaseError('Failed to add user (user must exist in auth.users)', error);
    }
    return;
};

export const updateUser = async (id: string, updates: Partial<EmployeeUser>): Promise<void> => {
    const supabase = getSupabase();
    const { error: userError } = await supabase.from('users').update({ name: updates.name, email: updates.email, role: updates.role }).eq('id', id);
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
    const dbRouteData = { name: routeData.name, route_data: { steps: routeData.routeData.steps.map((s:any) => ({ approver_id: s.approverId })) } };
    const { data, error } = await supabase.from('approval_routes').insert(dbRouteData).select().single();
    ensureSupabaseSuccess(error, 'Failed to add approval route');
    return dbApprovalRouteToApprovalRoute(data);
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

export const getApplications = async (currentUser: User | null): Promise<ApplicationWithDetails[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('applications')
        .select(`*, applicant:applicant_id(*), application_code:application_code_id(*), approval_route:approval_route_id(*)`)
        .or(`applicant_id.eq.${currentUser?.id},approver_id.eq.${currentUser?.id}`)
        .order('created_at', { ascending: false });
        
    ensureSupabaseSuccess(error, 'Failed to fetch applications');
    return (data || []).map(app => ({
        ...dbApplicationToApplication(app),
        applicant: app.applicant,
        applicationCode: app.application_code ? dbApplicationCodeToApplicationCode(app.application_code) : undefined,
        approvalRoute: app.approval_route ? dbApprovalRouteToApprovalRoute(app.approval_route) : undefined,
    }));
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
        application_code_id: appData.applicationCodeId, form_data: appData.formData, approval_route_id: appData.approvalRouteId,
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
            .order('company_name', { nullsFirst: false })
            .order('recipient_name', { nullsFirst: false });
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
        const legacyPayload = {
            recipient_code: payload.recipient_code,
            company_name: payload.company_name,
            recipient_name: payload.recipient_name,
        };
        const { error: fallbackError } = await supabase
            .from('payment_recipients')
            .upsert({ id: item.id, ...legacyPayload });
        ensureSupabaseSuccess(fallbackError, '支払先の保存に失敗しました');
        return;
    }
    ensureSupabaseSuccess(error, '支払先の保存に失敗しました');
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
        const legacyPayload = {
            recipient_code: payload.recipient_code,
            company_name: payload.company_name,
            recipient_name: payload.recipient_name,
        };
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
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });
    ensureSupabaseSuccess(error, 'Failed to fetch purchase orders');
    return (data || []).map(dbOrderToPurchaseOrder);
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

export const getEstimates = async (): Promise<Estimate[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('estimates').select('*');
    ensureSupabaseSuccess(error, 'Failed to fetch estimates');
    return data || [];
};
export const addEstimate = async (estimateData: any): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('estimates').insert(estimateData);
    ensureSupabaseSuccess(error, 'Failed to add estimate');
};

export const updateEstimate = async (id: string, updates: Partial<Estimate>): Promise<Estimate> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('estimates').update(updates).eq('id', id).select().single();
    ensureSupabaseSuccess(error, 'Failed to update estimate');
    return data;
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
    const { data: jobsToInvoice, error: jobsError } = await supabase.from('jobs').select('*').in('id', jobIds);
    if (jobsError) throw formatSupabaseError('Failed to fetch jobs for invoicing', jobsError);
    if (!jobsToInvoice || jobsToInvoice.length === 0) throw new Error("No jobs found for invoicing.");

    const customerName = jobsToInvoice[0].client_name;
    const subtotal = jobsToInvoice.reduce((sum, job) => sum + job.price, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const invoiceNo = `INV-${Date.now()}`;

    const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert({
        invoice_no: invoiceNo, invoice_date: new Date().toISOString().split('T')[0], customer_name: customerName,
        subtotal_amount: subtotal, tax_amount: tax, total_amount: total, status: 'issued',
    }).select().single();
    if (invoiceError) throw formatSupabaseError('Failed to create invoice record', invoiceError);

    const invoiceItems: Omit<InvoiceItem, 'id'>[] = jobsToInvoice.map((job, index) => ({
        invoiceId: newInvoice.id, jobId: job.id, description: `${job.title} (案件番号: ${job.job_number})`,
        quantity: 1, unit: '式', unitPrice: job.price, lineTotal: job.price, sortIndex: index,
    }));
    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems.map(item => ({...item, invoice_id: item.invoiceId, job_id: item.jobId, unit_price: item.unitPrice, line_total: item.lineTotal, sort_index: item.sortIndex})));
    if (itemsError) throw formatSupabaseError('Failed to create invoice items', itemsError);

    const { error: updateJobsError } = await supabase.from('jobs').update({
        invoice_id: newInvoice.id, invoice_status: InvoiceStatus.Invoiced, invoiced_at: new Date().toISOString(),
    }).in('id', jobIds);
    if (updateJobsError) throw formatSupabaseError('Failed to update jobs after invoicing', updateJobsError);

    return { invoiceNo };
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
    updates.updated_at = new Date().toISOString();

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
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
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
