import React, { useEffect, useMemo, useState } from 'react';
import PageShell from './ui/PageShell';
import { ApprovalRoute, ApplicationWithDetails, EmployeeUser, Toast } from '../types';
import { getApprovalRoutes, getDailyReportApplicationsByMonth, getUsers } from '../services/dataService';
import { Loader } from './Icons';

type SubmissionStatus = 'submitted' | 'missing_today' | 'overdue' | 'upcoming';

type DailyReportSubmission = {
  id: string;
  userId: string;
  reportDate: string;
  startTime?: string;
  endTime?: string;
  submittedAt?: string | null;
  status?: string;
  approvalRouteId?: string;
};

type DailyReportProgressPageProps = {
  currentUser: EmployeeUser | null;
  addToast?: (message: string, type: Toast['type']) => void;
};

const DEFAULT_END_TIME = '18:00';

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const addMonths = (monthKey: string, offset: number) => {
  const [yearPart, monthPart] = monthKey.split('-').map(Number);
  const year = Number.isFinite(yearPart) ? yearPart : new Date().getFullYear();
  const month = Number.isFinite(monthPart) ? monthPart : new Date().getMonth() + 1;
  const next = new Date(year, month - 1 + offset, 1);
  return formatMonthKey(next);
};

const buildMonthDates = (monthKey: string) => {
  const [yearPart, monthPart] = monthKey.split('-').map(Number);
  const year = Number.isFinite(yearPart) ? yearPart : new Date().getFullYear();
  const month = Number.isFinite(monthPart) ? monthPart : new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${year}-${String(month).padStart(2, '0')}-${day}`;
  });
};

const extractDatePart = (value?: string | null): string | null => {
  if (!value) return null;
  const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  return null;
};

const formatDateLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
};

const formatTimeLabel = (iso?: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date);
};

const parseTimeToMinutes = (value?: string | null) => {
  if (!value) return null;
  const [hourPart, minutePart] = value.split(':').map(Number);
  if (!Number.isFinite(hourPart) || !Number.isFinite(minutePart)) return null;
  return hourPart * 60 + minutePart;
};

const getStatusForDate = (
  date: string,
  report: DailyReportSubmission | undefined,
  expectedEndTime: string,
  now: Date,
): SubmissionStatus => {
  if (report) return 'submitted';
  const todayIso = now.toISOString().slice(0, 10);
  if (date > todayIso) return 'upcoming';
  if (date < todayIso) return 'overdue';
  const endMinutes = parseTimeToMinutes(expectedEndTime) ?? parseTimeToMinutes(DEFAULT_END_TIME) ?? 18 * 60;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes < endMinutes ? 'missing_today' : 'overdue';
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: '提出済',
  missing_today: '未提出(当日)',
  overdue: '未提出(遅延)',
  upcoming: '対象外',
};

const STATUS_BADGE_CLASS: Record<SubmissionStatus, string> = {
  submitted: 'bg-emerald-100 text-emerald-700',
  missing_today: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-700',
  upcoming: 'bg-slate-100 text-slate-500',
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending_approval: '承認待ち',
  approved: '承認済',
  rejected: '差戻し',
  draft: '下書き',
};

const resolveDepartmentName = (user: EmployeeUser | null) => {
  if (!user) return '未設定';
  return (
    (user as any).department ||
    (user as any).department_name ||
    (user as any).departmentName ||
    user.department_id ||
    '未設定'
  );
};

const DailyReportProgressPage: React.FC<DailyReportProgressPageProps> = ({ currentUser, addToast }) => {
  const [monthKey, setMonthKey] = useState<string>(() => formatMonthKey(new Date()));
  const [users, setUsers] = useState<EmployeeUser[]>([]);
  const [approvalRoutes, setApprovalRoutes] = useState<ApprovalRoute[]>([]);
  const [reports, setReports] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('late_first');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [usersData, routesData, reportData] = await Promise.all([
          getUsers(),
          getApprovalRoutes(),
          getDailyReportApplicationsByMonth(monthKey),
        ]);
        if (!isMounted) return;
        setUsers(usersData || []);
        setApprovalRoutes(routesData || []);
        setReports(reportData || []);
      } catch (err: any) {
        if (!isMounted) return;
        const message = err?.message || '日報提出状況の取得に失敗しました。';
        setError(message);
        addToast?.(message, 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [monthKey, addToast]);

  const isApprover = useMemo(() => {
    if (!currentUser?.id) return false;
    return approvalRoutes.some((route) =>
      route.routeData?.steps?.some((step: any) => step?.approverId === currentUser.id),
    );
  }, [approvalRoutes, currentUser?.id]);

  const canViewAll = currentUser?.role === 'admin' || isApprover;

  const submissions = useMemo<DailyReportSubmission[]>(() => {
    return reports
      .map((app) => {
        const formData = app.formData ?? {};
        const reportDate =
          (typeof formData.reportDate === 'string' && formData.reportDate) ||
          extractDatePart(app.submittedAt ?? app.createdAt) ||
          '';
        if (!reportDate) return null;
        return {
          id: app.id,
          userId: app.applicantId ?? app.applicant?.id ?? '',
          reportDate,
          startTime: typeof formData.startTime === 'string' ? formData.startTime : undefined,
          endTime: typeof formData.endTime === 'string' ? formData.endTime : undefined,
          submittedAt: app.submittedAt ?? null,
          status: app.status,
          approvalRouteId: app.approvalRouteId ?? app.approvalRoute?.id,
        } as DailyReportSubmission;
      })
      .filter((entry): entry is DailyReportSubmission => Boolean(entry && entry.userId));
  }, [reports]);

  const submissionsByUser = useMemo(() => {
    const map = new Map<string, DailyReportSubmission[]>();
    submissions.forEach((entry) => {
      if (!map.has(entry.userId)) map.set(entry.userId, []);
      map.get(entry.userId)?.push(entry);
    });
    map.forEach((entries) => entries.sort((a, b) => b.reportDate.localeCompare(a.reportDate)));
    return map;
  }, [submissions]);

  const monthDates = useMemo(() => buildMonthDates(monthKey), [monthKey]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const currentMonthKey = useMemo(() => formatMonthKey(new Date()), []);
  const isFutureMonth = monthKey > currentMonthKey;
  const isPastMonth = monthKey < currentMonthKey;
  const todayInMonth = monthKey === currentMonthKey;
  const daysInMonth = monthDates.length;
  const daysConsidered = isFutureMonth ? 0 : todayInMonth ? new Date().getDate() : daysInMonth;

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((user) => set.add(resolveDepartmentName(user)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [users]);

  const rows = useMemo(() => {
    const now = new Date();
    const baseUsers = canViewAll
      ? users
      : users.filter((user) => user.id && user.id === currentUser?.id);

    return baseUsers.map((user) => {
      const userReports = submissionsByUser.get(user.id) || [];
      const reportByDate = new Map(userReports.map((entry) => [entry.reportDate, entry]));
      const latestReport = userReports[0];
      const expectedEndTime = latestReport?.endTime || DEFAULT_END_TIME;
      const todayStatus = todayInMonth && monthDates.includes(todayIso)
        ? getStatusForDate(todayIso, reportByDate.get(todayIso), expectedEndTime, now)
        : null;
      const yesterdayStatus = todayInMonth && monthDates.includes(yesterdayIso)
        ? getStatusForDate(yesterdayIso, reportByDate.get(yesterdayIso), expectedEndTime, now)
        : null;
      const overdueCount = monthDates.filter((date) => {
        if (isFutureMonth) return false;
        if (!isPastMonth && date > todayIso) return false;
        if (reportByDate.has(date)) return false;
        if (!isPastMonth && date === todayIso) {
          return todayStatus === 'overdue';
        }
        return true;
      }).length;
      const submittedCount = monthDates.filter((date) => {
        if (daysConsidered === 0) return false;
        if (!isPastMonth && date > todayIso) return false;
        return reportByDate.has(date);
      }).length;
      const submissionRate = daysConsidered > 0 ? Math.round((submittedCount / daysConsidered) * 100) : null;
      const routeId = latestReport?.approvalRouteId || '';
      const overallStatus: SubmissionStatus = overdueCount > 0
        ? 'overdue'
        : todayStatus || 'upcoming';

      return {
        user,
        department: resolveDepartmentName(user),
        todayStatus,
        yesterdayStatus,
        submissionRate,
        submittedCount,
        overdueCount,
        lastReportDate: latestReport?.reportDate || '',
        overallStatus,
        routeId,
        reportByDate,
      };
    });
  }, [
    users,
    canViewAll,
    currentUser?.id,
    submissionsByUser,
    monthDates,
    todayIso,
    yesterdayIso,
    todayInMonth,
    daysConsidered,
    isFutureMonth,
    isPastMonth,
  ]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => (departmentFilter === 'all' ? true : row.department === departmentFilter))
      .filter((row) => {
        if (routeFilter === 'all') return true;
        if (routeFilter === 'unassigned') return !row.routeId;
        return row.routeId === routeFilter;
      })
      .filter((row) => {
        if (statusFilter === 'all') return true;
        return row.overallStatus === statusFilter;
      })
      .sort((a, b) => {
        const statusWeight = (status: SubmissionStatus | null) => {
          if (status === 'overdue') return 3;
          if (status === 'missing_today') return 2;
          if (status === 'submitted') return 1;
          return 0;
        };
        if (sortKey === 'delay_days') {
          return b.overdueCount - a.overdueCount;
        }
        if (sortKey === 'submission_rate') {
          const aRate = a.submissionRate ?? -1;
          const bRate = b.submissionRate ?? -1;
          return aRate - bRate;
        }
        const diff = statusWeight(b.overallStatus) - statusWeight(a.overallStatus);
        if (diff !== 0) return diff;
        return a.user.name.localeCompare(b.user.name, 'ja');
      });
  }, [rows, departmentFilter, routeFilter, statusFilter, sortKey]);

  const routeOptions = useMemo(
    () => approvalRoutes.map((route) => ({ id: route.id, name: route.name })),
    [approvalRoutes],
  );

  const renderStatusBadge = (status: SubmissionStatus | null) => {
    if (!status) return <span className="text-xs text-slate-400">-</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_BADGE_CLASS[status]}`}>
        {STATUS_LABELS[status]}
      </span>
    );
  };

  return (
    <PageShell className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">日報提出進捗</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {canViewAll ? '提出状況を一覧で把握できます。' : '自分の提出状況を確認できます。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthKey((prev) => addMonths(prev, -1))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            前月
          </button>
          <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold">
            {monthKey.replace('-', '年')}月
          </div>
          <button
            type="button"
            onClick={() => setMonthKey((prev) => addMonths(prev, 1))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            翌月
          </button>
        </div>
      </div>

      {canViewAll && (
        <div className="flex flex-wrap gap-3">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="all">部署: すべて</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="all">承認ルート: すべて</option>
            <option value="unassigned">承認ルート: 未設定</option>
            {routeOptions.map((route) => (
              <option key={route.id} value={route.id}>{route.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="all">提出状態: すべて</option>
            <option value="submitted">提出済</option>
            <option value="missing_today">未提出(当日)</option>
            <option value="overdue">未提出(遅延)</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="late_first">並び順: 未提出優先</option>
            <option value="delay_days">並び順: 遅延日数順</option>
            <option value="submission_rate">並び順: 提出率昇順</option>
          </select>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader className="w-5 h-5 animate-spin" />
            読み込み中...
          </div>
        )}
        {!isLoading && error && (
          <div className="py-10 text-center text-sm text-rose-600">{error}</div>
        )}
        {!isLoading && !error && (
          <table>
            <thead>
              <tr>
                <th className="text-left">ユーザー名</th>
                <th className="text-left">部署</th>
                <th className="text-left">本日</th>
                <th className="text-left">前日</th>
                <th className="text-left">今月提出率</th>
                <th className="text-left">最終提出日</th>
                <th className="text-left">状態</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-sm text-slate-500 py-8">
                    表示できるデータがありません。
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => {
                const isExpanded = expandedUserId === row.user.id;
                const rateLabel = row.submissionRate === null
                  ? '対象外'
                  : `${row.submissionRate}% (${row.submittedCount}/${daysConsidered})`;
                return (
                  <React.Fragment key={row.user.id}>
                    <tr
                      className="cursor-pointer"
                      onClick={() => setExpandedUserId(isExpanded ? null : row.user.id)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{row.user.name}</span>
                        </div>
                      </td>
                      <td>{row.department}</td>
                      <td>{renderStatusBadge(row.todayStatus)}</td>
                      <td>{renderStatusBadge(row.yesterdayStatus)}</td>
                      <td>{rateLabel}</td>
                      <td>{row.lastReportDate ? formatDateLabel(row.lastReportDate) : '-'}</td>
                      <td>{renderStatusBadge(row.overallStatus)}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50 dark:bg-slate-800/60">
                          <div className="p-4">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">日付別詳細</p>
                            <div className="overflow-x-auto">
                              <table>
                                <thead>
                                  <tr>
                                    <th className="text-left">日付</th>
                                    <th className="text-left">業務時間</th>
                                    <th className="text-left">提出時刻</th>
                                    <th className="text-left">承認状況</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {monthDates.map((date) => {
                                    const report = row.reportByDate.get(date);
                                    const approvalLabel = report
                                      ? APPROVAL_STATUS_LABELS[report.status || ''] || '提出済'
                                      : '未提出';
                                    const workTime = report
                                      ? `${report.startTime || '--:--'} 〜 ${report.endTime || '--:--'}`
                                      : '-';
                                    return (
                                      <tr key={date}>
                                        <td>{formatDateLabel(date)}</td>
                                        <td>{workTime}</td>
                                        <td>{formatTimeLabel(report?.submittedAt)}</td>
                                        <td>{approvalLabel}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
};

export default DailyReportProgressPage;
