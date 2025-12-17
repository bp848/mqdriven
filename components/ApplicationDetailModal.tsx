import React, { useState, useEffect, useRef } from 'react';
import { ApplicationWithDetails, User } from '../types';
import { X, CheckCircle, Send, Loader, FileText } from './Icons';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import { getUsers, updateApplication } from '../services/dataService';
import { useSubmitWithConfirmation } from '../hooks/useSubmitWithConfirmation';

type SummaryHighlight = {
    label: string;
    value: React.ReactNode;
};

type SummaryListSection = {
    title: string;
    items: { label: string; value: React.ReactNode }[];
};

type SummaryTableSection = {
    title: string;
    columns: string[];
    rows: React.ReactNode[][];
};

interface FormSummary {
    highlights: SummaryHighlight[];
    listSections: SummaryListSection[];
    tableSections: SummaryTableSection[];
}

const isFilled = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

const formatCurrency = (value: any): string => {
    if (!isFilled(value)) return '';
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        return `¥${Math.round(numeric).toLocaleString('ja-JP')}`;
    }
    if (typeof value === 'string') {
        return value;
    }
    return '';
};

const formatDateValue = (value?: string | null): string => {
    if (!isFilled(value)) return '';
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) return value as string;
    return date.toLocaleDateString('ja-JP');
};

const calculateDayDiff = (start?: string, end?: string): number | null => {
    if (!isFilled(start) || !isFilled(end)) return null;
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

const resolveCustomerCandidate = (line: any): string => {
    if (!line || typeof line !== 'object') return '';
    const candidates = [
        line.customerName,
        line.customCustomerName,
        line.customerCandidate,
        typeof line.customer === 'string' ? line.customer : null,
        line.customer?.customerName,
        line.customer?.name,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed) return trimmed;
        }
    }
    if (typeof line.customerId === 'string') {
        const trimmed = line.customerId.trim();
        if (trimmed) return trimmed;
    }
    return '';
};

const buildFormSummary = (code?: string, rawData?: any): FormSummary => {
    const summary: FormSummary = { highlights: [], listSections: [], tableSections: [] };
    if (!rawData || typeof rawData !== 'object') return summary;
    const data = rawData as Record<string, any>;
    const normalizedCode = code?.toUpperCase();

    const pushHighlight = (label: string, value?: any, opts?: { format?: 'currency' | 'date' }) => {
        if (!isFilled(value)) return;
        let display: React.ReactNode = value;
        if (opts?.format === 'currency') {
            const formatted = formatCurrency(value);
            if (!formatted) return;
            display = formatted;
        } else if (opts?.format === 'date') {
            const formatted = formatDateValue(value);
            if (!formatted) return;
            display = formatted;
        }
        summary.highlights.push({ label, value: display });
    };

    const pushListSection = (title: string, items: { label: string; value: React.ReactNode }[]) => {
        const filtered = items.filter(item => isFilled(item.value));
        if (!filtered.length) return;
        summary.listSections.push({ title, items: filtered });
    };

    const pushTableSection = (title: string, columns: string[], rows: React.ReactNode[][]) => {
        if (!rows.length) return;
        summary.tableSections.push({ title, columns, rows });
    };

    switch (normalizedCode) {
        case 'EXP': {
            const invoice = data.invoice || {};
            const total = invoice.totalGross ?? invoice.totalNet ?? data.totalAmount ?? data.amount;
            pushHighlight('申請金額', total, { format: 'currency' });
            const payee = invoice.supplierName ?? data.supplierName ?? data.customerName;
            pushHighlight('支払先', payee);
            pushHighlight('支払期限', invoice.dueDate, { format: 'date' });

            const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
            const customerCandidates = lines
                .map((line: any) => resolveCustomerCandidate(line))
                .filter(name => isFilled(name));
            const uniqueCustomerCandidates = Array.from(new Set(customerCandidates));
            const hasCustomerCandidates = lines.some(line => isFilled(resolveCustomerCandidate(line)));

            const mq = data.mqAccounting || {};
            const mqCostTypeLabel = mq.costType === 'V' ? '変動費 (V)' : mq.costType === 'F' ? '固定費 (F)' : '';
            const mqExpectedSales = mq.expectedSalesPQ;
            const mqExpectedMargin = mq.expectedMarginMQ;
            let mqRate: string | '' = '';
            if (mqExpectedSales && Number.isFinite(Number(mqExpectedSales)) && Number(mqExpectedSales) !== 0 &&
                mqExpectedMargin && Number.isFinite(Number(mqExpectedMargin))) {
                const rate = (Number(mqExpectedMargin) / Number(mqExpectedSales)) * 100;
                mqRate = `${rate.toFixed(1)}%`;
            }

            pushListSection('請求情報', [
                { label: 'サプライヤー / 支払先', value: invoice.supplierName ?? data.supplierName },
                { label: '顧客候補', value: uniqueCustomerCandidates.join(' / ') },
                { label: '請求書発行日', value: formatDateValue(invoice.invoiceDate) },
                { label: '支払期限', value: formatDateValue(invoice.dueDate) },
                { label: '登録番号', value: invoice.registrationNumber },
                { label: '部署ID', value: data.departmentId },
                { label: '備考', value: data.notes },
            ]);

            pushListSection('MQ会計情報', [
                { label: '経費の種類 (V/F)', value: mqCostTypeLabel },
                { label: '支出の目的・期待効果', value: mq.purpose },
                { label: '期待売上 (PQ)', value: mqExpectedSales },
                { label: '期待限界利益 (MQ)', value: mqExpectedMargin },
                { label: 'm率 (MQ ÷ PQ)', value: mqRate },
            ]);

            const bankAccount = invoice.bankAccount || {};
            pushListSection('振込先口座', [
                { label: '金融機関', value: bankAccount.bankName },
                { label: '支店名', value: bankAccount.branchName },
                { label: '口座種別', value: bankAccount.accountType },
                { label: '口座番号', value: bankAccount.accountNumber },
            ]);

            if (lines.length) {
                const columns = ['日付', '内容'];
                if (hasCustomerCandidates) columns.push('顧客候補');
                columns.push('数量', '単価', '金額(税抜)', '税率');
                const rows = lines.map((line: any, idx: number) => {
                    const cells: React.ReactNode[] = [
                        line.lineDate || `#${idx + 1}`,
                        line.description || '-',
                    ];
                    if (hasCustomerCandidates) {
                        cells.push(resolveCustomerCandidate(line) || '-');
                    }
                    cells.push(
                        line.quantity ?? '-',
                        formatCurrency(line.unitPrice) || '-',
                        formatCurrency(line.amountExclTax) || '-',
                        isFilled(line.taxRate) ? `${line.taxRate}%` : '-',
                    );
                    return cells;
                });
                pushTableSection(
                    '経費明細',
                    columns,
                    rows
                );
            }
            break;
        }
        case 'TRP': {
            const details = Array.isArray(data.details) ? data.details : [];
            const total = data.totalAmount ?? details.reduce((sum: number, detail: any) => sum + (Number(detail.amount) || 0), 0);
            pushHighlight('申請金額', total, { format: 'currency' });
            if (details.length) {
                const first = details[0];
                const route = `${first?.departure || '未入力'} → ${first?.arrival || '未入力'}`;
                pushHighlight('代表経路', route);
            }
            pushListSection('備考', [{ label: 'メモ', value: data.notes }]);
            if (details.length) {
                pushTableSection(
                    '交通経路明細',
                    ['日付', '出発', '到着', '手段', '金額'],
                    details.map((detail: any, idx: number) => [
                        detail.travelDate || `#${idx + 1}`,
                        detail.departure || '-',
                        detail.arrival || '-',
                        detail.transportMode || '-',
                        formatCurrency(detail.amount) || '-',
                    ])
                );
            }
            break;
        }
        case 'LEV': {
            pushHighlight('休暇種別', data.leaveType);
            const start = formatDateValue(data.startDate);
            const end = formatDateValue(data.endDate);
            if (start || end) {
                pushHighlight('取得期間', `${start || '未入力'} 〜 ${end || '未入力'}`);
            }
            const days = data.totalDays ?? calculateDayDiff(data.startDate, data.endDate);
            if (isFilled(days)) {
                pushHighlight('取得日数', `${days}日`);
            }
            pushListSection('休暇内容', [
                { label: '理由', value: data.reason },
                { label: '備考', value: data.notes },
            ]);
            break;
        }
        case 'APL': {
            pushHighlight('件名', data.title);
            pushHighlight('申請金額', data.amount, { format: 'currency' });
            pushListSection('申請概要', [{ label: '内容', value: data.details }]);
            break;
        }
        case 'DLY': {
            pushHighlight('報告日', formatDateValue(data.reportDate) || data.reportDate);
            pushHighlight('訪問先 / 顧客', data.customerName);
            if (data.startTime || data.endTime) {
                pushHighlight('稼働時間', `${data.startTime || '--'} 〜 ${data.endTime || '--'}`);
            }
            pushListSection('活動概要', [
                { label: '活動内容', value: data.activityContent },
                { label: '翌日の予定', value: data.nextDayPlan },
            ]);
            break;
        }
        case 'WKR': {
            pushHighlight('件名', data.title);
            pushListSection('週報内容', [{ label: '詳細', value: data.details }]);
            break;
        }
        default:
            break;
    }

    const fallbackAmount = data.invoice?.totalGross ?? data.invoice?.totalNet ?? data.totalAmount ?? data.amount;
    const fallbackPayee = data.invoice?.supplierName ?? data.supplierName ?? data.customerName ?? data.payee;

    const hasAmountHighlight = summary.highlights.some(item => item.label.includes('金額'));
    if (!hasAmountHighlight) {
        pushHighlight('申請金額', fallbackAmount, { format: 'currency' });
    }

    const hasPayeeHighlight = summary.highlights.some(item => item.label.includes('先') || item.label.includes('相手'));
    if (!hasPayeeHighlight) {
        pushHighlight('相手先 / 取引先', fallbackPayee);
    }

    return summary;
};

interface ApplicationDetailModalProps {
    application: ApplicationWithDetails | null;
    currentUser: User | null;
    onApprove: (app: ApplicationWithDetails) => Promise<void>;
    onReject: (app: ApplicationWithDetails, reason: string) => Promise<void>;
    onCancel?: (app: ApplicationWithDetails, options?: { skipConfirm?: boolean }) => Promise<void>;
    onClose: () => void;
    onUpdateApplication?: (app: ApplicationWithDetails) => void;
}

const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
    application,
    currentUser,
    onApprove,
    onReject,
    onCancel,
    onClose,
    onUpdateApplication
}) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedApplicantId, setSelectedApplicantId] = useState('');
    const [isUpdatingApplicant, setIsUpdatingApplicant] = useState(false);
    const mounted = useRef(true);
    const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();

    useEffect(() => {
        mounted.current = true;
        let isSubscribed = true;
        getUsers().then(data => {
            if (isSubscribed) setAllUsers(data as User[]);
        }).catch(console.error);
        return () => {
            isSubscribed = false;
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (application) {
            setRejectionReason('');
            setSelectedApplicantId(application.applicantId);
        }
    }, [application]);

    const executeApprove = async () => {
        if (!application) return;
        setIsProcessing(true);
        try {
            await onApprove(application);
        } finally {
            if (mounted.current) {
                setIsProcessing(false);
            }
        }
    };

    const executeReject = async (reason: string) => {
        if (!application) return;
        setIsProcessing(true);
        try {
            await onReject(application, reason);
        } finally {
            if (mounted.current) {
                setIsProcessing(false);
            }
        }
    };

    const handleApprove = () => {
        if (!application) return;
        requestConfirmation({
            label: '承認',
            title: '申請を承認しますか？',
            description: '承認すると申請者へ通知されます。',
            confirmLabel: '承認する',
            onConfirm: executeApprove,
        });
    };

    const handleReject = () => {
        if (!application) return;
        const trimmedReason = rejectionReason.trim();
        if (!trimmedReason) {
            alert('差し戻し理由を入力してください。');
            return;
        }
        requestConfirmation({
            label: '差し戻し送信',
            title: '申請を差し戻しますか？',
            description: `差し戻し理由: ${trimmedReason}`,
            confirmLabel: '差し戻す',
            onConfirm: () => executeReject(trimmedReason),
        });
    };

    if (!application) {
        return null;
    }

    const resubmittedFromId: string | undefined = application.formData?.meta?.resubmittedFromId;
    const isCurrentUserApprover = currentUser?.id === application.approverId && application.status === 'pending_approval';
    const canApplicantCancel = currentUser?.id === application.applicantId && application.status === 'pending_approval';
    const isCancelled = application.status === 'cancelled';

    const handleCancelRequest = () => {
        if (!application || !onCancel) return;
        requestConfirmation({
            label: '申請を取り消す',
            title: '申請を取り消しますか？',
            description: '承認ルートから取り下げられ、再申請する場合は新たに申請してください。',
            confirmLabel: '取り消す',
            onConfirm: () => onCancel(application, { skipConfirm: true }),
        });
    };

    const { formData, applicationCode, approvalRoute } = application;
    const code = applicationCode?.code;
    const amount = formData.amount ? `¥${Number(formData.amount).toLocaleString()}` : (formData.totalAmount ? `¥${Number(formData.totalAmount).toLocaleString()}` : null);
    const formSummary = React.useMemo(() => buildFormSummary(code, formData), [code, formData]);
    const hasSummarySections =
        formSummary.highlights.length > 0 || formSummary.listSections.length > 0 || formSummary.tableSections.length > 0;
    const documentUrl: string | null = application.documentUrl || formData.documentUrl || formData.receiptUrl || null;
    const documentName = formData.documentName || formData.receiptName || formData.invoice?.sourceFile?.name || '添付ファイル';
    const documentMimeType = formData.documentMimeType || formData.invoice?.sourceFile?.type || '';
    const isImageAttachment =
        !!documentUrl &&
        ((typeof documentMimeType === 'string' && documentMimeType.startsWith('image/')) || /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(documentUrl));
    const hasAttachments = Boolean(documentUrl);
    const showRejectionReason = application.status === 'rejected' && application.rejectionReason;

    const usersById = new Map(allUsers.map(u => [u.id, u.name]));
    const routeSteps = approvalRoute?.routeData.steps || [];

    const renderValue = (value: any) => {
        if (React.isValidElement(value)) return value;
        if (Array.isArray(value)) {
            return (
                <div className="space-y-2">
                    {value.map((item, index) => (
                        <div key={index} className="text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                            {renderObjectAsHTML(item)}
                        </div>
                    ))}
                </div>
            );
        }
        if (typeof value === 'object' && value !== null) {
            return (
                <div className="text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                    {renderObjectAsHTML(value)}
                </div>
            );
        }
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        
        // Handle markdown files and text content
        if (typeof value === 'string') {
            // Check if it's markdown content
            if (value.includes('#') || value.includes('**') || value.includes('*')) {
                return (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg whitespace-pre-wrap font-mono">{value}</div>
                    </div>
                );
            }
            // Check if it's a file path to .md file
            if (value.endsWith('.md') && value.length < 200) {
                return (
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-mono text-blue-600 dark:text-blue-400">{value}</span>
                    </div>
                );
            }
        }
        
        return value;
    };

    const renderObjectAsHTML = (obj: any) => {
        if (obj === null || obj === undefined) return '-';
        
        if (Array.isArray(obj)) {
            return (
                <div className="ml-4">
                    <span className="font-semibold text-blue-600">Array[{obj.length}]</span>
                    {obj.map((item, index) => (
                        <div key={index} className="ml-4 mt-1">
                            [{index}]: {renderObjectAsHTML(item)}
                        </div>
                    ))}
                </div>
            );
        }
        
        if (typeof obj === 'object') {
            return (
                <div className="space-y-1">
                    {Object.entries(obj).map(([key, val]) => (
                        <div key={key} className="flex">
                            <span className="font-semibold text-blue-600 min-w-[100px]">{key}:</span>
                            <span className="ml-2">{renderObjectAsHTML(val)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        
        return <span className="text-green-600">{String(obj)}</span>;
    };

    const applicationMetaRows = [
        { label: '申請ID', value: application.id },
        { label: '申請者ID', value: application.applicantId },
        { label: '申請種別ID', value: application.applicationCodeId },
        { label: '申請種別名', value: applicationCode?.name || '-' },
        { label: '申請者名', value: application.applicant?.name || '不明なユーザー' },
        { label: 'ステータス', value: <ApplicationStatusBadge status={application.status} /> },
        { label: '承認ルートID', value: application.approvalRouteId || '-' },
        { label: '承認ルート名', value: approvalRoute?.name || '-' },
        { label: '承認者ID', value: application.approverId || '-' },
        { label: '承認レベル', value: application.currentLevel ?? '-' },
        { label: '申請日時', value: application.submittedAt ? new Date(application.submittedAt).toLocaleString('ja-JP') : '-' },
        { label: '承認日時', value: application.approvedAt ? new Date(application.approvedAt).toLocaleString('ja-JP') : '-' },
        { label: '差戻し日時', value: application.rejectedAt ? new Date(application.rejectedAt).toLocaleString('ja-JP') : '-' },
        { label: '差戻し理由', value: application.rejectionReason || '-' },
        { label: '作成日時', value: new Date(application.createdAt).toLocaleString('ja-JP') },
        { label: '更新日時', value: application.updatedAt ? new Date(application.updatedAt).toLocaleString('ja-JP') : '-' },
        ...(resubmittedFromId ? [{ label: '再申請元ID', value: resubmittedFromId }] : []),
        { label: 'formData', value: formData },
    ];

    const relatedRows = [
        { label: '申請者詳細', value: application.applicant || '登録なし' },
        { label: '申請種別詳細', value: application.applicationCode || '登録なし' },
        { label: '承認ルート詳細', value: application.approvalRoute || '登録なし' },
        { label: '承認ルート構成', value: approvalRoute?.routeData || '未設定' },
    ];

    const shouldSkipFormField = (key: string) => key === 'mqAccounting' || key === 'meta' || key.startsWith('_');

    const formDataRows = [
        ...(amount ? [{ label: '合計金額', value: amount }] : []),
        ...Object.entries(formData || {})
            .filter(([key]) => !shouldSkipFormField(key))
            .map(([key, value]) => ({ label: key, value })),
    ];

    const routeStepRows = routeSteps.map((step, index) => {
        const level = index + 1;
        const approverName = usersById.get(step.approverId) || step.approverId || '未設定';
        const isRejectedLike = application.status === 'rejected' || application.status === 'cancelled';
        const isCompleted =
            application.status === 'approved' ||
            (!isRejectedLike && typeof application.currentLevel === 'number' && level < application.currentLevel);
        const isCurrent = level === application.currentLevel && application.status === 'pending_approval';
        const isRejectedHere = isRejectedLike && level === application.currentLevel;
        let statusLabel = '未承認';
        if (isRejectedHere) statusLabel = isCancelled ? '取下げ' : '差戻し';
        else if (isCurrent) statusLabel = '現在の承認者';
        else if (isCompleted) statusLabel = '承認済';
        return {
            level,
            approverName,
            approverId: step.approverId || '-',
            status: statusLabel,
        };
    });

    return (
        <>
            <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 md:p-8 font-sans">
                <div className="flex h-full w-full flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-6 py-5 md:px-8 md:py-6">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">MQ会計ドリブン</p>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">申請詳細</h2>
                            {resubmittedFromId && (
                                <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-900/30 dark:text-indigo-200">
                                    再申請
                                    <span className="font-mono text-[11px] text-indigo-500 dark:text-indigo-300">
                                        元ID: {resubmittedFromId}
                                    </span>
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden px-4 py-4 md:px-8 md:py-6">
                        <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                            <div className="min-h-0 overflow-y-auto space-y-6 pr-1">
                                {hasSummarySections && (
                                    <section className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-6 shadow-inner">
                                        {formSummary.highlights.length > 0 && (
                                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                                {formSummary.highlights.map((item, index) => (
                                                    <div key={`summary-highlight-${index}`} className="rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 p-4">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                                                        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white break-words">{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formSummary.listSections.map((section, sectionIndex) => (
                                            <div key={`summary-list-${sectionIndex}`} className="rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/60 p-4">
                                                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{section.title}</h3>
                                                <dl className="mt-4 space-y-2">
                                                    {section.items.map((item, itemIndex) => (
                                                        <div key={`summary-list-item-${sectionIndex}-${itemIndex}`} className="flex items-start justify-between gap-4 text-sm">
                                                            <dt className="text-slate-500 dark:text-slate-400">{item.label}</dt>
                                                            <dd className="text-right font-semibold text-slate-900 dark:text-white break-words max-w-[60%]">{typeof item.value === 'string' ? item.value : item.value}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </div>
                                        ))}
                                        {formSummary.tableSections.map((section, sectionIndex) => (
                                            <div key={`summary-table-${sectionIndex}`} className="rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/60 overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{section.title}</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                                        <thead className="bg-slate-50 dark:bg-slate-900/30">
                                                            <tr>
                                                                {section.columns.map(column => (
                                                                    <th key={`${section.title}-${column}`} className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{column}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                            {section.rows.map((row, rowIndex) => (
                                                                <tr key={`summary-table-row-${rowIndex}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                                    {row.map((cell, cellIndex) => (
                                                                        <td key={`summary-table-cell-${rowIndex}-${cellIndex}`} className="px-4 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">{cell ?? '-'}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                )}

                                
                                {hasAttachments && documentUrl && (
                                    <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-6 space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">添付ファイル</h3>
                                        {isImageAttachment ? (
                                            <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                                                <img
                                                    src={documentUrl}
                                                    alt={documentName}
                                                    className="max-h-[280px] w-auto rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
                                                />
                                            </a>
                                        ) : (
                                            <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                                                <div className="flex items-center gap-3">
                                                    <div className="rounded-full bg-slate-200/60 dark:bg-slate-700/60 p-3">
                                                        <FileText className="w-6 h-6 text-slate-600 dark:text-slate-200" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white break-all">{documentName}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{documentMimeType || '添付ファイル'}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <a
                                                        href={documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400"
                                                    >
                                                        ファイルを開く
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>

                            <div className="min-h-0 overflow-y-auto space-y-6 pl-1">
                                
                                {showRejectionReason && (
                                    <section className="rounded-3xl border border-red-200 dark:border-red-500/50 bg-red-50 dark:bg-red-900/30 p-6">
                                        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-3">差し戻し理由</h3>
                                        <p className="text-sm leading-relaxed text-red-800 dark:text-red-100 whitespace-pre-wrap">{application.rejectionReason}</p>
                                    </section>
                                )}
                                {isCancelled && (
                                    <section className="rounded-3xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-6">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">申請を取り消しました</h3>
                                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                            {application.rejectionReason || '申請者によって承認ルートから取り消されました。'}
                                        </p>
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>

                    {isCurrentUserApprover ? (
                        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 px-4 py-4 md:px-8 md:py-5 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                                <div className="md:col-span-1">
                                    <label htmlFor="rejection_reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        コメント・差し戻し理由
                                    </label>
                                    <textarea
                                        id="rejection_reason"
                                        rows={2}
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="承認コメント、または差し戻し理由を入力"
                                        className="mt-1 block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        disabled={isProcessing}
                                    />
                                </div>
                                <div className="flex justify-end gap-3 md:col-span-2 md:justify-end">
                                    <button
                                        type="button"
                                        onClick={handleReject}
                                        disabled={isProcessing || !rejectionReason.trim()}
                                        className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                                    >
                                        {isProcessing ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        <span>差し戻し送信</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApprove}
                                        disabled={isProcessing}
                                        className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:bg-slate-400"
                                    >
                                        {isProcessing ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                        <span>承認</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : canApplicantCancel ? (
                        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 px-4 py-4 md:px-8 md:py-5 flex flex-col gap-3">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                                入力ミスや差し戻し前に取り消したい場合は、下記ボタンから承認ルートへ通知せずに撤回できます。
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleCancelRequest}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                                >
                                    <X className="w-4 h-4" />
                                    <span>申請を取り消す</span>
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            {ConfirmationDialog}
        </>
    );
};

export default ApplicationDetailModal;
