import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Job, Invoice, JobStatus, InvoiceStatus } from '../../types';
import { FileText, Loader, X } from '../Icons';
import { updateJobReadyToInvoice, createInvoiceFromJobs, getInvoices } from '../../services/dataService';

interface BillingManagementProps {
    jobs: Job[];
    onRefreshData: () => void;
    onMarkPaid: (invoice: Invoice) => void;
}

type Tab = 'candidates' | 'issued';

const JPY = (n: number | undefined) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Math.round(n || 0));

const FlagToggle: React.FC<{
    jobId: string;
    initialValue: boolean;
    onChanged: (jobId: string, value: boolean) => Promise<void>;
    disabled?: boolean;
}> = ({ jobId, initialValue, onChanged, disabled }) => {
    const [value, setValue] = useState(initialValue);
    const [isUpdating, setIsUpdating] = useState(false);
    useEffect(() => setValue(initialValue), [initialValue]);

    const handleClick = async () => {
        if (disabled || isUpdating) return;
        setIsUpdating(true);
        await onChanged(jobId, !value);
        setIsUpdating(false);
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isUpdating}
            className={`w-16 h-7 flex items-center rounded-full p-1 transition-colors duration-200 ${value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${value ? 'translate-x-9' : ''}`} />
        </button>
    );
};

const InvoiceDetailModal: React.FC<{ invoice: Invoice; onClose: () => void; onMarkPaid: (invoice: Invoice) => void; }> = ({ invoice, onClose, onMarkPaid }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">請求書詳細</h2>
                        <p className="text-sm text-slate-500">No: {invoice.invoiceNo}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-sm font-medium text-slate-500">顧客名</p>
                            <p className="font-semibold">{invoice.customerName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-500">発行日</p>
                            <p className="font-semibold">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <table className="w-full text-base text-left">
                        <thead className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-2">内容</th>
                                <th className="px-4 py-2 text-right">金額</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items?.map(item => (
                                <tr key={item.id} className="border-b dark:border-slate-700">
                                    <td className="px-4 py-3">{item.description}</td>
                                    <td className="px-4 py-3 text-right">{JPY(item.lineTotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 flex justify-end">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between"><span className="text-slate-500">小計</span><span>{JPY(invoice.subtotalAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">消費税</span><span>{JPY(invoice.taxAmount)}</span></div>
                            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span >合計</span><span>{JPY(invoice.totalAmount)}</span></div>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{invoice.status}</span>
                    <div>
                        {invoice.status !== 'paid' && (
                            <button
                                onClick={() => onMarkPaid(invoice)}
                                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700"
                            >
                                入金済みにする
                            </button>
                        )}
                        <button onClick={onClose} className="ml-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">閉じる</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const BillingManagement: React.FC<BillingManagementProps> = ({ jobs, onRefreshData, onMarkPaid }) => {
    const [activeTab, setActiveTab] = useState<Tab>('candidates');
    const [selectedJobs, setSelectedJobs] = useState<Record<string, boolean>>({});
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    const fetchInvoices = useCallback(async () => {
        setIsLoadingInvoices(true);
        try {
            const data = await getInvoices();
            setInvoices(data);
        } catch (error) {
            console.error(error);
            alert('請求書データの取得に失敗しました。');
        } finally {
            setIsLoadingInvoices(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'issued') {
            fetchInvoices();
        }
    }, [activeTab, fetchInvoices]);


    const candidateJobs = useMemo(() => {
        return jobs.filter(job => job.readyToInvoice === true && job.invoiceStatus === InvoiceStatus.Uninvoiced);
    }, [jobs]);

    const selectedJobIds = useMemo(() => Object.keys(selectedJobs).filter(id => selectedJobs[id]), [selectedJobs]);

    const handleToggleJobSelection = (jobId: string) => {
        setSelectedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
    };
    
    const handleReadyToInvoiceChanged = async (jobId: string, value: boolean) => {
        try {
            await updateJobReadyToInvoice(jobId, value);
            onRefreshData();
        } catch (error) {
            console.error(error);
            alert('状態の更新に失敗しました。');
        }
    };
    
    const handleCreateInvoice = async () => {
        if (selectedJobIds.length === 0) return;
        
        const selected = jobs.filter(j => selectedJobIds.includes(j.id));
        const customerName = selected[0]?.clientName;
        if (!selected.every(j => j.clientName === customerName)) {
            alert('同じクライアントの案件のみをまとめて請求できます。');
            return;
        }

        setIsProcessing(true);
        try {
            const result = await createInvoiceFromJobs(selectedJobIds);
            alert(`請求書 ${result.invoiceNo} が作成されました。`);
            setSelectedJobs({});
            onRefreshData();
        } catch (error) {
            console.error(error);
            alert(`請求書の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <div className="px-6 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('candidates')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-base transition-colors ${activeTab === 'candidates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>請求候補</button>
                    <button onClick={() => setActiveTab('issued')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-base transition-colors ${activeTab === 'issued' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>発行済み請求書</button>
                </nav>
            </div>

            {activeTab === 'candidates' && (
                <div>
                    <div className="p-4 flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                         <button
                            onClick={handleCreateInvoice}
                            disabled={selectedJobIds.length === 0 || isProcessing}
                            className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
                        >
                            {isProcessing ? <Loader className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                            選択した案件で請求書作成 ({selectedJobIds.length})
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                                <tr>
                                    <th scope="col" className="p-4"><input type="checkbox" onChange={e => {
                                        const newSelected: Record<string, boolean> = {};
                                        if (e.target.checked) candidateJobs.forEach(j => newSelected[j.id] = true);
                                        setSelectedJobs(newSelected);
                                    }}/></th>
                                    <th scope="col" className="px-6 py-3">クライアント / 案件名</th>
                                    <th scope="col" className="px-6 py-3 text-right">金額</th>
                                    <th scope="col" className="px-6 py-3">完了日</th>
                                    <th scope="col" className="px-6 py-3 text-center">請求準備OK</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidateJobs.map(job => (
                                    <tr key={job.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50/50">
                                        <td className="p-4"><input type="checkbox" checked={!!selectedJobs[job.id]} onChange={() => handleToggleJobSelection(job.id)} /></td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{job.clientName}</div>
                                            <div className="text-sm text-slate-500">{job.title}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">¥{job.price.toLocaleString()}</td>
                                        <td className="px-6 py-4">{job.dueDate}</td>
                                        <td className="px-6 py-4 text-center">
                                            <FlagToggle jobId={job.id} initialValue={!!job.readyToInvoice} onChanged={handleReadyToInvoiceChanged} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {candidateJobs.length === 0 && <div className="p-16 text-center">請求候補の案件はありません。</div>}
                    </div>
                </div>
            )}
            {activeTab === 'issued' && (
                 <div className="overflow-x-auto">
                    <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-6 py-3">請求書番号</th>
                                <th scope="col" className="px-6 py-3">顧客名</th>
                                <th scope="col" className="px-6 py-3">発行日</th>
                                <th scope="col" className="px-6 py-3 text-right">合計金額</th>
                                <th scope="col" className="px-6 py-3 text-center">ステータス</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingInvoices ? <tr><td colSpan={5} className="text-center p-16"><Loader className="w-8 h-8 animate-spin mx-auto" /></td></tr> :
                            invoices.map(inv => (
                                <tr key={inv.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                                    <td className="px-6 py-4 font-mono">{inv.invoiceNo}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inv.customerName}</td>
                                    <td className="px-6 py-4">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right font-semibold">{JPY(inv.totalAmount)}</td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                                            inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                                            inv.status === 'void' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                         }`}>{inv.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoadingInvoices && invoices.length === 0 && <div className="p-16 text-center">発行済みの請求書はありません。</div>}
                 </div>
            )}
            {selectedInvoice && <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onMarkPaid={onMarkPaid} />}
        </div>
    );
};

export default React.memo(BillingManagement);