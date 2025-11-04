import React, { useState, useEffect, useMemo } from 'react';
import ApplicationList from '../ApplicationList.tsx';
import ApplicationDetailModal from '../ApplicationDetailModal.tsx';
import { getApplications, getApplicationCodes, approveApplication, rejectApplication, resolveUserSession } from '../../services/dataService.ts';
import { normalizeFormCode } from '../../services/normalizeFormCode.ts';
import { ApplicationWithDetails, ApplicationCode, EmployeeUser, Toast, Customer, AccountItem, Department, AllocationDivision, Project, PaymentRecipient } from '../../types.ts';
import { Loader, AlertTriangle } from '../Icons.tsx';
import { getSupabase, hasSupabaseCredentials } from '../../services/supabaseClient.ts';

// Form components
import ExpenseReimbursementForm from '../forms/ExpenseReimbursementForm.tsx';
import TransportExpenseForm from '../forms/TransportExpenseForm.tsx';
import LeaveApplicationForm from '../forms/LeaveApplicationForm.tsx';
import ApprovalForm from '../forms/ApprovalForm.tsx';
import DailyReportForm from '../forms/DailyReportForm.tsx';
import WeeklyReportForm from '../forms/WeeklyReportForm.tsx';

interface ApprovalWorkflowPageProps {
    currentUser: EmployeeUser | null;
    view: 'list' | 'form';
    formCode?: string;
    searchTerm?: string;
    addToast: (message: string, type: Toast['type']) => void;
    customers?: Customer[];
    accountItems?: AccountItem[];
    projects?: Project[];
    departments?: Department[];
    isAIOff?: boolean;
    allocationDivisions?: AllocationDivision[];
    paymentRecipients?: PaymentRecipient[];
    onSuccess?: () => void; // Added for form submission success callback
    onRefreshData?: () => void; // Added for list data refresh
}

const TABS_CONFIG = {
    pending: { title: "あなたが承認する申請", description: "あなたが承認する必要がある申請の一覧です。" },
    submitted: { title: "自分の申請", description: "あなたが過去に提出したすべての申請履歴です。" },
    completed: { title: "完了済", description: "承認または却下されたすべての申請の履歴です。" },
};

const USER_LOAD_ERROR_CODE = 'APPROVAL-USER-LOAD-001';

const ApprovalWorkflowPage: React.FC<ApprovalWorkflowPageProps> = ({ currentUser, view, formCode, searchTerm, addToast, customers, accountItems, projects, departments, isAIOff, allocationDivisions, paymentRecipients, onSuccess, onRefreshData }) => {
    // State for list view
    const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'submitted' | 'completed'>('pending');

    // State for form view
    const [applicationCodes, setApplicationCodes] = useState<ApplicationCode[]>([]);
    const [isCodesLoading, setIsCodesLoading] = useState(true);
    const [resolvedUser, setResolvedUser] = useState<EmployeeUser | null>(currentUser);
    const [isUserLoading, setIsUserLoading] = useState(!currentUser && hasSupabaseCredentials());
    const [hasNotifiedUserError, setHasNotifiedUserError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (currentUser) {
            setResolvedUser(currentUser);
            setIsUserLoading(false);
            return () => {
                isMounted = false;
            };
        }

        if (!hasSupabaseCredentials()) {
            setResolvedUser(null);
            setIsUserLoading(false);
            return () => {
                isMounted = false;
            };
        }

        const fetchUser = async () => {
            setIsUserLoading(true);
            try {
                const supabaseClient = getSupabase();
                const { data, error } = await supabaseClient.auth.getSession();
                if (!isMounted) return;
                if (error || !data.session?.user) {
                    setResolvedUser(null);
                    return;
                }

                const user = await resolveUserSession(data.session.user);
                if (!isMounted) return;
                setResolvedUser(user);
            } catch (err) {
                console.error('Failed to resolve current user for ApprovalWorkflowPage', err);
                if (isMounted) {
                    setResolvedUser(null);
                }
            } finally {
                if (isMounted) {
                    setIsUserLoading(false);
                }
            }
        };

        fetchUser();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const effectiveUser = currentUser ?? resolvedUser;
    const effectiveUserId = effectiveUser?.id;

    useEffect(() => {
        if (!isUserLoading && !effectiveUser) {
            if (!hasNotifiedUserError) {
                addToast(
                    `[${USER_LOAD_ERROR_CODE}] ユーザー情報が読み込めませんでした。再ログインしてください。`,
                    'error'
                );
                setHasNotifiedUserError(true);
            }
        } else if (hasNotifiedUserError) {
            setHasNotifiedUserError(false);
        }
    }, [isUserLoading, effectiveUser, addToast, hasNotifiedUserError]);

    const fetchListData = async () => {
        if (!effectiveUser) return;
        try {
            setIsLoading(true);
            setError('');
            const apps = await getApplications(effectiveUser);
            setApplications(apps);
        } catch (err: any) {
            setError(err.message || '申請データの取得に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFormData = async () => {
        setIsCodesLoading(true);
        setError('');
        try {
            const codes = await getApplicationCodes();
            console.log('取得した申請種別:', codes);
            setApplicationCodes(codes);
        } catch (err: any) {
             setError(err.message || '申請フォームの基本データの読み込みに失敗しました。');
        } finally {
            setIsCodesLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'list' && effectiveUser) {
            fetchListData();
        } else if (view === 'form') {
            fetchFormData();
        }
    }, [view, effectiveUserId]);

    // List View Logic
    const handleSelectApplication = (app: ApplicationWithDetails) => {
        setSelectedApplication(app);
        setIsDetailModalOpen(true);
    };

    const handleModalClose = () => {
        setIsDetailModalOpen(false);
        setSelectedApplication(null);
    };

    const handleApprove = async (application: ApplicationWithDetails) => {
        if (!effectiveUser) return;
        try {
            await approveApplication(application, effectiveUser as any);
            addToast('申請を承認しました。', 'success');
            handleModalClose();
            await fetchListData(); // Refresh list after action
            onRefreshData?.(); // Notify parent to refresh if needed
        } catch (err: any) {
            addToast(`エラー: ${err.message}`, 'error');
        }
    };

    const handleReject = async (application: ApplicationWithDetails, reason: string) => {
        if (!effectiveUser) return;
        try {
            await rejectApplication(application, reason, effectiveUser as any);
            addToast('申請を差し戻しました。', 'success');
            handleModalClose();
            await fetchListData(); // Refresh list after action
            onRefreshData?.(); // Notify parent to refresh if needed
        } catch (err: any) {
            addToast(`エラー: ${err.message}`, 'error');
        }
    };
    
    const { displayedApplications, tabCounts } = useMemo(() => {
        const pendingApps = applications.filter(app => app.approverId === effectiveUserId && app.status === 'pending_approval');
        const submittedApps = applications.filter(app => app.applicantId === effectiveUserId);
        const completedApps = applications.filter(app => app.status === 'approved' || app.status === 'rejected');

        const counts = {
            pending: pendingApps.length,
            submitted: submittedApps.length,
            completed: completedApps.length
        };

        let filteredByTab: ApplicationWithDetails[];
        switch(activeTab) {
            case 'pending':
                filteredByTab = pendingApps;
                break;
            case 'submitted':
                filteredByTab = submittedApps;
                break;
            case 'completed':
                filteredByTab = completedApps;
                break;
            default:
                filteredByTab = [];
        }
        
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filteredByTab = filteredByTab.filter(app =>
                app.applicant?.name?.toLowerCase().includes(lowercasedTerm) ||
                app.applicationCode?.name?.toLowerCase().includes(lowercasedTerm) ||
                app.status.toLowerCase().includes(lowercasedTerm)
            );
        }
        return { displayedApplications: filteredByTab, tabCounts: counts };
    }, [applications, activeTab, searchTerm, effectiveUserId]);


    // Form View Logic
    const handleFormSuccess = () => {
        addToast('申請が提出されました。承認一覧で確認できます。', 'success');
        onSuccess?.(); // Call parent onSuccess to trigger global data reload
    };

    const renderActiveForm = () => {
        const rawFormCode = formCode ?? '';
        const normalizedInput = normalizeFormCode(rawFormCode) ?? rawFormCode.toUpperCase();
        const normalizedCompact = normalizedInput.replace(/[\s_-]+/g, '');

        console.log('フォームコード検索:', { rawFormCode, normalizedInput, normalizedCompact, applicationCodes });

        const matchesFormCode = (candidate?: string | null) => {
            if (!candidate) return false;
            const upper = candidate.toUpperCase();
            const compact = upper.replace(/[\s_-]+/g, '');
            const mapped = normalizeFormCode(candidate);
            const mappedUpper = mapped?.toUpperCase();
            const mappedCompact = mappedUpper?.replace(/[\s_-]+/g, '');
            return (
                upper === normalizedInput ||
                compact === normalizedInput ||
                upper === normalizedCompact ||
                compact === normalizedCompact ||
                (!!mappedUpper && (mappedUpper === normalizedInput || mappedUpper === normalizedCompact)) ||
                (!!mappedCompact && (mappedCompact === normalizedInput || mappedCompact === normalizedCompact))
            );
        };

        const activeApplicationCode = applicationCodes.find(code =>
            matchesFormCode(code.code) || matchesFormCode(code.id) || matchesFormCode(code.name)
        );
        
        console.log('マッチした申請種別:', activeApplicationCode);

        const effectiveFormCode = activeApplicationCode?.code ?? normalizedInput;
        const displayFormCode = formCode ?? activeApplicationCode?.code ?? normalizedInput;

        const formError = error || (!isCodesLoading && !activeApplicationCode)
            ? (error || `申請種別'${displayFormCode}'の定義が見つかりません。`)
            : '';
        
        if (isUserLoading) {
            return (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm text-center">
                    <Loader className="w-8 h-8 mx-auto animate-spin" aria-hidden="true" />
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">ユーザー情報を読み込み中です…</p>
                </div>
            );
        }

        if (!effectiveUser) {
            return (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                    <p className="font-bold">致命的なエラー</p>
                    <p className="mt-1">エラーコード: <span className="font-mono">{USER_LOAD_ERROR_CODE}</span></p>
                    <p className="mt-1">ユーザー情報が読み込めませんでした。再ログインしてください。</p>
                </div>
            );
        }

        const formProps = {
            onSuccess: handleFormSuccess,
            applicationCodeId: activeApplicationCode?.id || '',
            currentUser: effectiveUser as any,
            addToast: addToast,
            isAIOff: isAIOff,
            isLoading: isCodesLoading,
            error: formError,
        };

        switch(effectiveFormCode) {
            case 'EXP': return <ExpenseReimbursementForm {...formProps} customers={customers || []} accountItems={accountItems || []} projects={projects || []} departments={departments || []} allocationDivisions={allocationDivisions || []} paymentRecipients={paymentRecipients || []} />;
            case 'TRP': return <TransportExpenseForm {...formProps} accountItems={accountItems || []} allocationDivisions={allocationDivisions || []} />;
            case 'LEV': return <LeaveApplicationForm {...formProps} />;
            case 'APL': return <ApprovalForm {...formProps} />;
            case 'DLY': return <DailyReportForm {...formProps} />;
            case 'WKR': return <WeeklyReportForm {...formProps} />;
            default: return (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-bold">フォームが見つかりません</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">申請フォーム '{displayFormCode}' は存在しないか、正しく設定されていません。</p>
                </div>
            );
        }
    };
    
    const EmptyState = () => {
        const messages = {
            pending: "承認待ちの申請はありません。",
            submitted: "あなたが申請した案件はありません。",
            completed: "完了した申請はまだありません。"
        };
        return (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <p className="font-semibold">{messages[activeTab]}</p>
                <p className="mt-1 text-base">新しい活動があると、ここに表示されます。</p>
            </div>
        );
    };


    if (view === 'list') {
        const TabButton = ({ id, label, count }: { id: 'pending' | 'submitted' | 'completed', label: string, count: number }) => (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 rounded-t-lg border-b-2 font-semibold text-base transition-colors ${
                    activeTab === id
                        ? 'border-blue-500 text-blue-600 bg-white dark:bg-slate-800'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                aria-selected={activeTab === id}
                role="tab"
            >
                {label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                    {count}
                </span>
            </button>
        );

        return (
            <div className="flex flex-col gap-6">
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="flex space-x-2" role="tablist">
                        <TabButton id="pending" label="あなたが承認する申請" count={tabCounts.pending} />
                        <TabButton id="submitted" label="自分の申請" count={tabCounts.submitted} />
                        <TabButton id="completed" label="完了済" count={tabCounts.completed} />
                    </nav>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{TABS_CONFIG[activeTab].title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{TABS_CONFIG[activeTab].description}</p>
                </div>

                {isLoading ? (
                    <div className="text-center p-16" aria-live="polite"><Loader className="w-8 h-8 mx-auto animate-spin" aria-hidden="true" /></div>
                ) : error ? (
                    <div className="text-center p-16 text-red-500" role="alert">{error}</div>
                ) : displayedApplications.length > 0 ? (
                    <ApplicationList
                        applications={displayedApplications}
                        onApplicationSelect={handleSelectApplication}
                        selectedApplicationId={selectedApplication?.id || null}
                    />
                ) : (
                    <EmptyState />
                )}

                {isDetailModalOpen && (
                    <ApplicationDetailModal
                        application={selectedApplication}
                        currentUser={effectiveUser}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onClose={handleModalClose}
                    />
                )}
            </div>
        );
    }

    if (view === 'form') {
        return (
            <div>
                {renderActiveForm()}
            </div>
        );
    }

    return null;
};

export default ApprovalWorkflowPage;