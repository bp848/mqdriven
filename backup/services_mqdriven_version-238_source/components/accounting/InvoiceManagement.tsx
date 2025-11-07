import React, { useState, useMemo } from 'react';
import { Job, InvoiceStatus, JobStatus } from '../../types';
import { CheckCircle, FileText } from '../Icons';

interface InvoiceManagementProps {
    jobs: Job[];
    onUpdateJobInvoiceStatus: (jobId: string, status: InvoiceStatus) => void;
    isDemoMode: boolean;
}

type Tab = 'issuance' | 'tracking' | 'paid';

const TABS: { id: Tab; label: string }[] = [
    { id: 'issuance', label: '請求書発行' },
    { id: 'tracking', label: '入金管理' },
    { id: 'paid', label: '入金済み一覧' },
];

const InvoiceManagement: React.FC<InvoiceManagementProps> = ({ jobs, onUpdateJobInvoiceStatus, isDemoMode }) => {
    const [activeTab, setActiveTab] = useState<Tab>('issuance');

    const filteredJobs = useMemo(() => {
        switch (activeTab) {
            case 'issuance':
                return jobs.filter(j => j.status === JobStatus.Completed && j.invoiceStatus === InvoiceStatus.Uninvoiced);
            case 'tracking':
                return jobs.filter(j => j.invoiceStatus === InvoiceStatus.Invoiced);
            case 'paid':
                return jobs.filter(j => j.invoiceStatus === InvoiceStatus.Paid);
            default:
                return [];
        }
    }, [jobs, activeTab]);

    const renderTable = () => {
        if (filteredJobs.length === 0) {
            return (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                    <p className="font-semibold">対象の案件はありません。</p>
                    <p className="mt-1 text-base">
                        {activeTab === 'issuance' && "ステータスが「完了」の案件がここに表示されます。"}
                        {activeTab === 'tracking' && "請求書が発行されると、案件がここに表示されます。"}
                    </p>
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th scope="col" className="px-6 py-3">案件ID / クライアント</th>
                            <th scope="col" className="px-6 py-3">案件名</th>
                            <th scope="col" className="px-6 py-3 text-right">金額</th>
                            <th scope="col" className="px-6 py-3">{activeTab === 'tracking' ? '請求日' : (activeTab === 'paid' ? '入金日' : '完了日')}</th>
                            <th scope="col" className="px-6 py-3 text-center">アクション</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredJobs.map(job => (
                            <tr key={job.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4">
                                    <div className="font-mono text-xs text-slate-500">{job.id}</div>
                                    <div className="font-medium text-slate-900 dark:text-white">{job.clientName}</div>
                                </td>
                                <td className="px-6 py-4">{job.title}</td>
                                <td className="px-6 py-4 text-right">¥{job.price.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {activeTab === 'tracking' && job.invoicedAt ? new Date(job.invoicedAt).toLocaleDateString() : ''}
                                    {activeTab === 'paid' && job.paidAt ? new Date(job.paidAt).toLocaleDateString() : ''}
                                    {activeTab === 'issuance' ? job.dueDate : ''}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {activeTab === 'issuance' && (
                                        <button
                                            onClick={() => onUpdateJobInvoiceStatus(job.id, InvoiceStatus.Invoiced)}
                                            disabled={isDemoMode}
                                            className="flex w-full items-center justify-center gap-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-semibold py-1.5 px-3 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <FileText className="w-4 h-4" />
                                            請求書発行
                                        </button>
                                    )}
                                    {activeTab === 'tracking' && (
                                        <button
                                            onClick={() => onUpdateJobInvoiceStatus(job.id, InvoiceStatus.Paid)}
                                            disabled={isDemoMode}
                                            className="flex w-full items-center justify-center gap-1.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-semibold py-1.5 px-3 rounded-full hover:bg-green-200 dark:hover:bg-green-800 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            入金済みにする
                                        </button>
                                    )}
                                    {activeTab === 'paid' && (
                                        <span className="flex w-full items-center justify-center gap-1.5 text-green-600 dark:text-green-400 font-semibold text-base px-3">
                                            <CheckCircle className="w-4 h-4" />
                                            入金済み
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-base`}
                                aria-current={activeTab === tab.id ? 'page' : undefined}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
            <div className="p-6">
                {renderTable()}
            </div>
        </div>
    );
};

export default InvoiceManagement;