import React, { useState, useMemo, useEffect } from 'react';
import { submitApplication, saveApplicationDraft, clearApplicationDraft } from '../../services/dataService';
import { extractInvoiceDetails } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons';
import { User, InvoiceData, ApplicationWithDetails } from '../../types';
import { useSubmitWithConfirmation } from '../../hooks/useSubmitWithConfirmation';

interface TransportExpenseFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    draftApplication?: ApplicationWithDetails | null;
}

interface TransportDetail {
    id: string;
    travelDate: string;
    departure: string;
    arrival: string;
    transportMode: string;
    amount: number;
}

const TRANSPORT_MODES = ['電車', 'バス', 'タクシー', '飛行機', 'その他'];

const createEmptyDetail = (): TransportDetail => ({
    id: `row_${Date.now()}`,
    travelDate: new Date().toISOString().split('T')[0],
    departure: '',
    arrival: '',
    transportMode: TRANSPORT_MODES[0],
    amount: 0,
});

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const TransportExpenseForm: React.FC<TransportExpenseFormProps> = ({ onSuccess, applicationCodeId, currentUser, isAIOff, isLoading, error: formLoadError, draftApplication }) => {
    const [details, setDetails] = useState<TransportDetail[]>(() => [createEmptyDetail()]);
    const [notes, setNotes] = useState('');
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();

    const isDisabled = isSubmitting || isSavingDraft || isLoading || !!formLoadError;
    const totalAmount = useMemo(() => details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [details]);

    const addNewRow = () => {
        setDetails(prev => [...prev, createEmptyDetail()]);
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
            const ocrData: InvoiceData = await extractInvoiceDetails(base64String, file.type);
            
            // Heuristic to parse departure/arrival from description
            const description = ocrData.description || '';
            const parts = description.split(/から|→|～/);
            const departure = parts[0]?.trim() || '';
            const arrival = parts[1]?.trim() || '';

            setDetails(prev => [...prev.filter(d => d.departure || d.arrival), {
                id: `row_ocr_${Date.now()}`,
                travelDate: ocrData.invoiceDate || new Date().toISOString().split('T')[0],
                departure,
                arrival,
                transportMode: TRANSPORT_MODES[0],
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

    const buildSubmissionPayload = () => {
        const sanitizedDetails = details
            .filter(d => d.departure || d.arrival)
            .map(detail => ({
                travelDate: detail.travelDate,
                departure: detail.departure,
                arrival: detail.arrival,
                transportMode: detail.transportMode,
                amount: detail.amount,
            }));

        return {
            applicationCodeId,
            formData: {
                details: sanitizedDetails,
                notes,
                totalAmount,
            },
            approvalRouteId,
        };
    };

    const executeSubmission = async () => {
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }
        const payload = buildSubmissionPayload();
        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication(payload, currentUser.id);
            await clearApplicationDraft(applicationCodeId, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        if (!approvalRouteId) return setError('承認ルートを選択してください。');
        if (!currentUser) return setError('ユーザー情報が見つかりません。');
        if (details.length === 0 || details.every(d => !d.departure && !d.arrival)) {
            return setError('少なくとも1つの明細を入力してください。');
        }

        requestConfirmation({
            label: '申請を送信する',
            title: '交通費申請を送信しますか？',
            description: '送信すると承認ルートに通知されます。内容に誤りがないかご確認ください。',
            confirmLabel: 'はい（申請）',
            draftLabel: '下書き保存',
            onConfirm: executeSubmission,
            onDraft: handleSaveDraft,
        });
    };

    const handleSaveDraft = async () => {
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }

        setIsSavingDraft(true);
        setError('');
        try {
            await saveApplicationDraft(buildSubmissionPayload(), currentUser.id);
        } catch (err: any) {
            setError('下書きの保存に失敗しました。');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const clearForm = () => {
        setDetails([createEmptyDetail()]);
        setNotes('');
        setError('');
    };

    useEffect(() => {
        if (!draftApplication || draftApplication.applicationCodeId !== applicationCodeId) return;
        const rawDetails = Array.isArray(draftApplication.formData?.details) ? draftApplication.formData.details : [];
        const restoredDetails = rawDetails.map((detail: any, index: number) => ({
            id: detail.id || `draft_${index}_${Date.now()}`,
            travelDate: detail.travelDate || new Date().toISOString().split('T')[0],
            departure: detail.departure || '',
            arrival: detail.arrival || '',
            transportMode: detail.transportMode || TRANSPORT_MODES[0],
            amount: Number(detail.amount) || 0,
        }));
        setDetails(restoredDetails.length ? restoredDetails : [createEmptyDetail()]);
        setNotes(draftApplication.formData?.notes || '');
        setApprovalRouteId(draftApplication.approvalRouteId || '');
        setError('');
    }, [draftApplication, applicationCodeId]);

    const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="relative">
             {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8">
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-8 animate-fade-in-up">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center">交通費申請フォーム</h2>

                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}
                
                <details className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700" open>
                    <summary className="text-base font-semibold cursor-pointer text-slate-700 dark:text-slate-200">明細書 (AI-OCR)</summary>
                    <div className="mt-4 flex items-center gap-4">
                        <label htmlFor="ocr-file-upload" className={`relative inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${isOcrLoading || isAIOff || isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isOcrLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span>{isOcrLoading ? '解析中...' : 'ファイルから読み取り'}</span>
                            <input id="ocr-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf" disabled={isOcrLoading || isAIOff || isDisabled} />
                        </label>
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、OCR機能は利用できません。</p>}
                        {!isAIOff && <p className="text-sm text-slate-500 dark:text-slate-400">交通費の領収書を選択すると、下の表に自動で追加されます。</p>}
                    </div>
                </details>

                <div>
                    <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">交通費明細 *</label>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    {['利用日', '出発地', '目的地', '交通手段', '金額(円)'].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>)}
                                    <th className="p-2 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {details.map((item) => (
                                    <tr key={item.id}>
                                        <td className="p-1"><input type="date" value={item.travelDate} onChange={e => handleDetailChange(item.id, 'travelDate', e.target.value)} className={inputClass} disabled={isDisabled} /></td>
                                        <td className="p-1 min-w-[150px]"><input type="text" placeholder="例: 東京駅" value={item.departure} onChange={e => handleDetailChange(item.id, 'departure', e.target.value)} className={inputClass} disabled={isDisabled} /></td>
                                        <td className="p-1 min-w-[150px]"><input type="text" placeholder="例: 幕張メッセ" value={item.arrival} onChange={e => handleDetailChange(item.id, 'arrival', e.target.value)} className={inputClass} disabled={isDisabled} /></td>
                                        <td className="p-1 min-w-[120px]">
                                            <select value={item.transportMode} onChange={e => handleDetailChange(item.id, 'transportMode', e.target.value)} className={inputClass} disabled={isDisabled}>
                                                {TRANSPORT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1 min-w-[120px]"><input type="number" value={item.amount} onChange={e => handleDetailChange(item.id, 'amount', Number(e.target.value))} className={`${inputClass} text-right`} disabled={isDisabled} /></td>
                                        <td className="text-center p-1">
                                            <button type="button" onClick={() => handleRemoveRow(item.id)} className="p-1 text-slate-400 hover:text-red-500" disabled={isDisabled}><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                        <button type="button" onClick={clearForm} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled}>内容をクリア</button>
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                            disabled={isDisabled}
                        >
                            下書き保存
                        </button>
                    <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled}>
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : '申請を送信する'}
                    </button>
                </div>
            </form>
            {ConfirmationDialog}
        </div>
    );
};

export default TransportExpenseForm;
