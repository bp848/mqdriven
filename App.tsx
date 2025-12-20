import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import JobList from './components/JobList';
import CreateJobModal from './components/CreateJobModal';
import JobDetailModal from './components/JobDetailModal';
import CustomerList from './components/CustomerList';
import CustomerDetailModal from './components/CustomerDetailModal';
import { CompanyAnalysisModal } from './components/CompanyAnalysisModal';
import LeadManagementPage from './components/sales/LeadManagementPage';
import CreateLeadModal from './components/sales/CreateLeadModal';
import FaxOcrIntakePage from './components/sales/FaxOcrIntakePage';
import PlaceholderPage from './components/PlaceholderPage';
import MySchedulePage from './components/MySchedulePage';
import UserManagementPage from './components/admin/UserManagementPage';
import ApprovalRouteManagementPage from './components/admin/ApprovalRouteManagementPage';
import BugReportChatModal from './components/BugReportChatModal';
import SettingsPage from './components/SettingsPage';
import AccountingPage from './components/Accounting';
import SalesPipelinePage from './components/sales/SalesPipelinePage';
import InventoryManagementPage from './components/inventory/InventoryManagementPage';
import CreateInventoryItemModal from './components/inventory/CreateInventoryItemModal';
import ManufacturingPipelinePage from './components/manufacturing/ManufacturingPipelinePage';
import ManufacturingOrdersPage from './components/manufacturing/ManufacturingOrdersPage';
import PurchasingManagementPage from './components/purchasing/PurchasingManagementPage';
import CreatePurchaseOrderModal from './components/purchasing/CreatePurchaseOrderModal';
import EstimateManagementPage from './components/sales/EstimateManagementPage';
import SalesRanking from './components/accounting/SalesRanking';
import BusinessPlanPage from './components/accounting/BusinessPlanPage';
import ApprovalWorkflowPage from './components/accounting/ApprovalWorkflowPage';
import AccountingDashboard from './src/components/accounting/Dashboard';
import { JournalReviewPage } from './src/components/accounting/JournalEntry';
import { ApprovedApplications } from './src/components/accounting/ApprovedApplications';
import GeneralLedger from './components/accounting/GeneralLedger';
import PayablesPage from './components/accounting/Payables';
import ReceivablesPage from './components/accounting/Receivables';
import CashSchedulePage from './components/accounting/CashSchedule';
import DocumentCreationHub from './components/DocumentCreationHub';
import BulletinBoardPage from './components/BulletinBoardPage';
import AIChatPage from './components/AIChatPage';
import MarketResearchPage from './components/MarketResearchPage';
import MeetingMinutesIframe from './components/MeetingMinutesIframe';
import PDFEditingHub from './components/PDFEditingHub';
import DTPHub from './components/DTPHub';
import { ToastContainer } from './components/Toast';
import ConfirmationDialog from './components/ConfirmationDialog';
import SalesDashboard from './components/sales/SalesDashboard';
import SalesOrdersPage from './components/sales/SalesOrdersPage';
import ManufacturingCostManagement from './components/accounting/ManufacturingCostManagement';
import AuditLogPage from './components/admin/AuditLogPage';
import JournalQueuePage from './components/admin/JournalQueuePage';
import MasterManagementPage from './components/admin/MasterManagementPage';
import ActionConsolePage from './components/admin/ActionConsolePage';
import DatabaseSetupInstructionsModal from './components/DatabaseSetupInstructionsModal';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import AuthCallbackPage from './components/AuthCallbackPage';

import * as dataService from './services/dataService';
import * as geminiService from './services/geminiService';
import { getSupabase, hasSupabaseCredentials } from './services/supabaseClient';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

import { Page, Job, JobCreationPayload, Customer, JournalEntry, User, AccountItem, Lead, ApprovalRoute, PurchaseOrder, InventoryItem, Employee, Toast, ConfirmationDialogProps, BugReport, Estimate, ApplicationWithDetails, Invoice, EmployeeUser, Department, PaymentRecipient, MasterAccountItem, AllocationDivision, Title, ProjectBudgetSummary, DailyReportPrefill } from './types';
import { PlusCircle, Loader, AlertTriangle, RefreshCw, Settings } from './components/Icons';

const getEnvValue = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        const envMap = import.meta.env as Record<string, string | undefined>;
        if (envMap[key] !== undefined) {
            return envMap[key];
        }
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    return undefined;
};

type PredictiveSuggestion = {
    id: string;
    value: string;
    label: string;
    subLabel?: string;
    type: 'customer' | 'job';
};

const PAGE_TITLES: Record<Page, string> = {
    analysis_dashboard: 'ダッシュボード',
    my_schedule: '日報タスクカレンダー',
    sales_dashboard: '販売状況',
    sales_leads: 'リード管理',
    sales_customers: '取引先/お客様カルテ',
    sales_pipeline: '進捗管理',
    sales_estimates: '見積管理',
    sales_orders: '予算管理',
    sales_billing: '売上請求（AR）',
    fax_ocr_intake: '何でも取り込み',
    analysis_ranking: '売上ランキング',
    purchasing_orders: '受注一覧',
    purchasing_invoices: '仕入計上 (AP)',
    purchasing_payments: '支払管理',
    inventory_management: '在庫管理',
    manufacturing_orders: '製造指示',
    manufacturing_progress: '製造パイプライン',
    manufacturing_cost: '製造原価',
    hr_attendance: '勤怠',
    hr_man_hours: '工数',
    hr_labor_cost: '人件費配賦',
    approval_list: '承認一覧',
    approval_form_expense: '経費精算',
    approval_form_transport: '交通費精算',
    approval_form_leave: '休暇申請',
    approval_form_approval: '稟議申請',
    approval_form_daily: '日報',
    approval_form_weekly: '週報',
    accounting_journal: '仕訳帳',
    accounting_general_ledger: '総勘定元帳',
    accounting_trial_balance: '試算表',
    accounting_tax_summary: '消費税集計',
    accounting_period_closing: '締処理',
    accounting_business_plan: '経営計画',
    accounting_dashboard: '会計ダッシュボード',
    accounting_journal_review: '仕訳レビュー',
    accounting_payables: '支払管理',
    accounting_receivables: '売掛金管理',
    accounting_cash_schedule: '資金繰り表',
    accounting_approved_applications: '承認済み申請',
    document_creation_tools: '資料作成',
    proposal_ai: '提案書作成AI',
    pdf_editing_tools: 'PDF編集AI',
    dtp_tools: 'DTP自動組版AI',
    ai_business_consultant: 'AI経営相談',
    ai_market_research: 'AI市場調査',
    meeting_minutes: '議事録支援',
    admin_audit_log: '監査ログ',
    admin_journal_queue: 'ジャーナル・キュー',
    admin_user_management: 'ユーザー管理',
    admin_route_management: '承認ルート管理',
    admin_master_management: 'マスタ管理',
    admin_action_console: 'アクションコンソール',
    admin_bug_reports: 'バグ・改善報告',
    bulletin_board: '議事録/掲示板',
    settings: '設定',
};

const APPLICATION_FORM_PAGE_MAP: Partial<Record<string, Page>> = {
    EXP: 'approval_form_expense',
    TRP: 'approval_form_transport',
    LEV: 'approval_form_leave',
    APL: 'approval_form_approval',
    DLY: 'approval_form_daily',
    WKR: 'approval_form_weekly',
};

const PRIMARY_ACTION_ENABLED_PAGES: Page[] = [
    'sales_orders',
    'sales_leads',
    'sales_customers',
    'purchasing_orders',
    'inventory_management',
    'sales_estimates',
];

const SEARCH_ENABLED_PAGES: Page[] = [
    'sales_orders',
    'sales_customers',
    'sales_leads',
    'sales_estimates',
    'approval_list',
];

const PREDICTIVE_SUGGESTION_PAGES: Page[] = [
    'sales_orders',
    'sales_customers',
];

const GlobalErrorBanner: React.FC<{ error: string; onRetry: () => void; onShowSetup: () => void; }> = ({ error, onRetry, onShowSetup }) => (
    <div className="bg-red-600 text-white p-3 flex items-center justify-between gap-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-bold">データベースエラー</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onShowSetup} className="bg-red-700 hover:bg-red-800 font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
            <Settings className="w-4 h-4" />
            セットアップガイド
        </button>
        <button onClick={onRetry} className="bg-red-700 hover:bg-red-800 font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
            <RefreshCw className="w-4 h-4" />
            再試行
        </button>
      </div>
    </div>
);


const App: React.FC = () => {
    const isSupabaseConfigured = useMemo(() => hasSupabaseCredentials(), []);
    const isAuthBypassEnabled = useMemo(() => getEnvValue('VITE_BYPASS_SUPABASE_AUTH') === '1', []);
    const shouldRequireAuth = isSupabaseConfigured && !isAuthBypassEnabled;
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState<boolean>(shouldRequireAuth);
    const [authError, setAuthError] = useState<string | null>(null);
    // Global State
    const [currentPage, setCurrentPage] = useState<Page>('analysis_dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState<EmployeeUser | null>(null);
    const [user, setUser] = useState<any>(null); // TODO: Replace 'any' with proper user type
    
    const onUserChange = (newUser: any) => {
        setCurrentUser(newUser);
        setUser(newUser);
    };
    const [allUsers, setAllUsers] = useState<EmployeeUser[]>([]);
    
    // Data State
    const [jobs, setJobs] = useState<ProjectBudgetSummary[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
    const [paymentRecipients, setPaymentRecipients] = useState<PaymentRecipient[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [approvalRoutes, setApprovalRoutes] = useState<ApprovalRoute[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
    const [resumedApplication, setResumedApplication] = useState<ApplicationWithDetails | null>(null);
    const [dailyReportPrefill, setDailyReportPrefill] = useState<DailyReportPrefill | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allocationDivisions, setAllocationDivisions] = useState<AllocationDivision[]>([]);
    const [titles, setTitles] = useState<Title[]>([]);
    
    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);
    const [toastsEnabled, setToastsEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const stored = window.localStorage.getItem('toasts_enabled');
        return stored === null ? true : stored === '1';
    });
    const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);
    const [isCreateJobModalOpen, setCreateJobModalOpen] = useState(false);
    const [isCreateLeadModalOpen, setCreateLeadModalOpen] = useState(false);
    const [isCreatePOModalOpen, setCreatePOModalOpen] = useState(false);
    const [isCreateInventoryItemModalOpen, setIsCreateInventoryItemModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [isJobDetailModalOpen, setJobDetailModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerModalMode, setCustomerModalMode] = useState<'view' | 'edit' | 'new'>('view');
    const [isCustomerDetailModalOpen, setCustomerDetailModalOpen] = useState(false);
    const [customerInitialValues, setCustomerInitialValues] = useState<Partial<Customer> | null>(null);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [companyAnalysis, setCompanyAnalysis] = useState<{ swot: string; painPointsAndNeeds: string; suggestedActions: string; proposalEmail: { subject: string; body: string; }; sources?: { uri: string; title: string; }[] } | null>(null);
    const [isAnalysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogProps>({ isOpen: false, title: '', message: '', onConfirm: () => {}, onClose: () => () => setConfirmationDialog(prev => ({ ...prev, isOpen: false })) });
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const [isAIOff, setIsAIOff] = useState(process.env.NEXT_PUBLIC_AI_OFF === '1');
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [showFeatureUpdateModal, setShowFeatureUpdateModal] = useState(false);

    const isAuthenticated = shouldRequireAuth ? !!supabaseSession : true;
    const isAuthCallbackRoute = shouldRequireAuth && typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback');

    const predictiveSuggestions = useMemo<PredictiveSuggestion[]>(() => {
        const predictiveSuggestionPages: Page[] = ['sales_orders', 'sales_customers', 'sales_estimates'];
        if (!predictiveSuggestionPages.includes(currentPage)) return [];
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return [];

        const matchesQuery = (value?: string | number | null) => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(keyword);
        };

        const customerSuggestions: PredictiveSuggestion[] = [];
        for (const customer of customers) {
            if (customerSuggestions.length >= 5) break;
            if (!customer.customerName) continue;
            const isMatch =
                matchesQuery(customer.customerName) ||
                matchesQuery(customer.customerNameKana) ||
                matchesQuery(customer.customerCode);
            if (!isMatch) continue;
            customerSuggestions.push({
                id: `customer-${customer.id}`,
                value: customer.customerName,
                label: customer.customerName,
                subLabel: customer.customerNameKana || customer.customerCode || undefined,
                type: 'customer',
            });
        }

        const jobSuggestions: PredictiveSuggestion[] = [];
        for (const job of jobs) {
            if (jobSuggestions.length >= 5) break;
            const jobNumberLabel = job.jobNumber ? `案件番号: ${job.jobNumber}` : '';
            const isMatch =
                matchesQuery(job.title) ||
                matchesQuery(job.clientName) ||
                matchesQuery(job.jobNumber) ||
                matchesQuery(job.projectCode);
            if (!isMatch) continue;
            const label = job.title?.trim() || job.clientName?.trim() || jobNumberLabel;
            if (!label) continue;
            const subParts: string[] = [];
            if (job.clientName && job.clientName.trim() && job.clientName.trim() !== label) {
                subParts.push(job.clientName.trim());
            }
            if (jobNumberLabel) subParts.push(jobNumberLabel);

            jobSuggestions.push({
                id: `job-${job.id ?? job.jobNumber ?? label}`,
                value: label,
                label,
                subLabel: subParts.join(' / ') || undefined,
                type: 'job',
            });
        }

        return [...customerSuggestions, ...jobSuggestions];
    }, [currentPage, searchTerm, customers, jobs]);

    // Navigation and Modals
    const handleNavigate = (page: Page) => {
        if (page === 'accounting_business_plan' && currentUser?.role !== 'admin') {
            addToast('経営計画は管理者のみ閲覧できます。', 'error');
            return;
        }
        setCurrentPage(page);
        setSearchTerm('');
    };

    const handleDailyReportPrefillApplied = () => {
        setDailyReportPrefill(null);
    };

    const handleCreateDailyReport = (prefill: DailyReportPrefill) => {
        setDailyReportPrefill(prefill);
        handleNavigate('approval_form_daily');
    };

    const addToast = useCallback((message: string, type: Toast['type']) => {
        if (!toastsEnabled) return;
        const newToast: Toast = { id: Date.now(), message, type };
        setToasts(prev => [...prev, newToast]);
    }, [toastsEnabled]);

    const dismissToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };
    
    const requestConfirmation = (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
        setConfirmationDialog({ ...dialog, isOpen: true, onClose: () => setConfirmationDialog(prev => ({ ...prev, isOpen: false })) });
    };
    const clearResumedApplication = useCallback(() => {
        setResumedApplication(null);
    }, []);

    useEffect(() => {
        const todayKey = `feature_modal_seen_${new Date().toISOString().slice(0, 10)}`;
        const seen = typeof window !== 'undefined' ? window.localStorage.getItem(todayKey) : null;
        if (currentUser && !seen && currentPage === 'my_schedule') {
            setShowFeatureUpdateModal(true);
        }
    }, [currentUser, currentPage]);

    const handleDismissFeatureModal = () => {
        const todayKey = `feature_modal_seen_${new Date().toISOString().slice(0, 10)}`;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(todayKey, '1');
        }
        setShowFeatureUpdateModal(false);
    };

    const toggleToasts = () => {
        setToastsEnabled(prev => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('toasts_enabled', next ? '1' : '0');
            }
            return next;
        });
    };

    const handleStartGoogleCalendarAuth = async () => {
        if (!currentUser) {
            addToast('ログイン状態を確認してください。', 'error');
            return;
        }
        setIsGoogleAuthLoading(true);
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.functions.invoke<{ authUrl?: string }>('google-oauth-start', {
                body: { user_id: currentUser.id },
            });
            if (error) {
                console.error('Google OAuth start failed', error);
                addToast('Googleカレンダー連携の開始に失敗しました。設定を確認してください。', 'error');
                return;
            }
            if (data?.authUrl) {
                window.open(data.authUrl, '_blank', 'noopener');
            } else {
                addToast('認可URLを取得できませんでした。', 'error');
            }
        } catch (err) {
            console.error('Failed to start Google OAuth', err);
            addToast('Googleカレンダー連携でエラーが発生しました。', 'error');
        } finally {
            setIsGoogleAuthLoading(false);
        }
    };

    const handleResumeApplicationDraft = useCallback((application: ApplicationWithDetails) => {
        if (!currentUser || application.applicantId !== currentUser.id) {
            addToast('自分が作成した申請のみ再開できます。', 'error');
            return;
        }

        if (application.status !== 'draft' && application.status !== 'rejected') {
            addToast('下書きまたは差戻し済みの申請のみ再申請できます。', 'error');
            return;
        }

        const applicationCode = application.applicationCode?.code;
        if (!applicationCode) {
            addToast('申請種別を特定できず、申請を再開できません。', 'error');
            return;
        }

        const targetPage = APPLICATION_FORM_PAGE_MAP[applicationCode];
        if (!targetPage) {
            addToast(`申請種別「${application.applicationCode?.name || applicationCode}」のフォームにはまだ対応していません。`, 'error');
            return;
        }

        if (application.status === 'rejected') {
            addToast('差し戻し内容をフォームに読み込みました。必要事項を修正して再申請してください。', 'info');
        }

        setResumedApplication(application);
        setSearchTerm('');
        setCurrentPage(targetPage);
    }, [addToast, currentUser]);

    const resetAppData = useCallback(() => {
        setJobs([]);
        setCustomers([]);
        setJournalEntries([]);
        setAccountItems([]);
        setPaymentRecipients([]);
        setLeads([]);
        setApprovalRoutes([]);
        setPurchaseOrders([]);
        setInventoryItems([]);
        setEmployees([]);
        setEstimates([]);
        setApplications([]);
        setResumedApplication(null);
        setDepartments([]);
        setAllocationDivisions([]);
        setTitles([]);
        setCurrentUser(null);
        setAllUsers([]);
        setDbError(null);
    }, []);

    const handleSignOut = useCallback(async () => {
        if (!isSupabaseConfigured) {
            return;
        }
        try {
            const supabaseClient = getSupabase();
            await supabaseClient.auth.signOut();
            resetAppData();
            setSupabaseSession(null);
            setSupabaseUser(null);
            setAuthView('login');
        } catch (error) {
            console.error('Failed to sign out:', error);
            addToast('ログアウトに失敗しました。', 'error');
        }
    }, [isSupabaseConfigured, resetAppData, addToast]);

    useEffect(() => {
        if (!shouldRequireAuth) {
            setSupabaseSession(null);
            setSupabaseUser(null);
            setIsAuthChecking(false);
            return;
        }

        if (!isSupabaseConfigured) {
            setIsAuthChecking(false);
            setSupabaseSession(null);
            setSupabaseUser(null);
            return;
        }

        const supabaseClient = getSupabase();
        let isMounted = true;

        const resolveSession = async () => {
            try {
                const { data, error } = await supabaseClient.auth.getSession();
                if (!isMounted) return;
                if (error) {
                    console.error('Failed to fetch auth session:', error.message);
                    setAuthError(error.message);
                    setSupabaseSession(null);
                    setSupabaseUser(null);
                } else {
                    setAuthError(null);
                    setSupabaseSession(data.session ?? null);
                    setSupabaseUser(data.session?.user ?? null);
                }
            } catch (error: any) {
                if (!isMounted) return;
                console.error('Unexpected auth session error:', error);
                setAuthError(error?.message ?? 'ログイン状態の取得に失敗しました。');
                setSupabaseSession(null);
                setSupabaseUser(null);
            } finally {
                if (isMounted) {
                    setIsAuthChecking(false);
                }
            }
        };

        setIsAuthChecking(true);
        resolveSession();

        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setAuthError(null);
            setSupabaseSession(session);
            setSupabaseUser(session?.user ?? null);
            if (!session) {
                resetAppData();
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [isSupabaseConfigured, shouldRequireAuth, resetAppData]);

    const loadAllData = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            setIsLoading(true);
            setDbError(null);

            if (!hasSupabaseCredentials()) {
                throw new Error("Supabaseの接続情報が設定されていません。supabaseCredentials.tsファイルを確認してください。");
            }

            const usersData = await dataService.getUsers();
            if (signal.aborted) return;
            setAllUsers(usersData);
            
            let effectiveUser: User | null = currentUser ?? null;
            if (!effectiveUser && supabaseUser) {
                effectiveUser = usersData.find(user => user.id === supabaseUser.id) ?? null;
                if (!effectiveUser && supabaseUser.email) {
                    const normalizedEmail = supabaseUser.email.toLowerCase();
                    effectiveUser = usersData.find(user => user.email?.toLowerCase() === normalizedEmail) ?? null;
                }
            }
            if (!effectiveUser && usersData.length > 0) {
                effectiveUser = usersData[0];
            }
            if (effectiveUser && (!currentUser || currentUser.id !== effectiveUser.id)) {
                setCurrentUser(effectiveUser as EmployeeUser);
            }
            
            const employeesFromUsers: Employee[] = usersData.map(user => ({
                id: user.id,
                name: user.name,
                department: user.department || '未設定',
                title: user.title || (user.role === 'admin' ? '管理者' : 'スタッフ'),
                hireDate: user.createdAt,
                salary: 0,
                createdAt: user.createdAt,
            }));
            
            const results = await Promise.allSettled([
                dataService.getProjectBudgetSummaries(),
                dataService.getCustomers(),
                dataService.getJournalEntries(),
                dataService.getAccountItems(),
                dataService.getLeads(),
                dataService.getApprovalRoutes(),
                dataService.getPurchaseOrders(),
                dataService.getInventoryItems(),
                dataService.getEstimates(),
                dataService.getDepartments(),
                dataService.getPaymentRecipients(),
                dataService.getAllocationDivisions(),
                dataService.getTitles(),
            ]);

            if (signal.aborted) return;

            const [
                jobsResult,
                customersResult,
                journalResult,
                accountItemsResult,
                leadsResult,
                routesResult,
                poResult,
                inventoryResult,
                estimatesResult,
                departmentsResult,
                paymentRecipientsResult,
                allocationDivisionsResult,
                titlesResult,
            ] = results;

            if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value); else console.error('Failed to load jobs:', jobsResult.reason);
            if (customersResult.status === 'fulfilled') setCustomers(customersResult.value); else console.error('Failed to load customers:', customersResult.reason);
            if (journalResult.status === 'fulfilled') setJournalEntries(journalResult.value); else console.error('Failed to load journal entries:', journalResult.reason);
            if (accountItemsResult.status === 'fulfilled') setAccountItems(accountItemsResult.value); else console.error('Failed to load account items:', accountItemsResult.reason);
            if (leadsResult.status === 'fulfilled') setLeads(leadsResult.value); else console.error('Failed to load leads:', leadsResult.reason);
            if (routesResult.status === 'fulfilled') setApprovalRoutes(routesResult.value); else console.error('Failed to load approval routes:', routesResult.reason);
            if (poResult.status === 'fulfilled') setPurchaseOrders(poResult.value); else console.error('Failed to load purchase orders:', poResult.reason);
            if (inventoryResult.status === 'fulfilled') setInventoryItems(inventoryResult.value); else console.error('Failed to load inventory items:', inventoryResult.reason);
            setEmployees(employeesFromUsers);
            if (estimatesResult.status === 'fulfilled') setEstimates(estimatesResult.value); else console.error('Failed to load estimates:', estimatesResult.reason);
            if (departmentsResult.status === 'fulfilled') setDepartments(departmentsResult.value); else console.error('Failed to load departments:', departmentsResult.reason);
            if (paymentRecipientsResult.status === 'fulfilled') setPaymentRecipients(paymentRecipientsResult.value); else console.error('Failed to load payment recipients:', paymentRecipientsResult.reason);
            if (allocationDivisionsResult.status === 'fulfilled') setAllocationDivisions(allocationDivisionsResult.value); else console.error('Failed to load allocation divisions:', allocationDivisionsResult.reason);
            if (titlesResult.status === 'fulfilled') setTitles(titlesResult.value); else console.error('Failed to load titles:', titlesResult.reason);
            
            if (effectiveUser) {
                const applicationsData = await dataService.getApplications(effectiveUser);
                if (!signal.aborted) setApplications(applicationsData);
            } else {
                if (!signal.aborted) setApplications([]);
            }

        } catch (error: any) {
            if (signal.aborted) {
                console.log('Data loading aborted.');
                return;
            }
            console.error("Failed to load data:", error);
            const errorMessage = error.message || "データの読み込みに失敗しました。";
            setDbError(errorMessage);
            addToast(`データベースエラー: ${errorMessage}`, 'error');

        } finally {
            if (!signal.aborted) {
                setIsLoading(false);
            }
        }
    }, [currentUser, supabaseUser, addToast]);


useEffect(() => {
    if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
    }
        if (!isAuthenticated) {
            setIsLoading(false);
            return;
        }
        loadAllData();
    }, [isSupabaseConfigured, isAuthenticated, loadAllData]);

    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const supabase = getSupabase();
        const channel = supabase
            .channel('customers-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'customers' },
                () => {
                    loadAllData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSupabaseConfigured, loadAllData]);
    
    useEffect(() => {
        if (currentPage === 'analysis_dashboard' && jobs.length > 0 && !isAIOff) {
            setIsSuggestionLoading(true);
            geminiService.getDashboardSuggestion(jobs)
                .then(setAiSuggestion)
                .catch(err => {
                    if (err.name === 'AbortError') return;
                    console.error("Failed to get AI suggestion:", err);
                    setAiSuggestion("AIからの提案の取得に失敗しました。");
                })
                .finally(() => setIsSuggestionLoading(false));
        } else if (currentPage === 'analysis_dashboard' && isAIOff) {
            setAiSuggestion("AI機能は現在無効です。");
            setIsSuggestionLoading(false);
        }
    }, [currentPage, jobs, isAIOff]);

    const pendingApprovalCount = useMemo(() => {
      if (!currentUser || !applications) return 0;
      return applications.filter(app => app.approverId === currentUser.id && app.status === 'pending_approval').length;
    }, [currentUser, applications]);

    // Data Handlers
    const handleAddJob = async (jobData: JobCreationPayload) => {
        await dataService.addJob(jobData);
        addToast('案件が正常に追加されました。', 'success');
        await loadAllData();
    };
    const handleCreateCustomerInline = async (customerData: Partial<Customer>): Promise<Customer> => {
        const created = await dataService.addCustomer(customerData);
        setCustomers(prev => [created, ...prev]);
        addToast('顧客を登録しました。', 'success');
        return created;
    };
    const handleCreatePaymentRecipientInline = async (recipientData: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
        const created = await dataService.createPaymentRecipient(recipientData);
        setPaymentRecipients(prev => [created, ...prev]);
        addToast('支払先を登録しました。', 'success');
        return created;
    };
    const handleUpdateJob = async (jobId: string, updatedData: Partial<Job>) => {
        await dataService.updateJob(jobId, updatedData);
        addToast('案件が更新されました。', 'success');
        await loadAllData();
    };
    const handleDeleteJob = async (jobId: string) => {
        await dataService.deleteJob(jobId);
        addToast('案件が削除されました。', 'success');
        setJobDetailModalOpen(false);
        await loadAllData();
    };
     const handleAddLead = async (leadData: Partial<Lead>) => {
        await dataService.addLead(leadData);
        addToast('リードが追加されました。', 'success');
        setCreateLeadModalOpen(false);
        await loadAllData();
    };
    const handleUpdateLead = async (leadId: string, updatedData: Partial<Lead>) => {
        await dataService.updateLead(leadId, updatedData);
        addToast('リードが更新されました。', 'success');
        await loadAllData();
    };
    const handleDeleteLead = async (leadId: string) => {
        await dataService.deleteLead(leadId);
        addToast('リードが削除されました。', 'success');
        await loadAllData();
    };
    const handleSaveCustomer = async (customerData: Partial<Customer>) => {
        if (customerData.id) {
            await dataService.updateCustomer(customerData.id, customerData);
            addToast('顧客情報が更新されました。', 'success');
        } else {
            await dataService.addCustomer(customerData);
            addToast('新規顧客が登録されました。', 'success');
        }
        setCustomerDetailModalOpen(false);
        setCustomerInitialValues(null);
        await loadAllData();
    };

    const handleUpdateCustomer = async (customerId: string, customerData: Partial<Customer>) => {
        await dataService.updateCustomer(customerId, customerData);
        addToast('顧客情報が更新されました。', 'success');
        await loadAllData();
    };

    const handleAddPurchaseOrder = async (orderData: Omit<PurchaseOrder, 'id'>) => {
        await dataService.addPurchaseOrder(orderData);
        addToast('発注が追加されました。', 'success');
        setCreatePOModalOpen(false);
        await loadAllData();
    };

    const handleSaveInventoryItem = async (itemData: Partial<InventoryItem>) => {
        if (itemData.id) {
            await dataService.updateInventoryItem(itemData.id, itemData);
            addToast('在庫品目が更新されました。', 'success');
        } else {
            await dataService.addInventoryItem(itemData as Omit<InventoryItem, 'id'>);
            addToast('在庫品目が追加されました。', 'success');
        }
        setIsCreateInventoryItemModalOpen(false);
        await loadAllData();
    };


    const handleAnalyzeCustomer = async (customer: Customer) => {
        setAnalysisError('');
        if (customer.aiAnalysis) {
            setCompanyAnalysis(customer.aiAnalysis);
            setAnalysisModalOpen(true);
            return;
        }
        setCompanyAnalysis(null);
        setAnalysisLoading(true);
        setAnalysisModalOpen(true);
        try {
            const analysis = await geminiService.analyzeCompany(customer);
            await handleUpdateCustomer(customer.id, { aiAnalysis: analysis });
            setCompanyAnalysis(analysis);
        } catch (e: any) {
            if (e.name === 'AbortError') return;
            setAnalysisError(e.message);
        } finally {
            setAnalysisLoading(false);
        }
    };
    
    const handleSaveBugReport = async (report: Omit<BugReport, 'id' | 'createdAt' | 'status' | 'reporterName'>) => {
        if (!currentUser) {
            addToast('ユーザー情報が見つかりません。', 'error');
            return;
        }
        await dataService.addBugReport({ ...report, reporterName: currentUser.name });
        addToast('ご報告ありがとうございます。内容を受け付けました。', 'success');
    };

    const handleAddEstimate = async (estimateData: any) => {
        await dataService.addEstimate(estimateData);
        await loadAllData();
    };
    
    const onPrimaryAction = () => {
        if (dbError) {
            addToast('データベース接続エラーのため、この操作は実行できません。', 'error');
            return;
        }
        switch(currentPage) {
            case 'sales_orders': setCreateJobModalOpen(true); break;
            case 'sales_leads': setCreateLeadModalOpen(true); break;
            case 'sales_customers':
                setSelectedCustomer(null);
                setCustomerModalMode('new');
                setCustomerInitialValues(null);
                setCustomerDetailModalOpen(true);
                break;
            case 'purchasing_orders': setCreatePOModalOpen(true); break;
            case 'inventory_management':
                setSelectedInventoryItem(null);
                setIsCreateInventoryItemModalOpen(true);
                break;
            case 'sales_estimates':
                // TODO: Open create estimate modal
                break;
            default:
                break;
        }
    };

    // Render Logic
    const renderContent = () => {
        switch (currentPage) {
            case 'analysis_dashboard':
                return <Dashboard 
                            jobs={jobs} 
                            journalEntries={journalEntries} 
                            accountItems={accountItems} 
                            suggestion={aiSuggestion} 
                            isSuggestionLoading={isSuggestionLoading}
                            pendingApprovalCount={pendingApprovalCount}
                            onNavigateToApprovals={() => handleNavigate('approval_list')}
                            onNavigateToBulletinBoard={() => handleNavigate('bulletin_board')}
                            isAIOff={isAIOff}
                            onStartGoogleCalendarAuth={handleStartGoogleCalendarAuth}
                            isGoogleAuthLoading={isGoogleAuthLoading}
                            toastsEnabled={toastsEnabled}
                            onToggleToasts={toggleToasts}
                        />;
            case 'sales_dashboard':
                return <SalesDashboard jobs={jobs} leads={leads} />;
            case 'sales_orders':
                return (
                    <SalesOrdersPage
                        projectSummaries={jobs}
                        orders={purchaseOrders}
                        searchTerm={searchTerm}
                        onSelectJob={(job) => { setSelectedJob(job); setJobDetailModalOpen(true); }}
                        onNewJob={() => setCreateJobModalOpen(true)}
                    />
                );
            case 'fax_ocr_intake':
                return (
                    <FaxOcrIntakePage
                        currentUser={currentUser}
                        addToast={addToast}
                        onNavigateToOrders={() => handleNavigate('sales_orders')}
                        onNavigateToEstimates={() => handleNavigate('sales_estimates')}
                        customers={customers}
                        paymentRecipients={paymentRecipients}
                    />
                );
            case 'sales_customers':
                return <CustomerList
                    customers={customers}
                    searchTerm={searchTerm}
                    onSelectCustomer={(customer) => {
                        setCustomerInitialValues(null);
                        setSelectedCustomer(customer);
                        setCustomerModalMode('view');
                        setCustomerDetailModalOpen(true);
                    }}
                    onUpdateCustomer={handleUpdateCustomer}
                    onAnalyzeCustomer={handleAnalyzeCustomer}
                    addToast={addToast}
                    currentUser={currentUser}
                    onNewCustomer={() => {
                        setCustomerInitialValues(null);
                        setSelectedCustomer(null);
                        setCustomerModalMode('new');
                        setCustomerDetailModalOpen(true);
                    }}
                    isAIOff={isAIOff}
                />;
            case 'sales_leads':
                return <LeadManagementPage leads={leads} searchTerm={searchTerm} onRefresh={loadAllData} onUpdateLead={handleUpdateLead} onDeleteLead={handleDeleteLead} addToast={addToast} requestConfirmation={requestConfirmation} currentUser={currentUser} isAIOff={isAIOff} onAddEstimate={handleAddEstimate} />;
            case 'sales_pipeline':
                return <SalesPipelinePage jobs={jobs} onUpdateJob={handleUpdateJob} onCardClick={(job) => { setSelectedJob(job); setJobDetailModalOpen(true); }} />;
            case 'admin_user_management':
                return <UserManagementPage addToast={addToast} requestConfirmation={requestConfirmation} currentUser={currentUser} />;
            case 'admin_route_management':
                return <ApprovalRouteManagementPage addToast={addToast} requestConfirmation={requestConfirmation} />;
            case 'admin_master_management':
                return <MasterManagementPage
                    accountItems={accountItems}
                    paymentRecipients={paymentRecipients}
                    allocationDivisions={allocationDivisions}
                    departments={departments}
                    titles={titles}
                    onSaveAccountItem={async (item: Partial<AccountItem>) => { await dataService.saveAccountItem(item); await loadAllData(); addToast('勘定科目を保存しました。', 'success'); }}
                    onDeleteAccountItem={async (id: string) => { await dataService.deactivateAccountItem(id); await loadAllData(); addToast('勘定科目を無効化しました。', 'success');}}
                    onSavePaymentRecipient={async (item: Partial<PaymentRecipient>) => { await dataService.savePaymentRecipient(item); await loadAllData(); addToast('支払先を保存しました。', 'success'); }}
                    onDeletePaymentRecipient={async (id: string) => { await dataService.deletePaymentRecipient(id); await loadAllData(); addToast('支払先を削除しました。', 'success');}}
                    onSaveAllocationDivision={async (item: Partial<AllocationDivision>) => { await dataService.saveAllocationDivision(item); await loadAllData(); addToast('振分区分を保存しました。', 'success'); }}
                    onDeleteAllocationDivision={async (id: string) => { await dataService.deleteAllocationDivision(id); await loadAllData(); addToast('振分区分を削除しました。', 'success');}}
                    onSaveDepartment={async (item: Partial<Department>) => { await dataService.saveDepartment(item); await loadAllData(); addToast('部署を保存しました。', 'success'); }}
                    onDeleteDepartment={async (id: string) => { await dataService.deleteDepartment(id); await loadAllData(); addToast('部署を削除しました。', 'success');}}
                    onSaveTitle={async (item: Partial<Title>) => { await dataService.saveTitle(item); await loadAllData(); addToast('役職を保存しました。', 'success'); }}
                    onDeleteTitle={async (id: string) => { await dataService.deleteTitle(id); await loadAllData(); addToast('役職を削除しました。', 'success');}}
                    addToast={addToast}
                    requestConfirmation={requestConfirmation}
                />;
            case 'settings':
                return <SettingsPage addToast={addToast} currentUser={currentUser} />;
            case 'accounting_journal': case 'sales_billing': case 'purchasing_invoices': case 'purchasing_payments': case 'hr_labor_cost': case 'accounting_trial_balance': case 'accounting_period_closing':
                return <AccountingPage page={currentPage} journalEntries={journalEntries} accountItems={accountItems} onAddEntry={async (entry: any) => { await dataService.addJournalEntry(entry); loadAllData(); }} addToast={addToast} requestConfirmation={requestConfirmation} jobs={jobs} applications={applications} onNavigate={handleNavigate} isAIOff={isAIOff} customers={customers} employees={employees} onRefreshData={loadAllData} />;
            case 'inventory_management':
                return <InventoryManagementPage inventoryItems={inventoryItems} onSelectItem={(item) => { setSelectedInventoryItem(item); setIsCreateInventoryItemModalOpen(true); }} />;
            case 'manufacturing_progress':
                return <ManufacturingPipelinePage jobs={jobs} onUpdateJob={handleUpdateJob} onCardClick={(job) => { setSelectedJob(job); setJobDetailModalOpen(true); }} />;
             case 'manufacturing_orders':
                return <ManufacturingOrdersPage jobs={jobs} onSelectJob={(job) => { setSelectedJob(job); setJobDetailModalOpen(true); }} />;
            case 'manufacturing_cost':
                return <ManufacturingCostManagement jobs={jobs} />;
            case 'purchasing_orders':
                return <PurchasingManagementPage purchaseOrders={purchaseOrders} jobs={jobs} />;
            case 'sales_estimates':
                return <EstimateManagementPage estimates={estimates} customers={customers} allUsers={allUsers} onAddEstimate={handleAddEstimate} addToast={addToast} currentUser={currentUser} searchTerm={searchTerm} isAIOff={isAIOff} />;
            case 'analysis_ranking':
                return <SalesRanking initialSummaries={jobs} customers={customers} />;
            case 'accounting_business_plan':
                if (currentUser?.role !== 'admin') {
                    return (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8">
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">経営計画は管理者専用です</h2>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                閲覧権限が必要です。管理者に相談してください。
                            </p>
                        </div>
                    );
                }
                return <BusinessPlanPage allUsers={allUsers} />;
            case 'accounting_dashboard':
                return <AccountingDashboard setCurrentView={handleNavigate} />;
            case 'accounting_journal_review':
                return <JournalReviewPage notify={addToast} />;
            case 'accounting_general_ledger':
                return <GeneralLedger />;
            case 'accounting_payables':
                return <PayablesPage />;
            case 'accounting_receivables':
                return <ReceivablesPage />;
            case 'accounting_cash_schedule':
                return <CashSchedulePage />;
            case 'accounting_approved_applications':
                return <ApprovedApplications notify={addToast} />;
            case 'bulletin_board':
                return <BulletinBoardPage currentUser={currentUser} addToast={addToast} allUsers={allUsers} />;
            case 'approval_list':
                return <ApprovalWorkflowPage currentUser={currentUser} view="list" addToast={addToast} searchTerm={searchTerm} onResumeDraft={handleResumeApplicationDraft} />;
            case 'approval_form_expense': return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode="EXP" addToast={addToast} customers={customers} accountItems={accountItems} jobs={jobs} purchaseOrders={purchaseOrders} departments={departments} isAIOff={isAIOff} allocationDivisions={allocationDivisions} paymentRecipients={paymentRecipients} onCreatePaymentRecipient={handleCreatePaymentRecipientInline} resumedApplication={resumedApplication} onResumeDraftClear={clearResumedApplication} />;
            case 'approval_form_transport': return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode="TRP" addToast={addToast} isAIOff={isAIOff} resumedApplication={resumedApplication} onResumeDraftClear={clearResumedApplication} />;
            case 'approval_form_leave': return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode="LEV" addToast={addToast} isAIOff={isAIOff} resumedApplication={resumedApplication} onResumeDraftClear={clearResumedApplication} />;
            case 'approval_form_approval': return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode="APL" addToast={addToast} isAIOff={isAIOff} resumedApplication={resumedApplication} onResumeDraftClear={clearResumedApplication} />;
            case 'approval_form_daily':
                return (
                    <ApprovalWorkflowPage
                        currentUser={currentUser}
                        view="form"
                        formCode="DLY"
                        addToast={addToast}
                        isAIOff={isAIOff}
                        resumedApplication={resumedApplication}
                        onResumeDraftClear={clearResumedApplication}
                        dailyReportPrefill={dailyReportPrefill}
                        onDailyReportPrefillApplied={handleDailyReportPrefillApplied}
                    />
                );
            case 'approval_form_weekly': return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode="WKR" addToast={addToast} isAIOff={isAIOff} resumedApplication={resumedApplication} onResumeDraftClear={clearResumedApplication} />;
            case 'proposal_ai':
                return <DocumentCreationHub />;
            case 'document_creation_tools':
                return <DocumentCreationHub />;
            case 'pdf_editing_tools':
                return <PDFEditingHub />;
            case 'ai_business_consultant':
                return <AIChatPage currentUser={currentUser} jobs={jobs} customers={customers} journalEntries={journalEntries} />;
            case 'ai_market_research':
                return <MarketResearchPage addToast={addToast} isAIOff={isAIOff} />;
            case 'meeting_minutes':
                return <MeetingMinutesIframe />;
            case 'my_schedule':
                return (
                    <MySchedulePage
                        jobs={jobs}
                        purchaseOrders={purchaseOrders}
                        applications={applications}
                        currentUser={currentUser}
                        allUsers={allUsers}
                        addToast={addToast}
                        onCreateDailyReport={handleCreateDailyReport}
                    />
                );
            case 'admin_audit_log':
                return <AuditLogPage />;
            case 'admin_journal_queue':
                return <JournalQueuePage />;
            case 'admin_action_console':
                // @ts-ignore - TODO: Add 'admin_action_console' to Page type if needed
                return <ActionConsolePage />;
            default:
                return <PlaceholderPage title={PAGE_TITLES[currentPage] || currentPage} />;
        }
    };
    
    if (shouldRequireAuth && isAuthCallbackRoute) {
        return <AuthCallbackPage />;
    }

    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6">
                <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Supabase接続設定が必要です</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        データベースと認証を利用するには、プロジェクトルートの <code className="font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-900 rounded">supabaseCredentials.ts</code> に
                        SupabaseのURLとAnon Keyを設定してください。
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Supabaseダッシュボードの「Project Settings &gt; API」で確認できます。
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        設定後に再読み込み
                    </button>
                </div>
            </div>
        );
    }

    if (shouldRequireAuth && isAuthChecking) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-sm">ログイン状態を確認しています...</p>
            </div>
        );
    }

    if (shouldRequireAuth && !isAuthenticated) {
        return (
            <>
                {authError && (
                    <div className="w-full bg-red-600 text-white text-center text-sm font-semibold py-3 px-4">
                        {authError}
                    </div>
                )}
                {authView === 'login' ? (
                    <LoginPage onSwitchToRegister={() => setAuthView('register')} />
                ) : (
                    <RegisterPage onBackToLogin={() => setAuthView('login')} />
                )}
            </>
        );
    }

    const headerConfig = {
      title: PAGE_TITLES[currentPage],
      primaryAction: PRIMARY_ACTION_ENABLED_PAGES.includes(currentPage)
        ? { label: `新規${PAGE_TITLES[currentPage].replace('管理', '')}作成`, onClick: onPrimaryAction, icon: PlusCircle, disabled: !!dbError, tooltip: dbError ? 'データベース接続エラーのため利用できません。' : undefined }
        : undefined,
      secondaryActions: undefined,
      search: SEARCH_ENABLED_PAGES.includes(currentPage)
        ? { value: searchTerm, onChange: setSearchTerm, placeholder: `${PAGE_TITLES[currentPage]}を検索...`, suggestions: predictiveSuggestions }
        : undefined,
    };

    return (
        <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans flex">
            <Sidebar 
                currentPage={currentPage}
                onNavigate={handleNavigate}
                currentUser={currentUser}
                allUsers={allUsers}
                onUserChange={onUserChange}
                supabaseUserEmail={user?.email}
                onSignOut={handleSignOut}
                approvalsCount={pendingApprovalCount}
            />
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-900 relative min-h-0">
                {dbError && <GlobalErrorBanner error={dbError} onRetry={loadAllData} onShowSetup={() => setIsSetupModalOpen(true)} />}
                <div className={`flex-1 overflow-y-auto p-8 bg-slate-100 dark:bg-slate-900 transition-opacity duration-150 ${isLoading && !dbError ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Header {...headerConfig} />
                    <div className="mt-8">
                        {renderContent()}
                    </div>
                </div>
                {isLoading && !dbError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 z-20">
                        <Loader className="w-12 h-12 animate-spin text-blue-500" />
                    </div>
                )}
            </main>
            
            {/* Modals */}
            {isCreateJobModalOpen && <CreateJobModal isOpen={isCreateJobModalOpen} onClose={() => setCreateJobModalOpen(false)} onAddJob={handleAddJob} customers={customers} onCreateCustomer={handleCreateCustomerInline} />}
            {isCreateLeadModalOpen && <CreateLeadModal isOpen={isCreateLeadModalOpen} onClose={() => setCreateLeadModalOpen(false)} onAddLead={handleAddLead} />}
            {isCreatePOModalOpen && (
                <CreatePurchaseOrderModal
                    isOpen={isCreatePOModalOpen}
                    onClose={() => setCreatePOModalOpen(false)}
                    onAddPurchaseOrder={handleAddPurchaseOrder}
                    paymentRecipients={paymentRecipients}
                    onCreatePaymentRecipient={handleCreatePaymentRecipientInline}
                />
            )}
            {isCreateInventoryItemModalOpen && <CreateInventoryItemModal isOpen={isCreateInventoryItemModalOpen} onClose={() => setIsCreateInventoryItemModalOpen(false)} onSave={handleSaveInventoryItem} item={selectedInventoryItem} />}
            {isJobDetailModalOpen && <JobDetailModal isOpen={isJobDetailModalOpen} job={selectedJob} onClose={() => setJobDetailModalOpen(false)} onUpdateJob={handleUpdateJob} onDeleteJob={handleDeleteJob} requestConfirmation={requestConfirmation} onNavigate={handleNavigate} addToast={addToast} />}
            {isCustomerDetailModalOpen && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    mode={customerModalMode}
                    onClose={() => { setCustomerDetailModalOpen(false); setCustomerInitialValues(null); }}
                    onSave={handleSaveCustomer}
                    onSetMode={setCustomerModalMode}
                    onAnalyzeCustomer={handleAnalyzeCustomer}
                    isAIOff={isAIOff}
                    initialValues={customerInitialValues}
                    addToast={addToast}
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onAutoCreateCustomer={handleCreateCustomerInline}
                />
            )}
            {isAnalysisModalOpen && <CompanyAnalysisModal isOpen={isAnalysisModalOpen} onClose={() => setAnalysisModalOpen(false)} analysis={companyAnalysis} customer={selectedCustomer} isLoading={isAnalysisLoading} error={analysisError} currentUser={currentUser} isAIOff={isAIOff} onReanalyze={handleAnalyzeCustomer}/>}
            {isBugReportModalOpen && <BugReportChatModal isOpen={isBugReportModalOpen} onClose={() => setIsBugReportModalOpen(false)} onReportSubmit={handleSaveBugReport} isAIOff={isAIOff} />}
            {isSetupModalOpen && <DatabaseSetupInstructionsModal onRetry={() => { setIsSetupModalOpen(false); loadAllData(); }} />}
            {showFeatureUpdateModal && currentUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">本日の追加機能</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                    連携と入力を少しだけ楽にしました。
                                </p>
                            </div>
                            <button onClick={handleDismissFeatureModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">×</button>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-100 list-disc list-inside">
                            <li>日報フォームに顧客マスタのオートコンプリートを追加しました。</li>
                            <li>名刺取り込みで「取得イベント」「受領者（社員番号/氏名）」を入力し、赤ペンの社員番号と突合できるようになりました。</li>
                            <li>Googleカレンダー連携をここから開始できます。</li>
                        </ul>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleDismissFeatureModal}
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200"
                            >
                                閉じる
                            </button>
                            <button
                                type="button"
                                onClick={handleStartGoogleCalendarAuth}
                                disabled={isGoogleAuthLoading}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isGoogleAuthLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isGoogleAuthLoading ? '開始中...' : 'Google連携を開始'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global UI */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <ConfirmationDialog {...confirmationDialog} />
            
             <button
                onClick={() => setIsBugReportModalOpen(true)}
                className="fixed bottom-8 right-8 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-110"
                title="バグ報告・改善要望"
                disabled={isAIOff}
            >
                <PlusCircle className="w-6 h-6" />
            </button>
            <button
                onClick={toggleToasts}
                className="fixed bottom-8 right-24 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-full shadow hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-semibold"
                title="トースト通知 ON/OFF"
            >
                {toastsEnabled ? 'トースト: ON' : 'トースト: OFF'}
            </button>
        </div>
    );
};

export default App;
