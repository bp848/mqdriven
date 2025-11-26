import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, ArrowRight } from './Icons';
import { extractDailyReportFromImage } from '../services/geminiService';
import {
    ProjectBudgetSummary,
    PurchaseOrder,
    ApplicationWithDetails,
    EmployeeUser,
    Toast,
    DailyReportPrefill,
    ScheduleItem,
} from '../types';

type CalendarEventType = 'job' | 'purchaseOrder' | 'application' | 'custom';

interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    type: CalendarEventType;
    description?: string;
    time?: string;
}

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type ViewMode = 'day' | 'week' | 'month';

const calendarWeekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

const viewModeOptions: { id: ViewMode; label: string }[] = [
    { id: 'day', label: '日別' },
    { id: 'week', label: '週別' },
    { id: 'month', label: '月別' },
];

const dateWithYearRegex = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
const dateWithoutYearRegex = /(\d{1,2})[\/\-](\d{1,2})/g;
const planSectionRegex = /(月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜日).*予定/;
const timeLineRegex = /(\d{1,2}[:：]\d{2})\s*[～〜~\-]\s*(\d{1,2}[:：]\d{2})\s+(.+)/;

const normalizeTimeString = (value: string) => value.replace('：', ':').trim();

const parseDailyReportText = (rawText: string, fallbackDate: string): { date: string; items: ScheduleItem[] } => {
    const trimmedText = rawText.trim();
    if (!trimmedText) {
        return { date: fallbackDate, items: [] };
    }

    const detectIsoDate = () => {
        const withYearMatch = trimmedText.match(dateWithYearRegex);
        if (withYearMatch) {
            const [_, year, month, day] = withYearMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        for (const match of trimmedText.matchAll(dateWithoutYearRegex)) {
            const index = match.index ?? 0;
            const precedingChar = index > 0 ? trimmedText[index - 1] : '';
            if (precedingChar === ':' || precedingChar === '：') {
                continue;
            }
            const [, monthStr, dayStr] = match;
            const month = Number(monthStr);
            const day = Number(dayStr);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                const year = new Date(fallbackDate).getFullYear();
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
        return fallbackDate;
    };

    const timestamp = Date.now();
    const items: ScheduleItem[] = [];
    let isParsingActual = true;
    const lines = trimmedText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    lines.forEach((line) => {
        if (planSectionRegex.test(line)) {
            isParsingActual = false;
            return;
        }
        if (!isParsingActual) {
            return;
        }
        const match = line.match(timeLineRegex);
        if (!match) {
            return;
        }
        const [, rawStart, rawEnd, rawDescription] = match;
        items.push({
            id: `daily-report-${timestamp}-${items.length}`,
            start: normalizeTimeString(rawStart),
            end: normalizeTimeString(rawEnd),
            description: rawDescription.replace(/\s+/g, ' ').trim(),
        });
    });

    return {
        date: detectIsoDate(),
        items,
    };
};

const getWeekStartIso = (iso: string) => {
    const date = new Date(iso);
    const day = date.getDay();
    const offset = (day + 6) % 7; // Monday start
    date.setDate(date.getDate() - offset);
    return formatDate(date);
};

const addMonthsToDate = (iso: string, offset: number) => {
    const date = new Date(iso);
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + offset;
    const day = date.getDate();
    const target = new Date(targetYear, targetMonth, 1);
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    target.setDate(Math.min(day, daysInTargetMonth));
    return formatDate(target);
};

const getWeekDates = (anchorDate: string) => {
    const startOfWeek = getWeekStartIso(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek, index));
};

const buildMonthCalendar = (anchorDate: string) => {
    const baseDate = new Date(anchorDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // Sunday = 0
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - startDay);
    const totalCells = 42;
    return Array.from({ length: totalCells }, (_, index) => {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + index);
        return {
            date: formatDate(current),
            inMonth: current.getMonth() === month,
        };
    });
};

interface MySchedulePageProps {
    jobs: ProjectBudgetSummary[];
    purchaseOrders: PurchaseOrder[];
    applications: ApplicationWithDetails[];
    currentUser: EmployeeUser | null;
    allUsers: EmployeeUser[];
    addToast?: (message: string, type: Toast['type']) => void;
    onCreateDailyReport?: (prefill: DailyReportPrefill) => void;
}

const extractDatePart = (value?: string | null) => {
    if (!value) return null;
    const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const normalized = value.replace(/\//g, '-');
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
        const [y, m, d] = normalized.split('-').map((part) => Number(part));
        if (!y || !m || !d) return null;
        return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
};

const typeLabels: Record<CalendarEventType, string> = {
    job: '案件納期',
    purchaseOrder: '発注スケジュール',
    application: '社内申請',
    custom: 'マイイベント',
};

const badgeStyles: Record<CalendarEventType, string> = {
    job: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    purchaseOrder: 'bg-sky-100 text-sky-800 border border-sky-200',
    application: 'bg-amber-100 text-amber-800 border border-amber-200',
    custom: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
};

const isSameDay = (isoDate: string, other: string) => isoDate === other;

const addDays = (iso: string, days: number) => {
    const base = new Date(iso);
    base.setDate(base.getDate() + days);
    return formatDate(base);
};

const DayView: React.FC<{
    selectedDate: string;
    planEvents: CalendarEvent[];
    actualItems: ScheduleItem[];
    onUpdateActualItems: (items: ScheduleItem[]) => void;
    onDeleteEvent: (id: string) => void;
    canEdit: boolean;
}> = ({ selectedDate, planEvents, actualItems, onUpdateActualItems, onDeleteEvent, canEdit }) => {
    const [newActualItem, setNewActualItem] = useState({ start: '', end: '', description: '' });

    const handleAddActualItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActualItem.description.trim()) return;
        const newItem: ScheduleItem = {
            id: `actual-${Date.now()}`,
            ...newActualItem,
        };
        onUpdateActualItems([...actualItems, newItem]);
        setNewActualItem({ start: '', end: '', description: '' });
    };

    const handleUpdateActualItem = (id: string, updatedField: Partial<Omit<ScheduleItem, 'id'>>) => {
        onUpdateActualItems(
            actualItems.map(item => (item.id === id ? { ...item, ...updatedField } : item)),
        );
    };

    const handleDeleteActualItem = (id: string) => {
        onUpdateActualItems(actualItems.filter(item => item.id !== id));
    };
    
    const inputClass = `w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed`;

    return (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Column */}
            <div className="rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">計画</h3>
                <div className="mt-4 space-y-3">
                    {planEvents.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">この日の予定はありません。</p>}
                    {planEvents.map((event) => (
                        <div key={event.id} className="rounded-xl bg-white dark:bg-slate-800/50 p-3 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{typeLabels[event.type]}</p>
                                </div>
                                {event.time && (
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full">{event.time}</span>
                                )}
                            </div>
                            {event.description && (
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{event.description}</p>
                            )}
                            {event.type === 'custom' && canEdit && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteEvent(event.id)}
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    削除
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actual Column */}
            <div className="rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">実績</h3>
                <div className="mt-4 space-y-2">
                    {actualItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group bg-white dark:bg-slate-800/50 p-2 rounded-lg">
                            <input type="time" value={item.start} onChange={e => handleUpdateActualItem(item.id, { start: e.target.value })} className={`${inputClass} w-24`} disabled={!canEdit} />
                            <span className="text-slate-400">～</span>
                            <input type="time" value={item.end} onChange={e => handleUpdateActualItem(item.id, { end: e.target.value })} className={`${inputClass} w-24`} disabled={!canEdit} />
                            <input type="text" value={item.description} onChange={e => handleUpdateActualItem(item.id, { description: e.target.value })} className={`${inputClass} flex-grow`} disabled={!canEdit} />
                            {canEdit && <button type="button" onClick={() => handleDeleteActualItem(item.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                    ))}
                </div>
                {canEdit && (
                    <form onSubmit={handleAddActualItem} className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center gap-2">
                        <input type="time" value={newActualItem.start} onChange={e => setNewActualItem({...newActualItem, start: e.target.value})} className={`${inputClass} w-24`} />
                        <span className="text-slate-400">～</span>
                        <input type="time" value={newActualItem.end} onChange={e => setNewActualItem({...newActualItem, end: e.target.value})} className={`${inputClass} w-24`} />
                        <input type="text" value={newActualItem.description} onChange={e => setNewActualItem({...newActualItem, description: e.target.value})} placeholder="実績を入力" className={`${inputClass} flex-grow`} required />
                        <button type="submit" className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><PlusCircle className="w-4 h-4" /></button>
                    </form>
                )}
                 {actualItems.length === 0 && !canEdit && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">この日の実績はありません。</p>
                )}
            </div>
        </div>
    );
};

const WeekView: React.FC<{
    weekDates: string[];
    eventsByDate: Record<string, CalendarEvent[]>;
    selectedDate: string;
    onSelectDate: (date: string) => void;
}> = ({ weekDates, eventsByDate, selectedDate, onSelectDate }) => (
    <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-7">
            {weekDates.map((date) => {
                const events = eventsByDate[date] ?? [];
                const dayLabel = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(new Date(date));
                const dayNumber = new Date(date).getDate();
                const isSelected = date === selectedDate;
                return (
                    <button
                        type="button"
                        key={date}
                        onClick={() => onSelectDate(date)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                            isSelected
                                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/40 shadow-sm'
                                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                        }`}
                    >
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{dayLabel}</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{dayNumber}</div>
                        <div className="mt-2 space-y-1">
                            {events.length === 0 && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">予定なし</p>
                            )}
                            {events.slice(0, 2).map((event) => (
                                <div key={event.id} className="rounded-lg bg-slate-50/70 dark:bg-slate-900/60 p-2 text-[11px] text-slate-700 dark:text-slate-200">
                                    <p className="font-semibold text-[12px] text-slate-900 dark:text-white">{event.title}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{event.time ? `${event.time} ` : ''}{event.description ?? ''}</p>
                                </div>
                            ))}
                            {events.length > 2 && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{events.length} 件の予定</p>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">日別モードで詳細と実績を編集できます。</p>
    </div>
);

const MonthView: React.FC<{
    days: { date: string; inMonth: boolean }[];
    eventsByDate: Record<string, CalendarEvent[]>;
    selectedDate: string;
    onSelectDate: (date: string) => void;
}> = ({ days, eventsByDate, selectedDate, onSelectDate }) => (
    <div className="mt-4">
        <div className="grid grid-cols-7 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
            {calendarWeekdayLabels.map((label) => (
                <div key={label} className="text-center">
                    {label}
                </div>
            ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map(({ date, inMonth }) => {
                const events = eventsByDate[date] ?? [];
                const dayNumber = new Date(date).getDate();
                const isSelected = date === selectedDate;
                return (
                    <button
                        type="button"
                        key={date}
                        onClick={() => onSelectDate(date)}
                        className={`flex h-full flex-col items-start gap-1 rounded-xl border p-2 text-left text-[11px] transition ${
                            isSelected
                                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/40 shadow-sm'
                                : inMonth
                                    ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                                    : 'border-transparent bg-slate-100/60 dark:bg-slate-900/40'
                        }`}
                    >
                        <span className={`text-sm font-semibold ${inMonth ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                            {dayNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {events.length > 0 ? `${events.length}件` : '予定なし'}
                        </span>
                    </button>
                );
            })}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">日別モードで詳細な実績を確認できます。</p>
    </div>
);

const MySchedulePage: React.FC<MySchedulePageProps> = ({
    jobs,
    purchaseOrders,
    applications,
    currentUser,
    allUsers,
    addToast,
    onCreateDailyReport,
}) => {
    const todayIso = useMemo(() => formatDate(new Date()), []);
    const [selectedDate, setSelectedDate] = useState<string>(todayIso);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [dailyReportText, setDailyReportText] = useState('');
    const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
    const [actualItems, setActualItems] = useState<ScheduleItem[]>([]);
    const [newEvent, setNewEvent] = useState({ title: '', date: todayIso, time: '', description: '' });
    const [isDailyOcrLoading, setIsDailyOcrLoading] = useState(false);
    const newEventTitleRef = useRef<HTMLInputElement | null>(null);
    const [hasManualNewEventDate, setHasManualNewEventDate] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<string>(() => currentUser?.id ?? allUsers[0]?.id ?? 'guest');

    const selectableUsers = useMemo(() => {
        const map = new Map<string, EmployeeUser>();
        allUsers.forEach((user) => {
            if (user?.id) {
                map.set(user.id, user);
            }
        });
        if (currentUser?.id) {
            map.set(currentUser.id, currentUser);
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }, [allUsers, currentUser]);

    useEffect(() => {
        if (viewingUserId === 'guest') return;
        const exists = selectableUsers.some((user) => user.id === viewingUserId);
        if (!exists) {
            const fallbackId = currentUser?.id ?? selectableUsers[0]?.id ?? 'guest';
            setViewingUserId(fallbackId);
        }
    }, [viewingUserId, selectableUsers, currentUser?.id]);

    const viewingUser = useMemo(
        () => selectableUsers.find((user) => user.id === viewingUserId) ?? null,
        [selectableUsers, viewingUserId],
    );

    const canEditCurrentCalendar = (currentUser?.id ?? 'guest') === viewingUserId;

    const customEventsStorageKey = useMemo(
        () => `mqdriven_my_schedule_${viewingUserId ?? 'guest'}`,
        [viewingUserId],
    );
    
    const actualsStorageKey = useMemo(
        () => `mqdriven_my_schedule_actuals_${viewingUserId ?? 'guest'}_${selectedDate}`,
        [viewingUserId, selectedDate],
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(customEventsStorageKey);
            if (!raw) {
                setCustomEvents([]);
                return;
            }
            const parsed = JSON.parse(raw) as CalendarEvent[];
            if (Array.isArray(parsed)) {
                setCustomEvents(
                    parsed
                        .filter((event) => event?.date && event?.title)
                        .map((event) => ({ ...event, type: 'custom' as const })),
                );
            } else {
                setCustomEvents([]);
            }
        } catch {
            setCustomEvents([]);
        }
    }, [customEventsStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(customEventsStorageKey, JSON.stringify(customEvents));
    }, [customEventsStorageKey, customEvents]);
    
    useEffect(() => {
        if (typeof window === 'undefined') {
            setActualItems([]);
            return;
        };
        try {
            const raw = window.localStorage.getItem(actualsStorageKey);
            const parsed = raw ? JSON.parse(raw) as ScheduleItem[] : [];
            if (Array.isArray(parsed)) {
                setActualItems(parsed.filter(item => item && typeof item.description === 'string'));
            } else {
                setActualItems([]);
            }
        } catch {
            setActualItems([]);
        }
    }, [actualsStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(actualsStorageKey, JSON.stringify(actualItems));
    }, [actualsStorageKey, actualItems]);

    useEffect(() => {
        if (hasManualNewEventDate) return;
        setNewEvent((prev) => ({
            ...prev,
            date: selectedDate,
        }));
    }, [selectedDate, hasManualNewEventDate]);

    const monthLabel = useMemo(() => {
        const d = new Date(selectedDate);
        return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(d);
    }, [selectedDate]);

    const selectedDateLabel = useMemo(() => {
        return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full' }).format(new Date(selectedDate));
    }, [selectedDate]);

    const weekRangeLabel = useMemo(() => {
        const weekStart = getWeekStartIso(selectedDate);
        const weekEnd = addDays(weekStart, 6);
        const formatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });
        return `${formatter.format(new Date(weekStart))} ～ ${formatter.format(new Date(weekEnd))}`;
    }, [selectedDate]);

    const viewLabel = useMemo(() => {
        switch (viewMode) {
            case 'week':
                return weekRangeLabel;
            case 'month':
                return monthLabel;
            default:
                return selectedDateLabel;
        }
    }, [viewMode, weekRangeLabel, monthLabel, selectedDateLabel]);

    const shiftSelectedDate = (direction: number) => {
        setSelectedDate((prev) => {
            if (viewMode === 'week') {
                return addDays(prev, direction * 7);
            }
            if (viewMode === 'month') {
                return addMonthsToDate(prev, direction);
            }
            return addDays(prev, direction);
        });
        setHasManualNewEventDate(false);
    };

    const goToPreviousSpan = () => shiftSelectedDate(-1);
    const goToNextSpan = () => shiftSelectedDate(1);

    const handleToday = () => {
        setSelectedDate(todayIso);
        setHasManualNewEventDate(false);
    };

    const handleAddEvent = (event: React.FormEvent) => {
        event.preventDefault();
        if (!canEditCurrentCalendar) {
            addToast?.('このユーザーのカレンダーは閲覧専用です。', 'info');
            return;
        }
        const trimmedTitle = newEvent.title.trim();
        const date = newEvent.date || selectedDate;
        if (!trimmedTitle || !date) return;

        const nextEvent: CalendarEvent = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date,
            title: trimmedTitle,
            type: 'custom',
            time: newEvent.time || undefined,
            description: newEvent.description.trim() || undefined,
        };
        setCustomEvents((prev) => [...prev, nextEvent]);
        setNewEvent({ title: '', date: selectedDate, time: '', description: '' });
        setHasManualNewEventDate(false);
        addToast?.('予定を追加しました。', 'success');
    };

    const handleDeleteEvent = (id: string) => {
        if (!canEditCurrentCalendar) {
            addToast?.('このユーザーのカレンダーは閲覧専用です。', 'info');
            return;
        }
        setCustomEvents((prev) => prev.filter((event) => event.id !== id));
        addToast?.('予定を削除しました。', 'info');
    };

    const handleImportDailyReport = () => {
        if (!dailyReportText.trim()) {
            addToast?.('日報テキストを入力してください。', 'info');
            return;
        }
        const { date: parsedDate, items } = parseDailyReportText(dailyReportText, selectedDate);
        if (items.length === 0) {
            addToast?.('作業実績の時刻が見つかりませんでした。', 'warning');
            return;
        }
        setSelectedDate(parsedDate);
        setActualItems(items);
        setViewMode('day');
        setHasManualNewEventDate(false);
        addToast?.('日報から実績を取り込みました。', 'success');
    };

    const handleDailyReportTextClear = () => {
        setDailyReportText('');
    };

    const isDailyReportTextEmpty = !dailyReportText.trim();

    const handleDailyReportOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsDailyOcrLoading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const result = reader.result as string | null;
                if (!result) return;
                const base64 = result.split(',')[1] || '';
                const text = await extractDailyReportFromImage(base64, file.type);
                setDailyReportText(prev => (prev ? `${prev}\n\n${text}` : text));
                addToast?.('画像から日報テキストを読み取りました。', 'success');
            } catch (err: any) {
                const msg = err instanceof Error ? err.message : '日報画像の読み取りに失敗しました。';
                addToast?.(msg, 'error');
            } finally {
                setIsDailyOcrLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSelectDateFromCalendar = (date: string) => {
        setSelectedDate(date);
        setHasManualNewEventDate(false);
    };

    const aggregatedEvents = useMemo(() => {
        const entries: CalendarEvent[] = [];

        jobs.forEach((job) => {
            const plannedDate = extractDatePart(job.dueDate || job.createdAt);
            if (!plannedDate) return;
            entries.push({
                id: `job-${job.id}`,
                date: plannedDate,
                title: job.title,
                type: 'job',
                description: job.details || job.clientName || undefined,
            });
        });

        purchaseOrders.forEach((order) => {
            const orderDate = extractDatePart(order.orderDate);
            if (!orderDate) return;
            entries.push({
                id: `po-${order.id}`,
                date: orderDate,
                title: `発注：${order.itemName}`,
                type: 'purchaseOrder',
                description: order.supplierName || undefined,
            });
        });

        applications.forEach((application) => {
            const applicationDate = extractDatePart(application.submittedAt ?? application.createdAt);
            if (!applicationDate) return;
            const label =
                application.applicationCode?.name ||
                application.applicationCode?.code ||
                '社内申請';
            entries.push({
                id: `application-${application.id}`,
                date: applicationDate,
                title: `申請：${label}`,
                type: 'application',
                description: application.applicant?.name || undefined,
            });
        });

        entries.push(...customEvents);
        return entries.sort((a, b) => a.date.localeCompare(b.date));
    }, [applications, customEvents, jobs, purchaseOrders]);

    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        aggregatedEvents.forEach((event) => {
            if (!map[event.date]) {
                map[event.date] = [];
            }
            map[event.date].push(event);
        });
        return map;
    }, [aggregatedEvents]);

    const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
    const monthCalendar = useMemo(() => buildMonthCalendar(selectedDate), [selectedDate]);

    const selectedEvents = useMemo(
        () => aggregatedEvents.filter((event) => event.date === selectedDate),
        [aggregatedEvents, selectedDate],
    );

    const upcomingEvents = useMemo(
        () => aggregatedEvents.filter((event) => event.date >= todayIso).slice(0, 5),
        [aggregatedEvents, todayIso],
    );

    const dailyReportButtonDisabled = !onCreateDailyReport || !canEditCurrentCalendar;
    const dailyReportButtonTitle = !onCreateDailyReport
        ? '日報作成は有効化されていません'
        : !canEditCurrentCalendar
            ? '閲覧専用のカレンダーです'
            : '選択した日の予定を日報に反映します';

    const handleCreateDailyReport = () => {
        if (!onCreateDailyReport) return;
        const planItems = selectedEvents.map((event) => ({
            id: `${event.id}-plan`,
            start: event.time || '',
            end: '',
            description: event.description ? `${event.title} - ${event.description}` : event.title,
        }));
        const activityContent =
            selectedEvents.map((event) => event.description ?? event.title).join('\n') ||
            '本日の活動内容を記入してください。';
        const nextDayPlan =
            upcomingEvents
                .slice(0, 3)
                .map((event) => event.title)
                .join(' / ') || '次回の予定を整理してください。';

        onCreateDailyReport({
            id: `${viewingUserId}-schedule-${selectedDate}`,
            reportDate: selectedDate,
            startTime: planItems[0]?.start || '09:00',
            endTime: planItems[planItems.length - 1]?.start || '18:00',
            customerName: selectedEvents[0]?.title || '',
            activityContent,
            nextDayPlan,
            planItems,
            actualItems,
            comments: [],
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                            <CalendarIcon className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {viewingUser
                                    ? `${viewingUser.name} さんのカレンダー`
                                    : 'ゲストモード（この端末のみ）'}
                            </p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{monthLabel}</p>
                            {!canEditCurrentCalendar && (
                                <p className="mt-1 text-xs font-semibold text-amber-600">
                                    他のユーザーの予定は閲覧のみです。
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 items-stretch lg:items-end">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <label className="text-slate-500 dark:text-slate-300">表示ユーザー</label>
                            <select
                                value={viewingUserId}
                                onChange={(e) => setViewingUserId(e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
                            >
                                <option value="guest">ゲスト（ローカル）</option>
                                {selectableUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                        {user.department ? `（${user.department}）` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={goToPreviousSpan}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                前の日
                            </button>
                            <button
                                type="button"
                                onClick={handleToday}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                今日
                            </button>
                            <button
                                type="button"
                                onClick={goToNextSpan}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                次の日
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            表示期間：<span className="font-semibold text-slate-900 dark:text-white">{viewLabel}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {viewModeOptions.map((option) => (
                                <button
                                    type="button"
                                    key={option.id}
                                    onClick={() => setViewMode(option.id)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                        viewMode === option.id
                                            ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-300'
                                            : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCreateDailyReport}
                        disabled={dailyReportButtonDisabled}
                        title={dailyReportButtonTitle}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            dailyReportButtonDisabled
                                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <PlusCircle className="w-4 h-4" />
                        日報作成
                    </button>
                </div>

                {viewMode === 'day' && (
                    <DayView
                        selectedDate={selectedDate}
                        planEvents={selectedEvents}
                        actualItems={actualItems}
                        onUpdateActualItems={setActualItems}
                        onDeleteEvent={handleDeleteEvent}
                        canEdit={canEditCurrentCalendar}
                    />
                )}
                {viewMode === 'week' && (
                    <WeekView
                        weekDates={weekDates}
                        eventsByDate={eventsByDate}
                        selectedDate={selectedDate}
                        onSelectDate={handleSelectDateFromCalendar}
                    />
                )}
                {viewMode === 'month' && (
                    <MonthView
                        days={monthCalendar}
                        eventsByDate={eventsByDate}
                        selectedDate={selectedDate}
                        onSelectDate={handleSelectDateFromCalendar}
                    />
                )}

                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 p-4 space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">日報テキストを貼り付け</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                日報や週報のテキスト（時刻と内容を含む報告文）を貼り付けると、作業実績として自動で反映されます。
                            </p>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">「作業実績」項目のみ活用します</span>
                    </div>
                    <textarea
                        value={dailyReportText}
                        onChange={(e) => setDailyReportText(e.target.value)}
                        rows={6}
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        placeholder="いつもありがとうございます。11/21(金)の業務報告をさせて頂きます。..."
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                        <label className="text-[11px] font-semibold cursor-pointer rounded-full px-4 py-1 bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100 hover:border-slate-300">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleDailyReportOcrUpload}
                                disabled={isDailyOcrLoading}
                            />
                            {isDailyOcrLoading ? '手書き日報から読み取り中…' : '手書き日報から読み取る'}
                        </label>
                        <button
                            type="button"
                            onClick={handleDailyReportTextClear}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                        >
                            クリア
                        </button>
                        <button
                            type="button"
                            onClick={handleImportDailyReport}
                            disabled={isDailyReportTextEmpty}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                                isDailyReportTextEmpty
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <PlusCircle className="w-4 h-4" />
                            実績を取り込む
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                <PlusCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">予定を追加</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    個人の予定を登録して、案件情報と合わせて確認できます。
                                </p>
                            </div>
                        </div>
                        <form onSubmit={handleAddEvent} className="mt-4 space-y-4">
                            {!canEditCurrentCalendar && (
                                <p className="text-xs font-semibold text-amber-600">
                                    このカレンダーは閲覧のみです。予定を追加するには対象ユーザーを切り替えてください。
                                </p>
                            )}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">タイトル</label>
                                <input
                                    type="text"
                                    value={newEvent.title}
                                    onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                                    ref={newEventTitleRef}
                                    className={`mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm ${
                                        !canEditCurrentCalendar ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    placeholder="顧客訪問 / 社内MTG"
                                    required
                                    disabled={!canEditCurrentCalendar}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">日付</label>
                                    <input
                                        type="date"
                                        value={newEvent.date}
                                        onChange={(e) => {
                                            setHasManualNewEventDate(true);
                                            setNewEvent((prev) => ({ ...prev, date: e.target.value }));
                                        }}
                                        className={`mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm ${
                                            !canEditCurrentCalendar ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        required
                                        disabled={!canEditCurrentCalendar}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">時間（任意）</label>
                                    <input
                                        type="time"
                                        value={newEvent.time}
                                        onChange={(e) => setNewEvent((prev) => ({ ...prev, time: e.target.value }))}
                                        className={`mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm ${
                                            !canEditCurrentCalendar ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        disabled={!canEditCurrentCalendar}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">メモ（任意）</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                                    className={`mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm ${
                                        !canEditCurrentCalendar ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    rows={3}
                                    placeholder="参加メンバー、持ち物など"
                                    disabled={!canEditCurrentCalendar}
                                />
                            </div>
                            <button
                                type="submit"
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white ${
                                    canEditCurrentCalendar
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-slate-400 cursor-not-allowed'
                                }`}
                                disabled={!canEditCurrentCalendar}
                            >
                                <PlusCircle className="w-4 h-4" />
                                予定を追加
                            </button>
                        </form>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">近日の重要な予定</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            案件・購買・申請などのシステム情報も自動で集約しています。
                        </p>
                        <div className="mt-4 space-y-3">
                            {upcomingEvents.length === 0 && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">直近の予定はありません。</p>
                            )}
                            {upcomingEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{typeLabels[event.type]}</p>
                                        {event.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{event.description}</p>
                                        )}
                                    </div>
                                    <div className="text-right text-sm font-semibold text-slate-700 dark:text-slate-100">
                                        {new Intl.DateTimeFormat('ja-JP', {
                                            month: 'numeric',
                                            day: 'numeric',
                                            weekday: 'short',
                                        }).format(new Date(event.date))}
                                        {event.time && <div className="text-xs text-slate-500">{event.time}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg">
                        <p className="text-sm font-semibold">ヒント</p>
                        <p className="mt-2 text-sm text-slate-200">
                            案件・購買・申請データと連動したカレンダーです。社外予定などは「予定を追加」から登録すれば、一つの画面で業務全体の予定を俯瞰できます。
                        </p>
                        <ul className="mt-4 text-xs text-slate-300 space-y-1">
                            <li>• カードをクリックすると日付を切り替えられます</li>
                            <li>• 予定はローカルに保存されるため、ドラフトでも安心です</li>
                            <li>• 色で予定の種類を判別できます</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MySchedulePage;
