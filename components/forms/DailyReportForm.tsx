import React, { useState, useMemo, useRef } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import { Loader, PlusCircle, Trash2, AlertTriangle, Copy } from '../Icons.tsx';
import { User, Toast } from '../../types.ts';

interface DailyReportFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    addToast: (message: string, type: Toast['type']) => void;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
}

interface TimeEntry {
    id: string;
    timeRange: string;
    activity: string;
}

interface DailyReportData {
    reportDate: string;
    pqTarget: string;
    pqCurrent: string;
    pqLastYear: string;
    mqTarget: string;
    mqCurrent: string;
    mqLastYear: string;
    planEntries: TimeEntry[];
    actualEntries: TimeEntry[];
    notes: string;
}

const DailyReportForm: React.FC<DailyReportFormProps> = ({ onSuccess, applicationCodeId, currentUser, addToast, isAIOff, isLoading, error: formLoadError }) => {
    const [formData, setFormData] = useState<DailyReportData>({
        reportDate: new Date().toISOString().split('T')[0],
        pqTarget: '',
        pqCurrent: '',
        pqLastYear: '',
        mqTarget: '',
        mqCurrent: '',
        mqLastYear: '',
        planEntries: [{ id: '1', timeRange: '', activity: '' }],
        actualEntries: [{ id: '1', timeRange: '', activity: '' }],
        notes: '',
    });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
    
    const isDisabled = isSubmitting || isLoading || !!formLoadError;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePlanEntryChange = (id: string, field: 'timeRange' | 'activity', value: string) => {
        setFormData(prev => ({
            ...prev,
            planEntries: prev.planEntries.map(entry =>
                entry.id === id ? { ...entry, [field]: value } : entry
            )
        }));
    };

    const handleActualEntryChange = (id: string, field: 'timeRange' | 'activity', value: string) => {
        setFormData(prev => ({
            ...prev,
            actualEntries: prev.actualEntries.map(entry =>
                entry.id === id ? { ...entry, [field]: value } : entry
            )
        }));
    };

    const addPlanEntry = () => {
        setFormData(prev => ({
            ...prev,
            planEntries: [...prev.planEntries, { id: Date.now().toString(), timeRange: '', activity: '' }]
        }));
    };

    const removePlanEntry = (id: string) => {
        if (formData.planEntries.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            planEntries: prev.planEntries.filter(entry => entry.id !== id)
        }));
    };

    const addActualEntry = () => {
        setFormData(prev => ({
            ...prev,
            actualEntries: [...prev.actualEntries, { id: Date.now().toString(), timeRange: '', activity: '' }]
        }));
    };

    const removeActualEntry = (id: string) => {
        if (formData.actualEntries.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            actualEntries: prev.actualEntries.filter(entry => entry.id !== id)
        }));
    };

    // Excel/テキストからの貼り付け処理
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, type: 'plan' | 'actual') => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const lines = pastedText.split('\n').filter(line => line.trim());
        
        const entries: TimeEntry[] = lines.map((line, index) => {
            // "8:20～8:40　朝礼" のような形式を解析
            const match = line.match(/^([0-9:：～〜\-]+)\s+(.+)$/);
            if (match) {
                return {
                    id: `${Date.now()}_${index}`,
                    timeRange: match[1].replace(/：/g, ':').replace(/〜/g, '～'),
                    activity: match[2].trim()
                };
            }
            return {
                id: `${Date.now()}_${index}`,
                timeRange: '',
                activity: line.trim()
            };
        });

        if (entries.length > 0) {
            if (type === 'plan') {
                setFormData(prev => ({ ...prev, planEntries: entries }));
            } else {
                setFormData(prev => ({ ...prev, actualEntries: entries }));
            }
            addToast(`${entries.length}件の項目を読み込みました`, 'success');
        }
    };

    // Form validation for submit button activation
    const isFormValid = useMemo(() => {
        const hasActualEntries = formData.actualEntries.some(e => e.activity.trim());
        return !!formData.reportDate && hasActualEntries && !!approvalRouteId;
    }, [formData, approvalRouteId]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        firstInvalidRef.current = null;
        setError('');
        
        if (!approvalRouteId) {
            setError('承認ルートは必須です。');
            firstInvalidRef.current = document.getElementById('approval-route-selector') as HTMLSelectElement;
            firstInvalidRef.current?.focus();
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。再度ログインしてください。');
            return;
        }
        if (!formData.reportDate) {
            setError('報告日は必須です。');
            return;
        }
        const hasActualEntries = formData.actualEntries.some(e => e.activity.trim());
        if (!hasActualEntries) {
            setError('実績を少なくとも1件入力してください。');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication({
                applicationCodeId: applicationCodeId,
                formData,
                approvalRouteId
            }, currentUser.id);
            addToast('日報を提出しました', 'success');
            onSuccess();
        } catch (err: any) {
            setError('日報の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
    const smallInputClass = "w-24 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="relative">
            {(isLoading || formLoadError) && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8" aria-live="polite" aria-busy={isLoading}>
                    {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" aria-hidden="true" />}
                </div>
            )}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-6" aria-labelledby="form-title">
                <div className="flex justify-between items-center">
                    <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white">日報作成</h2>
                </div>
                
                {formLoadError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">フォーム読み込みエラー</p>
                        <p>{formLoadError}</p>
                    </div>
                )}

                {/* 報告日 */}
                <div>
                    <label htmlFor="reportDate" className={labelClass}>報告日 *</label>
                    <input 
                        type="date" 
                        id="reportDate" 
                        name="reportDate" 
                        value={formData.reportDate} 
                        onChange={handleChange} 
                        className={inputClass} 
                        required 
                        disabled={isDisabled} 
                    />
                </div>

                {/* PQ/MQ目標 */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">PQ/MQ目標</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="pqTarget" className={labelClass}>PQ目標</label>
                            <input type="text" id="pqTarget" name="pqTarget" value={formData.pqTarget} onChange={handleChange} className={smallInputClass} placeholder="22.5" disabled={isDisabled} />
                        </div>
                        <div>
                            <label htmlFor="pqCurrent" className={labelClass}>今期現在</label>
                            <input type="text" id="pqCurrent" name="pqCurrent" value={formData.pqCurrent} onChange={handleChange} className={smallInputClass} placeholder="8.8" disabled={isDisabled} />
                        </div>
                        <div>
                            <label htmlFor="pqLastYear" className={labelClass}>前年</label>
                            <input type="text" id="pqLastYear" name="pqLastYear" value={formData.pqLastYear} onChange={handleChange} className={smallInputClass} placeholder="11.0" disabled={isDisabled} />
                        </div>
                        <div>
                            <label htmlFor="mqTarget" className={labelClass}>MQ目標</label>
                            <input type="text" id="mqTarget" name="mqTarget" value={formData.mqTarget} onChange={handleChange} className={smallInputClass} placeholder="13.5" disabled={isDisabled} />
                        </div>
                        <div>
                            <label htmlFor="mqCurrent" className={labelClass}>今期現在</label>
                            <input type="text" id="mqCurrent" name="mqCurrent" value={formData.mqCurrent} onChange={handleChange} className={smallInputClass} placeholder="4.6" disabled={isDisabled} />
                        </div>
                        <div>
                            <label htmlFor="mqLastYear" className={labelClass}>前年</label>
                            <input type="text" id="mqLastYear" name="mqLastYear" value={formData.mqLastYear} onChange={handleChange} className={smallInputClass} placeholder="5.7" disabled={isDisabled} />
                        </div>
                    </div>
                </div>

                {/* 計画 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">計画</h3>
                        <button
                            type="button"
                            onClick={addPlanEntry}
                            className="flex items-center gap-2 text-sm bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-blue-700 transition-colors"
                            disabled={isDisabled}
                        >
                            <PlusCircle className="w-4 h-4" />
                            行追加
                        </button>
                    </div>
                    <div className="mb-2">
                        <textarea
                            placeholder="Excelやテキストから貼り付け（例: 8:20～8:40　朝礼）"
                            onPaste={(e) => handlePaste(e, 'plan')}
                            className="w-full bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                            rows={2}
                            disabled={isDisabled}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Copy className="w-3 h-3 inline mr-1" />
                            Excelやメールからコピー＆ペーストできます
                        </p>
                    </div>
                    <div className="space-y-2">
                        {formData.planEntries.map((entry) => (
                            <div key={entry.id} className="flex gap-2">
                                <input
                                    type="text"
                                    value={entry.timeRange}
                                    onChange={(e) => handlePlanEntryChange(entry.id, 'timeRange', e.target.value)}
                                    placeholder="8:20～8:40"
                                    className="w-32 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={entry.activity}
                                    onChange={(e) => handlePlanEntryChange(entry.id, 'activity', e.target.value)}
                                    placeholder="朝礼"
                                    className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                    disabled={isDisabled}
                                />
                                {formData.planEntries.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removePlanEntry(entry.id)}
                                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        disabled={isDisabled}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 実績 */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">実績 *</h3>
                        <button
                            type="button"
                            onClick={addActualEntry}
                            className="flex items-center gap-2 text-sm bg-green-600 text-white font-semibold py-1.5 px-3 rounded-lg hover:bg-green-700 transition-colors"
                            disabled={isDisabled}
                        >
                            <PlusCircle className="w-4 h-4" />
                            行追加
                        </button>
                    </div>
                    <div className="mb-2">
                        <textarea
                            placeholder="Excelやテキストから貼り付け（例: 8:20～8:40　朝礼）"
                            onPaste={(e) => handlePaste(e, 'actual')}
                            className="w-full bg-white dark:bg-slate-700 border border-green-300 dark:border-green-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                            rows={2}
                            disabled={isDisabled}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Copy className="w-3 h-3 inline mr-1" />
                            Excelやメールからコピー＆ペーストできます
                        </p>
                    </div>
                    <div className="space-y-2">
                        {formData.actualEntries.map((entry) => (
                            <div key={entry.id} className="flex gap-2">
                                <input
                                    type="text"
                                    value={entry.timeRange}
                                    onChange={(e) => handleActualEntryChange(entry.id, 'timeRange', e.target.value)}
                                    placeholder="8:20～8:40"
                                    className="w-32 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={entry.activity}
                                    onChange={(e) => handleActualEntryChange(entry.id, 'activity', e.target.value)}
                                    placeholder="朝礼"
                                    className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                    disabled={isDisabled}
                                />
                                {formData.actualEntries.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeActualEntry(entry.id)}
                                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        disabled={isDisabled}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 備考・特記事項 */}
                <div>
                    <label htmlFor="notes" className={labelClass}>備考・特記事項</label>
                    <textarea 
                        id="notes" 
                        name="notes" 
                        rows={4} 
                        value={formData.notes} 
                        onChange={handleChange} 
                        className={inputClass} 
                        disabled={isDisabled} 
                        placeholder="顧客からのコメントや特記事項があれば記入してください。"
                    />
                </div>

                <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg flex items-center gap-2" role="alert">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </p>}

                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button 
                        type="submit" 
                        className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 transition-colors" 
                        disabled={isDisabled || !isFormValid}
                    >
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : '報告を提出する'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default DailyReportForm;
