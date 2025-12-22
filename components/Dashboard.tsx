import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line,
} from 'recharts';
import { Job, JournalEntry, AccountItem, JobStatus, BulletinThread, Customer, PurchaseOrder } from '../types';
import { MONTHLY_GOALS, FIXED_COSTS } from '../constants';
import { formatJPY } from '../utils';
import { AlertTriangle, Inbox } from './Icons';
import { getBulletinThreads } from '../services/dataService';
import { getSupabase } from '../services/supabaseClient';

// Integrated Board API service
const getIntegratedBoardPosts = async (userId?: string) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('get_user_posts', {
            p_user_id: userId ?? null,
        });
        if (error) throw error;
        return data ?? [];
    } catch (error) {
        console.error('Error fetching integrated board posts:', error);
        return [];
    }
};

const createBoardPost = async (postData: any) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('create_post', {
            p_title: postData.title,
            p_content: postData.content,
            p_visibility: postData.visibility ?? 'all',
            p_is_task: postData.is_task ?? false,
            p_due_date: postData.due_date ?? null,
            p_assignees: Array.isArray(postData.assignees) ? postData.assignees : [],
            p_created_by: postData.created_by ?? null,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating board post:', error);
        throw error;
    }
};

const addBoardComment = async (postId: string, content: string, userId?: string) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('add_comment', {
            p_post_id: postId,
            p_content: content,
            p_user_id: userId ?? null,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
};

const completeTask = async (postId: string, userId?: string) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.rpc('complete_task', {
            p_post_id: postId,
            p_user_id: userId ?? null,
        });
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error completing task:', error);
        throw error;
    }
};


const ActionItemsCard: React.FC<{
  jobs: Job[];
  pendingApprovalCount: number;
  onNavigateToApprovals: () => void;
}> = ({ jobs, pendingApprovalCount, onNavigateToApprovals }) => {
    const actionItems = useMemo(() => {
        const overdue = jobs.filter(j => j.status !== JobStatus.Completed && new Date(j.dueDate) < new Date());
        const needsInvoicing = jobs.filter(j => j.status === JobStatus.Completed && !j.invoiceId);
        return { overdue, needsInvoicing };
    }, [jobs]);

    if (actionItems.overdue.length === 0 && actionItems.needsInvoicing.length === 0 && pendingApprovalCount === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-slate-800 dark:to-slate-900/70 p-6 rounded-2xl shadow-sm flex items-start gap-4">
             <div className="bg-yellow-200 dark:bg-yellow-900/50 p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">アクションアイテム</h3>
                <ul className="mt-2 text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-1">
                    {pendingApprovalCount > 0 && (
                        <li>
                            <a href="#" onClick={(e) => { e.preventDefault(); onNavigateToApprovals(); }} className="hover:underline">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{pendingApprovalCount}件</span>の申請があなたの承認を待っています。
                            </a>
                        </li>
                    )}
                    {actionItems.overdue.length > 0 && (
                        <li>
                            <span className="font-semibold text-red-600 dark:text-red-400">{actionItems.overdue.length}件</span>の案件が期限切れです。
                        </li>
                    )}
                     {actionItems.needsInvoicing.length > 0 && (
                        <li>
                           <span className="font-semibold text-orange-600 dark:text-orange-400">{actionItems.needsInvoicing.length}件</span>の完了案件が請求書未発行です。
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};


const Meter: React.FC<{ value: number; goal: number; }> = ({ value, goal }) => {
    const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    return (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-2">
            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
        </div>
    );
};

const MQCard: React.FC<{
    title: string;
    value: number;
    subValue?: string;
    subLabel?: string;
    colorClass: string;
    meterGoal?: number;
    children?: React.ReactNode;
}> = ({ title, value, subValue, subLabel, colorClass, meterGoal, children }) => (
    <div className={`p-6 rounded-2xl shadow-sm ${colorClass} flex flex-col`}>
        <p className="text-lg font-semibold text-white/90">{title}</p>
        <p className="text-3xl font-bold mt-2 text-white">{formatJPY(value)}</p>
        {(subValue || subLabel) && (
            <div className="mt-2 text-white/80 font-medium">
                {subLabel && <span>{subLabel}: </span>}
                {subValue && <span>{subValue}</span>}
            </div>
        )}
        {meterGoal !== undefined && <Meter value={value} goal={meterGoal} />}
        {children && <div className="mt-auto pt-4">{children}</div>}
    </div>
);

const MonthlyTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">月次業績推移</h3>
        <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={(value) => `¥${value / 1000}k`} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                    formatter={(value: number) => [formatJPY(value), '']}
                    labelStyle={{ color: '#333' }}
                    itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Line type="monotone" dataKey="PQ" name="売上高" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="MQ" name="限界利益" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="F" name="固定費" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="G" name="利益" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
    </div>
);

interface DashboardProps {
  jobs: Job[];
  journalEntries: JournalEntry[];
  accountItems: AccountItem[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  pendingApprovalCount: number;
  onNavigateToApprovals: () => void;
  onNavigateToBulletinBoard: () => void;
  suggestion?: any;
  isSuggestionLoading?: boolean;
  isAIOff?: boolean;
  onStartGoogleCalendarAuth: () => void;
  onDisconnectGoogleCalendar: () => void;
  isGoogleAuthLoading: boolean;
  googleAuthConnected: boolean;
  googleAuthExpiresAt?: string | null;
  googleAuthStatusLoading?: boolean;
  toastsEnabled: boolean;
  onToggleToasts: () => void;
}

const BulletinHighlightsCard: React.FC<{ threads: BulletinThread[]; onNavigate: () => void; isLoading: boolean; }> = ({ threads, onNavigate, isLoading }) => {
    const visibleThreads = useMemo(() => {
        if (!threads.length) {
            return [];
        }
        const pinned = threads.filter(thread => thread.pinned);
        const latest = threads
            .filter(thread => !thread.pinned)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return [...pinned, ...latest].slice(0, 3);
    }, [threads]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full">
                        <Inbox className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">社内掲示板</h3>
                </div>
                <button
                    type="button"
                    onClick={onNavigate}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                    すべて表示
                </button>
            </div>
            {isLoading ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">掲示板を読み込み中です...</p>
            ) : visibleThreads.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">まだ投稿がありません。最初の投稿を作成しましょう。</p>
            ) : (
                <div className="mt-4 space-y-4">
                    {visibleThreads.map(thread => (
                        <div key={thread.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {thread.pinned && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">PIN</span>
                                )}
                                <span>{new Date(thread.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <p className="mt-1 text-base font-semibold text-slate-800 dark:text-white line-clamp-2">{thread.title}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{thread.body}</p>
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{thread.authorName}{thread.authorDepartment ? `（${thread.authorDepartment}）` : ''}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({
    jobs,
    journalEntries,
    accountItems,
    customers,
    purchaseOrders,
    pendingApprovalCount,
    onNavigateToApprovals,
    onNavigateToBulletinBoard,
    onStartGoogleCalendarAuth,
    onDisconnectGoogleCalendar,
    isGoogleAuthLoading,
    googleAuthConnected,
    googleAuthExpiresAt,
    googleAuthStatusLoading,
    toastsEnabled,
    onToggleToasts,
}) => {
    const [bulletinThreads, setBulletinThreads] = useState<BulletinThread[]>([]);
    const [isBulletinLoading, setIsBulletinLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setIsBulletinLoading(true);
        getBulletinThreads({ limit: 5 })
            .then(data => {
                if (isMounted) {
                    setBulletinThreads(data);
                }
            })
            .catch(error => {
                console.error('Failed to load bulletin highlights', error);
            })
            .finally(() => {
                if (isMounted) {
                    setIsBulletinLoading(false);
                }
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const prevMonth = new Date(currentYear, currentMonth - 1, 1);

    const currentMonthCustomers = useMemo(
      () => customers.filter(c => {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }),
      [customers, currentYear, currentMonth]
    );

    const prevMonthCustomers = useMemo(
      () => customers.filter(c => {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        return d.getFullYear() === prevMonth.getFullYear() && d.getMonth() === prevMonth.getMonth();
      }),
      [customers, prevMonth]
    );

    const customerDelta = currentMonthCustomers.length - prevMonthCustomers.length;

    const expenseBreakdown = useMemo(() => {
      const expenseMap: Record<string, number> = {};

      // Journal entries (debit > credit) as expense
      journalEntries.forEach(entry => {
        const rawDate = (entry as any).date || (entry as any).createdAt || (entry as any).created_at;
        const entryDate = rawDate ? new Date(rawDate) : null;
        if (!entryDate) return;
        if (entryDate.getFullYear() !== currentYear || entryDate.getMonth() !== currentMonth) return;
        const debit = Number(entry.debit ?? 0);
        const credit = Number(entry.credit ?? 0);
        const amount = debit - credit;
        if (amount <= 0) return;
        const label = entry.account || '仕訳';
        expenseMap[label] = (expenseMap[label] || 0) + amount;
      });

      // Purchase orders (amount/totalCost) as expense-like
      purchaseOrders.forEach(po => {
        const rawDate = (po as any).orderDate || (po as any).createdAt || (po as any).order_date || (po as any).created_at;
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;
        const amount = Number(po.totalCost ?? po.amount ?? po.subamount ?? 0);
        if (!amount || amount <= 0) return;
        const label = po.supplierName || '発注';
        expenseMap[label] = (expenseMap[label] || 0) + amount;
      });

      const rows = Object.entries(expenseMap)
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);
      const total = rows.reduce((sum, r) => sum + r.amount, 0);
      const count = purchaseOrders.filter(po => {
        const rawDate = (po as any).orderDate || (po as any).createdAt || (po as any).order_date || (po as any).created_at;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }).length;
      return { rows, total, count };
    }, [journalEntries, purchaseOrders, currentMonth, currentYear]);

    const mqData = useMemo(() => {
        const currentMonthJobs = jobs.filter(job => {
            const jobDate = new Date(job.createdAt);
            return jobDate.getFullYear() === currentYear && jobDate.getMonth() === currentMonth;
        });

        const currentMonthJournalEntries = journalEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
        });

        // --- Overall Metrics (for current month) ---
        const pq = currentMonthJobs.reduce((sum, job) => sum + job.price, 0);
        const vq = currentMonthJobs.reduce((sum, job) => sum + job.variableCost, 0);
        const mq = pq - vq;

        // F (Fixed Cost) Breakdown from actual journal entries for this month
        const fBreakdown = { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0 };
        const accountMap: Map<string, AccountItem> = new Map(accountItems.map(item => [item.name, item]));

        currentMonthJournalEntries.forEach(entry => {
            const cost = entry.debit - entry.credit;
            if (cost <= 0) return;

            const accountInfo = accountMap.get(entry.account);
            if (entry.account.includes('給料') || entry.account.includes('人件費')) fBreakdown.f1 += cost;
            else if (entry.account.includes('減価償却')) fBreakdown.f5 += cost;
            else if (accountInfo && accountInfo.categoryCode === 'TRP') fBreakdown.f4 += cost; // (販)
            else if (accountInfo && accountInfo.categoryCode === 'NOC' && entry.account.includes('支払利息')) fBreakdown.f3 += cost; // 営業外
            else fBreakdown.f2 += cost; // その他経費
        });
        
        // CRITICAL FIX: Use budgeted fixed cost for F and G calculation.
        const f = FIXED_COSTS.monthly.labor + FIXED_COSTS.monthly.other;
        const g = mq - f;

        // --- Monthly Trend Data (for last 12 months) ---
        const monthlyMetrics: { [key: string]: { PQ: number, VQ: number, F: number } } = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMetrics[monthKey] = { PQ: 0, VQ: 0, F: 0 };
        }

        jobs.forEach(job => {
            const jobDate = new Date(job.createdAt);
            const monthKey = `${jobDate.getFullYear()}/${String(jobDate.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyMetrics[monthKey]) {
                monthlyMetrics[monthKey].PQ += job.price;
                monthlyMetrics[monthKey].VQ += job.variableCost;
            }
        });
        
        journalEntries.forEach(entry => {
             if (entry.debit > entry.credit) { // It's a cost
                const entryDate = new Date(entry.date);
                const monthKey = `${entryDate.getFullYear()}/${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyMetrics[monthKey]) {
                     monthlyMetrics[monthKey].F += entry.debit - entry.credit;
                }
             }
        });

        const chartData = Object.entries(monthlyMetrics).map(([name, values]) => {
            const mq = values.PQ - values.VQ;
            return {
                name,
                PQ: values.PQ,
                MQ: mq,
                F: values.F,
                G: mq - values.F
            };
        });

        return { pq, vq, mq, f, g, fBreakdown, chartData };
    }, [jobs, journalEntries, accountItems]);

    const { pq, vq, mq, f, g, fBreakdown, chartData } = mqData;
    const mRate = pq > 0 ? ((mq / pq) * 100).toFixed(1) : '0.0';
    const fmRatio = mq > 0 ? ((f / mq) * 100).toFixed(1) : '0.0';

    const getFmRatioRank = (ratio: number) => {
        if (ratio < 80) return 'A';
        if (ratio < 90) return 'B';
        if (ratio < 100) return 'C';
        if (ratio < 110) return 'D';
        return 'E';
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">Googleカレンダー連携</p>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">スケジュールを同期</h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                {googleAuthConnected ? '連携済みです。必要に応じて同期解除できます。' : 'OAuthを開始して予定をGoogleカレンダーへ連携します。'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {googleAuthStatusLoading
                                    ? 'ステータス確認中...'
                                    : googleAuthConnected
                                        ? `トークン有効期限: ${googleAuthExpiresAt ? new Date(googleAuthExpiresAt).toLocaleString('ja-JP') : '取得不可'}`
                                        : '未連携'}
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-300 font-bold">G</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={googleAuthConnected ? onDisconnectGoogleCalendar : onStartGoogleCalendarAuth}
                        disabled={isGoogleAuthLoading || googleAuthStatusLoading}
                        className={`mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${isGoogleAuthLoading || googleAuthStatusLoading ? 'bg-slate-400 cursor-not-allowed' : googleAuthConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isGoogleAuthLoading || googleAuthStatusLoading
                            ? '処理中...'
                            : googleAuthConnected
                                ? '同期解除'
                                : 'Google連携を開始'}
                    </button>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">通知設定</p>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">トースト通知を切替</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">ワンクリックでトーストを{toastsEnabled ? 'オフにできます。' : 'オンにできます。'}</p>
                    <button
                        type="button"
                        onClick={onToggleToasts}
                        className={`mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold ${toastsEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
                    >
                        {toastsEnabled ? 'トーストをOFFにする' : 'トーストをONにする'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActionItemsCard jobs={jobs} pendingApprovalCount={pendingApprovalCount} onNavigateToApprovals={onNavigateToApprovals} />
                <BulletinHighlightsCard threads={bulletinThreads} onNavigate={onNavigateToBulletinBoard} isLoading={isBulletinLoading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <MQCard title="限界利益" value={mq} subValue={`${mRate}%`} subLabel="M率" colorClass="bg-gradient-to-br from-blue-500 to-blue-600" meterGoal={MONTHLY_GOALS.mq} />
                <MQCard title="利益" value={g} subValue={getFmRatioRank(parseFloat(fmRatio))} subLabel={`F/M比 ${fmRatio}%`} colorClass="bg-gradient-to-br from-violet-500 to-violet-600" />
                <MQCard title="売上高" value={pq} colorClass="bg-gradient-to-br from-sky-500 to-sky-600" />
                <MQCard title="固定費" value={f} colorClass="bg-gradient-to-br from-orange-500 to-orange-600">
                    <div className="text-xs text-white/80 space-y-1">
                        <p>人件費: {formatJPY(fBreakdown.f1)}</p>
                        <p>その他経費: {formatJPY(fBreakdown.f2)}</p>
                        <p>営業外費用: {formatJPY(fBreakdown.f3)}</p>
                        <p>販管費: {formatJPY(fBreakdown.f4)}</p>
                        <p>減価償却費: {formatJPY(fBreakdown.f5)}</p>
                    </div>
                </MQCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">今月の新規顧客</h3>
                    <p className="mt-2 text-4xl font-bold text-blue-600 dark:text-blue-300">{currentMonthCustomers.length} 件</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        先月比: <span className={customerDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            {customerDelta >= 0 ? '+' : ''}{customerDelta}
                        </span>
                    </p>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">新規登録がゼロでも件数を表示します。</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">今月の経費内訳</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">カテゴリ別の支出合計（仕訳 + 発注）</p>
                    <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">合計: {formatJPY(expenseBreakdown.total)} / 件数: {expenseBreakdown.count ?? 0} 件</p>
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                        {expenseBreakdown.rows.length === 0 ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                <p>今月の経費データがありません。</p>
                                <p>仕訳または発注を登録するとここに集計されます。</p>
                            </div>
                        ) : (
                            expenseBreakdown.rows.map(row => {
                                const pct = expenseBreakdown.total > 0 ? Math.round((row.amount / expenseBreakdown.total) * 100) : 0;
                                return (
                                    <div key={row.label} className="flex items-center justify-between text-sm">
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{row.label}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{pct}%</p>
                                        </div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{formatJPY(row.amount)}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <MonthlyTrendChart data={chartData} />
            </div>
        </div>
    );
};

export default React.memo(Dashboard);
