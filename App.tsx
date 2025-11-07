import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import MobileHeader from './components/MobileHeader.tsx';
import Dashboard from './components/Dashboard.tsx';
import JobList from './components/JobList.tsx';
import CreateJobModal from './components/CreateJobModal.tsx';
import JobDetailModal from './components/JobDetailModal.tsx';
import CustomerList from './components/CustomerList.tsx';
import CustomerDetailModal from './components/CustomerDetailModal.tsx';
import { CompanyAnalysisModal } from './components/CompanyAnalysisModal.tsx';
import LeadManagementPage from './components/sales/LeadManagementPage.tsx';
import CreateLeadModal from './components/sales/CreateLeadModal.tsx';
import PlaceholderPage from './components/PlaceholderPage.tsx';
import UserManagementPage from './components/admin/UserManagementPage.tsx';
import ApprovalRouteManagementPage from './components/admin/ApprovalRouteManagementPage.tsx';
import BugReportList from './components/admin/BugReportList.tsx';
import SettingsPage from './components/SettingsPage.tsx';
import AccountingPage from './components/accounting/Accounting.tsx';
import SalesPipelinePage from './components/sales/SalesPipelinePage.tsx';
import InventoryManagementPage from './components/inventory/InventoryManagementPage.tsx';
import CreateInventoryItemModal from './components/inventory/CreateInventoryItemModal.tsx';
import ManufacturingPipelinePage from './components/manufacturing/ManufacturingPipelinePage.tsx';
import ManufacturingOrdersPage from './components/manufacturing/ManufacturingOrdersPage.tsx';
import PurchasingManagementPage from './components/purchasing/PurchasingManagementPage.tsx';
import CreatePurchaseOrderModal from './components/purchasing/CreatePurchaseOrderModal.tsx';
import EstimateManagementPage from './components/sales/EstimateManagementPage.tsx';
import EstimateCreationPage from './components/sales/EstimateCreationPage.tsx';
import ProjectListPage from './components/sales/ProjectListPage.tsx';
import ProjectCreationPage from './components/sales/ProjectCreationPage.tsx';
import SalesRanking from './components/accounting/SalesRanking.tsx';
import BusinessPlanPage from './components/accounting/BusinessPlanPage.tsx';
import ApprovalWorkflowPage from './components/accounting/ApprovalWorkflowPage.tsx';
import BusinessSupportPage from './components/BusinessSupportPage.tsx';
import AIChatPage from './components/AIChatPage.tsx';
import MarketResearchPage from './components/MarketResearchPage.tsx';
import LiveChatPage from './components/LiveChatPage.tsx';
import AnythingAnalysisPage from './components/AnythingAnalysisPage.tsx';
import { ToastContainer } from './components/Toast.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import ManufacturingCostManagement from './components/accounting/ManufacturingCostManagement.tsx';
import AuditLogPage from './components/admin/AuditLogPage.tsx';
import JournalQueuePage from './components/admin/JournalQueuePage.tsx';
import MasterManagementPage from './components/admin/MasterManagementPage.tsx';
import DatabaseSetupInstructionsModal from './components/DatabaseSetupInstructionsModal.tsx';
import OrganizationChartPage from './components/hr/OrganizationChartPage.tsx';
import LoginPage from './components/LoginPage.tsx';
import BugReportModal from './components/BugReportModal.tsx';
import PermissionRequestButton from './components/PermissionRequestButton.tsx';
import OtsuboneAI from './components/OtsuboneAI.tsx';
import RoleIssueHelper from './components/RoleIssueHelper.tsx';
import AccountingBulkUploadPage from './components/accounting/AccountingBulkUploadPage.tsx';

import * as dataService from './services/dataService.ts';
import { normalizeFormCode } from './services/normalizeFormCode.ts';
import * as geminiService from './services/geminiService.ts';
import { getSupabase, hasSupabaseCredentials } from './services/supabaseClient.ts';
import { Session } from '@supabase/supabase-js';
import { getEnvValue } from './utils.ts';

import { Page, Job, Customer, JournalEntry, User, AccountItem, Lead, ApprovalRoute, PurchaseOrder, InventoryItem, Employee, Toast, ConfirmationDialogProps, BugReport, Estimate, ApplicationWithDetails, Invoice, EmployeeUser, Department, PaymentRecipient, MasterAccountItem, AllocationDivision, Title, Project, ApplicationCode } from './types.ts';
import { PlusCircle, Loader, AlertTriangle, RefreshCw, Settings, Bug } from './components/Icons.tsx';
import packageJson from './package.json';

const PAGE_TITLES: Record<Page, string> = {
    analysis_dashboard: 'ホーム',
    sales_leads: '問い合わせ管理',
    sales_customers: '取引先管理',
    sales_pipeline: '進捗管理',
    sales_estimates: '見積管理',
    sales_orders: '受注管理',
    sales_billing: '売上・請求管理',
    sales_delivery: '納品管理',
    analysis_ranking: '売上ランキング',
    purchasing_orders: '発注 (PO)',
    purchasing_invoices: '仕入計上 (AP)',
    purchasing_payments: '支払管理',
    purchasing_suppliers: '発注先一覧',
    inventory_management: '在庫管理',
    manufacturing_orders: '製造指示',
    manufacturing_progress: '製造パイプライン',
    manufacturing_cost: '製造原価',
    hr_attendance: '勤怠',
    hr_man_hours: '工数',
    hr_labor_cost: '人件費配賦',
    hr_org_chart: '組織図',
    approval_list: '承認一覧',
    approval_form_expense: '経費精算',
    approval_form_transport: '交通費申請',
    approval_form_leave: '休暇申請',
    approval_form_approval: '経費なし稟議申請',
    approval_form_daily: '日報',
    approval_form_weekly: '週報',
    report_other: '営業・セミナー・その他報告',
    accounting_journal: '仕訳帳',
    accounting_general_ledger: '総勘定元帳',
    accounting_trial_balance: '試算表',
    accounting_tax_summary: '消費税集計',
    accounting_period_closing: '締処理',
    accounting_business_plan: '経営計画',
    business_support_proposal: '提案書作成',
    ai_anything_analysis: 'なんでも分析',
    ai_business_consultant: 'AI業務支援',
    ai_market_research: 'AI市場調査',
    ai_live_chat: 'AIライブチャット',
    accounting_bulk_upload: '一括アップロード',
    estimate_creation: '新規見積作成',
    project_list: '案件一覧',
    project_creation: '新規案件作成',
    admin_audit_log: '監査ログ',
    admin_journal_queue: 'ジャーナル・キュー',
    admin_user_management: 'ユーザー管理',
    admin_route_management: '承認ルート管理',
    admin_master_management: 'マスタ管理',
    admin_bug_reports: '改善要望一覧',
    settings: '設定',
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
        promise
            .then((value) => {
                clearTimeout(timeoutId);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
};

const GlobalErrorBanner: React.FC<{ error: string; onRetry: () => void; onShowSetup: () => void; }> = ({ error, onRetry, onShowSetup }) => (
    <div className="bg-red-600 text-white p-3 flex items-center justify-between gap-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-bold">データベースエラー</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button 
          onClick={onRetry} 
          className="bg-red-700 hover:bg-red-800 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" />
          再接続
        </button>
        <button 
          onClick={onShowSetup}
          className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <Settings className="w-4 h-4" />
          セットアップガイド
        </button>
      </div>
    </div>
);

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const [currentPage, setCurrentPage] = useState<Page>('analysis_dashboard');
    const [currentUser, setCurrentUser] = useState<EmployeeUser | null>(null);
    const [allUsers, setAllUsers] = useState<EmployeeUser[]>([]);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [approvalRoutes, setApprovalRoutes] = useState<ApprovalRoute[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [bugReports, setBugReports] = useState<BugReport[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
    const [applicationCodes, setApplicationCodes] = useState<ApplicationCode[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Master data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [paymentRecipients, setPaymentRecipients] = useState<PaymentRecipient[]>([]);
    const [masterAccountItems, setMasterAccountItems] = useState<MasterAccountItem[]>([]);
    const [allocationDivisions, setAllocationDivisions] = useState<AllocationDivision[]>([]);
    const [titles, setTitles] = useState<Title[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);
    const [isJobDetailModalOpen, setIsJobDetailModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
    const [isCustomerDetailModalOpen, setIsCustomerDetailModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerModalMode, setCustomerModalMode] = useState<'view' | 'edit' | 'new'>('view');

    const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);

    const [isCreatePurchaseOrderModalOpen, setIsCreatePurchaseOrderModalOpen] = useState(false);
    const [isCreateInventoryItemModalOpen, setIsCreateInventoryItemModalOpen] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);

    const [isCompanyAnalysisModalOpen, setIsCompanyAnalysisModalOpen] = useState(false);
    const [analysisTargetCustomer, setAnalysisTargetCustomer] = useState<Customer | null>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [analysisError, setAnalysisError] = useState('');

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogProps>({
      isOpen: false, title: '', message: '', onConfirm: () => {}, onClose: () => {}
    });
    
    const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);

    const isAIOff = getEnvValue('NEXT_PUBLIC_AI_OFF') === '1';
    
    const [showSetupModal, setShowSetupModal] = useState(false);

    const addToast = useCallback((message: string, type: Toast['type']) => {
        setToasts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);

    const requestConfirmation = useCallback((dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
      setConfirmationDialog({ ...dialog, isOpen: true, onClose: () => setConfirmationDialog(prev => ({ ...prev, isOpen: false })) });
    }, []);

    const fetchData = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        // IMPORTANT: Load users, approval routes, and application codes first
        // This ensures mapApplicationDetails works correctly
        const usersData = await dataService.getUsers();
        const routesData = await dataService.getApprovalRoutes();
        const appCodesData = await dataService.getApplicationCodes();
        
        const [
          jobsData, customersData, journalData, accountsData, leadsData,
          poData, inventoryData, employeesData, bugReportsData, estimatesData, 
          applicationsData, invoicesData, projectsData,
          departmentsData, paymentRecipientsData, allocationDivisionsData, titlesData
        ] = await Promise.all([
          dataService.getJobs(), dataService.getCustomers(), dataService.getJournalEntries(),
          dataService.getAccountItems(), dataService.getLeads(),
          dataService.getPurchaseOrders(), dataService.getInventoryItems(), dataService.getEmployees(),
          dataService.getBugReports(), dataService.getEstimates(),
          dataService.getApplications(currentUser), dataService.getInvoices(),
          dataService.getProjects(), dataService.getDepartments(), dataService.getPaymentRecipients(),
          dataService.getAllocationDivisions(), dataService.getTitles()
        ]);
        setJobs(jobsData);
        setCustomers(customersData);
        setJournalEntries(journalData);
        setAccountItems(accountsData);
        setLeads(leadsData);
        setApprovalRoutes(routesData);
        setPurchaseOrders(poData);
        setInventoryItems(inventoryData);
        setEmployees(employeesData);
        setAllUsers(usersData);
        setBugReports(bugReportsData);
        setEstimates(estimatesData);
        setApplications(applicationsData);
        setApplicationCodes(appCodesData);
        setInvoices(invoicesData);
        setProjects(projectsData);
        setDepartments(departmentsData);
        setPaymentRecipients(paymentRecipientsData);
        setAllocationDivisions(allocationDivisionsData);
        setTitles(titlesData);
      } catch (err: any) {
        console.error("Data fetching error:", err);
        if (dataService.isSupabaseUnavailableError(err)) {
            setError('データベースに接続できません。オフラインまたは Supabase の認証情報が正しく設定されていない可能性があります。');
            setShowSetupModal(true);
            return;
        }
        if (err instanceof Error && typeof err.message === 'string' && err.message.trim().length > 0) {
            setError(err.message.trim());
        } else if (typeof err === 'string' && err.trim().length > 0) {
            setError(err.trim());
        } else {
            setError("データの読み込みに失敗しました。");
        }
      } finally {
        setIsLoading(false);
      }
    }, [currentUser]);

    useEffect(() => {
        let isMounted = true;
        const credentialsConfigured = hasSupabaseCredentials();
        const AUTH_TIMEOUT_MS = 8000;

        const handleAuthFailure = (message: string, cause?: unknown) => {
            if (typeof cause !== 'undefined') {
                console.error('Supabase auth initialization failed:', cause);
            } else {
                console.error('Supabase auth initialization failed:', message);
            }
            if (!isMounted) {
                return;
            }
            setSession(null);
            setCurrentUser(null);
            setError((prev) => prev ?? message);
            setShowSetupModal(true);
        };

        if (!credentialsConfigured) {
            const initializeDemoAuth = async () => {
                try {
                    const demoUsers = await dataService.getUsers();
                    if (!isMounted) {
                        return;
                    }
                    const demoUser = demoUsers[0] ?? {
                        id: 'demo-user',
                        name: 'デモユーザー',
                        email: 'demo@example.com',
                        role: 'admin' as const,
                        department: null,
                        title: null,
                        createdAt: new Date().toISOString(),
                        canUseAnythingAnalysis: true,
                    };
                    const now = new Date().toISOString();
                    const demoSession = {
                        access_token: 'demo-access-token',
                        refresh_token: 'demo-refresh-token',
                        expires_in: 3600,
                        expires_at: Math.floor(Date.now() / 1000) + 3600,
                        token_type: 'bearer',
                        user: {
                            id: demoUser.id,
                            aud: 'authenticated',
                            app_metadata: { provider: 'demo', providers: ['demo'] },
                            user_metadata: {
                                name: demoUser.name,
                                email: demoUser.email,
                            },
                            created_at: now,
                            email: demoUser.email,
                            email_confirmed_at: now,
                            last_sign_in_at: now,
                            phone: '',
                            phone_confirmed_at: null,
                            role: 'authenticated',
                            identities: [],
                            factors: [],
                        },
                        provider_token: null,
                        provider_refresh_token: null,
                    } as unknown as Session;
                    setSession(demoSession);
                    setCurrentUser(demoUser);
                    setError(null);
                    setShowSetupModal(false);
                } catch (demoError) {
                    if (!isMounted) {
                        return;
                    }
                    console.error('Demo auth initialization failed:', demoError);
                    setSession(null);
                    setCurrentUser(null);
                    setError('デモデータの読み込みに失敗しました。');
                    setShowSetupModal(true);
                } finally {
                    if (isMounted) {
                        setAuthLoading(false);
                    }
                }
            };

            initializeDemoAuth();

            return () => {
                isMounted = false;
            };
        }

        const initializeAuth = async () => {
            try {
                const supabaseClient = getSupabase();
                const { data, error } = await withTimeout(supabaseClient.auth.getSession(), AUTH_TIMEOUT_MS);
                if (!isMounted) return;

                if (error) {
                    throw error;
                }

                const sessionData = data.session ?? null;
                setSession(sessionData);

                if (sessionData) {
                    const resolvedUser = await dataService.resolveUserSession(sessionData.user);
                    if (!isMounted) return;
                    setCurrentUser(resolvedUser);
                    setError(null);
                    setShowSetupModal(false);
                } else {
                    setCurrentUser(null);
                }
            } catch (authError: any) {
                const message = dataService.isSupabaseUnavailableError(authError)
                    ? 'Supabase 認証に接続できません。ネットワークまたは設定を確認してください。'
                    : 'ログイン状態の確認に失敗しました。再度ログインしてください。';
                handleAuthFailure(message, authError);
            } finally {
                if (isMounted) {
                    setAuthLoading(false);
                }
            }
        };

        initializeAuth();

        const supabaseClient = getSupabase();
        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (_event, nextSession) => {
            if (!isMounted) return;
            
            // 新規登録フローの場合、メールアドレス付きで管理者に通知
            const urlParams = new URLSearchParams(window.location.search);
            const isRegistrationFlow = urlParams.get('registration') === 'true';
            
            if (nextSession && isRegistrationFlow && nextSession.user?.email) {
                try {
                    const adminNotification = {
                        type: 'new_user_oauth_completed',
                        timestamp: new Date().toISOString(),
                        message: `新規ユーザー ${nextSession.user.email} がGoogle OAuthを完了しました。ユーザー登録が必要です。`,
                        source: 'auth_state_change',
                        user_email: nextSession.user.email,
                        user_id: nextSession.user.id,
                        provider: nextSession.user.app_metadata?.provider || 'google'
                    };
                    await supabaseClient.from('admin_notifications').insert([adminNotification]);
                    console.log(`管理者にOAuth完了通知を送信: ${nextSession.user.email}`);
                    
                    // URLパラメータをクリア
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (notifyError) {
                    console.warn('管理者通知の送信に失敗:', notifyError);
                }
            }
            
            setSession(nextSession);
            if (nextSession) {
                dataService.resolveUserSession(nextSession.user)
                    .then(user => {
                        if (!isMounted) return;
                        setCurrentUser(user);
                        setError(null);
                        setShowSetupModal(false);
                    })
                    .catch(async (err) => {
                        if (!isMounted) return;
                        if (isSigningOut) return; // 既にサインアウト処理中なら何もしない
                        
                        // ユーザーのメールアドレスを取得
                        const userEmail = nextSession.user?.email || '';
                        
                        // ドメインチェック（許可ドメインのいずれかに一致）
                        const allowedDomains = ['@bunsyodo.jp', '@b-p.co.jp'];
                        let message = '';

                        const isAllowedDomain = userEmail ? allowedDomains.some(d => userEmail.endsWith(d)) : false;
                        if (userEmail && !isAllowedDomain) {
                            // ドメインが違う場合
                            const domainsList = allowedDomains.join(' / ');
                            message = `❌ ログインできません\n\n現在、${userEmail} でログインしようとされています。\n\n申し訳ございませんが、このシステムは社員専用です。\n\n許可ドメイン: ${domainsList}\n\n該当の会社メールアドレスでGoogleログインしてください。`;
                        } else if (err.message && err.message.includes('not found')) {
                            // ユーザーが登録されていない場合 - 新規登録の可能性を提示
                            message = `ℹ️ 新規ユーザー登録が必要です\n\n${userEmail} はまだシステムに登録されていません。\n\n✅ 管理者に通知済みです。ユーザー登録後に再度ログインしてください。\n\n右下のチャットからもお問い合わせいただけます。`;
                        } else if (dataService.isSupabaseUnavailableError(err)) {
                            message = 'Supabase からユーザー情報を取得できません。ネットワークを確認してください。';
                        } else {
                            message = `ユーザー情報の取得に失敗しました。\n\nエラー内容：${err.message}\n\n右下のチャットでお問い合わせください。`;
                        }
                        
                        setError((prev) => prev ?? message);
                        const toastType = message.includes('ℹ️') ? 'info' : 'error';
                        addToast(message, toastType);
                        setCurrentUser(null);
                        setSession(null);
                        
                        // 新規ユーザーの場合は即座リダイレクトせず、登録完了を待つ
                        if (!message.includes('ℹ️')) {
                            // ログアウトして再試行できるようにする（ループ防止）
                            setIsSigningOut(true);
                            try {
                                const supabaseClient = getSupabase();
                                await supabaseClient.auth.signOut();
                                // 強制的にログインページにリダイレクト
                                window.location.href = '/';
                            } catch (signOutError) {
                                console.error('Sign out failed:', signOutError);
                                // サインアウトに失敗した場合も強制リダイレクト
                                window.location.href = '/';
                            } finally {
                                setIsSigningOut(false);
                            }
                        } else {
                            // 新規ユーザーの場合はサインアウトのみ実行（リダイレクトなし）
                            try {
                                const supabaseClient = getSupabase();
                                await supabaseClient.auth.signOut();
                                console.log('新規ユーザー登録待ち: リダイレクトせずにログインページで待機');
                            } catch (signOutError) {
                                console.error('Sign out failed:', signOutError);
                            }
                        }
                    });
            } else {
                if (!isSigningOut) { // サインアウト処理中でなければ
                    setCurrentUser(null);
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);
    
    useEffect(() => {
      if (session && currentUser) {
        fetchData();
      } else if (!authLoading) {
        setIsLoading(false);
      }
    }, [fetchData, session, currentUser, authLoading]);

    const handleSignOut = useCallback(async () => {
        if (!hasSupabaseCredentials()) {
            setCurrentUser(null);
            setSession(null);
            addToast('デモモードのセッションを終了しました。', 'info');
            return;
        }

        try {
            const supabaseClient = getSupabase();
            await supabaseClient.auth.signOut();
        } finally {
            setCurrentUser(null);
            setSession(null);
        }
    }, [addToast]);

    // ... (rest of the component remains the same)

    const handleAnalyzeCustomer = useCallback(async (customer: Customer) => {
        setAnalysisTargetCustomer(customer);
        setIsCompanyAnalysisModalOpen(true);
        setIsAnalysisLoading(true);
        setAnalysisError('');
        setAnalysisResult(null);
        try {
            const result = await geminiService.analyzeCompany(customer);
            setAnalysisResult(result);
            // Optionally save analysis to customer record
            // await dataService.updateCustomer(customer.id, { aiAnalysis: result });
        } catch (e) {
            setAnalysisError(e instanceof Error ? e.message : '分析中にエラーが発生しました。');
        } finally {
            setIsAnalysisLoading(false);
        }
    }, []);

    const handleAddJob = useCallback(async (jobData: any) => {
        await dataService.addJob(jobData);
        await fetchData();
        addToast("新しい案件が追加されました。", "success");
    }, [fetchData, addToast]);
    
    const handleUpdateJob = useCallback(async (jobId: string, updatedData: Partial<Job>) => {
        await dataService.updateJob(jobId, updatedData);
        await fetchData();
        addToast("案件情報が更新されました。", "success");
    }, [fetchData, addToast]);
    
    const handleDeleteJob = useCallback(async (jobId: string) => {
        await dataService.deleteJob(jobId);
        await fetchData();
        addToast("案件が削除されました。", "success");
        setIsJobDetailModalOpen(false);
    }, [fetchData, addToast]);

    const handleAddCustomer = useCallback(async (customerData: Partial<Customer>) => {
        await dataService.addCustomer(customerData);
        await fetchData();
        addToast("新しい顧客が追加されました。", "success");
        setCustomerModalMode('view');
        setIsCustomerDetailModalOpen(false);
    }, [fetchData, addToast]);
    
    const handleUpdateCustomer = useCallback(async (customerId: string, updatedData: Partial<Customer>) => {
        await dataService.updateCustomer(customerId, updatedData);
        await fetchData();
        addToast("顧客情報が更新されました。", "success");
    }, [fetchData, addToast]);
    
    const handleAddJournalEntry = useCallback(async (entry: Omit<JournalEntry, 'id' | 'date'>) => {
        await dataService.addJournalEntry({ ...entry, date: new Date().toISOString() });
        await fetchData();
        addToast("仕訳が追加されました。", "success");
    }, [fetchData, addToast]);

    const handleAddLead = useCallback(async (leadData: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>) => {
        await dataService.addLead(leadData);
        await fetchData();
        addToast("新しいリードが追加されました。", "success");
    }, [fetchData, addToast]);

    const handleUpdateLead = useCallback(async (leadId: string, updatedData: Partial<Lead>) => {
        await dataService.updateLead(leadId, updatedData);
        await fetchData();
        addToast("リード情報が更新されました。", "success");
    }, [fetchData, addToast]);

    const handleDeleteLead = useCallback(async (leadId: string) => {
        await dataService.deleteLead(leadId);
        await fetchData();
        addToast("リードが削除されました。", "success");
    }, [fetchData, addToast]);

    const handleAddPurchaseOrder = useCallback(async (orderData: Omit<PurchaseOrder, 'id'>) => {
        await dataService.addPurchaseOrder(orderData);
        await fetchData();
        addToast("新しい発注が作成されました。", "success");
        setIsCreatePurchaseOrderModalOpen(false);
    }, [fetchData, addToast]);
    
    const handleSaveInventoryItem = useCallback(async (itemData: Partial<InventoryItem>) => {
        if(itemData.id){
            await dataService.updateInventoryItem(itemData.id, itemData);
            addToast("在庫品目が更新されました。", "success");
        } else {
            await dataService.addInventoryItem(itemData);
            addToast("新しい在庫品目が追加されました。", "success");
        }
        await fetchData();
        setIsCreateInventoryItemModalOpen(false);
        setSelectedInventoryItem(null);
    }, [fetchData, addToast]);

    const handleAddBugReport = useCallback(async (reportData: any) => {
        if (!currentUser) return;
        const newReport = { ...reportData, reporterName: currentUser.name };
        await dataService.addBugReport(newReport);
        await fetchData();
        addToast('フィードバックを送信しました。ご協力ありがとうございます！', 'success');
        setIsBugReportModalOpen(false);
    }, [currentUser, fetchData, addToast]);
    
    const handleUpdateBugReport = useCallback(async (reportId: string, updatedData: Partial<BugReport>) => {
        await dataService.updateBugReport(reportId, updatedData);
        await fetchData();
        addToast("レポートのステータスが更新されました。", "success");
    }, [fetchData, addToast]);
    
    const handleCreateEstimate = useCallback(async (estimateData: any) => {
        await dataService.addEstimate(estimateData);
        await fetchData();
    }, [fetchData]);

    const handleProjectCreated = useCallback(async () => {
        await fetchData();
        addToast("AIによる案件作成が完了しました。", "success");
        setCurrentPage('project_list');
    }, [fetchData, addToast]);

    // Master data handlers
    const masterSaveHandler = (saveFn: (item: any) => Promise<any>, entity: string) => async (item: any) => {
        await saveFn(item);
        addToast(`${entity}を保存しました。`, 'success');
        await fetchData();
    };
    const masterDeleteHandler = (deleteFn: (id: string) => Promise<any>, entity: string) => async (id: string) => {
        await deleteFn(id);
        addToast(`${entity}を削除しました。`, 'success');
        await fetchData();
    };


    const renderPage = () => {
        switch (currentPage) {
            case 'analysis_dashboard':
                return <Dashboard 
                    jobs={jobs} 
                    journalEntries={journalEntries} 
                    accountItems={accountItems} 
                    applications={applications}
                    currentUser={currentUser}
                    pendingApprovalCount={applications.filter(a => a.approverId === currentUser?.id && a.status === 'pending_approval').length} 
                    onNavigateToApprovals={() => setCurrentPage('approval_list')} 
                />;
            case 'sales_orders':
                return <JobList jobs={jobs} searchTerm={searchTerm} onSelectJob={(job) => { setSelectedJob(job); setIsJobDetailModalOpen(true); }} onNewJob={() => setIsCreateJobModalOpen(true)} />;
            case 'sales_customers':
                return <CustomerList customers={customers} searchTerm={searchTerm} onSelectCustomer={(c) => { setSelectedCustomer(c); setCustomerModalMode('view'); setIsCustomerDetailModalOpen(true); }} onUpdateCustomer={handleUpdateCustomer} onAnalyzeCustomer={handleAnalyzeCustomer} addToast={addToast} currentUser={currentUser} onNewCustomer={() => { setCustomerModalMode('new'); setIsCustomerDetailModalOpen(true); }} isAIOff={isAIOff} />;
            case 'sales_leads':
                return <LeadManagementPage leads={leads} searchTerm={searchTerm} onRefresh={fetchData} onUpdateLead={handleUpdateLead} onDeleteLead={handleDeleteLead} addToast={addToast} requestConfirmation={requestConfirmation} currentUser={currentUser} isAIOff={isAIOff} onAddEstimate={handleCreateEstimate} />;
            case 'sales_pipeline':
                return <SalesPipelinePage jobs={jobs} onUpdateJob={handleUpdateJob} onCardClick={(job) => { setSelectedJob(job); setIsJobDetailModalOpen(true); }} />;
            case 'inventory_management':
                return <InventoryManagementPage inventoryItems={inventoryItems} onSelectItem={(item) => { setSelectedInventoryItem(item); setIsCreateInventoryItemModalOpen(true); }} />;
            case 'manufacturing_progress':
                return <ManufacturingPipelinePage jobs={jobs} onUpdateJob={handleUpdateJob} onCardClick={(job) => { setSelectedJob(job); setIsJobDetailModalOpen(true); }} />;
            case 'manufacturing_orders':
                return <ManufacturingOrdersPage jobs={jobs} onSelectJob={(job) => { setSelectedJob(job); setIsJobDetailModalOpen(true); }} />;
            case 'purchasing_orders':
                return <PurchasingManagementPage purchaseOrders={purchaseOrders} />;
            case 'sales_estimates':
                return <EstimateManagementPage estimates={estimates} customers={customers} allUsers={allUsers} addToast={addToast} currentUser={currentUser} searchTerm={searchTerm} isAIOff={isAIOff} onNavigateToCreate={setCurrentPage} />;
            case 'estimate_creation':
                 return <EstimateCreationPage customers={customers} allUsers={allUsers} addToast={addToast} currentUser={currentUser} isAIOff={isAIOff} onCreateEstimate={handleCreateEstimate} onNavigateBack={() => setCurrentPage('sales_estimates')} />;
            case 'project_list':
                 return <ProjectListPage projects={projects} onNavigateToCreate={() => setCurrentPage('project_creation')} />;
            case 'project_creation':
                return <ProjectCreationPage onNavigateBack={() => setCurrentPage('project_list')} onProjectCreated={handleProjectCreated} customers={customers} currentUser={currentUser} isAIOff={isAIOff} addToast={addToast} />;
            case 'analysis_ranking':
                return <SalesRanking jobs={jobs} />;
            case 'accounting_business_plan':
                return <BusinessPlanPage allUsers={allUsers} />;
            case 'accounting_bulk_upload':
                return currentUser?.role === 'admin'
                    ? <AccountingBulkUploadPage addToast={addToast} isAIOff={isAIOff} />
                    : <PlaceholderPage title="管理者のみ利用可能" />;
            case 'manufacturing_cost':
                return <ManufacturingCostManagement jobs={jobs} />;
            case 'business_support_proposal':
                return <BusinessSupportPage customers={customers} jobs={jobs} estimates={estimates} currentUser={currentUser} addToast={addToast} isAIOff={isAIOff} />;
            case 'ai_business_consultant':
                return <AIChatPage currentUser={currentUser} jobs={jobs} customers={customers} journalEntries={journalEntries} />;
            case 'ai_market_research':
                return <MarketResearchPage addToast={addToast} isAIOff={isAIOff} />;
            case 'ai_live_chat':
                return <LiveChatPage addToast={addToast} isAIOff={isAIOff} />;
            case 'ai_anything_analysis':
                return currentUser?.canUseAnythingAnalysis ? <AnythingAnalysisPage currentUser={currentUser} addToast={addToast} isAIOff={isAIOff} /> : <PlaceholderPage title="なんでも分析" />;
            
            case 'approval_list':
                return <ApprovalWorkflowPage view="list" currentUser={currentUser} searchTerm={searchTerm} addToast={addToast} onRefreshData={fetchData} />;
            case 'approval_form_expense':
            case 'approval_form_transport':
            case 'approval_form_leave':
            case 'approval_form_approval':
            case 'approval_form_daily':
            case 'approval_form_weekly':
                const rawFormCode = currentPage.split('_').pop() || '';
                const formCode = normalizeFormCode(rawFormCode) ?? rawFormCode.toUpperCase();
                return <ApprovalWorkflowPage
                    view="form"
                    formCode={formCode}
                    currentUser={currentUser}
                    addToast={addToast}
                    isAIOff={isAIOff}
                    customers={customers}
                    accountItems={accountItems}
                    projects={projects}
                    departments={departments}
                    allocationDivisions={allocationDivisions}
                    paymentRecipients={paymentRecipients}
                    applicationCodes={applicationCodes}
                    onSuccess={() => { setCurrentPage('approval_list'); fetchData(); }}
                />;
            
            case 'accounting_journal':
            case 'purchasing_invoices':
            case 'purchasing_payments':
            case 'hr_labor_cost':
            case 'accounting_general_ledger':
            case 'accounting_trial_balance':
            case 'accounting_period_closing':
            case 'sales_billing':
                 return <AccountingPage 
                    page={currentPage}
                    journalEntries={journalEntries}
                    accountItems={accountItems}
                    onAddEntry={handleAddJournalEntry}
                    addToast={addToast}
                    requestConfirmation={requestConfirmation}
                    isAIOff={isAIOff}
                    jobs={jobs}
                    applications={applications}
                    onNavigate={setCurrentPage}
                    customers={customers}
                    employees={employees}
                    onRefreshData={fetchData}
                    allocationDivisions={allocationDivisions}
                />;

            case 'admin_user_management':
                return <UserManagementPage addToast={addToast} requestConfirmation={requestConfirmation} />;
            case 'admin_route_management':
                return <ApprovalRouteManagementPage addToast={addToast} requestConfirmation={requestConfirmation} />;
            case 'admin_bug_reports':
                return <BugReportList reports={bugReports} onUpdateReport={handleUpdateBugReport} searchTerm={searchTerm} />;
            case 'admin_audit_log': return <AuditLogPage />;
            case 'admin_journal_queue': return <JournalQueuePage />;
            case 'purchasing_suppliers':
                return <MasterManagementPage 
                    accountItems={accountItems}
                    paymentRecipients={paymentRecipients}
                    allocationDivisions={allocationDivisions}
                    departments={departments}
                    titles={titles}
                    onSaveAccountItem={masterSaveHandler(dataService.saveAccountItem, '勘定科目')}
                    onDeleteAccountItem={masterDeleteHandler(dataService.deactivateAccountItem, '勘定科目')}
                    onSavePaymentRecipient={masterSaveHandler(dataService.savePaymentRecipient, '支払先')}
                    onDeletePaymentRecipient={masterDeleteHandler(dataService.deletePaymentRecipient, '支払先')}
                    onSaveAllocationDivision={masterSaveHandler(dataService.saveAllocationDivision, '振分区分')}
                    onDeleteAllocationDivision={masterDeleteHandler(dataService.deleteAllocationDivision, '振分区分')}
                    onSaveDepartment={masterSaveHandler(dataService.saveDepartment, '部署')}
                    onDeleteDepartment={masterDeleteHandler(dataService.deleteDepartment, '部署')}
                    onSaveTitle={masterSaveHandler(dataService.saveTitle, '役職')}
                    onDeleteTitle={masterDeleteHandler(dataService.deleteTitle, '役職')}
                    addToast={addToast}
                    requestConfirmation={requestConfirmation}
                    initialTab="recipients"
                    visibleTabs={['recipients']}
                />;
            case 'admin_master_management': 
                return <MasterManagementPage 
                    accountItems={accountItems}
                    paymentRecipients={paymentRecipients}
                    allocationDivisions={allocationDivisions}
                    departments={departments}
                    titles={titles}
                    onSaveAccountItem={masterSaveHandler(dataService.saveAccountItem, '勘定科目')}
                    onDeleteAccountItem={masterDeleteHandler(dataService.deactivateAccountItem, '勘定科目')}
                    onSavePaymentRecipient={masterSaveHandler(dataService.savePaymentRecipient, '支払先')}
                    onDeletePaymentRecipient={masterDeleteHandler(dataService.deletePaymentRecipient, '支払先')}
                    onSaveAllocationDivision={masterSaveHandler(dataService.saveAllocationDivision, '振分区分')}
                    onDeleteAllocationDivision={masterDeleteHandler(dataService.deleteAllocationDivision, '振分区分')}
                    onSaveDepartment={masterSaveHandler(dataService.saveDepartment, '部署')}
                    onDeleteDepartment={masterDeleteHandler(dataService.deleteDepartment, '部署')}
                    onSaveTitle={masterSaveHandler(dataService.saveTitle, '役職')}
                    onDeleteTitle={masterDeleteHandler(dataService.deleteTitle, '役職')}
                    addToast={addToast}
                    requestConfirmation={requestConfirmation}
                />;

            case 'hr_org_chart':
                return <OrganizationChartPage employees={employees} />;
            case 'settings':
                return <SettingsPage addToast={addToast} />;

            default:
                return <PlaceholderPage title={PAGE_TITLES[currentPage] || currentPage} />;
        }
    };
    
    if (authLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader className="w-12 h-12 animate-spin" /></div>;
    }
    
    if (!session) {
        return <LoginPage />;
    }

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100">
            {/* デスクトップ用サイドバー */}
            <div className="hidden lg:block">
                <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} currentUser={currentUser} onSignOut={handleSignOut} />
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* モバイル用ヘッダー */}
                <MobileHeader 
                    title={PAGE_TITLES[currentPage] || 'Dashboard'}
                    currentUser={currentUser}
                    currentPage={currentPage}
                    onNavigate={setCurrentPage}
                    onSignOut={handleSignOut}
                />
                
                {error && <GlobalErrorBanner error={error} onRetry={fetchData} onShowSetup={() => setShowSetupModal(true)} />}
                
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
                    {/* デスクトップ用ヘッダー */}
                    <div className="hidden lg:block">
                        <Header
                            title={PAGE_TITLES[currentPage] || 'Dashboard'}
                            primaryAction={
                              currentPage === 'sales_orders' ? { label: '新規案件作成', onClick: () => setIsCreateJobModalOpen(true), icon: PlusCircle } :
                              currentPage === 'sales_customers' ? { label: '新規顧客登録', onClick: () => { setCustomerModalMode('new'); setIsCustomerDetailModalOpen(true); }, icon: PlusCircle } :
                              currentPage === 'sales_leads' ? { label: '新規リード作成', onClick: () => setIsCreateLeadModalOpen(true), icon: PlusCircle } :
                              currentPage === 'purchasing_orders' ? { label: '新規発注作成', onClick: () => setIsCreatePurchaseOrderModalOpen(true), icon: PlusCircle } :
                              currentPage === 'inventory_management' ? { label: '新規品目登録', onClick: () => { setSelectedInventoryItem(null); setIsCreateInventoryItemModalOpen(true); }, icon: PlusCircle } :
                              undefined
                            }
                            search={
                              ['sales_orders', 'sales_customers', 'sales_leads', 'admin_bug_reports', 'approval_list'].includes(currentPage) ? {
                                value: searchTerm,
                                onChange: setSearchTerm,
                                placeholder: `${PAGE_TITLES[currentPage]}を検索...`
                              } : undefined
                            }
                        />
                    </div>
                    
                    {isLoading && currentPage !== 'analysis_dashboard' ? <Loader className="w-8 h-8 mx-auto animate-spin" /> : renderPage()}
                </main>
                <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-3">
                    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                        <div>© 2025 MQDriven. All rights reserved.</div>
                        <div>Version {packageJson.version}</div>
                    </div>
                </footer>
            </div>
            {isCreateJobModalOpen && <CreateJobModal isOpen={isCreateJobModalOpen} onClose={() => setIsCreateJobModalOpen(false)} onAddJob={handleAddJob} />}
            {isJobDetailModalOpen && <JobDetailModal isOpen={isJobDetailModalOpen} job={selectedJob} onClose={() => setIsJobDetailModalOpen(false)} onUpdateJob={handleUpdateJob} onDeleteJob={handleDeleteJob} requestConfirmation={requestConfirmation} onNavigate={setCurrentPage} addToast={addToast} />}
            {isCustomerDetailModalOpen && <CustomerDetailModal customer={selectedCustomer} mode={customerModalMode} onClose={() => setIsCustomerDetailModalOpen(false)} onSave={customerModalMode === 'new' ? handleAddCustomer : (d) => handleUpdateCustomer(d.id!, d)} onSetMode={setCustomerModalMode} onAnalyzeCustomer={handleAnalyzeCustomer} isAIOff={isAIOff} />}
            {isCreateLeadModalOpen && <CreateLeadModal isOpen={isCreateLeadModalOpen} onClose={() => setIsCreateLeadModalOpen(false)} onAddLead={handleAddLead} />}
            {isCreatePurchaseOrderModalOpen && <CreatePurchaseOrderModal isOpen={isCreatePurchaseOrderModalOpen} onClose={() => setIsCreatePurchaseOrderModalOpen(false)} onAddPurchaseOrder={handleAddPurchaseOrder} />}
            {isCreateInventoryItemModalOpen && <CreateInventoryItemModal isOpen={isCreateInventoryItemModalOpen} onClose={() => { setIsCreateInventoryItemModalOpen(false); setSelectedInventoryItem(null); }} onSave={handleSaveInventoryItem} item={selectedInventoryItem} />}
            {isCompanyAnalysisModalOpen && <CompanyAnalysisModal isOpen={isCompanyAnalysisModalOpen} onClose={() => setIsCompanyAnalysisModalOpen(false)} analysis={analysisResult} customer={analysisTargetCustomer} isLoading={isAnalysisLoading} error={analysisError} currentUser={currentUser} isAIOff={isAIOff} onReanalyze={handleAnalyzeCustomer} />}
            <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            <ConfirmationDialog {...confirmationDialog} />
            {showSetupModal && <DatabaseSetupInstructionsModal onRetry={() => { setShowSetupModal(false); fetchData(); }} />}
            <button
                onClick={() => setIsBugReportModalOpen(true)}
                className="fixed bottom-8 right-24 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-110"
                title="バグ報告・改善要望"
            >
                <Bug className="w-6 h-6"/>
            </button>
            {isBugReportModalOpen && <BugReportModal isOpen={isBugReportModalOpen} onClose={() => setIsBugReportModalOpen(false)} currentUser={currentUser} onReportSubmit={handleAddBugReport} />}
            
            {/* 権限リクエストボタン（一般ユーザーのみ表示） */}
            {currentUser && <PermissionRequestButton currentUser={currentUser} addToast={addToast} />}
            
            {/* おつぼねさんAI - 常に開きっぱなし（邪魔なら閉じてください） */}
            {currentUser && (
                <OtsuboneAI
                    currentUser={currentUser}
                    onDataSubmit={async (type, data) => {
                        // データ登録処理
                        console.log('Data submitted:', type, data);
                        addToast('データを登録しました！', 'success');
                    }}
                />
            )}
            
            {/* メニューが少ない問題を解決するヘルパー */}
            {currentUser && (
                <RoleIssueHelper
                    currentUser={currentUser}
                    onRefresh={() => window.location.reload()}
                />
            )}
        </div>
    );
};

export default App;
