import React, { useState, useEffect, useRef } from 'react';
import { ApplicationWithDetails, User } from '../types';
import { X, CheckCircle, Send, Loader } from './Icons';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import { getUsers } from '../services/dataService';
import { useSubmitWithConfirmation } from '../hooks/useSubmitWithConfirmation';

interface ApplicationDetailModalProps {
    application: ApplicationWithDetails | null;
    currentUser: User | null;
    onApprove: (app: ApplicationWithDetails) => Promise<void>;
    onReject: (app: ApplicationWithDetails, reason: string) => Promise<void>;
    onClose: () => void;
}

const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
    application,
    currentUser,
    onApprove,
    onReject,
    onClose
}) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
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

    const isCurrentUserApprover = currentUser?.id === application.approverId && application.status === 'pending_approval';

    const { formData, applicationCode, approvalRoute } = application;
    const code = applicationCode?.code;
    const amount = formData.amount ? `¥${Number(formData.amount).toLocaleString()}` : (formData.totalAmount ? `¥${Number(formData.totalAmount).toLocaleString()}` : null);

    const usersById = new Map(allUsers.map(u => [u.id, u.name]));
    const routeSteps = approvalRoute?.routeData.steps || [];

    const renderValue = (value: any) => {
        if (React.isValidElement(value)) return value;
        if (Array.isArray(value)) {
            return (
                <div className="space-y-2">
                    {value.map((item, index) => (
                        <pre key={index} className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded-lg whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                    ))}
                </div>
            );
        }
        if (typeof value === 'object' && value !== null) {
            return (
                <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded-lg whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
            );
        }
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        return value;
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
        { label: 'formData', value: formData },
    ];

    const relatedRows = [
        { label: '申請者詳細', value: application.applicant || '登録なし' },
        { label: '申請種別詳細', value: application.applicationCode || '登録なし' },
        { label: '承認ルート詳細', value: application.approvalRoute || '登録なし' },
        { label: '承認ルート構成', value: approvalRoute?.routeData || '未設定' },
    ];

    const formDataRows = [
        ...(amount ? [{ label: '合計金額', value: amount }] : []),
        ...Object.entries(formData || {}).map(([key, value]) => ({ label: key, value })),
    ];

    const routeStepRows = routeSteps.map((step, index) => {
        const level = index + 1;
        const approverName = usersById.get(step.approverId) || step.approverId || '未設定';
        const isCompleted =
            application.status === 'approved' || (application.status !== 'rejected' && level < application.currentLevel);
        const isCurrent = level === application.currentLevel && application.status === 'pending_approval';
        const isRejectedHere = application.status === 'rejected' && level === application.currentLevel;
        let statusLabel = '未承認';
        if (isRejectedHere) statusLabel = '差戻し';
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">申請詳細</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <section className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">申請メタ情報</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">項目</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">内容</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {applicationMetaRows.map((row, index) => (
                                        <tr key={`meta-${index}`} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <td className="px-4 py-3 font-medium text-sm text-slate-700 dark:text-slate-200">{row.label}</td>
                                            <td className="px-4 py-3 text-sm">{renderValue(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">関連情報</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">項目</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">内容</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {relatedRows.map((row, index) => (
                                        <tr key={`related-${index}`} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <td className="px-4 py-3 font-medium text-sm text-slate-700 dark:text-slate-200">{row.label}</td>
                                            <td className="px-4 py-3 text-sm">{renderValue(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">フォーム詳細 (formData)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">項目</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">値</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {formDataRows.map((row, index) => (
                                        <tr key={`form-${index}`} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <td className="px-4 py-3 font-medium text-sm text-slate-700 dark:text-slate-200">{row.label}</td>
                                            <td className="px-4 py-3 text-sm">{renderValue(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {formData.receiptUrl && (
                         <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">添付ファイル</h3>
                            <a href={formData.receiptUrl} target="_blank" rel="noopener noreferrer">
                                <img src={formData.receiptUrl} alt="添付ファイル" className="max-w-xs rounded-lg border border-slate-200 dark:border-slate-600" />
                            </a>
                        </div>
                    )}
                    
                    <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">承認ステップ</h3>
                        {routeStepRows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ステップ</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">承認者</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">承認者ID</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ステータス</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {routeStepRows.map((row) => (
                                            <tr key={`step-${row.level}`} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <td className="px-4 py-3 font-medium text-sm text-slate-700 dark:text-slate-200">{row.level}</td>
                                                <td className="px-4 py-3 text-sm">{row.approverName}</td>
                                                <td className="px-4 py-3 text-sm">{row.approverId}</td>
                                                <td className="px-4 py-3 text-sm">{row.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">承認ルートのステップ情報がありません。</p>
                        )}
                    </section>

                    {application.status === 'rejected' && application.rejectionReason && (
                         <section className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">差し戻し理由</h3>
                            <p className="p-3 bg-red-50 dark:bg-red-900/30 rounded-md text-red-800 dark:text-red-200">{application.rejectionReason}</p>
                        </section>
                    )}
                </div>
                
                {isCurrentUserApprover && (
                    <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                         <div>
                            <label htmlFor="rejection_reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                コメント・差し戻し理由
                            </label>
                            <textarea
                                id="rejection_reason"
                                rows={2}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="承認時のコメント、または差し戻し理由を入力"
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 sm:text-sm"
                                disabled={isProcessing}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={isProcessing || !rejectionReason.trim()}
                                className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-400"
                            >
                                {isProcessing ? <Loader className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                                <span>差し戻し送信</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-slate-400"
                            >
                                {isProcessing ? <Loader className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5" />}
                                <span>承認</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        {ConfirmationDialog}
        </>
    );
};

export default ApplicationDetailModal;
