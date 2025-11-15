import { getSupabase } from './supabaseClient';
import {
    EmployeeUser,
    Job,
    JobStatus,
    Customer,
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
} from '../types';

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

// Mappers from snake_case (DB) to camelCase (JS)
const dbJobToJob = (project: any): Job => ({
    id: project.id,
    jobNumber: typeof project.project_code === 'number'
        ? project.project_code
        : parseInt(project.project_code, 10) || 0,
    clientName: project.customer_code || project.client_name || '',
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
    if (job.clientName !== undefined) row.customer_code = job.clientName;
    if (job.title !== undefined) row.project_name = job.title;
    if (job.status !== undefined) row.project_status = job.status;
    if (job.createdAt) row.create_date = job.createdAt;
    if (job.dueDate) row.delivery_date = job.dueDate;
    if (job.quantity !== undefined) row.quantity = job.quantity;
    if (job.price !== undefined) row.amount = job.price;
    if (job.variableCost !== undefined) row.subamount = job.variableCost;
    return row;
};

const dbOrderToPurchaseOrder = (order: any): PurchaseOrder => {
    const quantity = Number(order.quantity ?? 0);
    const totalAmount = Number(order.amount ?? order.subamount ?? order.total_amount ?? 0);
    const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

    return {
        id: order.id,
        supplierName: order.client_custmer || order.customer_name || '',
        itemName: order.project_code || order.order_code || '',
        orderDate: order.order_date || order.create_date || '',
        quantity,
        unitPrice: Number(unitPrice ?? 0),
        status: mapOrderStatus(order.approval_status1 || order.status),
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

const dbLeadToLead = (dbLead: any): Lead => ({
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
    aiInvestigation: dbLead.ai_investigation ? { summary: dbLead.ai_investigation.summary, sources: dbLead.ai_investigation.sources } : undefined,
});

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


export const isSupabaseUnavailableError = (error: any): boolean => {
    if (!error) return false;
    const message = typeof error === 'string' ? error : error.message || error.details || error.error_description;
    if (!message) return false;
    return /fetch failed/i.test(message) || /failed to fetch/i.test(message) || /network/i.test(message);
};

// --- Data Service Functions ---

export const getJobs = async (): Promise<Job[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('project_code', { ascending: false });
    if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
    return (data || []).map(dbJobToJob);
};

export const addJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'jobNumber'>): Promise<Job> => {
    const supabase = getSupabase();
    const dbJob = jobToDbJob({ ...jobData, createdAt: new Date().toISOString() });
    const { data, error } = await supabase.from('projects').insert(dbJob).select().single();
    if (error) throw new Error(`Failed to add job: ${error.message}`);
    return dbJobToJob(data);
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('projects').update(jobToDbJob(updates)).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update job: ${error.message}`);
    return dbJobToJob(data);
};

export const deleteJob = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete job: ${error.message}`);
};

export const getCustomers = async (): Promise<Customer[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
    return (data || []).map(dbCustomerToCustomer);
};

export const addCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('customers').insert(customerToDbCustomer(customerData)).select().single();
    if (error) throw new Error(`Failed to add customer: ${error.message}`);
    return dbCustomerToCustomer(data);
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('customers').update(customerToDbCustomer(updates)).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update customer: ${error.message}`);
    return dbCustomerToCustomer(data);
};


export const getJournalEntries = async (): Promise<JournalEntry[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
    if (error) throw new Error(`Failed to fetch journal entries: ${error.message}`);
    return data || [];
};

export const addJournalEntry = async (entryData: Omit<JournalEntry, 'id'|'date'>): Promise<JournalEntry> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('journal_entries').insert(entryData).select().single();
    if (error) throw new Error(`Failed to add journal entry: ${error.message}`);
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

    if (userError) throw new Error(`Failed to fetch users: ${userError.message}`);
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
    if (error) throw new Error(`Failed to add user: ${error.message}. This might fail if the user doesn't exist in auth.users. An invite flow might be required.`);
    return;
};

export const updateUser = async (id: string, updates: Partial<EmployeeUser>): Promise<void> => {
    const supabase = getSupabase();
    const { error: userError } = await supabase.from('users').update({ name: updates.name, email: updates.email, role: updates.role }).eq('id', id);
    if (userError) throw new Error(`Failed to update user: ${userError.message}`);
};

export const deleteUser = async (userId: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw new Error(`Failed to delete user: ${error.message}`);
};

export const getLeads = async (): Promise<Lead[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`);
    return (data || []).map(dbLeadToLead);
};

export const addLead = async (leadData: Partial<Lead>): Promise<Lead> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('leads').insert(leadToDbLead(leadData)).select().single();
    if (error) throw new Error(`Failed to add lead: ${error.message}`);
    return dbLeadToLead(data);
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const supabase = getSupabase();
    const { updatedAt, ...restOfUpdates } = updates;
    const { data, error } = await supabase.from('leads').update(leadToDbLead(restOfUpdates)).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update lead: ${error.message}`);
    return dbLeadToLead(data);
};

export const deleteLead = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete lead: ${error.message}`);
};

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('approval_routes').select('*');
    if (error) throw new Error(`Failed to fetch approval routes: ${error.message}`);
    return (data || []).map(dbApprovalRouteToApprovalRoute);
};
export const addApprovalRoute = async (routeData: any): Promise<ApprovalRoute> => {
    const supabase = getSupabase();
    const dbRouteData = { name: routeData.name, route_data: { steps: routeData.routeData.steps.map((s:any) => ({ approver_id: s.approverId })) } };
    const { data, error } = await supabase.from('approval_routes').insert(dbRouteData).select().single();
    if (error) throw new Error(`Failed to add approval route: ${error.message}`);
    return dbApprovalRouteToApprovalRoute(data);
};
export const updateApprovalRoute = async (id: string, updates: Partial<ApprovalRoute>): Promise<ApprovalRoute> => {
    const supabase = getSupabase();
    const dbUpdates = { name: updates.name, route_data: { steps: updates.routeData!.steps.map(s => ({ approver_id: s.approverId }))}};
    const { data, error } = await supabase.from('approval_routes').update(dbUpdates).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update approval route: ${error.message}`);
    return dbApprovalRouteToApprovalRoute(data);
};
export const deleteApprovalRoute = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('approval_routes').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete approval route: ${error.message}`);
};

export const getApplications = async (currentUser: User | null): Promise<ApplicationWithDetails[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('applications')
        .select(`*, applicant:applicant_id(*), application_code:application_code_id(*), approval_route:approval_route_id(*)`)
        .or(`applicant_id.eq.${currentUser?.id},approver_id.eq.${currentUser?.id}`)
        .order('created_at', { ascending: false });
        
    if (error) throw new Error(`Failed to fetch applications: ${error.message}`);
    return (data || []).map(app => ({
        id: app.id, applicantId: app.applicant_id, applicationCodeId: app.application_code_id, formData: app.form_data, status: app.status,
        submittedAt: app.submitted_at, approvedAt: app.approved_at, rejectedAt: app.rejected_at, currentLevel: app.current_level,
        approverId: app.approver_id, rejectionReason: app.rejection_reason, approvalRouteId: app.approval_route_id,
        createdAt: app.created_at, updatedAt: app.updated_at,
        applicant: app.applicant,
        applicationCode: app.application_code ? dbApplicationCodeToApplicationCode(app.application_code) : undefined,
        approvalRoute: app.approval_route ? dbApprovalRouteToApprovalRoute(app.approval_route) : undefined,
    }));
};
export const getApplicationCodes = async (): Promise<ApplicationCode[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('application_codes').select('*');
    if (error) throw new Error(`Failed to fetch application codes: ${error.message}`);
    return (data || []).map(dbApplicationCodeToApplicationCode);
};
export const submitApplication = async (appData: any, applicantId: string): Promise<Application> => {
    const supabase = getSupabase();

    const { data: routeData, error: routeError } = await supabase.from('approval_routes').select('route_data').eq('id', appData.approvalRouteId).single();
    if (routeError) throw new Error(`承認ルートの取得に失敗しました: ${routeError.message}`);
    if (!routeData?.route_data?.steps || routeData.route_data.steps.length === 0) throw new Error('選択された承認ルートに承認者が設定されていません。');

    const firstApproverId = routeData.route_data.steps[0].approver_id;

    const { data, error } = await supabase.from('applications').insert({
        application_code_id: appData.applicationCodeId, form_data: appData.formData, approval_route_id: appData.approvalRouteId,
        applicant_id: applicantId, status: 'pending_approval', submitted_at: new Date().toISOString(), current_level: 1, approver_id: firstApproverId,
    }).select().single();

    if (error) throw new Error(`Failed to submit application: ${error.message}`);

    return data;
};
export const approveApplication = async (app: ApplicationWithDetails, currentUser: User): Promise<void> => {
    return Promise.resolve();
};
export const rejectApplication = async (app: ApplicationWithDetails, reason: string, currentUser: User): Promise<void> => {
    return Promise.resolve();
};

export const getAccountItems = async (): Promise<AccountItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('account_items').select('*');
    if (error) throw new Error(`Failed to fetch account items: ${error.message}`);
    return (data || []).map(d => ({ ...d, sortOrder: d.sort_order, categoryCode: d.category_code, createdAt: d.created_at, updatedAt: d.updated_at, isActive: d.is_active }));
};

export const getActiveAccountItems = async (): Promise<MasterAccountItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('account_items').select('id, code, name, category_code').eq('is_active', true).order('sort_order', { nullsFirst: false }).order('code');
    if (error) throw new Error(`Failed to fetch active account items: ${error.message || JSON.stringify(error)}`);
    return (data || []).map(d => ({ ...d, id: d.id, code: d.code, name: d.name, categoryCode: d.category_code }));
};

export const saveAccountItem = async (item: Partial<AccountItem>): Promise<void> => {
    const supabase = getSupabase();
    const dbItem = { code: item.code, name: item.name, category_code: item.categoryCode, is_active: item.isActive, sort_order: item.sortOrder };
    const { error } = await supabase.from('account_items').upsert({ id: item.id, ...dbItem });
    if (error) throw new Error(`勘定科目の保存に失敗しました: ${error.message}`);
};

export const deactivateAccountItem = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('account_items').update({ is_active: false }).eq('id', id);
    if (error) throw new Error(`勘定科目の無効化に失敗しました: ${error.message}`);
};

export const getPaymentRecipients = async (q?: string): Promise<PaymentRecipient[]> => {
    const supabase = getSupabase();
    let query = supabase.from('payment_recipients').select('id, recipient_code, company_name, recipient_name').order('company_name', { nullsFirst: false }).order('recipient_name', { nullsFirst: false });

    if (q && q.trim()) {
        query = query.ilike('company_name', `%${q}%`);
    }
    const { data, error } = await query.limit(1000);
    if (error) throw new Error(`Failed to fetch payment recipients: ${error.message || JSON.stringify(error)}`);
    return (data || []).map(d => ({ id: d.id, recipientCode: d.recipient_code, companyName: d.company_name, recipientName: d.recipient_name }));
};

export const savePaymentRecipient = async (item: Partial<PaymentRecipient>): Promise<void> => {
    const supabase = getSupabase();
    const dbItem = { recipient_code: item.recipientCode, company_name: item.companyName, recipient_name: item.recipientName };
    const { error } = await supabase.from('payment_recipients').upsert({ id: item.id, ...dbItem });
    if (error) throw new Error(`支払先の保存に失敗しました: ${error.message}`);
};

export const deletePaymentRecipient = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('payment_recipients').delete().eq('id', id);
    if (error) throw new Error(`支払先の削除に失敗しました: ${error.message}`);
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('allocation_divisions').select('*').order('name');
    if (error) throw new Error(`振分区分の取得に失敗しました: ${error.message}`);
    return (data || []).map(d => ({...d, createdAt: d.created_at, isActive: d.is_active}));
};

export const saveAllocationDivision = async (item: Partial<AllocationDivision>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    if (error) throw new Error(`振分区分の保存に失敗しました: ${error.message}`);
};

export const deleteAllocationDivision = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('allocation_divisions').delete().eq('id', id);
    if (error) throw new Error(`振分区分の削除に失敗しました: ${error.message}`);
};

export const getDepartments = async (): Promise<Department[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('departments').select('id, name').order('name');
    if (error) throw new Error(`Failed to fetch departments: ${error.message}`);
    return data as Department[];
};

export const saveDepartment = async (item: Partial<Department>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('departments').upsert({ id: item.id, name: item.name });
    if (error) throw new Error(`部署の保存に失敗しました: ${error.message}`);
};

export const deleteDepartment = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw new Error(`部署の削除に失敗しました: ${error.message}`);
};

export const getTitles = async (): Promise<Title[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('employee_titles').select('*').order('name');
    if (error) throw new Error(`役職の取得に失敗しました: ${error.message}`);
    return (data || []).map(d => ({...d, createdAt: d.created_at, isActive: d.is_active}));
};

export const saveTitle = async (item: Partial<Title>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').upsert({ id: item.id, name: item.name, is_active: item.isActive });
    if (error) throw new Error(`役職の保存に失敗しました: ${error.message}`);
};

export const deleteTitle = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_titles').delete().eq('id', id);
    if (error) throw new Error(`役職の削除に失敗しました: ${error.message}`);
};


export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch purchase orders: ${error.message}`);
    return (data || []).map(dbOrderToPurchaseOrder);
};

export const addPurchaseOrder = async (order: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const supabase = getSupabase();
    const insertPayload = {
        client_custmer: order.supplierName,
        project_code: order.itemName,
        order_date: order.orderDate,
        quantity: order.quantity,
        amount: order.unitPrice * order.quantity,
        approval_status1: order.status,
    };
    const { data, error } = await supabase.from('orders').insert(insertPayload).select().single();
    if (error) throw new Error(`Failed to add purchase order: ${error.message}`);
    return dbOrderToPurchaseOrder(data);
};


export const getInventoryItems = async (): Promise<InventoryItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    if (error) throw new Error(`Failed to fetch inventory items: ${error.message}`);
    return (data || []).map(d => ({ ...d, unitPrice: d.unit_price }));
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').insert({
        name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice
    }).select().single();
    if (error) throw new Error(`Failed to add inventory item: ${error.message}`);
    return data as InventoryItem;
}

export const updateInventoryItem = async (id: string, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inventory_items').update({
        name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice
    }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update inventory item: ${error.message}`);
    return data as InventoryItem;
}


export const getBugReports = async (): Promise<BugReport[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', {ascending: false});
    if (error) throw new Error(`Failed to fetch bug reports: ${error.message}`);
    return (data || []).map(dbBugReportToBugReport);
};
export const addBugReport = async (report: any): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('bug_reports').insert({ ...bugReportToDbBugReport(report), status: '未対応' });
    if (error) throw new Error(`Failed to add bug report: ${error.message}`);
};
export const updateBugReport = async (id: string, updates: Partial<BugReport>): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('bug_reports').update(bugReportToDbBugReport(updates)).eq('id', id);
    if (error) throw new Error(`Failed to update bug report: ${error.message}`);
};

export const getEstimates = async (): Promise<Estimate[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('estimates').select('*');
    if (error) throw new Error(`Failed to fetch estimates: ${error.message}`);
    return data || [];
};
export const addEstimate = async (estimateData: any): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('estimates').insert(estimateData);
    if (error) throw new Error(`Failed to add estimate: ${error.message}`);
};

export const updateEstimate = async (id: string, updates: Partial<Estimate>): Promise<Estimate> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('estimates').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update estimate: ${error.message}`);
    return data;
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice> => {
    const supabase = getSupabase();
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.paidAt) dbUpdates.paid_at = updates.paidAt;
    
    const { data, error } = await supabase.from('invoices').update(dbUpdates).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update invoice: ${error.message}`);
    return data;
};


// --- Implemented Functions ---

export const getInvoices = async (): Promise<Invoice[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('invoices').select('*, items:invoice_items(*)').order('invoice_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
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
    if (jobsError) throw new Error(`Failed to fetch jobs for invoicing: ${jobsError.message}`);
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
    if (invoiceError) throw new Error(`Failed to create invoice record: ${invoiceError.message}`);

    const invoiceItems: Omit<InvoiceItem, 'id'>[] = jobsToInvoice.map((job, index) => ({
        invoiceId: newInvoice.id, jobId: job.id, description: `${job.title} (案件番号: ${job.job_number})`,
        quantity: 1, unit: '式', unitPrice: job.price, lineTotal: job.price, sortIndex: index,
    }));
    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems.map(item => ({...item, invoice_id: item.invoiceId, job_id: item.jobId, unit_price: item.unitPrice, line_total: item.lineTotal, sort_index: item.sortIndex})));
    if (itemsError) throw new Error(`Failed to create invoice items: ${itemsError.message}`);

    const { error: updateJobsError } = await supabase.from('jobs').update({
        invoice_id: newInvoice.id, invoice_status: InvoiceStatus.Invoiced, invoiced_at: new Date().toISOString(),
    }).in('id', jobIds);
    if (updateJobsError) throw new Error(`Failed to update jobs after invoicing: ${updateJobsError.message}`);

    return { invoiceNo };
};

export const uploadFile = async (file: File, bucket: string): Promise<{ path: string }> => {
    const supabase = getSupabase();
    const filePath = `public/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);
    if (error) throw new Error(`Failed to upload to ${bucket}: ${error.message}`);
    return { path: data.path };
};


export const getInboxItems = async (): Promise<InboxItem[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inbox_items').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch inbox items: ${error.message}`);

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
    if (error) throw new Error(`Failed to add inbox item: ${error.message}`);
    return data as InboxItem;
};

export const updateInboxItem = async (id: string, updates: Partial<InboxItem>): Promise<InboxItem> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('inbox_items').update({
        status: updates.status, extracted_data: updates.extractedData,
    }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update inbox item: ${error.message}`);
    
    const { data: urlData } = supabase.storage.from('inbox').getPublicUrl(data.file_path);
    return { ...data, fileUrl: urlData.publicUrl, extractedData: data.extracted_data } as InboxItem;
};

export const deleteInboxItem = async (itemToDelete: InboxItem): Promise<void> => {
    const supabase = getSupabase();
    const { error: storageError } = await supabase.storage.from('inbox').remove([itemToDelete.filePath]);
    if (storageError) console.error("Storage deletion failed, proceeding with DB deletion:", storageError);

    const { error: dbError } = await supabase.from('inbox_items').delete().eq('id', itemToDelete.id);
    if (dbError) throw new Error(`Failed to delete inbox item from DB: ${dbError.message}`);
};

export const updateJobReadyToInvoice = async (jobId: string, value: boolean): Promise<void> => {
    const supabase = getSupabase();
    const { error } = await supabase.from('jobs').update({ ready_to_invoice: value }).eq('id', jobId);
    if (error) throw new Error(`Failed to update job ready status: ${error.message}`);
};
