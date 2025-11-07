import React, { useState, useMemo } from 'react';
import { submitApplication } from '../../services/dataService';
import { extractInvoiceDetails } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import AccountItemSelect from './AccountItemSelect';
import PaymentRecipientSelect from './PaymentRecipientSelect';
import DepartmentSelect from './DepartmentSelect';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons';
// FIX: Import AllocationDivision type.
import { User, InvoiceData, Customer, AccountItem, Job, PurchaseOrder, Department, AllocationDivision } from '../../types';

interface ExpenseReimbursementFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    customers: Customer[];
    accountItems: AccountItem[];
    jobs: Job[];
    purchaseOrders: PurchaseOrder[];
    departments: Department[];
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    // FIX: Add missing 'allocationDivisions' property.
    allocationDivisions: AllocationDivision[];
}

interface ExpenseDetail {
    id: string;
    paymentDate: string;
    paymentRecipientId: string;
    description: string;
    allocationTarget: string;
    costType: 'V' | 'F';
    accountItemId: string;
    // FIX: Rename 'departmentId' to 'allocationDivisionId' to match schema.
    allocationDivisionId: string;
    amount: number;
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = ({ onSuccess, applicationCodeId, currentUser, customers, jobs, departments, isAIOff, isLoading, error: formLoadError, allocationDivisions }) => {
    const [departmentId, setDepartmentId] = useState<string>('');
    const [details, setDetails] = useState<ExpenseDetail[]>([]);
    const [notes, setNotes] = useState('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    
    const isDisabled = isSubmitting || isLoading || !!formLoadError;

    const totalAmount = useMemo(() => details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [details]);

    const addNewRow = () => {
        setDetails(prev => [...prev, {
            id: `row_${Date.now()}`,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentRecipientId: '',
            description: '',
            allocationTarget: '',
            costType: 'F',
            accountItemId: '',
            // FIX: Use 'allocationDivisionId'.
            allocationDivisionId: '',
            amount: 0,
        }]);
    };
    
    const handleDetailChange = (id: string, field: keyof ExpenseDetail, value: string | number) => {
        setDetails(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleRemoveRow = (id: string) => setDetails(prev => prev.filter(item => item.id !== id));
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (isAIOff) {
            setError('AI機能は現在無効です。ファイルからの読み取りはできません。');
            return;
        }

        setIsOcrLoading(true);
        setError('');
        try {
            const base64String = await readFileAsBase64(file);
            const ocrData: InvoiceData = await extractInvoiceDetails(base64String, file.type);
            
            const newDetail: ExpenseDetail = {
                id: `row_ocr_${Date.now()}`,
                paymentDate: ocrData.invoiceDate || new Date().toISOString().split('T')[0],
                paymentRecipientId: '', // OCRデータに支払先IDはないため空
                description: `【OCR読取: ${ocrData.vendorName}】${ocrData.description}`,
                allocationTarget: ocrData.project ? `job:${jobs.find(j => j.title === ocrData.project)?.id || ''}` : `customer:${customers.find(c => c.customerName === ocrData.relatedCustomer)?.id || ''}`,
                costType: ocrData.costType || 'F',
                accountItemId: '', // OCRデータに勘定科目IDはないため空
                // FIX: Use 'allocationDivisionId'.
                allocationDivisionId: '',
                amount: ocrData.totalAmount || 0,
            };
            setDetails(prev => [...prev, newDetail]);

        } catch (err: any) {
            if (err.name === 'AbortError') return; // Request was aborted, do nothing
            setError(err.message || 'AI-OCR処理中にエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
            e.target.value = ''; // ファイル選択をリセット
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!approvalRouteId) return setError('承認ルートを選択してください。');
        if (!currentUser) return setError('ユーザー情報が見つかりません。');
        if (!departmentId) return setError('部門を選択してください。');
        if (details.length === 0 || details.every(d => !d.description && !d.paymentRecipientId)) {
            return setError('少なくとも1つの明細を入力してください。');
        }

        setIsSubmitting(true);
        setError('');
        try {
            const submissionData = {
                departmentId,
                details: details.filter(d => d.description || d.paymentRecipientId),
                notes: notes,
                totalAmount: totalAmount,
            };
            await submitApplication({ applicationCodeId, formData: submissionData, approvalRouteId }, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="relative">
            {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8">
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-8 animate-fade-in-up">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center">経費精算フォーム</h2>
                
                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}
                
                <div className="mt-4 flex items-center gap-4">
                    <label htmlFor="ocr-file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${isOcrLoading || isAIOff || isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isOcrLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        <span>{isOcrLoading ? '解析中...' : '領収書から読み取り'}</span>
                        <input id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" disabled={isOcrLoading || isAIOff || isDisabled} />
                    </label>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、OCR機能は利用できません。</p>}
                    {!isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400">領収書ファイルを選択すると、下の表に自動で追加されます。</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">部門 *</label>
                  <DepartmentSelect
                    value={departmentId}
                    onChange={setDepartmentId}
                    required
                  />
                </div>

                <div>
                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">経費明細 *</label>
                    {details.map(item => (
                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start mb-2">
                            <input type="date" value={item.paymentDate} onChange={e => handleDetailChange(item.id, 'paymentDate', e.target.value)} className={`${inputClass} md:col-span-2`} disabled={isDisabled} />
                            <div className="md:col-span-2"><PaymentRecipientSelect value={item.paymentRecipientId} onChange={(id) => handleDetailChange(item.id, 'paymentRecipientId', id)} required /></div>
                            <input type="text" placeholder="内容" value={item.description} onChange={e => handleDetailChange(item.id, 'description', e.target.value)} className={`${inputClass} md:col-span-2`} disabled={isDisabled} />
                            <div className="md:col-span-2"><AccountItemSelect value={item.accountItemId} onChange={(id) => handleDetailChange(item.id, 'accountItemId', id)} required /></div>
                            {/* FIX: Replace DepartmentSelect with AllocationDivision select. */}
                            <div className="md:col-span-1">
                                <select value={item.allocationDivisionId} onChange={e => handleDetailChange(item.id, 'allocationDivisionId', e.target.value)} className={inputClass} disabled={isDisabled}>
                                    <option value="">振分区分</option>
                                    {allocationDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <select value={item.allocationTarget} onChange={e => handleDetailChange(item.id, 'allocationTarget', e.target.value)} className={`${inputClass} md:col-span-1`} disabled={isDisabled}>
                                <option value="">振分先</option>
                                <optgroup label="顧客">
                                    {customers.map(c => <option key={`customer:${c.id}`} value={`customer:${c.id}`}>{c.customerName}</option>)}
                                </optgroup>
                                <optgroup label="案件">
                                    {jobs.map(j => <option key={`job:${j.id}`} value={`job:${j.id}`}>{j.title}</option>)}
                                </optgroup>
                            </select>
                            <input type="number" placeholder="金額" value={item.amount} onChange={e => handleDetailChange(item.id, 'amount', Number(e.target.value))} className={`${inputClass} md:col-span-1 text-right`} disabled={isDisabled} />
                            <button type="button" onClick={() => handleRemoveRow(item.id)} className="p-2 text-slate-400 hover:text-red-500 h-10" disabled={isDisabled}><Trash2 className="w-5 h-5" /></button>
                        </div>
                    ))}
                     <div className="flex items-center justify-between mt-2">
                        <button type="button" onClick={addNewRow} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700" disabled={isDisabled}>
                            <PlusCircle className="w-4 h-4" /> 行を追加
                        </button>
                        <div className="text-right">
                            <span className="text-sm text-slate-500 dark:text-slate-400">合計金額: </span>
                            <span className="text-xl font-bold text-slate-800 dark:text-white">¥{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="notes" className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">備考</label>
                    <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="補足事項があれば入力してください。" disabled={isDisabled} />
                </div>

                <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} />

                {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}

                <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled}>下書き保存</button>
                    <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled}>
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : '申請を送信する'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExpenseReimbursementForm;