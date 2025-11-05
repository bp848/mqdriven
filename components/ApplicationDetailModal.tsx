import React, { useState, useEffect, useRef } from 'react';
import { ApplicationWithDetails, User } from '../types';
import { X, CheckCircle, Send, Loader } from './Icons';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import { getUsers } from '../services/dataService';

interface ApplicationDetailModalProps {
    application: ApplicationWithDetails | null;
    currentUser: User | null;
    onApprove: (app: ApplicationWithDetails) => Promise<void>;
    onReject: (app: ApplicationWithDetails, reason: string) => Promise<void>;
    onClose: () => void;
}

const DetailItem: React.FC<{ label: string; children: React.ReactNode, className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="mt-1 text-base text-slate-900 dark:text-white whitespace-pre-wrap break-words">{children || '-'}</dd>
    </div>
);

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

    const handleApprove = async () => {
        if (!application) return;
        setIsProcessing(true);
        await onApprove(application);
        if (mounted.current) {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!application) {
            return;
        }
        setIsProcessing(true);
        await onReject(application, rejectionReason || '（理由なし）');
        if (mounted.current) {
            setIsProcessing(false);
        }
    };

    if (!application) {
        return null;
    }

    const isCurrentUserApprover = currentUser?.id === application.approverId && application.status === 'pending_approval';

    const { formData, applicationCode, approvalRoute } = application;
    const code = applicationCode?.code;
    const amount = formData.amount ? `¥${Number(formData.amount).toLocaleString()}` : (formData.totalAmount ? `¥${Number(formData.totalAmount).toLocaleString()}`: null);

    const usersById = new Map(allUsers.map(u => [u.id, u.name]));
    const approvers = approvalRoute?.routeData.steps || [];

    const renderDailyReportDetails = (data: any) => {
        if (typeof data.details === 'string') {
            return (
                <>
                    <DetailItem label="件名">{data.title}</DetailItem>
                    <DetailItem label="詳細" className="md:col-span-2">{data.details}</DetailItem>
                </>
            );
        }
        
        if (data.activityContent !== undefined) {
             return (
                <>
                    <DetailItem label="報告日">{data.reportDate}</DetailItem>
                    <DetailItem label="業務時間">{`${data.startTime || ''} - ${data.endTime || ''}`}</DetailItem>
                    <DetailItem label="訪問先">{data.customerName}</DetailItem>
                    <DetailItem label="活動内容" className="md:col-span-2">{data.activityContent}</DetailItem>
                    <DetailItem label="翌日予定" className="md:col-span-2">{data.nextDayPlan}</DetailItem>
                </>
            );
        }
        
        return <DetailItem label="内容" className="md:col-span-2"><pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded-md">{JSON.stringify(data, null, 2)}</pre></DetailItem>;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 font-sans">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">申請詳細</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <DetailItem label="申請種別">{applicationCode?.name}</DetailItem>
                        <DetailItem label="申請者">{application.applicant?.name || '不明なユーザー'}</DetailItem>
                        <DetailItem label="申請日時">{application.submittedAt ? new Date(application.submittedAt).toLocaleString('ja-JP') : '-'}</DetailItem>
                        <DetailItem label="ステータス"><ApplicationStatusBadge status={application.status} /></DetailItem>
                    </dl>
                    
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                         <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">申請内容</h3>
                         <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                            {amount && <DetailItem label="合計金額">{amount}</DetailItem>}
                            {code === 'EXP' && <>
                                <DetailItem label="内容" className="md:col-span-2">
                                    <div className="space-y-1">
                                    {Array.isArray(formData.details) && formData.details.map((d: any, i: number) => 
                                        <div key={i} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">{d.paymentDate}: {d.description} ({d.costType}) - ¥{d.amount?.toLocaleString()}</div>
                                    )}
                                    </div>
                                </DetailItem>
                                <DetailItem label="備考">{formData.notes}</DetailItem>
                            </>}
                            {code === 'TRP' && <>
                                <DetailItem label="内容" className="md:col-span-2">
                                    <div className="space-y-1">
                                    {Array.isArray(formData.details) && formData.details.map((d: any, i: number) => 
                                        <div key={i} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                            {d.travelDate}: {d.departure} → {d.arrival} ({d.transportMode}) - ¥{d.amount?.toLocaleString()}
                                        </div>
                                    )}
                                    </div>
                                </DetailItem>
                                <DetailItem label="備考">{formData.notes}</DetailItem>
                            </>}
                            {(code === 'APL' || code === 'NOC' || code === 'WKR') && <>
                                <DetailItem label="件名">{formData.title}</DetailItem>
                                <DetailItem label="詳細" className="md:col-span-2">{formData.details}</DetailItem>
                            </>}
                             {(code === 'DLY' || code === 'DRP') && renderDailyReportDetails(formData)}
                            {code === 'LEV' && <>
                                <DetailItem label="開始日">{formData.startDate}</DetailItem>
                                <DetailItem label="終了日">{formData.endDate}</DetailItem>
                                <DetailItem label="理由" className="md:col-span-2">{formData.reason}</DetailItem>
                            </>}
                         </dl>
                    </div>

                    {formData.receiptUrl && (
                         <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">添付ファイル</h3>
                            <a href={formData.receiptUrl} target="_blank" rel="noopener noreferrer">
                                <img src={formData.receiptUrl} alt="添付ファイル" className="max-w-xs rounded-lg border border-slate-200 dark:border-slate-600" />
                            </a>
                        </div>
                    )}
                    
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">承認ルート: {approvalRoute?.name}</h3>
                        <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2">
                            {approvers.map((step, index) => {
                                const level = index + 1;
                                const isCompleted = application.status === 'approved' || (application.status !== 'rejected' && level < application.currentLevel);
                                const isCurrent = level === application.currentLevel && application.status === 'pending_approval';
                                const isRejectedHere = application.status === 'rejected' && level === application.currentLevel;
                                
                                let statusColor = 'bg-slate-300 dark:bg-slate-600';
                                if (isCompleted) statusColor = 'bg-green-500';
                                if (isCurrent) statusColor = 'bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-900';
                                if (isRejectedHere) statusColor = 'bg-red-500';

                                return (
                                    <li key={level} className="mb-6 ml-6">
                                        <span className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ${statusColor}`}>
                                            {isCompleted && <CheckCircle className="w-4 h-4 text-white"/>}
                                        </span>
                                        <h4 className="font-semibold text-slate-900 dark:text-white">{usersById.get(step.approverId) || '不明なユーザー'}</h4>
                                        <p className="text-sm text-slate-500">ステップ {level}</p>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>

                    {application.status === 'rejected' && application.rejectionReason && (
                         <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">差し戻し理由</h3>
                            <p className="p-3 bg-red-50 dark:bg-red-900/30 rounded-md text-red-800 dark:text-red-200">{application.rejectionReason}</p>
                        </div>
                    )}
                </div>
                
                {isCurrentUserApprover && (
                    <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                         <div>
                            <label htmlFor="rejection_reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                コメント・差し戻し理由（任意）
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
                                onClick={handleReject}
                                disabled={isProcessing}
                                className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-400"
                            >
                                {isProcessing ? <Loader className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                                <span>差し戻し</span>
                            </button>
                            <button
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
    );
};

export default ApplicationDetailModal;