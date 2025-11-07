import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line,
} from 'recharts';
import { Job, JournalEntry, AccountItem, JobStatus, ApplicationWithDetails, EmployeeUser } from '../types.ts';
import { MONTHLY_GOALS, FIXED_COSTS } from '../constants.ts';
import { formatJPY } from '../utils.ts';
import { Loader, AlertTriangle, CheckCircle, FileText } from './Icons.tsx';

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
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-slate-800 dark:to-slate-900/70 p-4 sm:p-6 rounded-2xl shadow-sm flex items-start gap-3 sm:gap-4">
             <div className="bg-yellow-200 dark:bg-yellow-900/50 p-2 sm:p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-300" />
            </div>
            <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white">アクションアイテム</h3>
                <ul className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 list-disc pl-4 sm:pl-5 space-y-1">
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


const ApplicationsSummaryCard: React.FC<{
  applications: ApplicationWithDetails[];
  currentUser: EmployeeUser | null;
  onNavigateToApplications: () => void;
}> = ({ applications, currentUser, onNavigateToApplications }) => {
    const summary = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const pendingApproval = applications.filter(app => 
            app.status === 'pending_approval' && 
            app.approverId === currentUser?.id
        ).length;

        const mySubmitted = applications.filter(app => 
            app.applicantId === currentUser?.id && 
            app.status === 'pending_approval'
        ).length;

        const thisMonthSubmitted = applications.filter(app => {
            if (!app.submittedAt) return false;
            const submittedDate = new Date(app.submittedAt);
            return submittedDate.getMonth() === currentMonth && 
                   submittedDate.getFullYear() === currentYear;
        }).length;

        const thisMonthApproved = applications.filter(app => {
            if (!app.approvedAt) return false;
            const approvedDate = new Date(app.approvedAt);
            return approvedDate.getMonth() === currentMonth && 
                   approvedDate.getFullYear() === currentYear &&
                   app.status === 'approved';
        }).length;

        return { pendingApproval, mySubmitted, thisMonthSubmitted, thisMonthApproved };
    }, [applications, currentUser]);

    return (
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white">申請サマリ</h3>
                <button
                    onClick={onNavigateToApplications}
                    className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
                >
                    承認一覧へ →
                </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-yellow-600 dark:text-yellow-400 mb-1 sm:mb-2" />
                    <p className="text-xl sm:text-3xl font-bold text-yellow-700 dark:text-yellow-300">{summary.pendingApproval}</p>
                    <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 mt-1">承認待ち</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-blue-600 dark:text-blue-400 mb-1 sm:mb-2" />
                    <p className="text-xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300">{summary.mySubmitted}</p>
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">申請中</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-purple-600 dark:text-purple-400 mb-1 sm:mb-2" />
                    <p className="text-xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300">{summary.thisMonthSubmitted}</p>
                    <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 mt-1">今月の申請</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-green-600 dark:text-green-400 mb-1 sm:mb-2" />
                    <p className="text-xl sm:text-3xl font-bold text-green-700 dark:text-green-300">{summary.thisMonthApproved}</p>
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-1">今月の承認</p>
                </div>
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
    <div className={`p-4 sm:p-6 rounded-2xl shadow-sm ${colorClass} flex flex-col min-h-[140px] sm:min-h-[160px]`}>
        <p className="text-sm sm:text-lg font-semibold text-white/90">{title}</p>
        <p className="text-2xl sm:text-5xl font-bold mt-1 sm:mt-2 text-white leading-tight">{formatJPY(value)}</p>
        {(subValue || subLabel) && (
            <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/80 font-medium">
                {subLabel && <span>{subLabel}: </span>}
                {subValue && <span>{subValue}</span>}
            </div>
        )}
        {meterGoal !== undefined && <Meter value={value} goal={meterGoal} />}
        {children && <div className="mt-auto pt-2 sm:pt-4">{children}</div>}
    </div>
);

const MonthlyTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white mb-3 sm:mb-4">月次業績推移</h3>
        <div className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={300} minWidth={600}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                        tickFormatter={(value) => `¥${value / 1000}k`} 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                        formatter={(value: number) => [formatJPY(value), '']}
                        labelStyle={{ color: '#333', fontSize: '12px' }}
                        itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="PQ" name="売上高" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="MQ" name="限界利益" stroke="#8b5cf6" strokeWidth={2} />
                    <Line type="monotone" dataKey="F" name="固定費" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="G" name="利益" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    </div>
);

interface DashboardProps {
  jobs: Job[];
  journalEntries: JournalEntry[];
  accountItems: AccountItem[];
  applications: ApplicationWithDetails[];
  currentUser: EmployeeUser | null;
  pendingApprovalCount: number;
  onNavigateToApprovals: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ jobs, journalEntries, accountItems, applications, currentUser, pendingApprovalCount, onNavigateToApprovals }) => {
    
    const mqData = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

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
        <div className="space-y-4 sm:space-y-6">
            <ActionItemsCard jobs={jobs} pendingApprovalCount={pendingApprovalCount} onNavigateToApprovals={onNavigateToApprovals} />
            
            <ApplicationsSummaryCard 
                applications={applications} 
                currentUser={currentUser} 
                onNavigateToApplications={onNavigateToApprovals} 
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
                <MQCard title="PQ (売上高)" value={pq} colorClass="bg-sky-700 dark:bg-sky-800" meterGoal={MONTHLY_GOALS.pq} />
                <MQCard title="MQ (限界利益)" value={mq} subLabel="m率" subValue={`${mRate}%`} colorClass="bg-indigo-700 dark:bg-indigo-800" meterGoal={MONTHLY_GOALS.mq} />
                <MQCard title="VQ (変動費)" value={vq} colorClass="bg-amber-700 dark:bg-amber-800" meterGoal={MONTHLY_GOALS.vq} />
                <MQCard title="F (固定費)" value={f} subLabel="f/m比率" subValue={`${fmRatio}% [${getFmRatioRank(Number(fmRatio))}]`} colorClass="bg-rose-800 dark:bg-rose-900" meterGoal={MONTHLY_GOALS.f}>
                    <div className={g >= 0 ? 'text-green-300' : 'text-red-300'}>
                        <p className="text-sm sm:text-lg font-semibold">G (利益)</p>
                        <p className="text-2xl sm:text-4xl font-bold">{formatJPY(g)}</p>
                        {g > 0 && <Meter value={g} goal={MONTHLY_GOALS.g} />}
                    </div>
                </MQCard>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {(Object.keys(fBreakdown) as (keyof typeof fBreakdown)[]).map((key, index) => (
                    <div key={key} className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl shadow-sm text-center">
                        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">F{index+1} {['人件費', '経費', '営業外', '戦略費', '償却費'][index]}</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatJPY(fBreakdown[key])}</p>
                    </div>
                ))}
            </div>

            <MonthlyTrendChart data={chartData} />
        </div>
    );
};

export default React.memo(Dashboard);