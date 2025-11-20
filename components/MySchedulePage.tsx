import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, ArrowRight } from './Icons';
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
type CalendarViewMode = 'week' | 'month';

interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    type: CalendarEventType;
    description?: string;
    time?: string;
}

interface MySchedulePageProps {
    jobs: ProjectBudgetSummary[];
    purchaseOrders: PurchaseOrder[];
    applications: ApplicationWithDetails[];
    currentUser: EmployeeUser | null;
    allUsers: EmployeeUser[];
    addToast?: (message: string, type: Toast['type']) => void;
    onCreateDailyReport?: (prefill: DailyReportPrefill) => void;
}

const weekdayLabels = ['月', '火', '水', '木', '金', '土', '日'];

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

const getWeekStart = (date: Date) => {
    const day = (date.getDay() + 6) % 7; // Monday start
    const monday = new Date(date);
    monday.setDate(date.getDate() - day);
    return monday;
};

const MonthView: React.FC<{
    calendarDays: {
        date: Date;
        iso: string;
        isCurrentMonth: boolean;
        isToday: boolean;
    }[];
    eventsByDate: Record<string, CalendarEvent[]>;
    selectedDate: string;
    onSelectDate: (iso: string) => void;
}> = ({ calendarDays, eventsByDate, selectedDate, onSelectDate }) => (
    <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
            {weekdayLabels.map((weekday) => (
                <div key={weekday} className="px-3 py-2 text-center">
                    {weekday}
                </div>
            ))}
        </div>
        <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
                const dayEvents = eventsByDate[day.iso] ?? [];
                const isSelected = selectedDate === day.iso;
                return (
                    <button
                        type="button"
                        key={day.iso}
                        onClick={() => onSelectDate(day.iso)}
                        className={`min-h-[110px] border border-slate-200 dark:border-slate-700 p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            day.isCurrentMonth
                                ? 'bg-white dark:bg-slate-900/40'
                                : 'bg-slate-50 dark:bg-slate-900/10 text-slate-400'
                        } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                    >
                        <div className="flex items-center justify-between">
                            <span
                                className={`text-sm font-semibold ${
                                    day.isToday ? 'text-blue-600 dark:text-blue-300' : ''
                                }`}
                            >
                                {day.date.getDate()}
                            </span>
                            {day.isToday && (
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                                    今日
                                </span>
                            )}
                        </div>
                        <div className="mt-2 space-y-1">
                            {dayEvents.slice(0, 2).map((event) => (
                                <span
                                    key={event.id}
                                    className={`block truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeStyles[event.type]}`}
                                >
                                    {event.title}
                                </span>
                            ))}
                            {dayEvents.length > 2 && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">+{dayEvents.length - 2} 件</span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    </div>
);

const WeekView: React.FC<{
    selectedDate: string;
    eventsByDate: Record<string, CalendarEvent[]>;
    onSelectDate: (iso: string) => void;
}> = ({ selectedDate, eventsByDate, onSelectDate }) => {
    const selected = new Date(selectedDate);
    const start = getWeekStart(selected);
    const todayIso = formatDate(new Date());
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const iso = formatDate(date);
        return {
            label: weekdayLabels[index],
            iso,
            date,
            isToday: isSameDay(iso, todayIso),
            events: eventsByDate[iso] ?? [],
        };
    });

    return (
        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                {days.map((day) => (
                    <div key={day.iso} className="px-3 py-2 text-center">
                        {day.label}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const isSelected = selectedDate === day.iso;
                    return (
                        <button
                            type="button"
                            key={day.iso}
                            onClick={() => onSelectDate(day.iso)}
                            className={`min-h-[140px] border border-slate-200 dark:border-slate-700 p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isSelected ? 'ring-2 ring-blue-500 relative z-10' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {day.date.getMonth() + 1}/{day.date.getDate()}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{day.label}</p>
                                </div>
                                {day.isToday && (
                                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-300">今日</span>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
                                {day.events.length === 0 && <p className="text-[11px] text-slate-400">予定なし</p>}
                                {day.events.map((event) => (
                                    <div
                                        key={event.id}
                                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${badgeStyles[event.type]}`}
                                    >
                                        <p className="truncate">{event.title}</p>
                                        {event.time && <p className="text-[10px] opacity-80">{event.time}</p>}
                                    </div>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

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
    const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date());
    const [selectedDate, setSelectedDate] = useState<string>(todayIso);
    const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
    const [newEvent, setNewEvent] = useState({ title: '', date: todayIso, time: '', description: '' });
    const newEventTitleRef = useRef<HTMLInputElement | null>(null);
    const [hasManualNewEventDate, setHasManualNewEventDate] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<string>(() => currentUser?.id ?? allUsers[0]?.id ?? 'guest');
    const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

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

    const handleSelectDate = useCallback(
        (iso: string) => {
            setSelectedDate(iso);
            setHasManualNewEventDate(false);
            setNewEvent((prev) => ({ ...prev, date: iso }));
            if (canEditCurrentCalendar) {
                newEventTitleRef.current?.focus();
            }
        },
        [canEditCurrentCalendar],
    );

    const storageKey = useMemo(
        () => `mqdriven_my_schedule_${viewingUserId ?? 'guest'}`,
        [viewingUserId],
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(storageKey);
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
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(storageKey, JSON.stringify(customEvents));
    }, [storageKey, customEvents]);

    useEffect(() => {
        if (hasManualNewEventDate) return;
        setNewEvent((prev) => ({
            ...prev,
            date: selectedDate,
        }));
    }, [selectedDate, hasManualNewEventDate]);

    useEffect(() => {
        if (viewMode === 'month') {
            const target = new Date(selectedDate);
            setVisibleMonth(new Date(target.getFullYear(), target.getMonth(), 1));
        }
    }, [viewMode, selectedDate]);

    const derivedEvents = useMemo<CalendarEvent[]>(() => {
        const jobEvents = jobs.flatMap((job) => {
            const date = extractDatePart(job.dueDate);
            if (!date) return [];
            const event: CalendarEvent = {
                id: `job-${job.id}`,
                date,
                title: job.title || job.projectCode || `案件#${job.jobNumber}`,
                type: 'job',
                description: job.clientName ? `${job.clientName} / Q${job.quantity}` : undefined,
            };
            return [event];
        });

        const purchaseEvents = purchaseOrders.flatMap((order) => {
            const date = extractDatePart(order.orderDate);
            if (!date) return [];
            const event: CalendarEvent = {
                id: `po-${order.id}`,
                date,
                title: `発注：${order.itemName}`,
                type: 'purchaseOrder',
                description: order.supplierName ?? undefined,
            };
            return [event];
        });

        const applicationEvents = applications.flatMap((application) => {
            const date =
                extractDatePart(application.submittedAt || application.updatedAt || application.createdAt) ?? null;
            if (!date) return [];
            const label = application.applicationCode?.name ?? application.applicationCodeId;
            const statusLabel =
                application.status === 'pending_approval'
                    ? '承認待ち'
                    : application.status === 'approved'
                    ? '承認済み'
                    : application.status === 'rejected'
                    ? '差戻し'
                    : '下書き';
            const event: CalendarEvent = {
                id: `application-${application.id}`,
                date,
                title: `${label}申請`,
                type: 'application',
                description: `ステータス：${statusLabel}`,
            };
            return [event];
        });

        return [...jobEvents, ...purchaseEvents, ...applicationEvents];
    }, [jobs, purchaseOrders, applications]);

    const sortedEvents = useMemo(() => {
        const complete = [...derivedEvents, ...customEvents];
        return complete.sort((a, b) => {
            if (a.date === b.date) {
                const timeA = a.time ?? '99:99';
                const timeB = b.time ?? '99:99';
                return timeA.localeCompare(timeB);
            }
            return a.date.localeCompare(b.date);
        });
    }, [derivedEvents, customEvents]);

    const eventsByDate = useMemo(() => {
        return sortedEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
            acc[event.date] = acc[event.date] ? [...acc[event.date], event] : [event];
            return acc;
        }, {});
    }, [sortedEvents]);

    const selectedEvents = eventsByDate[selectedDate] ?? [];

    const formatScheduleLine = (item: ScheduleItem) => {
        const start = item.start || '--:--';
        const end = item.end || '--:--';
        const description = item.description ? `　${item.description}` : '';
        return `${start}～${end}${description}`.trim();
    };

    const buildScheduleItems = (events: CalendarEvent[], mode: 'plan' | 'actual'): ScheduleItem[] =>
        events.map(event => ({
            id: `${mode}-${event.id}`,
            start: event.time || '',
            end: '',
            description: [
                event.title,
                event.description,
                typeLabels[event.type],
            ]
                .filter(Boolean)
                .join(' / '),
        }));

    const handleCreateDailyReport = () => {
        if (!onCreateDailyReport) return;
        if (!selectedEvents.length) {
            addToast?.('この日は予定がありません。', 'info');
            return;
        }
        const planItems = buildScheduleItems(selectedEvents, 'plan');
        const actualItems = buildScheduleItems(selectedEvents, 'actual');
        const planLines = planItems.map(formatScheduleLine).join('\n') || '（予定なし）';
        const actualLines = actualItems.map(formatScheduleLine).join('\n') || '（実績なし）';
        const activityContent = [
            `${selectedDateLabel} の業務のご報告です。`,
            '',
            'PQ目標__　今期現在__　前年__',
            'MQ目標__　今期現在__　前年__',
            '',
            '【本日の計画】',
            planLines,
            '',
            '【本日の実績】',
            actualLines,
        ].join('\n');
        const prefill: DailyReportPrefill = {
            id: `calendar-${selectedDate}-${Date.now()}`,
            reportDate: selectedDate,
            planItems,
            actualItems,
            activityContent,
            comments: [`カレンダーの予定（${selectedEvents.length}件）を反映しました。`],
        };
        onCreateDailyReport(prefill);
    };

    const dailyReportButtonDisabled = !canEditCurrentCalendar || selectedEvents.length === 0;
    const dailyReportButtonTitle = !canEditCurrentCalendar
        ? '他のユーザーのカレンダーは閲覧のみです。'
        : selectedEvents.length === 0
            ? '予定がありません。'
            : 'この日の予定を日報化します。';

    const upcomingEvents = useMemo(() => {
        return sortedEvents.filter((event) => event.date >= todayIso).slice(0, 5);
    }, [sortedEvents, todayIso]);

    const monthLabel = useMemo(() => {
        return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(visibleMonth);
    }, [visibleMonth]);

    const selectedDateLabel = useMemo(() => {
        return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full' }).format(new Date(selectedDate));
    }, [selectedDate]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
        const offset = (firstDay.getDay() + 6) % 7; // Monday start
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - offset);

        return Array.from({ length: 42 }, (_, index) => {
            const current = new Date(start);
            current.setDate(start.getDate() + index);
            const iso = formatDate(current);
            return {
                date: current,
                iso,
                isCurrentMonth: current.getMonth() === visibleMonth.getMonth(),
                isToday: isSameDay(iso, todayIso),
            };
        });
    }, [visibleMonth, todayIso]);

    const goToPreviousSpan = () => {
        if (viewMode === 'month') {
            setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        } else {
            setSelectedDate((prev) => addDays(prev, -7));
            setHasManualNewEventDate(false);
        }
    };

    const goToNextSpan = () => {
        if (viewMode === 'month') {
            setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        } else {
            setSelectedDate((prev) => addDays(prev, 7));
            setHasManualNewEventDate(false);
        }
    };

    const handleToday = () => {
        setSelectedDate(todayIso);
        setHasManualNewEventDate(false);
        setVisibleMonth(new Date());
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
                            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-1">
                                {(['week', 'month'] as CalendarViewMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setViewMode(mode)}
                                        className={`px-3 py-1 text-sm font-semibold rounded-lg transition ${
                                            viewMode === mode
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {mode === 'week' ? '週表示' : '月表示'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={goToPreviousSpan}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                前の{viewMode === 'week' ? '週' : '月'}
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
                                次の{viewMode === 'week' ? '週' : '月'}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                    選択中：<span className="font-semibold text-slate-900 dark:text-white">{selectedDateLabel}</span>
                </p>

                {viewMode === 'week' ? (
                    <WeekView selectedDate={selectedDate} eventsByDate={eventsByDate} onSelectDate={handleSelectDate} />
                ) : (
                    <MonthView
                        calendarDays={calendarDays}
                        eventsByDate={eventsByDate}
                        selectedDate={selectedDate}
                        onSelectDate={handleSelectDate}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/70">
                                    <CalendarIcon className="w-5 h-5 text-slate-600 dark:text-slate-200" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                                        {selectedDateLabel}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">この日の予定</p>
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
                        <div className="mt-4 space-y-3">
                            {selectedEvents.length === 0 && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    この日の予定はまだありません。
                                </p>
                            )}
                            {selectedEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {event.title}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {typeLabels[event.type]}
                                            </p>
                                        </div>
                                        {event.time && (
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {event.time}
                                            </span>
                                        )}
                                    </div>
                                    {event.description && (
                                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>
                                    )}
                                    {event.type === 'custom' && canEditCurrentCalendar && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            削除
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

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
