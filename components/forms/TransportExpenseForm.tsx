import React, { useState, useMemo, useRef } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import { extractInvoiceDetails } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons.tsx';
import { User, InvoiceData, AccountItem, AllocationDivision } from '../../types.ts';

interface TransportExpenseFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    accountItems: AccountItem[];
    allocationDivisions: AllocationDivision[];
}

interface TransportDetail {
    id: string;
    travelDate: string;
    departure: string;
    arrival: string;
    transportMode: string;
    amount: number;
}

const TRP_MODES = ['電車', 'バス', 'タクシー', '飛行機', 'その他'];

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const TransportExpenseForm: React.FC<TransportExpenseFormProps> = ({ onSuccess, applicationCodeId, currentUser, isAIOff, isLoading, error: formLoadError, accountItems, allocationDivisions }) => {
    const [details, setDetails] = useState<TransportDetail[]>(() => [{
        id: `row_${Date.now()}`,
        travelDate: new Date().toISOString().split('T')[0],
        departure: '',
        arrival: '',
        transportMode: TRP_MODES[0],
        amount: 0,
    }]);
    const [notes, setNotes] = useState('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

    const isDisabled = isSubmitting || isLoading || !!formLoadError;
    const totalAmount = useMemo(() => details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [details]);

    const addNewRow = () => {
        setDetails(prev => [...prev, {
            id: `row_${Date.now()}`,
            travelDate: new Date().toISOString().split('T')[0],
            departure: '',
            arrival: '',
            transportMode: TRP_MODES[0],
            amount: 0,
        }]);
    };

    const handleDetailChange = (id: string, field: keyof TransportDetail, value: string | number) => {
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
            const ocrData: InvoiceData = await extractInvoiceDetails(base64String, file.type, accountItems, allocationDivisions);
            
            // Heuristic to parse departure/arrival from description
            const description = ocrData.description || '';
            const parts = description.split(/から|→|～/);
            const departure = parts[0]?.trim() || '';
            const arrival = parts[1]?.trim() || '';

            setDetails(prev => [...prev.filter(d => d.departure.trim() || d.arrival.trim() || d.amount), { // Filter out empty rows if OCR data is adding a new one
                id: `row_ocr_${Date.now()}`,
                travelDate: ocrData.invoiceDate || new Date().toISOString().split('T')[0],
                departure,
                arrival,
                transportMode: TRP_MODES[0],
                amount: ocrData.totalAmount || 0,
            }]);
        } catch (err: any) {
            if (err.name === 'AbortError') return; // Request was aborted, do nothing
            setError(err.message || 'AI-OCR処理中にエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
            e.target.value = '';
        }
    };

    // Form validation for submit button activation
    const isFormValid = useMemo(() => {
        if (!approvalRouteId || details.length === 0) return false;
        return !details.some(detail =>
            !detail.travelDate ||
            !detail.departure.trim() ||
            !detail.arrival.trim() ||
            !detail.transportMode ||
            detail.amount <= 0
        );
    }, [approvalRouteId, details]);

    const mapDetailToPayload = (detail: TransportDetail) => ({
        travel_date: detail.travelDate,
        departure: detail.departure,
        arrival: detail.arrival,
        transport_mode: detail.transportMode,
        amount: detail.amount,
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        firstInvalidRef.current = null;
        setError('');

        if (!approvalRouteId) {
            setError('承認ルートを選択してください。');
            firstInvalidRef.current = document.getElementById('approval-route-selector') as HTMLSelectElement;
            firstInvalidRef.current?.focus();
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }
        if (details.length === 0 || details.every(d => !d.departure.trim() && !d.arrival.trim() && !d.amount)) {
            setError('少なくとも1つの明細を入力してください。');
            firstInvalidRef.current = document.querySelector('input[placeholder="例: 東京駅"]') as HTMLInputElement;
            firstInvalidRef.current?.focus();
            return;
        }
        
        // Validate each detail row
        for (let i = 0; i < details.length; i++) {
            const detail = details[i];
            if (!detail.travelDate) {
                setError('全ての明細で利用日を入力してください。');
                firstInvalidRef.current = document.querySelector(`input[id="travelDate-${detail.id}"]`) as HTMLInputElement;
                firstInvalidRef.current?.focus();
                return;
            }
            if (!detail.departure.trim()) {
                setError('全ての明細で出発地を入力してください。');
                firstInvalidRef.current = document.querySelector(`input[id="departure-${detail.id}"]`) as HTMLInputElement;
                firstInvalidRef.current?.focus();
                return;
            }
            if (!detail.arrival.trim()) {
                setError('全ての明細で目的地を入力してください。');
                firstInvalidRef.current = document.querySelector(`input[id="arrival-${detail.id}"]`) as HTMLInputElement;
                firstInvalidRef.current?.focus();
                return;
            }
            if (!detail.transportMode) {
                setError('全ての明細で交通手段を選択してください。');
                firstInvalidRef.current = document.querySelector(`select[id="transportMode-${detail.id}"]`) as HTMLSelectElement;
                firstInvalidRef.current?.focus();
                return;
            }
            if (detail.amount <= 0) {
                setError('全ての明細で金額を正しく入力してください。');
                firstInvalidRef.current = document.querySelector(`input[id="amount-${detail.id}"]`) as HTMLInputElement;
                firstInvalidRef.current?.focus();
                return;
            }
        }

        setIsSubmitting(true);
        setError('');
        try {
            const submissionData = {
                details: details
                    .filter(d => d.departure.trim() || d.arrival.trim() || d.amount)
                    .map(mapDetailToPayload),
                notes,
                total_amount: totalAmount,
            };
            await submitApplication({ applicationCodeId, formData: submissionData, approvalRouteId }, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const clearForm = () => {
        setDetails([]);
        setNotes('');
        setError('');
        addNewRow();
    };

    const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="relative">
             {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8" aria-live="polite" aria-busy={isLoading}>
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" aria-hidden="true" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-8 animate-fade-in-up" aria-labelledby="form-title">
                <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white text-center">交通費申請フォーム</h2>

                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}
                
                <details className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700" open>
                    <summary className="text-base font-semibold cursor-pointer text-slate-700 dark:text-slate-200" aria-expanded="true" aria-controls="ocr-section">明細書 (AI-OCR)</summary>
                    <div id="ocr-section" className="mt-4 flex items-center gap-4">
                        <label htmlFor="ocr-file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${isOcrLoading || isAIOff || isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isOcrLoading ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Upload className="w-5 h-5" aria-hidden="true" />}
                            <span>{isOcrLoading ? '解析中...' : 'ファイルから読み取り'}</span>
                            <input id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" disabled={isOcrLoading || isAIOff || isDisabled} aria-label="領収書ファイルアップロード" />
                        </label>
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、OCR機能は利用できません。</p>}
                        {!isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400">交通費の領収書を選択すると、下の表に自動で追加されます。</p>}
                    </div>
                </details>

                <div>
                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">交通費明細 *</label>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-sm" role="grid" aria-describedby="transport-details-description">
                            <caption id="transport-details-description" className="sr-only">交通費明細一覧</caption>
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    {['利用日', '出発地', '目的地', '交通手段', '金額(円)'].map(h => <th key={h} scope="col" className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>)}
                                    <th scope="col" className="p-2 w-12"><span className="sr-only">削除</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {details.map((item) => (
                                    <tr key={item.id}>
                                        <td className="p-1"><input type="date" id={`travelDate-${item.id}`} value={item.travelDate} onChange={e => handleDetailChange(item.id, 'travelDate', e.target.value)} className={inputClass} disabled={isDisabled} aria-label="利用日" aria-required="true" required /></td>
                                        <td className="p-1 min-w-[150px]"><input type="text" id={`departure-${item.id}`} placeholder="例: 東京駅" value={item.departure} onChange={e => handleDetailChange(item.id, 'departure', e.target.value)} className={inputClass} disabled={isDisabled} aria-label="出発地" aria-required="true" required /></td>
                                        <td className="p-1 min-w-[150px]"><input type="text" id={`arrival-${item.id}`} placeholder="例: 幕張メッセ" value={item.arrival} onChange={e => handleDetailChange(item.id, 'arrival', e.target.value)} className={inputClass} disabled={isDisabled} aria-label="目的地" aria-required="true" required /></td>
                                        <td className="p-1 min-w-[120px]">
                                            <select id={`transportMode-${item.id}`} value={item.transportMode} onChange={e => handleDetailChange(item.id, 'transportMode', e.target.value)} className={inputClass} disabled={isDisabled} aria-label="交通手段" aria-required="true" required>
                                                {TRP_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1 min-w-[120px]"><input type="number" id={`amount-${item.id}`} value={item.amount} onChange={e => handleDetailChange(item.id, 'amount', Number(e.target.value))} className={`${inputClass} text-right`} disabled={isDisabled} aria-label="金額" aria-required="true" required min="1" /></td>
                                        <td className="text-center p-1">
                                            <button type="button" onClick={() => handleRemoveRow(item.id)} className="p-1 text-slate-400 hover:text-red-500" disabled={isDisabled} aria-label="明細行を削除"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <button type="button" onClick={addNewRow} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700" disabled={isDisabled} aria-label="明細行を追加">
                            <PlusCircle className="w-4 h-4" aria-hidden="true" /> 行を追加
                        </button>
                        <div className="text-right">
                            <span className="text-sm text-slate-500 dark:text-slate-400">合計金額: </span>
                            <span className="text-xl font-bold text-slate-800 dark:text-white">¥{totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="notes" className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">備考</label>
                    <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="補足事項があれば入力してください。" disabled={isDisabled} aria-label="備考" />
                </div>

                <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg" role="alert">{error}</p>}

                <div className="flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={clearForm} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled} aria-label="フォーム内容をクリア">内容をクリア</button>
                    <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled} aria-label="下書き保存">下書き保存</button>
                    <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled || !isFormValid} aria-label="申請を送信する">
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : '申請を送信する'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TransportExpenseForm;