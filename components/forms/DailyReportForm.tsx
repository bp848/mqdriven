import React, { useState, useEffect, useMemo, useRef } from 'react';
import { submitApplication, getCalendarEvents } from '../../services/dataService';
import { generateDailyReportSummary, extractDailyReportFromImage } from '../../services/geminiService';
import ApprovalRouteSelector from './ApprovalRouteSelector';
import { Loader, Sparkles, PlusCircle, Copy } from '../Icons';
import {
    User,
    Toast,
    ApplicationWithDetails,
    DailyReportData,
    DailyReportPlanItem,
    DailyReportActualItem,
    DailyRoutine,
    DailyRoutineSelection,
    DailyReportPrefill,
    Customer,
    CalendarEvent,
} from '../../types';
import ChatApplicationModal from '../ChatApplicationModal';
import { useSubmitWithConfirmation } from '../../hooks/useSubmitWithConfirmation';
import { attachResubmissionMeta, buildResubmissionMeta } from '../../utils/applicationResubmission';

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
    customers?: Customer[];
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
    customers = [],
}) => {
    const createId = (prefix: string) =>
        `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const createPlanItem = (item?: Partial<DailyReportPlanItem>): DailyReportPlanItem => ({
        id: item?.id || createId('plan'),
        start: item?.start || '',
        end: item?.end || '',
        customerName: item?.customerName || '',
        action: item?.action || '',
        purpose: item?.purpose || '',
    });

    const createActualFromPlan = (
        plan: DailyReportPlanItem,
        existing?: Partial<DailyReportActualItem>
    ): DailyReportActualItem => ({
        id: plan.id,
        start: plan.start,
        end: plan.end,
        customerName: plan.customerName,
        action: plan.action,
        purpose: plan.purpose,
        result: existing?.result || '',
        variance: (existing?.variance as DailyReportActualItem['variance']) || 'as_planned',
        achievement: (existing?.achievement as DailyReportActualItem['achievement']) || 'achieved',
    });

    const syncActualItems = (
        planItems: DailyReportPlanItem[],
        existingActuals: DailyReportActualItem[]
    ): DailyReportActualItem[] => {
        const actualMap = new Map(existingActuals.map(item => [item.id, item]));
        return planItems.map(plan => createActualFromPlan(plan, actualMap.get(plan.id)));
    };

    const DEFAULT_GOALS = { pqGoal: '22.5', mqGoal: '13.5' };

    const [goalSettings, setGoalSettings] = useState<{ pqGoal: string; mqGoal: string }>(DEFAULT_GOALS);
    const [routines, setRoutines] = useState<DailyRoutine[]>([]);
    const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
    const [goalDraft, setGoalDraft] = useState<{ pqGoal: string; mqGoal: string }>(DEFAULT_GOALS);
    const [routineEditOpen, setRoutineEditOpen] = useState(false);

    const initialPlanItems = [createPlanItem()];
    const [formData, setFormData] = useState<DailyReportData>({
        reportDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '18:00',
        activityContent: '',
        pqGoal: DEFAULT_GOALS.pqGoal,
        pqCurrent: '',
        pqLastYear: '',
        mqGoal: DEFAULT_GOALS.mqGoal,
        mqCurrent: '',
        mqLastYear: '',
        planItems: initialPlanItems,
        actualItems: syncActualItems(initialPlanItems, []),
        routineSelections: [],
        nextDayAdhoc: '',
        nextDayPlan: '',
    });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isNextDayLoading, setIsNextDayLoading] = useState(false);
    const [error, setError] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [savedReports, setSavedReports] = useState<Record<string, DailyReportData>>({});
    const [appliedPrefillId, setAppliedPrefillId] = useState<string | null>(null);
    const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();
    const nextDayAutofillRef = useRef<string | null>(null);
    
    const isDisabled = isSubmitting || isSavingDraft || isLoading || !!formLoadError;
    const reportsStorageKey = useMemo(() => `mqdriven_daily_reports_${currentUser?.id ?? 'guest'}`, [currentUser?.id]);
    const goalStorageKey = useMemo(() => `mqdriven_daily_report_goals_${currentUser?.id ?? 'guest'}`, [currentUser?.id]);
    const routineStorageKey = useMemo(() => `mqdriven_daily_report_routines_${currentUser?.id ?? 'guest'}`, [currentUser?.id]);
    const templateText = useMemo(() => buildReportTemplate(formData), [formData]);
    const resubmissionMeta = useMemo(() => buildResubmissionMeta(draftApplication), [draftApplication]);
    const customerOptions = useMemo(() => {
        const seen = new Set<string>();
        return customers
            .map(c => (c.customerName || '').trim())
            .filter(name => {
                if (!name) return false;
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
            })
            .sort((a, b) => a.localeCompare(b, 'ja'));
    }, [customers]);

    const coercePlanItems = (items?: any[]): DailyReportPlanItem[] => {
        if (!Array.isArray(items) || items.length === 0) return [createPlanItem()];
        return items.map((item) =>
            createPlanItem({
                id: item?.id,
                start: item?.start,
                end: item?.end,
                customerName: item?.customerName ?? item?.customer ?? item?.clientName ?? '',
                action: item?.action ?? item?.description ?? '',
                purpose: item?.purpose ?? '',
            })
        );
    };

    const coerceActualItems = (
        items: any[] | undefined,
        planItems: DailyReportPlanItem[]
    ): DailyReportActualItem[] => {
        if (!Array.isArray(items) || items.length === 0) {
            return syncActualItems(planItems, []);
        }
        const normalized = items.map((item: any) => ({
            id: item?.id || createId('actual'),
            start: item?.start || '',
            end: item?.end || '',
            customerName: item?.customerName ?? '',
            action: item?.action ?? item?.description ?? '',
            purpose: item?.purpose ?? '',
            result: item?.result ?? item?.actualContent ?? '',
            variance: item?.variance ?? 'as_planned',
            achievement: item?.achievement ?? 'achieved',
        })) as DailyReportActualItem[];
        return syncActualItems(planItems, normalized);
    };

    const persistSavedReports = (next: Record<string, DailyReportData>) => {
        setSavedReports(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(reportsStorageKey, JSON.stringify(next));
        }
    };

    const persistRoutines = (next: DailyRoutine[]) => {
        setRoutines(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(routineStorageKey, JSON.stringify(next));
        }
    };

    const applyNextDayPlan = (
        selections: DailyRoutineSelection[],
        adhoc: string,
        routineSource: DailyRoutine[]
    ) => {
        const nextDayPlan = buildNextDayPlanText(selections, routineSource, adhoc);
        setFormData(prev => ({
            ...prev,
            routineSelections: selections,
            nextDayAdhoc: adhoc,
            nextDayPlan,
        }));
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
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(goalStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as { pqGoal?: string; mqGoal?: string };
                const nextGoals = {
                    pqGoal: parsed?.pqGoal || DEFAULT_GOALS.pqGoal,
                    mqGoal: parsed?.mqGoal || DEFAULT_GOALS.mqGoal,
                };
                setGoalSettings(nextGoals);
                setGoalDraft(nextGoals);
                setFormData(prev => ({
                    ...prev,
                    pqGoal: nextGoals.pqGoal,
                    mqGoal: nextGoals.mqGoal,
                }));
            }
        } catch {
            setGoalSettings(DEFAULT_GOALS);
            setGoalDraft(DEFAULT_GOALS);
        }
    }, [goalStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(routineStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as DailyRoutine[];
            if (Array.isArray(parsed)) {
                setRoutines(parsed);
            }
        } catch {
            setRoutines([]);
        }
    }, [routineStorageKey]);

    useEffect(() => {
        if (!draftApplication || draftApplication.applicationCodeId !== applicationCodeId) return;
        const data = draftApplication.formData || {};
        const planItems = coercePlanItems(data.planItems);
        const actualItems = coerceActualItems(data.actualItems, planItems);
        const routineSelections = Array.isArray(data.routineSelections) ? data.routineSelections : [];
        const nextDayAdhoc = data.nextDayAdhoc || '';
        const nextDayPlan = data.nextDayPlan || buildNextDayPlanText(routineSelections, routines, nextDayAdhoc);
        setFormData({
            reportDate: data.reportDate || new Date().toISOString().split('T')[0],
            startTime: data.startTime || '09:00',
            endTime: data.endTime || '18:00',
            activityContent: data.activityContent || '',
            pqGoal: goalSettings.pqGoal,
            pqCurrent: data.pqCurrent || '',
            pqLastYear: data.pqLastYear || '',
            mqGoal: goalSettings.mqGoal,
            mqCurrent: data.mqCurrent || '',
            mqLastYear: data.mqLastYear || '',
            planItems,
            actualItems,
            routineSelections,
            nextDayAdhoc,
            nextDayPlan,
        });
        setApprovalRouteId(draftApplication.approvalRouteId || '');
    }, [draftApplication, applicationCodeId, goalSettings, routines]);
    
    useEffect(() => {
        if (!prefill || appliedPrefillId === prefill.id) return;
        const { id, ...prefillContent } = prefill;
        setFormData(prev => {
            const planItems = prefill.planItems ? coercePlanItems(prefill.planItems) : prev.planItems || [createPlanItem()];
            const actualItems = prefill.actualItems
                ? coerceActualItems(prefill.actualItems, planItems)
                : syncActualItems(planItems, (prev.actualItems || []) as DailyReportActualItem[]);
            const routineSelections = Array.isArray(prefill.routineSelections)
                ? prefill.routineSelections
                : prev.routineSelections || [];
            const nextDayAdhoc = prefill.nextDayAdhoc ?? prev.nextDayAdhoc ?? '';
            const nextDayPlan = prefill.nextDayPlan || buildNextDayPlanText(routineSelections, routines, nextDayAdhoc);
            return {
                ...prev,
                ...prefillContent,
                pqGoal: goalSettings.pqGoal,
                mqGoal: goalSettings.mqGoal,
                planItems,
                actualItems,
                routineSelections,
                nextDayAdhoc,
                nextDayPlan,
            };
        });
        setAppliedPrefillId(prefill.id);
        onPrefillApplied?.();
    }, [prefill, appliedPrefillId, onPrefillApplied, goalSettings, routines]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateSummary = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        const planItems = (formData.planItems || []) as DailyReportPlanItem[];
        const actualItems = (formData.actualItems || []) as DailyReportActualItem[];
        const seedText = buildDailyReportSeed(planItems, actualItems);
        const customerSummary = buildCustomerSummary(planItems);
        if (!seedText && !formData.activityContent) {
            addToast('AIが下書きを作成するために、計画/実績または考察のキーワードを入力してください。', 'info');
            return;
        }
        setIsSummaryLoading(true);
        try {
            const summary = await generateDailyReportSummary(customerSummary, seedText || formData.activityContent || '');
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
        formData: attachResubmissionMeta(formData, resubmissionMeta),
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
            addToast('昨日の日報が見つかりません。', 'error');
            return;
        }
        const planItems = coercePlanItems(previous.planItems);
        const actualItems = coerceActualItems(previous.actualItems, planItems);
        const routineSelections = Array.isArray(previous.routineSelections) ? previous.routineSelections : [];
        const nextDayAdhoc = previous.nextDayAdhoc || '';
        const nextDayPlan = previous.nextDayPlan || buildNextDayPlanText(routineSelections, routines, nextDayAdhoc);
        setFormData({
            ...previous,
            reportDate: formData.reportDate,
            pqGoal: goalSettings.pqGoal,
            mqGoal: goalSettings.mqGoal,
            planItems,
            actualItems,
            routineSelections,
            nextDayAdhoc,
            nextDayPlan,
        });
        addToast('昨日の日報を複製しました。', 'info');
    };

    const handleCopyTemplate = async () => {
        try {
            await navigator.clipboard.writeText(templateText);
            addToast('フォーマットをコピーしました。', 'success');
        } catch {
            addToast('クリップボードへのコピーに失敗しました。', 'error');
        }
    };

    const updatePlanItems = (updater: (items: DailyReportPlanItem[]) => DailyReportPlanItem[]) => {
        setFormData(prev => {
            const currentPlan = Array.isArray(prev.planItems) ? prev.planItems : [];
            const nextPlan = updater(currentPlan);
            const nextActual = syncActualItems(
                nextPlan,
                (prev.actualItems || []) as DailyReportActualItem[]
            );
            return { ...prev, planItems: nextPlan, actualItems: nextActual };
        });
    };

    const handlePlanFieldChange = (id: string, field: keyof DailyReportPlanItem, value: string) => {
        updatePlanItems(items =>
            items.map(item => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const handleAddPlanRow = () => {
        updatePlanItems(items => [...items, createPlanItem()]);
    };

    const handleRemovePlanRow = (id: string) => {
        updatePlanItems(items => {
            if (items.length === 1) return items;
            return items.filter(item => item.id !== id);
        });
    };

    const handleActualFieldChange = (
        id: string,
        field: keyof Pick<DailyReportActualItem, 'result' | 'variance' | 'achievement'>,
        value: string
    ) => {
        setFormData(prev => ({
            ...prev,
            actualItems: (prev.actualItems || []).map(item =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        }));
    };

    const handleGoalSave = () => {
        const nextGoals = {
            pqGoal: goalDraft.pqGoal.trim() || DEFAULT_GOALS.pqGoal,
            mqGoal: goalDraft.mqGoal.trim() || DEFAULT_GOALS.mqGoal,
        };
        setGoalSettings(nextGoals);
        setFormData(prev => ({ ...prev, pqGoal: nextGoals.pqGoal, mqGoal: nextGoals.mqGoal }));
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(goalStorageKey, JSON.stringify(nextGoals));
        }
        setIsGoalEditorOpen(false);
    };

    const handleAddRoutine = () => {
        const next = [
            ...routines,
            { id: createId('routine'), name: '', timeRange: '', purpose: '' },
        ];
        persistRoutines(next);
        setRoutineEditOpen(true);
    };

    const handleRoutineChange = (
        id: string,
        field: keyof DailyRoutine,
        value: string
    ) => {
        const next = routines.map(item => (item.id === id ? { ...item, [field]: value } : item));
        persistRoutines(next);
    };

    const handleRoutineDelete = (id: string) => {
        const next = routines.filter(item => item.id !== id);
        persistRoutines(next);
        const nextSelections = (formData.routineSelections || []).filter(sel => sel.routineId !== id);
        applyNextDayPlan(nextSelections, formData.nextDayAdhoc || '', next);
    };

    const handleRoutineToggle = (routine: DailyRoutine) => {
        const selections = formData.routineSelections || [];
        const existing = selections.find(sel => sel.routineId === routine.id);
        const nextSelections = existing
            ? selections.filter(sel => sel.routineId !== routine.id)
            : [
                ...selections,
                {
                    id: createId('routine_sel'),
                    routineId: routine.id,
                    timeRange: routine.timeRange || '',
                    purpose: routine.purpose || '',
                },
            ];
        applyNextDayPlan(nextSelections, formData.nextDayAdhoc || '', routines);
    };

    const handleRoutineSelectionChange = (
        id: string,
        field: keyof DailyRoutineSelection,
        value: string
    ) => {
        const selections = (formData.routineSelections || []).map(sel =>
            sel.id === id ? { ...sel, [field]: value } : sel
        );
        applyNextDayPlan(selections, formData.nextDayAdhoc || '', routines);
    };

    const handleNextDayAdhocChange = (value: string) => {
        applyNextDayPlan(formData.routineSelections || [], value, routines);
    };

    const handleTemplateInsert = () => {
        const template = [
            '【数値】',
            `PQ目標${formData.pqGoal}　今期現在${formData.pqCurrent || '__'}　前年${formData.pqLastYear || '__'}`,
            `MQ目標${formData.mqGoal}　今期現在${formData.mqCurrent || '__'}　前年${formData.mqLastYear || '__'}`,
            '',
            '【お客様の声】',
            '',
            '【ライバル情報】',
            '',
            '【同業情報】',
            '',
            '【自分の考え】',
        ].join('\n');
        setFormData(prev => ({ ...prev, activityContent: template }));
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
    const hasCustomerVisit = useMemo(
        () => (formData.planItems || []).some(item => (item.customerName || '').trim()),
        [formData.planItems],
    );

    useEffect(() => {
        if (!currentUser?.id) return;
        if (!formData.reportDate) return;
        const nextDayKey = addDays(formData.reportDate, 1);
        const hasInput =
            (formData.routineSelections?.length ?? 0) > 0 ||
            !!formData.nextDayAdhoc?.trim() ||
            !!formData.nextDayPlan?.trim();
        if (hasInput) return;
        if (nextDayAutofillRef.current === nextDayKey) return;
        let isActive = true;
        setIsNextDayLoading(true);
        getCalendarEvents(currentUser.id)
            .then((events) => {
                if (!isActive) return;
                nextDayAutofillRef.current = nextDayKey;
                const lines = buildNextDayPlanFromCalendar(events, nextDayKey);
                if (lines.length === 0) return;
                applyNextDayPlan(formData.routineSelections || [], lines.join('\n'), routines);
            })
            .catch(() => {
                nextDayAutofillRef.current = nextDayKey;
            })
            .finally(() => {
                if (isActive) setIsNextDayLoading(false);
            });
        return () => {
            isActive = false;
        };
    }, [
        currentUser?.id,
        formData.reportDate,
        formData.routineSelections,
        formData.nextDayAdhoc,
        formData.nextDayPlan,
        routines,
    ]);

    return (
        <>
            <div className="relative">
                {(isLoading || formLoadError) && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8">
                        {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-2xl shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div className="flex flex-wrap gap-3 sm:ml-auto">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
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
                    
                    <MetricsSection
                        formData={formData}
                        goalSettings={goalSettings}
                        onChange={handleChange}
                        inputClass={inputClass}
                        labelClass={labelClass}
                        isDisabled={isDisabled}
                        onTemplateInsert={handleTemplateInsert}
                        onOpenGoalEditor={() => {
                            setGoalDraft(goalSettings);
                            setIsGoalEditorOpen(true);
                        }}
                    />

                    {isGoalEditorOpen && (
                        <GoalEditor
                            goalDraft={goalDraft}
                            onChange={(field, value) => setGoalDraft(prev => ({ ...prev, [field]: value }))}
                            onSave={handleGoalSave}
                            onCancel={() => setIsGoalEditorOpen(false)}
                            inputClass={inputClass}
                            labelClass={labelClass}
                        />
                    )}

                    <PlanSection
                        title="本日の計画"
                        items={(formData.planItems || []) as DailyReportPlanItem[]}
                        customerOptions={customerOptions}
                        onChange={handlePlanFieldChange}
                        onAddRow={handleAddPlanRow}
                        onRemoveRow={handleRemovePlanRow}
                        labelClass={labelClass}
                        inputClass={inputClass}
                        isDisabled={isDisabled}
                    />

                    <ActualSection
                        title="本日の実績（計画連動）"
                        items={(formData.actualItems || []) as DailyReportActualItem[]}
                        onChange={handleActualFieldChange}
                        labelClass={labelClass}
                        inputClass={inputClass}
                        isDisabled={isDisabled}
                    />

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="activityContent" className={labelClass}>実績サマリー・考察 *</label>
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
                        {hasCustomerVisit && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">顧客訪問がある場合は「お客様の声」「ライバル情報」「同業情報」「自分の考え」を明記してください。</p>
                        )}
                        <textarea id="activityContent" name="activityContent" rows={8} value={formData.activityContent} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="数値の進捗、お客様の声、ライバル情報、同業情報、自分の考えを記載してください。" autoComplete="on" />
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 mt-1">AI機能無効のため、AI下書き作成は利用できません。</p>}
                    </div>
                    
                    <RoutineSection
                        routines={routines}
                        selections={formData.routineSelections || []}
                        adhoc={formData.nextDayAdhoc || ''}
                        nextDayPlan={formData.nextDayPlan || ''}
                        onToggleRoutine={handleRoutineToggle}
                        onSelectionChange={handleRoutineSelectionChange}
                        onAdhocChange={handleNextDayAdhocChange}
                        onAddRoutine={handleAddRoutine}
                        onRoutineChange={handleRoutineChange}
                        onRoutineDelete={handleRoutineDelete}
                        labelClass={labelClass}
                        inputClass={inputClass}
                        isDisabled={isDisabled}
                        isEditing={routineEditOpen}
                        onToggleEdit={() => setRoutineEditOpen(prev => !prev)}
                        autoHint={isNextDayLoading ? '翌日の予定をカレンダーから取得中...' : undefined}
                    />
                    <ReportPreview templateText={templateText} onCopy={handleCopyTemplate} />

                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} />

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 w-full sm:w-auto"
                            disabled={isDisabled}
                            onClick={handleSaveDraft}
                        >
                            下書き保存
                        </button>
                        <button type="submit" className="w-full sm:w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled}>
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

const buildCustomerSummary = (planItems: DailyReportPlanItem[]) => {
    const names = Array.from(
        new Set(
            planItems
                .map(item => (item.customerName || '').trim())
                .filter(Boolean)
        )
    );
    return names.length ? names.join(' / ') : '（未入力）';
};

const formatPlanLine = (item: DailyReportPlanItem) => {
    const start = item.start || '--:--';
    const end = item.end || '--:--';
    const customer = item.customerName ? ` / ${item.customerName}` : '';
    const purpose = item.purpose ? `（目的: ${item.purpose}）` : '';
    const action = item.action || '（未入力）';
    return `${start}～${end}${customer}　${action}${purpose}`.trim();
};

const formatActualLine = (item: DailyReportActualItem) => {
    const start = item.start || '--:--';
    const end = item.end || '--:--';
    const customer = item.customerName ? ` / ${item.customerName}` : '';
    const result = item.result || '（未入力）';
    const varianceLabel = item.variance === 'changed' ? '変更あり' : '予定通り';
    const achievementLabel =
        item.achievement === 'missed'
            ? '未達'
            : item.achievement === 'partial'
                ? '一部未達'
                : '達成';
    return `${start}～${end}${customer}　実績: ${result} / 差異: ${varianceLabel} / 達成: ${achievementLabel}`;
};

const buildDailyReportSeed = (
    planItems: DailyReportPlanItem[],
    actualItems: DailyReportActualItem[]
) => {
    const planLines = planItems.map(formatPlanLine).filter(Boolean).join('\n');
    const actualLines = actualItems.map(formatActualLine).filter(Boolean).join('\n');
    const parts = [];
    if (planLines) parts.push(`計画:\n${planLines}`);
    if (actualLines) parts.push(`実績:\n${actualLines}`);
    return parts.join('\n');
};

const buildPlanActualLines = (
    planItems: DailyReportPlanItem[],
    actualItems: DailyReportActualItem[]
) => {
    const actualMap = new Map(actualItems.map(item => [item.id, item]));
    return planItems
        .map(plan => {
            const actual = actualMap.get(plan.id);
            const varianceLabel = actual?.variance === 'changed' ? '変更あり' : '予定通り';
            const achievementLabel =
                actual?.achievement === 'missed'
                    ? '未達'
                    : actual?.achievement === 'partial'
                        ? '一部未達'
                        : '達成';
            const result = actual?.result || '（未入力）';
            return `${formatPlanLine(plan)}\n  実績: ${result} / 差異: ${varianceLabel} / 達成: ${achievementLabel}`;
        })
        .join('\n');
};

const buildNextDayPlanText = (
    selections: DailyRoutineSelection[],
    routines: DailyRoutine[],
    adhoc: string
) => {
    const routineMap = new Map(routines.map(routine => [routine.id, routine]));
    const routineLines = selections.map(selection => {
        const routine = routineMap.get(selection.routineId);
        const name = routine?.name || 'ルーティーン';
        const time = selection.timeRange || routine?.timeRange || '';
        const purpose = selection.purpose || routine?.purpose || '';
        const note = selection.note || '';
        const details = [time && `時間:${time}`, purpose && `目的:${purpose}`].filter(Boolean).join(' / ');
        const suffix = [details, note].filter(Boolean).join(' / ');
        return suffix ? `${name}（${suffix}）` : name;
    });
    const adhocText = adhoc.trim();
    const lines = [...routineLines];
    if (adhocText) {
        lines.push(adhocText);
    }
    return lines.join('\n');
};

const buildReportTemplate = (data: DailyReportData) => {
    const date = data.reportDate ? new Date(data.reportDate) : new Date();
    const dateLabel = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
    const planItems = (data.planItems || []) as DailyReportPlanItem[];
    const actualItems = (data.actualItems || []) as DailyReportActualItem[];
    const planActualLines = buildPlanActualLines(planItems, actualItems);
    const summary = (data.activityContent || '').trim() || '（未入力）';
    const nextDay = (data.nextDayPlan || '').trim() || '（未入力）';
    const start = data.startTime || '--:--';
    const end = data.endTime || '--:--';

    return [
        `${dateLabel} の日報`,
        `業務時間: ${start}～${end}`,
        `PQ目標${data.pqGoal || '－'}　今期現在${data.pqCurrent || '－'}　前年${data.pqLastYear || '－'}`,
        `MQ目標${data.mqGoal || '－'}　今期現在${data.mqCurrent || '－'}　前年${data.mqLastYear || '－'}`,
        '',
        '【本日の計画 vs 実績】',
        planActualLines || '（未入力）',
        '',
        '【実績サマリー・考察】',
        summary,
        '',
        '【翌日予定】',
        nextDay,
    ].join('\n');
};

const MetricsSection: React.FC<{
    formData: DailyReportData;
    goalSettings: { pqGoal: string; mqGoal: string };
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    inputClass: string;
    labelClass: string;
    isDisabled: boolean;
    onTemplateInsert: () => void;
    onOpenGoalEditor: () => void;
}> = ({ formData, goalSettings, onChange, inputClass, labelClass, isDisabled, onTemplateInsert, onOpenGoalEditor }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">PQ / MQ 目標進捗</p>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenGoalEditor}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
                    disabled={isDisabled}
                >
                    目標設定
                </button>
                <button
                    type="button"
                    onClick={onTemplateInsert}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    disabled={isDisabled}
                >
                    テンプレートを貼り付け
                </button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className={labelClass}>PQ目標</label>
                <input name="pqGoal" value={goalSettings.pqGoal} readOnly className={inputClass} disabled />
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
                <input name="mqGoal" value={goalSettings.mqGoal} readOnly className={inputClass} disabled />
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

const GoalEditor: React.FC<{
    goalDraft: { pqGoal: string; mqGoal: string };
    onChange: (field: 'pqGoal' | 'mqGoal', value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    inputClass: string;
    labelClass: string;
}> = ({ goalDraft, onChange, onSave, onCancel, inputClass, labelClass }) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">PQ / MQ 目標（個人設定）</p>
            <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700">
                閉じる
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>PQ目標</label>
                <input value={goalDraft.pqGoal} onChange={(e) => onChange('pqGoal', e.target.value)} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>MQ目標</label>
                <input value={goalDraft.mqGoal} onChange={(e) => onChange('mqGoal', e.target.value)} className={inputClass} />
            </div>
        </div>
        <div className="flex justify-end">
            <button type="button" onClick={onSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                保存
            </button>
        </div>
    </div>
);

const PlanSection: React.FC<{
    title: string;
    items: DailyReportPlanItem[];
    customerOptions: string[];
    onChange: (id: string, field: keyof DailyReportPlanItem, value: string) => void;
    onAddRow: () => void;
    onRemoveRow: (id: string) => void;
    labelClass: string;
    inputClass: string;
    isDisabled: boolean;
}> = ({ title, items, customerOptions, onChange, onAddRow, onRemoveRow, labelClass, inputClass, isDisabled }) => (
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
        {customerOptions.length > 0 && (
            <datalist id="daily-report-plan-customers">
                {customerOptions.map(name => (
                    <option key={name} value={name} />
                ))}
            </datalist>
        )}
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
                        value={item.customerName}
                        onChange={(e) => onChange(item.id, 'customerName', e.target.value)}
                        className={`md:col-span-3 ${inputClass}`}
                        placeholder="訪問先・顧客名"
                        disabled={isDisabled}
                        list={customerOptions.length ? 'daily-report-plan-customers' : undefined}
                    />
                    <input
                        type="text"
                        value={item.action}
                        onChange={(e) => onChange(item.id, 'action', e.target.value)}
                        className={`md:col-span-3 ${inputClass}`}
                        placeholder="行動内容"
                        disabled={isDisabled}
                    />
                    <input
                        type="text"
                        value={item.purpose}
                        onChange={(e) => onChange(item.id, 'purpose', e.target.value)}
                        className={`md:col-span-2 ${inputClass}`}
                        placeholder="目的・狙い"
                        disabled={isDisabled}
                    />
                    <div className="md:col-span-12 flex justify-end">
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

const ActualSection: React.FC<{
    title: string;
    items: DailyReportActualItem[];
    onChange: (
        id: string,
        field: keyof Pick<DailyReportActualItem, 'result' | 'variance' | 'achievement'>,
        value: string
    ) => void;
    labelClass: string;
    inputClass: string;
    isDisabled: boolean;
}> = ({ title, items, onChange, labelClass, inputClass, isDisabled }) => (
    <div className="space-y-3">
        <label className={labelClass}>{title}</label>
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <input
                        type="time"
                        value={item.start}
                        readOnly
                        className={`md:col-span-2 ${inputClass}`}
                        disabled
                    />
                    <input
                        type="time"
                        value={item.end}
                        readOnly
                        className={`md:col-span-2 ${inputClass}`}
                        disabled
                    />
                    <input
                        type="text"
                        value={item.customerName}
                        readOnly
                        className={`md:col-span-3 ${inputClass}`}
                        disabled
                    />
                    <input
                        type="text"
                        value={item.action}
                        readOnly
                        className={`md:col-span-3 ${inputClass}`}
                        disabled
                    />
                    <input
                        type="text"
                        value={item.purpose}
                        readOnly
                        className={`md:col-span-2 ${inputClass}`}
                        disabled
                    />
                    <input
                        type="text"
                        value={item.result}
                        onChange={(e) => onChange(item.id, 'result', e.target.value)}
                        className={`md:col-span-8 ${inputClass}`}
                        placeholder="実績内容（簡易）"
                        disabled={isDisabled}
                    />
                    <select
                        value={item.variance}
                        onChange={(e) => onChange(item.id, 'variance', e.target.value)}
                        className={`md:col-span-2 ${inputClass}`}
                        disabled={isDisabled}
                    >
                        <option value="as_planned">予定通り</option>
                        <option value="changed">変更あり</option>
                    </select>
                    <select
                        value={item.achievement}
                        onChange={(e) => onChange(item.id, 'achievement', e.target.value)}
                        className={`md:col-span-2 ${inputClass}`}
                        disabled={isDisabled}
                    >
                        <option value="achieved">達成</option>
                        <option value="partial">一部未達</option>
                        <option value="missed">未達</option>
                    </select>
                </div>
            ))}
        </div>
    </div>
);

const RoutineSection: React.FC<{
    routines: DailyRoutine[];
    selections: DailyRoutineSelection[];
    adhoc: string;
    nextDayPlan: string;
    onToggleRoutine: (routine: DailyRoutine) => void;
    onSelectionChange: (id: string, field: keyof DailyRoutineSelection, value: string) => void;
    onAdhocChange: (value: string) => void;
    onAddRoutine: () => void;
    onRoutineChange: (id: string, field: keyof DailyRoutine, value: string) => void;
    onRoutineDelete: (id: string) => void;
    labelClass: string;
    inputClass: string;
    isDisabled: boolean;
    isEditing: boolean;
    onToggleEdit: () => void;
    autoHint?: string;
}> = ({
    routines,
    selections,
    adhoc,
    nextDayPlan,
    onToggleRoutine,
    onSelectionChange,
    onAdhocChange,
    onAddRoutine,
    onRoutineChange,
    onRoutineDelete,
    labelClass,
    inputClass,
    isDisabled,
    isEditing,
    onToggleEdit,
    autoHint,
}) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div>
                <label className={labelClass}>翌日予定（ルーティーン連動）</label>
                {autoHint && <p className="text-xs text-slate-500 mt-1">{autoHint}</p>}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggleEdit}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                    {isEditing ? '管理を閉じる' : 'ルーティーン管理'}
                </button>
                <button
                    type="button"
                    onClick={onAddRoutine}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    disabled={isDisabled}
                >
                    <PlusCircle className="w-4 h-4" />
                    ルーティーン追加
                </button>
            </div>
        </div>

        {routines.length === 0 && (
            <p className="text-sm text-slate-500">ルーティーンを登録すると、翌日予定が選択式になります。</p>
        )}

        <div className="space-y-3">
            {routines.map((routine) => {
                const selection = selections.find(sel => sel.routineId === routine.id);
                return (
                    <div key={routine.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <input
                                type="checkbox"
                                checked={!!selection}
                                onChange={() => onToggleRoutine(routine)}
                                disabled={isDisabled}
                            />
                            {routine.name || '未設定ルーティーン'}
                        </label>
                        {selection && (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                <input
                                    type="text"
                                    value={selection.timeRange || ''}
                                    onChange={(e) => onSelectionChange(selection.id, 'timeRange', e.target.value)}
                                    className={`md:col-span-3 ${inputClass}`}
                                    placeholder="時間帯"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={selection.purpose || ''}
                                    onChange={(e) => onSelectionChange(selection.id, 'purpose', e.target.value)}
                                    className={`md:col-span-6 ${inputClass}`}
                                    placeholder="目的"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={selection.note || ''}
                                    onChange={(e) => onSelectionChange(selection.id, 'note', e.target.value)}
                                    className={`md:col-span-3 ${inputClass}`}
                                    placeholder="微調整メモ"
                                    disabled={isDisabled}
                                />
                            </div>
                        )}
                        {isEditing && (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                <input
                                    type="text"
                                    value={routine.name || ''}
                                    onChange={(e) => onRoutineChange(routine.id, 'name', e.target.value)}
                                    className={`md:col-span-4 ${inputClass}`}
                                    placeholder="業務名"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={routine.timeRange || ''}
                                    onChange={(e) => onRoutineChange(routine.id, 'timeRange', e.target.value)}
                                    className={`md:col-span-3 ${inputClass}`}
                                    placeholder="想定時間帯"
                                    disabled={isDisabled}
                                />
                                <input
                                    type="text"
                                    value={routine.purpose || ''}
                                    onChange={(e) => onRoutineChange(routine.id, 'purpose', e.target.value)}
                                    className={`md:col-span-4 ${inputClass}`}
                                    placeholder="目的"
                                    disabled={isDisabled}
                                />
                                <div className="md:col-span-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => onRoutineDelete(routine.id)}
                                        className="px-3 py-2 text-sm text-rose-600 hover:text-rose-700"
                                        disabled={isDisabled}
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        <div>
            <label className={labelClass}>単発予定</label>
            <textarea
                rows={3}
                value={adhoc}
                onChange={(e) => onAdhocChange(e.target.value)}
                className={inputClass}
                disabled={isDisabled}
                placeholder="単発の予定のみ自由記述してください。"
            />
        </div>

        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs font-semibold text-slate-500 mb-2">自動生成プレビュー</p>
            <pre className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{nextDayPlan || '（未入力）'}</pre>
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

const formatLocalDateKey = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTimePart = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const formatTimeRange = (start?: string | null, end?: string | null, allDay?: boolean) => {
    if (allDay) return '終日';
    const startLabel = formatTimePart(start);
    const endLabel = formatTimePart(end);
    if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel}～${endLabel}`;
    return startLabel || endLabel || '';
};

const buildNextDayPlanFromCalendar = (events: CalendarEvent[], targetDate: string) => {
    return events
        .filter(ev => formatLocalDateKey(ev.startAt) === targetDate)
        .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''))
        .map(ev => {
            const title = (ev.title || '').trim() || '予定';
            const timeLabel = ev.allDay ? '終日' : formatTimeRange(ev.startAt, ev.endAt, ev.allDay);
            const description = (ev.description || '').trim();
            const suffix = description && description !== title ? ` / ${description}` : '';
            return `${timeLabel ? `${timeLabel} ` : ''}${title}${suffix}`.trim();
        })
        .filter(Boolean);
};




