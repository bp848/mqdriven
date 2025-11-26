import React, { useState, useEffect, useMemo } from 'react';
import { submitApplication } from '../../services/dataService';
import { generateDailyReportSummary, extractDailyReportFromImage } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import { Loader, Sparkles, PlusCircle, Copy } from '../Icons';
import { User, Toast, ApplicationWithDetails, DailyReportData, ScheduleItem, DailyReportPrefill } from '../../types';
import ChatApplicationModal from '../ChatApplicationModal';
import { useSubmitWithConfirmation } from '../../hooks/useSubmitWithConfirmation';

interface DailyReportFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    addToast: (message: string, type: Toast['type']) => void;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    draftApplication?: ApplicationWithDetails | null;
    prefill?: DailyReportPrefill;
    onPrefillApplied?: () => void;
}

const DailyReportForm: React.FC<DailyReportFormProps> = ({
    onSuccess,
    applicationCodeId,
    currentUser,
    addToast,
    isAIOff,
    isLoading,
    error: formLoadError,
    draftApplication,
    prefill,
    onPrefillApplied,
}) => {
    const createScheduleItem = (item?: Partial<ScheduleItem>): ScheduleItem => ({
        id: item?.id || `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        start: item?.start || '',
        end: item?.end || '',
        description: item?.description || '',
    });

    const [formData, setFormData] = useState<DailyReportData>({
        reportDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '18:00',
        customerName: '',
        activityContent: '',
        nextDayPlan: '',
        pqGoal: '22.5',
        pqCurrent: '',
        pqLastYear: '',
        mqGoal: '13.5',
        mqCurrent: '',
        mqLastYear: '',
        planItems: [createScheduleItem()],
        actualItems: [createScheduleItem()],
        comments: [''],
    });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [error, setError] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [savedReports, setSavedReports] = useState<Record<string, DailyReportData>>({});
    const [appliedPrefillId, setAppliedPrefillId] = useState<string | null>(null);
    const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();
    
    const isDisabled = isSubmitting || isSavingDraft || isLoading || !!formLoadError;
    const reportsStorageKey = useMemo(() => `mqdriven_daily_reports_${currentUser?.id ?? 'guest'}`, [currentUser?.id]);
    const templateText = useMemo(() => buildReportTemplate(formData), [formData]);

    const persistSavedReports = (next: Record<string, DailyReportData>) => {
        setSavedReports(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(reportsStorageKey, JSON.stringify(next));
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(reportsStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Record<string, DailyReportData>;
            if (parsed && typeof parsed === 'object') {
                setSavedReports(parsed);
            }
        } catch {
            setSavedReports({});
        }
    }, [reportsStorageKey]);

    useEffect(() => {
        if (!draftApplication || draftApplication.applicationCodeId !== applicationCodeId) return;
        const data = draftApplication.formData || {};
        setFormData({
            reportDate: data.reportDate || new Date().toISOString().split('T')[0],
            startTime: data.startTime || '09:00',
            endTime: data.endTime || '18:00',
            customerName: data.customerName || '',
            activityContent: data.activityContent || '',
            nextDayPlan: data.nextDayPlan || '',
            pqGoal: data.pqGoal || '22.5',
            pqCurrent: data.pqCurrent || '',
            pqLastYear: data.pqLastYear || '',
            mqGoal: data.mqGoal || '13.5',
            mqCurrent: data.mqCurrent || '',
            mqLastYear: data.mqLastYear || '',
            planItems: Array.isArray(data.planItems) && data.planItems.length
                ? data.planItems.map((item: ScheduleItem) => createScheduleItem(item))
                : [createScheduleItem()],
            actualItems: Array.isArray(data.actualItems) && data.actualItems.length
                ? data.actualItems.map((item: ScheduleItem) => createScheduleItem(item))
                : [createScheduleItem()],
            comments: Array.isArray(data.comments) && data.comments.length ? data.comments : [''],
        });
        setApprovalRouteId(draftApplication.approvalRouteId || '');
    }, [draftApplication, applicationCodeId]);
    
    useEffect(() => {
        if (!prefill || appliedPrefillId === prefill.id) return;
        const { id, ...prefillContent } = prefill;
        setFormData(prev => {
            const planItems = prefill.planItems ? prefill.planItems.map(item => ({ ...item })) : prev.planItems;
            const actualItems = prefill.actualItems ? prefill.actualItems.map(item => ({ ...item })) : prev.actualItems;
            const comments = prefill.comments ? [...prefill.comments] : prev.comments;
            return {
                ...prev,
                ...prefillContent,
                planItems,
                actualItems,
                comments,
            };
        });
        setAppliedPrefillId(prefill.id);
        onPrefillApplied?.();
    }, [prefill, appliedPrefillId, onPrefillApplied]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateSummary = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        if (!formData.customerName && !formData.activityContent) {
            addToast('AIが下書きを作成するために、顧客名または活動内容のキーワードを入力してください。', 'info');
            return;
        }
        setIsSummaryLoading(true);
        try {
            const summary = await generateDailyReportSummary(formData.customerName, formData.activityContent);
            setFormData(prev => ({ ...prev, activityContent: summary }));
            addToast('AIが活動内容の下書きを作成しました。', 'success');
        } catch (e: any) {
            if (e.name === 'AbortError') return; // Request was aborted, do nothing
            const errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました。';
            addToast(errorMessage, 'error');
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            e.target.value = '';
            return;
        }
        if (isDisabled) {
            e.target.value = '';
            return;
        }

        setIsOcrLoading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const result = reader.result as string | null;
                if (!result) return;
                const base64 = result.split(',')[1] || '';
                const text = await extractDailyReportFromImage(base64, file.type);
                setFormData(prev => ({
                    ...prev,
                    activityContent: prev.activityContent
                        ? `${prev.activityContent}\n\n${text}`
                        : text,
                }));
                addToast('画像から日報テキストを読み取りました。', 'success');
            } catch (err: any) {
                const msg = err instanceof Error ? err.message : '日報画像の読み取りに失敗しました。';
                addToast(msg, 'error');
            } finally {
                setIsOcrLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const buildSubmissionPayload = () => ({
        applicationCodeId,
        formData,
        approvalRouteId,
    });

    const executeSubmission = async () => {
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。再度ログインしてください。');
            return;
        }
        const payload = buildSubmissionPayload();
        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication(payload, currentUser.id);
            const nextSaved = {
                ...savedReports,
                [formData.reportDate]: formData,
            };
            persistSavedReports(nextSaved);
            onSuccess();
        } catch (err: any) {
            setError('日報の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        if (!approvalRouteId) {
            setError('承認ルートは必須です。');
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。再度ログインしてください。');
            return;
        }

        requestConfirmation({
            label: '報告を提出する',
            title: 'フォーム送信時に送信しますか？',
            description: 'はいを押すと日報が送信され、承認者に通知されます。内容をご確認ください。',
            confirmLabel: 'はい',
            cancelLabel: 'いいえ',
            draftLabel: '下書き',
            postConfirmMessage: 'はい（1件の申請を送信しました）',
            forceConfirmation: true,
            onConfirm: executeSubmission,
            onDraft: handleSaveDraft,
        });
    };

    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        const nextSaved = {
            ...savedReports,
            [formData.reportDate]: formData,
        };
        persistSavedReports(nextSaved);
        setIsSavingDraft(false);
        addToast('下書きを保存しました。', 'success');
    };

    const handleDuplicateYesterday = () => {
        const yesterday = addDays(formData.reportDate, -1);
        const previous = savedReports[yesterday];
        if (!previous) {
            addToast('前日の日報が見つかりません。', 'error');
            return;
        }
        setFormData({
            ...previous,
            reportDate: formData.reportDate,
            planItems:
                Array.isArray(previous.planItems) && previous.planItems.length
                    ? previous.planItems.map((item) => createScheduleItem(item))
                    : [createScheduleItem()],
            actualItems:
                Array.isArray(previous.actualItems) && previous.actualItems.length
                    ? previous.actualItems.map((item) => createScheduleItem(item))
                    : [createScheduleItem()],
            comments: Array.isArray(previous.comments) && previous.comments.length ? [...previous.comments] : [''],
        });
        addToast('前日の日報を複製しました。', 'info');
    };

    const handleCopyTemplate = async () => {
        try {
            await navigator.clipboard.writeText(templateText);
            addToast('フォーマットをコピーしました。', 'success');
        } catch {
            addToast('クリップボードへのコピーに失敗しました。', 'error');
        }
    };

    const handleScheduleChange = (type: 'planItems' | 'actualItems', id: string, field: keyof ScheduleItem, value: string) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].map(item => (item.id === id ? { ...item, [field]: value } : item)),
        }));
    };

    const handleAddScheduleRow = (type: 'planItems' | 'actualItems') => {
        setFormData(prev => ({
            ...prev,
            [type]: [...prev[type], createScheduleItem()],
        }));
    };

    const handleRemoveScheduleRow = (type: 'planItems' | 'actualItems', id: string) => {
        setFormData(prev => {
            if (prev[type].length === 1) return prev;
            return {
                ...prev,
                [type]: prev[type].filter(item => item.id !== id),
            };
        });
    };

    const handleCommentChange = (index: number, value: string) => {
        setFormData(prev => {
            const nextComments = [...prev.comments];
            nextComments[index] = value;
            return { ...prev, comments: nextComments };
        });
    };

    const handleAddComment = () => {
        setFormData(prev => ({ ...prev, comments: [...prev.comments, ''] }));
    };

    const handleTemplateInsert = () => {
        const template = [
            `PQ目標${formData.pqGoal}　今期現在${formData.pqCurrent || '__'}　前年${formData.pqLastYear || '__'}`,
            `MQ目標${formData.mqGoal}　今期現在${formData.mqCurrent || '__'}　前年${formData.mqLastYear || '__'}`,
            '',
            '【本日の計画】',
            formData.planItems.map(item => formatScheduleLine(item)).join('\n'),
            '',
            '【本日の実績】',
            formData.actualItems.map(item => formatScheduleLine(item)).join('\n'),
        ].join('\n');
        setFormData(prev => ({ ...prev, activityContent: template }));
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <>
            <div className="relative">
                {(isLoading || formLoadError) && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8">
                        {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">日報作成</h2>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleDuplicateYesterday}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isDisabled}
                            >
                                昨日の日報から複製
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsChatModalOpen(true)}
                                className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isAIOff || isDisabled}
                            >
                                <Sparkles className="w-5 h-5" />
                                <span>AIチャットで申請</span>
                            </button>
                        </div>
                    </div>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、AIチャットは利用できません。</p>}
                    
                    {formLoadError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">フォーム読み込みエラー</p>
                            <p>{formLoadError}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="reportDate" className={labelClass}>報告日 *</label>
                            <input type="date" id="reportDate" name="reportDate" value={formData.reportDate} onChange={handleChange} className={inputClass} required disabled={isDisabled} autoComplete="on" />
                        </div>
                        <div>
                            <label htmlFor="startTime" className={labelClass}>業務開始</label>
                            <input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} className={inputClass} disabled={isDisabled} autoComplete="on" />
                        </div>
                        <div>
                            <label htmlFor="endTime" className={labelClass}>業務終了</label>
                            <input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} className={inputClass} disabled={isDisabled} autoComplete="on" />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="customerName" className={labelClass}>訪問先・顧客名</label>
                        <input type="text" id="customerName" name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} disabled={isDisabled} placeholder="例: 株式会社〇〇" autoComplete="organization" />
                    </div>

                    <MetricsSection
                        formData={formData}
                        onChange={handleChange}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        isDisabled={isDisabled}
                        onTemplateInsert={handleTemplateInsert}
                    />

                    <ScheduleSection
                        title="本日の計画"
                        items={formData.planItems}
                        onChange={(id, field, value) => handleScheduleChange('planItems', id, field, value)}
                        onAddRow={() => handleAddScheduleRow('planItems')}
                        onRemoveRow={(id) => handleRemoveScheduleRow('planItems', id)}
                        labelClass={labelClass}
                        inputClass={inputClass}
                        isDisabled={isDisabled}
                    />

                    <ScheduleSection
                        title="本日の実績"
                        items={formData.actualItems}
                        onChange={(id, field, value) => handleScheduleChange('actualItems', id, field, value)}
                        onAddRow={() => handleAddScheduleRow('actualItems')}
                        onRemoveRow={(id) => handleRemoveScheduleRow('actualItems', id)}
                        labelClass={labelClass}
                        inputClass={inputClass}
                        isDisabled={isDisabled}
                    />

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="activityContent" className={labelClass}>活動内容 *</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleOcrUpload}
                                        disabled={isOcrLoading || isDisabled || isAIOff}
                                    />
                                    {isOcrLoading ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <span className="text-xs border border-blue-500 rounded px-2 py-0.5">画像から読み取り</span>
                                    )}
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGenerateSummary}
                                    disabled={isSummaryLoading || isDisabled || isAIOff}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSummaryLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    AIで下書きを作成
                                </button>
                            </div>
                        </div>
                        <textarea id="activityContent" name="activityContent" rows={8} value={formData.activityContent} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="本日の業務内容、進捗、課題などを具体的に記述してください。または、キーワードを入力してAIに下書き作成を依頼してください。" autoComplete="on" />
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 mt-1">AI機能無効のため、AI下書き作成は利用できません。</p>}
                    </div>
                    
                    <div>
                        <label htmlFor="nextDayPlan" className={labelClass}>翌日予定</label>
                        <textarea id="nextDayPlan" name="nextDayPlan" rows={3} value={formData.nextDayPlan} onChange={handleChange} className={inputClass} disabled={isDisabled} placeholder="明日のタスクやアポイントなどを記述してください。" autoComplete="on" />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>コメント・共有事項</label>
                            <button
                                type="button"
                                onClick={handleAddComment}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                                disabled={isDisabled}
                            >
                                <PlusCircle className="w-4 h-4" />
                                コメントを追加
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.comments.map((comment, index) => (
                                <textarea
                                    key={`comment-${index}`}
                                    value={comment}
                                    onChange={(e) => handleCommentChange(index, e.target.value)}
                                    className={inputClass}
                                    rows={2}
                                    placeholder="例: 金融財政事情研究会 大島様『カレンダーを75部お願いします』"
                                    disabled={isDisabled}
                                />
                            ))}
                        </div>
                    </div>

                    <ReportPreview templateText={templateText} onCopy={handleCopyTemplate} />

                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} />

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                            disabled={isDisabled}
                            onClick={handleSaveDraft}
                        >
                            下書き保存
                        </button>
                        <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled}>
                            {isSubmitting ? <Loader className="w-5 h-5 animate-spin"/> : '報告を提出する'}
                        </button>
                    </div>
                </form>
                {ConfirmationDialog}
            </div>
            {isChatModalOpen && (
                <ChatApplicationModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    onSuccess={() => {
                        setIsChatModalOpen(false);
                        onSuccess();
                    }}
                    currentUser={currentUser}
                    initialMessage="日報を提出したいです。"
                    isAIOff={isAIOff}
                />
            )}
        </>
    );
};

export default DailyReportForm;

const formatScheduleLine = (item: ScheduleItem) => {
    const start = item.start || '--:--';
    const end = item.end || '--:--';
    return `${start}～${end}　${item.description || ''}`.trim();
};

const buildReportTemplate = (data: DailyReportData) => {
    const date = new Date(data.reportDate);
    const dateLabel = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
    const planLines = data.planItems.map(formatScheduleLine).join('\n');
    const actualLines = data.actualItems.map(formatScheduleLine).join('\n');
    const comments = data.comments.filter((comment) => comment.trim().length > 0).map((comment) => `・${comment}`).join('\n') || '・';

    return [
        `${dateLabel} の業務報告`,
        `PQ目標${data.pqGoal}　今期現在${data.pqCurrent || '－'}　前年${data.pqLastYear || '－'}`,
        `MQ目標${data.mqGoal}　今期現在${data.mqCurrent || '－'}　前年${data.mqLastYear || '－'}`,
        '',
        '【本日の計画】',
        planLines || '（未入力）',
        '',
        '【本日の実績】',
        actualLines || '（未入力）',
        '',
        '【訪問先・対応】',
        data.customerName || '（未入力）',
        '',
        '【明日の予定】',
        data.nextDayPlan || '（未入力）',
        '',
        '【共有事項】',
        comments,
    ].join('\n');
};

const MetricsSection: React.FC<{
    formData: DailyReportData;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    inputClass: string;
    labelClass: string;
    isDisabled: boolean;
    onTemplateInsert: () => void;
}> = ({ formData, onChange, inputClass, labelClass, isDisabled, onTemplateInsert }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">PQ / MQ 目標進捗</p>
            <button
                type="button"
                onClick={onTemplateInsert}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                disabled={isDisabled}
            >
                テンプレートを貼り付け
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className={labelClass}>PQ目標</label>
                <input name="pqGoal" value={formData.pqGoal} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
            <div>
                <label className={labelClass}>PQ 今期</label>
                <input name="pqCurrent" value={formData.pqCurrent} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
            <div>
                <label className={labelClass}>PQ 前年</label>
                <input name="pqLastYear" value={formData.pqLastYear} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
            <div>
                <label className={labelClass}>MQ目標</label>
                <input name="mqGoal" value={formData.mqGoal} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
            <div>
                <label className={labelClass}>MQ 今期</label>
                <input name="mqCurrent" value={formData.mqCurrent} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
            <div>
                <label className={labelClass}>MQ 前年</label>
                <input name="mqLastYear" value={formData.mqLastYear} onChange={onChange} className={inputClass} disabled={isDisabled} />
            </div>
        </div>
    </div>
);

const ScheduleSection: React.FC<{
    title: string;
    items: ScheduleItem[];
    onChange: (id: string, field: keyof ScheduleItem, value: string) => void;
    onAddRow: () => void;
    onRemoveRow: (id: string) => void;
    labelClass: string;
    inputClass: string;
    isDisabled: boolean;
}> = ({ title, items, onChange, onAddRow, onRemoveRow, labelClass, inputClass, isDisabled }) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <label className={labelClass}>{title}</label>
            <button
                type="button"
                onClick={onAddRow}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                disabled={isDisabled}
            >
                <PlusCircle className="w-4 h-4" />
                行を追加
            </button>
        </div>
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <input
                        type="time"
                        value={item.start}
                        onChange={(e) => onChange(item.id, 'start', e.target.value)}
                        className={`md:col-span-2 ${inputClass}`}
                        disabled={isDisabled}
                    />
                    <input
                        type="time"
                        value={item.end}
                        onChange={(e) => onChange(item.id, 'end', e.target.value)}
                        className={`md:col-span-2 ${inputClass}`}
                        disabled={isDisabled}
                    />
                    <input
                        type="text"
                        value={item.description}
                        onChange={(e) => onChange(item.id, 'description', e.target.value)}
                        className={`md:col-span-7 ${inputClass}`}
                        placeholder="業務内容、訪問先、移動など"
                        disabled={isDisabled}
                    />
                    <div className="md:col-span-1 flex justify-end">
                        <button
                            type="button"
                            onClick={() => onRemoveRow(item.id)}
                            className="px-3 py-2 text-sm text-slate-500 hover:text-rose-600 disabled:opacity-50"
                            disabled={isDisabled || items.length === 1}
                        >
                            削除
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const ReportPreview: React.FC<{ templateText: string; onCopy: () => void }> = ({ templateText, onCopy }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">メール・チャット用フォーマット</p>
            <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
                <Copy className="w-4 h-4" />
                クリップボードにコピー
            </button>
        </div>
        <textarea
            className="w-full h-48 bg-slate-900 text-slate-100 rounded-2xl p-4 text-sm font-mono"
            readOnly
            value={templateText}
        />
    </div>
);

const addDays = (isoDate: string, offset: number) => {
    const base = new Date(isoDate);
    base.setDate(base.getDate() + offset);
    return base.toISOString().split('T')[0];
};
