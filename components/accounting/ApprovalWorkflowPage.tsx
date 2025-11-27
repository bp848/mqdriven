import React, { useState, useEffect, useMemo } from 'react';
import ApplicationList from '../ApplicationList';
import ApplicationDetailModal from '../ApplicationDetailModal';
import { getApplications, getApplicationCodes, approveApplication, rejectApplication } from '../../services/dataService';
// FIX: Import AllocationDivision type.
import { ApplicationWithDetails, ApplicationCode, EmployeeUser, Toast, Customer, AccountItem, Job, PurchaseOrder, Department, AllocationDivision, PaymentRecipient, DailyReportPrefill } from '../../types';
import { Loader, AlertTriangle } from '../Icons';

// Form components
import ExpenseReimbursementForm from '../forms/ExpenseReimbursementForm';
import TransportExpenseForm from '../forms/TransportExpenseForm';
import LeaveApplicationForm from '../forms/LeaveApplicationForm';
import ApprovalForm from '../forms/ApprovalForm';
import DailyReportForm from '../forms/DailyReportForm';
import WeeklyReportForm from '../forms/WeeklyReportForm';

interface ApprovalWorkflowPageProps {
    currentUser: EmployeeUser | null;
    view: 'list' | 'form';
    formCode?: string;
    searchTerm?: string;
    addToast: (message: string, type: Toast['type']) => void;
    customers?: Customer[];
    accountItems?: AccountItem[];
    jobs?: Job[];
    purchaseOrders?: PurchaseOrder[];
    departments?: Department[];
    isAIOff?: boolean;
    allocationDivisions?: AllocationDivision[];
    paymentRecipients?: PaymentRecipient[];
    onCreatePaymentRecipient?: (recipient: Partial<PaymentRecipient>) => Promise<PaymentRecipient>;
    onResumeDraft?: (application: ApplicationWithDetails) => void;
    resumedApplication?: ApplicationWithDetails | null;
    onResumeDraftClear?: () => void;
    dailyReportPrefill?: DailyReportPrefill;
    onDailyReportPrefillApplied?: () => void;
}

const TAB_ORDER = ['approvals', 'drafts', 'submitted', 'completed'] as const;
type TabId = typeof TAB_ORDER[number];

const TABS_CONFIG: Record<
    TabId,
    {
        label: string;
        title: string;
        description: string;
        emptyMessage: string;
        accent: string;
        shadow: string;
    }
> = {
    approvals: {
        label: '自分の承認',
        title: '自分の承認待ち',
        description: 'あなたが最終判断を下す必要がある申請一覧です。',
        emptyMessage: '現在、承認待ちの申請はありません。',
        accent: 'from-blue-500 via-blue-500 to-indigo-500',
        shadow: 'shadow-blue-500/30',
    },
    drafts: {
        label: '下書き',
        title: '保存している下書き',
        description: '途中保存した申請をここから再開できます。',
        emptyMessage: '保存されている下書きはまだありません。',
        accent: 'from-amber-500 via-orange-500 to-rose-500',
        shadow: 'shadow-amber-500/30',
    },
    submitted: {
        label: '提出履歴',
        title: '提出済みの申請',
        description: '提出済みの申請と現在のステータスを確認できます。',
        emptyMessage: 'まだ提出済みの申請はありません。',
        accent: 'from-emerald-500 via-green-500 to-teal-500',
        shadow: 'shadow-emerald-500/30',
    },
    completed: {
        label: '完了済',
        title: '完了した申請',
        description: '承認または却下が確定した申請の履歴です。',
        emptyMessage: '完了済みの申請はまだありません。',
        accent: 'from-slate-600 via-slate-700 to-slate-800',
        shadow: 'shadow-slate-600/30',
    },
};

const ApprovalWorkflowPage: React.FC<ApprovalWorkflowPageProps> = ({
    currentUser,
    view,
    formCode,
    searchTerm,
    addToast,
    customers,
    accountItems,
    jobs,
    purchaseOrders,
    departments,
    isAIOff,
    allocationDivisions,
    paymentRecipients,
    onCreatePaymentRecipient,
    onResumeDraft,
    resumedApplication,
    onResumeDraftClear,
}) => {
    // State for list view
    const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('approvals');
    const [activeResumedApplication, setActiveResumedApplication] = useState<ApplicationWithDetails | null>(null);

    // State for form view
    const [applicationCodes, setApplicationCodes] = useState<ApplicationCode[]>([]);
    const [isCodesLoading, setIsCodesLoading] = useState(true);

    // --- Helpers: derive numeric amount per application for summaries ---
    const deriveApplicationAmount = (app: ApplicationWithDetails): number | null => {
        const data: any = app.formData || {};
        const invoice = data.invoice || {};

        const toNumber = (value: any): number | null => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const normalized = value.replace(/,/g, '').trim();
                if (!normalized) return null;
                const parsed = Number(normalized);
                if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
            }
            return null;
        };

        const candidates = [
            toNumber(data.amount),
            toNumber(data.totalAmount),
            toNumber(data.requestedAmount),
            toNumber(data.estimatedAmount),
            toNumber(invoice.totalGross),
            toNumber(invoice.totalNet),
        ].filter((v): v is number => v !== null);

        if (candidates.length === 0) return null;
        return candidates[0];
    };

    const sumApplicationAmounts = (apps: ApplicationWithDetails[]): number => {
        return apps.reduce((sum, app) => {
            const amount = deriveApplicationAmount(app);
            return sum + (amount || 0);
        }, 0);
    };

    const fetchListData = async () => {
        if (!currentUser) return;
        try {
            setIsLoading(true);
            setError('');
            const apps = await getApplications(currentUser);
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
            setApplicationCodes(codes);
        } catch (err: any) {
             setError(err.message || '申請フォームの基本データの読み込みに失敗しました。');
        } finally {
            setIsCodesLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'list' && currentUser) {
            fetchListData();
        } else if (view === 'form') {
            fetchFormData();
        }
    }, [view, currentUser]);

    useEffect(() => {
        if (view !== 'form') {
            setActiveResumedApplication(null);
            return;
        }
        if (!resumedApplication) return;

        const targetCodeId = applicationCodes.find(code => code.code === formCode)?.id;
        const matchesCode = resumedApplication.applicationCode?.code === formCode;
        const matchesId = targetCodeId ? resumedApplication.applicationCodeId === targetCodeId : false;

        if ((matchesCode || matchesId) && activeResumedApplication?.id !== resumedApplication.id) {
            setActiveResumedApplication(resumedApplication);
            onResumeDraftClear?.();
        }
    }, [view, resumedApplication, formCode, applicationCodes, activeResumedApplication, onResumeDraftClear]);

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
        if (!currentUser) return;
        try {
            await approveApplication(application, currentUser as any);
            addToast('申請を承認しました。', 'success');
            handleModalClose();
            await fetchListData();
        } catch (err: any) {
            addToast(`エラー: ${err.message}`, 'error');
        }
    };

    const handleReject = async (application: ApplicationWithDetails, reason: string) => {
        if (!currentUser) return;
        try {
            await rejectApplication(application, reason, currentUser as any);
            addToast('申請を差し戻しました。', 'success');
            handleModalClose();
            await fetchListData();
        } catch (err: any) {
            addToast(`エラー: ${err.message}`, 'error');
        }
    };
    
    const { displayedApplications, tabCounts, tabTotals } = useMemo(() => {
        const approvalQueue = applications.filter(
            app => app.approverId === currentUser?.id && app.status === 'pending_approval'
        );
        const myApplications = applications.filter(app => app.applicantId === currentUser?.id);
        const draftQueue = myApplications.filter(app => app.status === 'draft');
        const submittedQueue = myApplications.filter(app => app.status !== 'draft');
        const completedQueue = applications.filter(app => {
            const involved = app.applicantId === currentUser?.id || app.approverId === currentUser?.id;
            const isDone = app.status === 'approved' || app.status === 'rejected';
            return involved && isDone;
        });

        const datasetMap: Record<TabId, ApplicationWithDetails[]> = {
            approvals: approvalQueue,
            drafts: draftQueue,
            submitted: submittedQueue,
            completed: completedQueue,
        };

        const counts: Record<TabId, number> = {
            approvals: approvalQueue.length,
            drafts: draftQueue.length,
            submitted: submittedQueue.length,
            completed: completedQueue.length,
        };

        const totals: Record<TabId, number> = {
            approvals: sumApplicationAmounts(approvalQueue),
            drafts: sumApplicationAmounts(draftQueue),
            submitted: sumApplicationAmounts(submittedQueue),
            completed: sumApplicationAmounts(completedQueue),
        };

        let filteredByTab = datasetMap[activeTab] || [];

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filteredByTab = filteredByTab.filter(app =>
                app.applicant?.name?.toLowerCase().includes(lowercasedTerm) ||
                app.applicationCode?.name?.toLowerCase().includes(lowercasedTerm) ||
                app.status.toLowerCase().includes(lowercasedTerm)
            );
        }
        return { displayedApplications: filteredByTab, tabCounts: counts, tabTotals: totals };
    }, [applications, activeTab, searchTerm, currentUser]);


    // Form View Logic
    const handleFormSuccess = () => {
        addToast('はい（1件の申請を送信しました）', 'success');
        setActiveResumedApplication(null);
    };

    const renderActiveForm = () => {
        const activeApplicationCode = applicationCodes.find(c => c.code === formCode);

        const formError = error || (!isCodesLoading && !activeApplicationCode) ? (error || `申請種別'${formCode}'の定義が見つかりません。`) : '';
        
        if (!currentUser) {
            return (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                    <p className="font-bold">致命的なエラー</p>
                    <p>ユーザー情報が読み込めませんでした。再ログインしてください。</p>
                </div>
            );
        }

        const formProps = {
            onSuccess: handleFormSuccess,
            applicationCodeId: activeApplicationCode?.id || '',
            currentUser: currentUser as any,
            addToast: addToast,
            isAIOff: isAIOff,
            isLoading: isCodesLoading,
            error: formError,
        };

        switch(formCode) {
            case 'EXP': return <ExpenseReimbursementForm {...formProps} customers={customers || []} accountItems={accountItems || []} jobs={jobs || []} purchaseOrders={purchaseOrders || []} departments={departments || []} allocationDivisions={allocationDivisions || []} paymentRecipients={paymentRecipients || []} onCreatePaymentRecipient={onCreatePaymentRecipient} draftApplication={activeResumedApplication} />;
            case 'TRP': return <TransportExpenseForm {...formProps} draftApplication={activeResumedApplication} />;
            case 'LEV': return <LeaveApplicationForm {...formProps} draftApplication={activeResumedApplication} />;
            case 'APL': return <ApprovalForm {...formProps} draftApplication={activeResumedApplication} />;
        case 'DLY':
            return (
                <DailyReportForm
                    {...formProps}
                    draftApplication={activeResumedApplication}
                    prefill={dailyReportPrefill}
                    onPrefillApplied={onDailyReportPrefillApplied}
                />
            );
            case 'WKR': return <WeeklyReportForm {...formProps} draftApplication={activeResumedApplication} />;
            default: return (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="mt-4 text-lg font-bold">フォームが見つかりません</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">申請フォーム '{formCode}' は存在しないか、正しく設定されていません。</p>
                </div>
            );
        }
    };
    
    const EmptyState = () => (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <p className="font-semibold">{TABS_CONFIG[activeTab].emptyMessage}</p>
            <p className="mt-1 text-base">新しい活動があると、ここに表示されます。</p>
        </div>
    );


    if (view === 'list') {
        const TabCard = ({ id }: { id: TabId }) => {
            const config = TABS_CONFIG[id];
            const isActive = activeTab === id;
            const count = tabCounts[id];
            const total = tabTotals[id];
            return (
                <button
                    onClick={() => setActiveTab(id)}
                    className={`relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                        isActive
                            ? `border-transparent bg-gradient-to-r ${config.accent} text-white shadow-lg ${config.shadow}`
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                    }`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-100'}`}>{config.label}</p>
                            <p className={`mt-1 text-xs ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{config.description}</p>
                            <p className={`mt-2 text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                合計 {count} 件 / 金額 ¥{total.toLocaleString()}
                            </p>
                        </div>
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            {count}
                        </span>
                    </div>
                </button>
            );
        };

        return (
            <div className="flex flex-col gap-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {TAB_ORDER.map(tabId => (
                        <TabCard key={tabId} id={tabId} />
                    ))}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span>{TABS_CONFIG[activeTab].title}</span>
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{TABS_CONFIG[activeTab].description}</p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-4 text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">件数: {tabCounts[activeTab]} 件</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">合計金額: ¥{tabTotals[activeTab].toLocaleString()}</span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center p-16"><Loader className="w-8 h-8 mx-auto animate-spin"/></div>
                ) : error ? (
                    <div className="text-center p-16 text-red-500">{error}</div>
                ) : displayedApplications.length > 0 ? (
                    <ApplicationList
                        applications={displayedApplications}
                        onApplicationSelect={handleSelectApplication}
                        selectedApplicationId={selectedApplication?.id || null}
                        onResumeDraft={onResumeDraft}
                        currentUserId={currentUser?.id}
                    />
                ) : (
                    <EmptyState />
                )}

                {isDetailModalOpen && (
                    <ApplicationDetailModal
                        application={selectedApplication}
                        currentUser={currentUser}
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
