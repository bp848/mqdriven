import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Estimate, SortConfig, EmployeeUser, Customer, Job, JobStatus, InvoiceStatus, Page, Toast, EstimateItem, EstimateStatus } from '../../types';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { FileText, PlusCircle, Loader, Sparkles, Trash2, Send, X, Save, Eye, Pencil } from '../Icons';
import { formatJPY, formatDate } from '../../utils';
import { draftEstimate } from '../../services/geminiService';
import EstimateDetailModal from './EstimateDetailModal';

declare const jspdf: any;
declare const html2canvas: any;

// Estimate Modal Component
interface EstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>) => Promise<void>;
    customers: Customer[];
    addToast: (message: string, type: Toast['type']) => void;
    estimateToEdit?: Estimate | null;
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
}

const EstimateModal: React.FC<EstimateModalProps> = ({ isOpen, onClose, onSave, customers, addToast, estimateToEdit, currentUser, isAIOff }) => {
    const [estimate, setEstimate] = useState<Partial<Estimate>>({});
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const initialData = estimateToEdit ? 
                { ...estimateToEdit, items: estimateToEdit.items || [] } : 
                {
                    items: [],
                    total: 0,
                    deliveryDate: new Date().toISOString().split('T')[0],
                    paymentTerms: '月末締め、翌月末払い',
                    title: '',
                    customerName: '',
                    deliveryMethod: '',
                    notes: '',
                    version: 1,
                    status: '見積中' as EstimateStatus,
                };
            setEstimate(initialData);
            
            const customer = customers.find(c => c.customerName === initialData.customerName);
            setSelectedCustomerId(customer?.id || '');
        }
    }, [isOpen, estimateToEdit, customers]);

    const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customer = customers.find(c => c.id === e.target.value) || null;
        setSelectedCustomerId(customer?.id || '');
        setEstimate(prev => ({ ...prev, customerName: customer?.customerName || '' }));
    };

    const handleAiDraft = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        if (!aiPrompt) return;
        setIsAiLoading(true);
        setError('');
        try {
            const draft = await draftEstimate(aiPrompt);
            setEstimate(prev => ({
                ...prev,
                title: draft.title,
                items: draft.items,
                notes: draft.notes,
                deliveryDate: draft.deliveryDate,
                paymentTerms: draft.paymentTerms,
                deliveryMethod: draft.deliveryMethod,
            }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'AIによる下書き作成に失敗しました。');
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleItemChange = (index: number, field: keyof EstimateItem, value: any) => {
        const newItems = [...(estimate.items || [])];
        const item = { ...newItems[index] };
        (item[field] as any) = value;

        if (field === 'quantity' || field === 'unitPrice') {
            item.price = (item.quantity || 0) * (item.unitPrice || 0);
        }
        if (field === 'price' || field === 'cost') {
            item.costRate = item.price > 0 ? (item.cost || 0) / item.price : 0;
        }
        item.subtotal = item.price;

        newItems[index] = item;
        setEstimate(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        const newItem: EstimateItem = { division: 'その他', content: '', quantity: 1, unit: '式', unitPrice: 0, price: 0, cost: 0, costRate: 0, subtotal: 0 };
        setEstimate(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };
    
    const removeItem = (index: number) => {
        setEstimate(prev => ({ ...prev, items: (prev.items || []).filter((_, i) => i !== index) }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEstimate(prev => ({ ...prev, [name]: value }));
    };

    const total = useMemo(() => estimate.items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0, [estimate.items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!estimate.customerName || !estimate.title || !estimate.items?.length) {
             setError('顧客名、件名、明細は必須です。');
             return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const saveData = { ...estimate, total: total, userId: currentUser.id };
            delete saveData.id;
            delete saveData.createdAt;
            delete saveData.updatedAt;
            delete saveData.estimateNumber;
            delete saveData.user;
            await onSave(saveData as Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>);
        } catch(e) {
            setError(e instanceof Error ? e.message : '保存に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!isOpen) return null;
    
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 text-base";
    const tableInputClass = "w-full bg-transparent p-2 focus:bg-slate-100 dark:focus:bg-slate-700 focus:outline-none rounded-md";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{estimateToEdit ? '見積編集' : '新規見積作成'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* AI Draft Section */}
                    <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-lg border border-blue-200 dark:border-slate-700">
                      <div className="flex gap-2">
                        <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="例：A4チラシ、コート90kg、両面カラー、1000枚" className={inputClass} />
                        <button onClick={handleAiDraft} disabled={isAiLoading || isAIOff} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {isAiLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} AIで下書き
                        </button>
                      </div>
                    </div>
                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select id="customer-select" onChange={handleCustomerChange} value={selectedCustomerId} className={inputClass}><option value="">顧客を選択...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}</select>
                        <input type="text" name="title" value={estimate.title || ''} onChange={handleInputChange} placeholder="件名 *" className={inputClass} />
                    </div>
                    {/* Items Table */}
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50"><tr>{['区分', '内容', '数量', '単位', '単価', '原価', '金額'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}<th/></tr></thead>
                            <tbody>{estimate.items?.map((item, index) => <tr key={index}>
                                <td><input value={item.division} onChange={e => handleItemChange(index, 'division', e.target.value)} className={tableInputClass} /></td>
                                <td><input value={item.content} onChange={e => handleItemChange(index, 'content', e.target.value)} className={tableInputClass} /></td>
                                <td><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className={`${tableInputClass} w-20`} /></td>
                                <td><input value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} className={`${tableInputClass} w-20`} /></td>
                                <td><input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className={`${tableInputClass} w-24`} /></td>
                                <td><input type="number" value={item.cost} onChange={e => handleItemChange(index, 'cost', Number(e.target.value))} className={`${tableInputClass} w-24`} /></td>
                                <td><input readOnly value={formatJPY(item.price)} className={`${tableInputClass} w-28`} /></td>
                                <td><button onClick={() => removeItem(index)}><Trash2 className="w-4 h-4"/></button></td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                    <button type="button" onClick={addItem}><PlusCircle className="w-5 h-5"/>行を追加</button>
                    {/* Totals */}
                    <div className="text-right font-bold text-xl">合計: {formatJPY(total)}</div>
                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose}>キャンセル</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">{isSubmitting ? '保存中...' : '保存'}</button>
                </div>
            </div>
        </div>
    );
};


// Main Page Component
interface EstimateManagementPageProps {
  estimates: Estimate[];
  customers: Customer[];
  allUsers: EmployeeUser[];
  onAddEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  currentUser: EmployeeUser | null;
  searchTerm: string;
  isAIOff: boolean;
}

const EstimateManagementPage: React.FC<EstimateManagementPageProps> = ({ estimates, customers, allUsers, onAddEstimate, addToast, currentUser, searchTerm, isAIOff }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'estimateNumber', direction: 'descending' });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

    const filteredEstimates = useMemo(() => {
        if (!searchTerm) return estimates;
        const lower = searchTerm.toLowerCase();
        return estimates.filter(e => e.customerName.toLowerCase().includes(lower) || e.title.toLowerCase().includes(lower));
    }, [estimates, searchTerm]);

    const sortedEstimates = useMemo(() => {
        let sortable = [...filteredEstimates];
        if (sortConfig) {
            sortable.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof Estimate];
                const bVal = b[sortConfig.key as keyof Estimate];
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredEstimates, sortConfig]);

    const requestSort = (key: string) => {
        const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };
    
    const handleOpenDetail = (estimate: Estimate) => {
        setSelectedEstimate(estimate);
        setIsDetailModalOpen(true);
    };

    const handleOpenEdit = (estimate: Estimate | null = null) => {
        setSelectedEstimate(estimate);
        setIsEditModalOpen(true);
    };

    const handleSaveEstimate = async (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>) => {
        // Here you would call update or add
        await onAddEstimate(estimateData);
        addToast('見積を保存しました。', 'success');
        setIsEditModalOpen(false);
    };

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">見積一覧</h2>
                    <div className="flex items-center gap-4">
                        <button onClick={() => handleOpenEdit(null)} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
                            <PlusCircle className="w-5 h-5" />
                            新規見積作成
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left">
                        <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <SortableHeader sortKey="estimateNumber" label="見積番号" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="customerName" label="顧客名" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium">件名</th>
                                <SortableHeader sortKey="total" label="合計金額" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="createdAt" label="作成日" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {sortedEstimates.map(est => (
                                <tr key={est.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-mono">{est.estimateNumber}</td>
                                    <td className="px-6 py-4">{est.customerName}</td>
                                    <td className="px-6 py-4">{est.title}</td>
                                    <td className="px-6 py-4 font-semibold">{formatJPY(est.total)}</td>
                                    <td className="px-6 py-4">{formatDate(est.createdAt)}</td>
                                    <td className="px-6 py-4">{est.status}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleOpenDetail(est)} className="p-2 text-slate-500 hover:text-blue-600"><Eye className="w-5 h-5"/></button>
                                        <button onClick={() => handleOpenEdit(est)} className="p-2 text-slate-500 hover:text-green-600"><Pencil className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sortedEstimates.length === 0 && <EmptyState icon={FileText} title="見積がありません" message="最初の見積を作成しましょう。" />}
                </div>
            </div>
            {isEditModalOpen && <EstimateModal 
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveEstimate}
                customers={customers}
                addToast={addToast}
                estimateToEdit={selectedEstimate}
                currentUser={currentUser}
                isAIOff={isAIOff}
            />}
             {isDetailModalOpen && <EstimateDetailModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                estimate={selectedEstimate}
                addToast={addToast}
                onEdit={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedEstimate);
                }}
            />}
        </>
    );
};

export default EstimateManagementPage;