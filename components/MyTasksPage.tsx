import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, PlusCircle, CheckCircle, AlertTriangle, Trash2, Calendar as CalendarIcon } from './Icons';
import {
    ProjectBudgetSummary,
    PurchaseOrder,
    ApplicationWithDetails,
    EmployeeUser,
    Toast,
} from '../types';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

interface UserTask {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: string;
    description?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

interface SystemReminder {
    id: string;
    title: string;
    description: string;
    dueDate?: string;
    source: 'job' | 'application' | 'purchaseOrder';
}

interface MyTasksPageProps {
    jobs: ProjectBudgetSummary[];
    applications: ApplicationWithDetails[];
    purchaseOrders: PurchaseOrder[];
    currentUser: EmployeeUser | null;
    addToast?: (message: string, type: Toast['type']) => void;
}

const statusLabels: Record<TaskStatus, string> = {
    todo: '未着手',
    in_progress: '進行中',
    done: '完了',
};

const priorityLabels: Record<TaskPriority, string> = {
    low: '低',
    medium: '中',
    high: '高',
};

const priorityStyles: Record<TaskPriority, string> = {
    low: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border border-amber-100',
    high: 'bg-rose-50 text-rose-700 border border-rose-100',
};

const statusStyles: Record<TaskStatus, string> = {
    todo: 'bg-slate-100 text-slate-700 border border-slate-200',
    in_progress: 'bg-blue-50 text-blue-700 border border-blue-100',
    done: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
};

const parseISODate = (value?: string | null): string | undefined => {
    if (!value) return undefined;
    const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    try {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }
    } catch {
        return undefined;
    }
    return undefined;
};

const formatDisplayDate = (value?: string) => {
    if (!value) return '期限未設定';
    try {
        return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(
            new Date(value),
        );
    } catch {
        return value;
    }
};

const daysUntil = (value?: string) => {
    if (!value) return null;
    const target = new Date(value);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
};

const MyTasksPage: React.FC<MyTasksPageProps> = ({ jobs, applications, purchaseOrders, currentUser, addToast }) => {
    const [tasks, setTasks] = useState<UserTask[]>([]);
    const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'medium' as TaskPriority, description: '', tags: '' });
    const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const storageKey = useMemo(() => `mqdriven_my_tasks_${currentUser?.id ?? 'guest'}`, [currentUser?.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as UserTask[];
            if (Array.isArray(parsed)) {
                setTasks(parsed);
            }
        } catch {
            setTasks([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(storageKey, JSON.stringify(tasks));
    }, [storageKey, tasks]);

    const handleAddTask = (event: React.FormEvent) => {
        event.preventDefault();
        const title = newTask.title.trim();
        if (!title) return;
        const now = new Date().toISOString();
        const tags = newTask.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        const task: UserTask = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title,
            status: 'todo',
            priority: newTask.priority,
            dueDate: newTask.dueDate || undefined,
            description: newTask.description.trim() || undefined,
            tags: tags.length ? tags : undefined,
            createdAt: now,
            updatedAt: now,
        };
        setTasks((prev) => [task, ...prev]);
        setNewTask({ title: '', dueDate: '', priority: 'medium', description: '', tags: '' });
        addToast?.('タスクを追加しました。', 'success');
    };

    const handleStatusChange = (id: string, status: TaskStatus) => {
        setTasks((prev) =>
            prev.map((task) => (task.id === id ? { ...task, status, updatedAt: new Date().toISOString() } : task)),
        );
    };

    const handleDeleteTask = (id: string) => {
        setTasks((prev) => prev.filter((task) => task.id !== id));
        addToast?.('タスクを削除しました。', 'info');
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false;
            }
            if (searchTerm) {
                const normalized = searchTerm.toLowerCase();
                const haystack = [task.title, task.description, ...(task.tags ?? [])].join(' ').toLowerCase();
                if (!haystack.includes(normalized)) {
                    return false;
                }
            }
            return true;
        });
    }, [tasks, statusFilter, searchTerm]);

    const completionRate = useMemo(() => {
        if (!tasks.length) return 0;
        const doneCount = tasks.filter((task) => task.status === 'done').length;
        return Math.round((doneCount / tasks.length) * 100);
    }, [tasks]);

    const upcomingCount = useMemo(() => {
        const now = new Date();
        return tasks.filter((task) => {
            if (!task.dueDate || task.status === 'done') return false;
            const due = new Date(task.dueDate);
            const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
        }).length;
    }, [tasks]);

    const systemReminders = useMemo<SystemReminder[]>(() => {
        const reminders: SystemReminder[] = [];

        jobs.forEach((job) => {
            const date = parseISODate(job.dueDate);
            if (!date) return;
            const remaining = daysUntil(date);
            if (remaining !== null && remaining <= 14) {
                reminders.push({
                    id: `job-${job.id}`,
                    title: job.title || job.projectCode || `案件#${job.jobNumber}`,
                    description: '納期が近づいています。進捗を確認しましょう。',
                    dueDate: date,
                    source: 'job',
                });
            }
        });

        applications.forEach((application) => {
            if (application.status !== 'pending_approval') return;
            const date = parseISODate(application.submittedAt || application.updatedAt);
            reminders.push({
                id: `application-${application.id}`,
                title: `${application.applicationCode?.name ?? application.applicationCodeId}の承認待ち`,
                description: '承認ルートに進むためのアクションが必要です。',
                dueDate: date,
                source: 'application',
            });
        });

        purchaseOrders.forEach((order) => {
            const date = parseISODate(order.orderDate);
            if (!date) return;
            reminders.push({
                id: `po-${order.id}`,
                title: `発注：${order.itemName}`,
                description: order.supplierName ? `${order.supplierName} との調整を確認してください。` : '仕入状況を確認してください。',
                dueDate: date,
                source: 'purchaseOrder',
            });
        });

        return reminders.slice(0, 6);
    }, [jobs, applications, purchaseOrders]);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30">
                        <ClipboardList className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {currentUser ? `${currentUser.name} さんのタスク管理` : 'ゲストモード'}
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">マイタスク</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                    <div className="min-w-[150px]">
                        <p className="text-xs text-slate-500 dark:text-slate-400">総タスク</p>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{tasks.length}</p>
                    </div>
                    <div className="min-w-[150px]">
                        <p className="text-xs text-slate-500 dark:text-slate-400">完了率</p>
                        <p className="text-2xl font-semibold text-emerald-600">{completionRate}%</p>
                    </div>
                    <div className="min-w-[150px]">
                        <p className="text-xs text-slate-500 dark:text-slate-400">今週の期限</p>
                        <p className="text-2xl font-semibold text-amber-600">{upcomingCount}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                            <PlusCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">タスクを追加</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">個人のTODOを登録して進捗を可視化できます。</p>
                        </div>
                    </div>
                    <form onSubmit={handleAddTask} className="mt-4 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">タイトル</label>
                            <input
                                type="text"
                                value={newTask.title}
                                onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                                className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                placeholder="例）顧客Aへ見積提出"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">期限</label>
                                <input
                                    type="date"
                                    value={newTask.dueDate}
                                    onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                                    className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">優先度</label>
                                <select
                                    value={newTask.priority}
                                    onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                                    className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                >
                                    <option value="high">高</option>
                                    <option value="medium">中</option>
                                    <option value="low">低</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">詳細メモ</label>
                            <textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                                className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                rows={3}
                                placeholder="共有したい内容やTODOの背景を記載"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">タグ（カンマ区切り）</label>
                            <input
                                type="text"
                                value={newTask.tags}
                                onChange={(e) => setNewTask((prev) => ({ ...prev, tags: e.target.value }))}
                                className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                placeholder="例）重要, 顧客対応"
                            />
                        </div>
                        <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            <PlusCircle className="w-4 h-4" />
                            タスクを追加
                        </button>
                    </form>
                </div>

                <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'todo', 'in_progress', 'done'] as const).map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                                        statusFilter === status
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    {status === 'all' ? 'すべて' : statusLabels[status]}
                                </button>
                            ))}
                        </div>
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="タスク名やタグで検索"
                            className="w-full lg:w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="space-y-3">
                        {filteredTasks.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                表示できるタスクがありません。
                            </div>
                        )}
                        {filteredTasks.map((task) => {
                            const dueLabel = formatDisplayDate(task.dueDate);
                            const remaining = daysUntil(task.dueDate);
                            const isOverdue = typeof remaining === 'number' && remaining < 0 && task.status !== 'done';
                            return (
                                <div
                                    key={task.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <p className="text-base font-semibold text-slate-900 dark:text-white">{task.title}</p>
                                            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${priorityStyles[task.priority]}`}>
                                                優先度：{priorityLabels[task.priority]}
                                            </span>
                                        </div>
                                        {task.description && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{task.description}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                {dueLabel}
                                                {isOverdue && (
                                                    <span className="inline-flex items-center gap-1 text-rose-600 ml-1">
                                                        <AlertTriangle className="w-3 h-3" />期限超過
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${statusStyles[task.status]}`}>
                                                {statusLabels[task.status]}
                                            </span>
                                            {task.tags && task.tags.length > 0 && (
                                                <span className="flex flex-wrap gap-1">
                                                    {task.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-semibold"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full md:w-auto">
                                        <select
                                            value={task.status}
                                            onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm"
                                        >
                                            <option value="todo">未着手に戻す</option>
                                            <option value="in_progress">進行中にする</option>
                                            <option value="done">完了にする</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-rose-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            削除
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                            <CheckCircle className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">システムからのリマインダー</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">案件・申請・購買データをもとに自動で抽出します。</p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-3">
                        {systemReminders.length === 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">現在アクションが必要なリマインダーはありません。</p>
                        )}
                        {systemReminders.map((reminder) => (
                            <div
                                key={reminder.id}
                                className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{reminder.title}</p>
                                    <span className="text-[11px] font-semibold rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                                        {reminder.source === 'job'
                                            ? '案件'
                                            : reminder.source === 'application'
                                            ? '社内申請'
                                            : '購買'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{reminder.description}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDisplayDate(reminder.dueDate)}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg space-y-4">
                    <p className="text-sm font-semibold">ヒント</p>
                    <ul className="text-sm text-slate-200 space-y-2">
                        <li>• タスクはローカルに保存されるため安心してドラフトできます。</li>
                        <li>• タグで業務領域や優先度の整理が可能です。</li>
                        <li>• システムリマインダーは自動更新され、抜け漏れを防止します。</li>
                    </ul>
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-800/40 p-4">
                        <p className="text-xs text-slate-400">ワンポイント</p>
                        <p className="mt-1 text-sm text-slate-100">
                            案件や購買データと一緒にTODOを管理することで、ひとつの画面で自分の仕事量を俯瞰できます。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyTasksPage;
