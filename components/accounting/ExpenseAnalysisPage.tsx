import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getExpenseLinesData,
  getExpenseByMonthAccount,
  getExpenseByMonthSupplier,
  getExpenseByMonthProject
} from '../../services/dataService';
import { analyzeExpenseData } from '../../services/geminiService';
import { Loader, TrendingUp } from '../Icons';
import EmptyState from '../ui/EmptyState';
import SortableHeader from '../ui/SortableHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

type TabType = 'overview' | 'monthly' | 'details' | 'byAccount' | 'bySupplier' | 'byProject';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

const ExpenseAnalysisPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expenseLines, setExpenseLines] = useState<any[]>([]);
  const [byAccount, setByAccount] = useState<any[]>([]);
  const [bySupplier, setBySupplier] = useState<any[]>([]);
  const [byProject, setByProject] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'amount', direction: 'descending' });
  const [aiComment, setAiComment] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // 期間指定
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 月別タブ: 展開中の月
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  // 勘定科目別タブ: 展開中の行キー ("YYYY-MM-DD::account_id")
  const [expandedAccountKey, setExpandedAccountKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lines, accounts, suppliers, projects] = await Promise.all([
          getExpenseLinesData(),
          getExpenseByMonthAccount(),
          getExpenseByMonthSupplier(),
          getExpenseByMonthProject(),
        ]);
        setExpenseLines(lines);
        setByAccount(accounts);
        setBySupplier(suppliers);
        setByProject(projects);
      } catch (err) {
        console.error('Failed to fetch expense analysis data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // -- 期間フィルタ済みデータ --

  const filteredLines = useMemo(() => {
    return expenseLines.filter(line => {
      if (!line.occurred_on) return false;
      const d = line.occurred_on.slice(0, 10); // YYYY-MM-DD
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [expenseLines, dateFrom, dateTo]);

  const filteredByAccount = useMemo(() => {
    return byAccount.filter(item => {
      if (!item.month) return false;
      const m = item.month.slice(0, 10);
      if (dateFrom && m < dateFrom.slice(0, 7) + '-01') return false;
      if (dateTo) {
        const toMonth = dateTo.slice(0, 7) + '-31';
        if (m > toMonth) return false;
      }
      return true;
    });
  }, [byAccount, dateFrom, dateTo]);

  const filteredBySupplier = useMemo(() => {
    return bySupplier.filter(item => {
      if (!item.month) return false;
      const m = item.month.slice(0, 10);
      if (dateFrom && m < dateFrom.slice(0, 7) + '-01') return false;
      if (dateTo) {
        const toMonth = dateTo.slice(0, 7) + '-31';
        if (m > toMonth) return false;
      }
      return true;
    });
  }, [bySupplier, dateFrom, dateTo]);

  const filteredByProject = useMemo(() => {
    return byProject.filter(item => {
      if (!item.month) return false;
      const m = item.month.slice(0, 10);
      if (dateFrom && m < dateFrom.slice(0, 7) + '-01') return false;
      if (dateTo) {
        const toMonth = dateTo.slice(0, 7) + '-31';
        if (m > toMonth) return false;
      }
      return true;
    });
  }, [byProject, dateFrom, dateTo]);

  // -- Derived data --

  const sortedExpenseLines = useMemo(() => {
    const sortableItems = [...filteredLines];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredLines, sortConfig]);

  const totalAmount = useMemo(() => {
    return filteredLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  }, [filteredLines]);

  const accountCount = useMemo(() => {
    return new Set(filteredLines.map(l => l.account_id)).size;
  }, [filteredLines]);

  // 勘定科目別 集計
  const accountSummary = useMemo(() => {
    const map = new Map<string, { name: string; code: string; amount: number }>();
    for (const line of filteredLines) {
      const key = line.account_id || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.amount += line.amount || 0;
      } else {
        map.set(key, { name: line.account_name || '不明', code: line.account_code || '', amount: line.amount || 0 });
      }
    }
    return [...map.values()]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [filteredLines]);

  // 月別推移データ
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of filteredLines) {
      if (!line.occurred_on) continue;
      const d = new Date(line.occurred_on);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + (line.amount || 0));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, m] = month.split('-');
        return { month, label: `${y}/${m}`, amount: Math.round(amount) };
      });
  }, [filteredLines]);

  // 月別詳細データ（月別タブ用）
  const monthlyDetailData = useMemo(() => {
    const map = new Map<string, { month: string; label: string; total: number; lines: any[]; accounts: Map<string, { code: string; name: string; amount: number }> }>();
    for (const line of filteredLines) {
      if (!line.occurred_on) continue;
      const d = new Date(line.occurred_on);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let entry = map.get(key);
      if (!entry) {
        const [y, m] = key.split('-');
        entry = { month: key, label: `${y}年${parseInt(m)}月`, total: 0, lines: [], accounts: new Map() };
        map.set(key, entry);
      }
      entry.total += line.amount || 0;
      entry.lines.push(line);
      const accKey = line.account_id || 'unknown';
      const acc = entry.accounts.get(accKey);
      if (acc) {
        acc.amount += line.amount || 0;
      } else {
        entry.accounts.set(accKey, { code: line.account_code || '', name: line.account_name || '不明', amount: line.amount || 0 });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredLines]);

  // 仕入先別 集計
  const supplierSummary = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>();
    for (const line of filteredLines) {
      const key = line.supplier_name || '(未設定)';
      const existing = map.get(key);
      if (existing) {
        existing.amount += line.amount || 0;
      } else {
        map.set(key, { name: key, amount: line.amount || 0 });
      }
    }
    return [...map.values()]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [filteredLines]);

  // -- AI Analysis --

  const runAiAnalysis = useCallback(async () => {
    if (filteredLines.length === 0) return;
    setAiLoading(true);
    try {
      const result = await analyzeExpenseData({
        totalAmount,
        lineCount: filteredLines.length,
        accountCount,
        topAccounts: accountSummary.slice(0, 5).map(a => ({ name: a.name, amount: Math.round(a.amount) })),
        topSuppliers: supplierSummary.filter(s => s.name !== '(未設定)').slice(0, 5).map(s => ({ name: s.name, amount: Math.round(s.amount) })),
        monthlyTrend: monthlyChartData.map(m => ({ month: m.label, amount: m.amount })),
      });
      setAiComment(result);
    } catch (err) {
      setAiComment('AI分析を実行できませんでした。');
      console.error('AI expense analysis failed:', err);
    } finally {
      setAiLoading(false);
    }
  }, [filteredLines, totalAmount, accountCount, accountSummary, supplierSummary, monthlyChartData]);

  // -- Helpers --

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || amount === 0) return '-';
    return `¥${Math.abs(amount).toLocaleString()}`;
  };

  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('ja-JP');
    } catch {
      return date;
    }
  };

  const formatMonth = (month: string | null | undefined): string => {
    if (!month) return '-';
    try {
      const d = new Date(month);
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    } catch {
      return month;
    }
  };

  // -- TSV生成（スプレッドシート貼り付け用） --

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const generateMonthlyTSV = useCallback(() => {
    if (monthlyDetailData.length === 0) return '';
    const allAccounts = new Map<string, { code: string; name: string }>();
    for (const md of monthlyDetailData) {
      for (const [key, acc] of md.accounts) {
        if (!allAccounts.has(key)) {
          allAccounts.set(key, { code: acc.code, name: acc.name });
        }
      }
    }
    const accountList = [...allAccounts.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
    const months = [...monthlyDetailData].sort((a, b) => a.month.localeCompare(b.month));
    const header = ['科目コード', '勘定科目', ...months.map(m => m.label)].join('\t');
    const rows = accountList.map(([accKey, acc]) => {
      const values = months.map(md => {
        const found = md.accounts.get(accKey);
        return found ? Math.round(found.amount) : '';
      });
      return [acc.code, acc.name, ...values].join('\t');
    });
    const totalRow = ['', '合計', ...months.map(m => Math.round(m.total))].join('\t');
    return [header, ...rows, totalRow].join('\n');
  }, [monthlyDetailData]);

  const generateByAccountTSV = useCallback(() => {
    if (filteredByAccount.length === 0) return '';
    const monthSet = new Set<string>();
    const accountMap = new Map<string, { code: string; name: string; byMonth: Map<string, number> }>();
    for (const item of filteredByAccount) {
      const mk = item.month ? item.month.slice(0, 7) : '';
      if (!mk) continue;
      monthSet.add(mk);
      const ak = item.account_id || item.account_code || 'x';
      if (!accountMap.has(ak)) {
        accountMap.set(ak, { code: item.account_code || '', name: item.account_name || '不明', byMonth: new Map() });
      }
      const prev = accountMap.get(ak)!.byMonth.get(mk) || 0;
      accountMap.get(ak)!.byMonth.set(mk, prev + Number(item.total_amount || 0));
    }
    const months = [...monthSet].sort();
    const accounts = [...accountMap.values()]
      .map(a => ({ ...a, total: [...a.byMonth.values()].reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total);
    const monthLabels = months.map(m => { const [y, mo] = m.split('-'); return `${y}年${parseInt(mo)}月`; });
    const header = ['コード', '科目名', ...monthLabels, '合計'].join('\t');
    const rows = accounts.map(a => {
      const vals = months.map(m => Math.round(a.byMonth.get(m) || 0) || '');
      return [a.code, a.name, ...vals, Math.round(a.total)].join('\t');
    });
    const monthTotals = months.map(m => accounts.reduce((s, a) => s + (a.byMonth.get(m) || 0), 0));
    const grandTotal = monthTotals.reduce((s, n) => s + n, 0);
    const totalRow = ['', '月合計', ...monthTotals.map(t => Math.round(t)), Math.round(grandTotal)].join('\t');
    return [header, ...rows, totalRow].join('\n');
  }, [filteredByAccount]);

  const generateBySupplierTSV = useCallback(() => {
    if (filteredBySupplier.length === 0) return '';
    const header = ['月', '仕入先名', '件数', '金額'].join('\t');
    const rows = filteredBySupplier.map(item =>
      [formatMonth(item.month), item.supplier_name || '', item.line_count, Math.round(item.total_amount || 0)].join('\t')
    );
    return [header, ...rows].join('\n');
  }, [filteredBySupplier]);

  const generateByProjectTSV = useCallback(() => {
    if (filteredByProject.length === 0) return '';
    const header = ['月', 'プロジェクトコード', '件数', '金額'].join('\t');
    const rows = filteredByProject.map(item =>
      [formatMonth(item.month), item.project_code || '', item.line_count, Math.round(item.total_amount || 0)].join('\t')
    );
    return [header, ...rows].join('\n');
  }, [filteredByProject]);

  const generateDetailsTSV = useCallback(() => {
    if (sortedExpenseLines.length === 0) return '';
    const header = ['発生日', '科目コード', '勘定科目', '仕入先/摘要', '金額'].join('\t');
    const rows = sortedExpenseLines.map(line =>
      [line.occurred_on?.slice(0, 10) || '', line.account_code || '', line.account_name || '', line.supplier_name || '', Math.round(line.amount || 0)].join('\t')
    );
    return [header, ...rows].join('\n');
  }, [sortedExpenseLines]);

  const requestSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
      }
      return { key, direction: 'descending' };
    });
  };

  const tooltipFormatter = (value: number) => [`¥${value.toLocaleString()}`, '金額'];

  const renderCopyButton = (generator: () => string) => (
    <div className="flex justify-end mb-2">
      <button
        onClick={() => copyToClipboard(generator())}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow transition-colors ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-600'
        }`}
      >
        {copied ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            コピー済み
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            スプレッドシート用コピー
          </>
        )}
      </button>
    </div>
  );

  // -- Pie chart data --
  const pieData = useMemo(() => {
    const top = accountSummary.slice(0, 8);
    const rest = accountSummary.slice(8);
    const restAmount = rest.reduce((s, a) => s + Math.abs(a.amount), 0);
    const result = top.map(a => ({ name: a.name, value: Math.abs(a.amount) }));
    if (restAmount > 0) {
      result.push({ name: 'その他', value: restAmount });
    }
    return result;
  }, [accountSummary]);

  // -- 期間クイック選択 --
  const setQuickRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'all') => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    switch (range) {
      case 'thisMonth':
        setDateFrom(`${yyyy}-${mm}-01`);
        setDateTo('');
        break;
      case 'lastMonth': {
        const prev = new Date(yyyy, now.getMonth() - 1, 1);
        const lastDay = new Date(yyyy, now.getMonth(), 0).getDate();
        const pm = String(prev.getMonth() + 1).padStart(2, '0');
        setDateFrom(`${prev.getFullYear()}-${pm}-01`);
        setDateTo(`${prev.getFullYear()}-${pm}-${String(lastDay).padStart(2, '0')}`);
        break;
      }
      case 'last3Months': {
        const three = new Date(yyyy, now.getMonth() - 2, 1);
        const tm = String(three.getMonth() + 1).padStart(2, '0');
        setDateFrom(`${three.getFullYear()}-${tm}-01`);
        setDateTo('');
        break;
      }
      case 'thisYear':
        setDateFrom(`${yyyy}-01-01`);
        setDateTo('');
        break;
      case 'all':
        setDateFrom('');
        setDateTo('');
        break;
    }
  };

  // -- Loading / Empty --

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  const hasData = expenseLines.length > 0 || byAccount.length > 0 || bySupplier.length > 0 || byProject.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-8">
        <EmptyState
          icon={TrendingUp}
          title="データ未集計"
          message="経費データがまだ集計されていません"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">経費分析</h2>
        <button
          onClick={runAiAnalysis}
          disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 text-sm font-medium shadow"
        >
          {aiLoading ? <Loader className="animate-spin h-4 w-4" /> : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          )}
          AI分析
        </button>
      </div>

      {/* 期間指定フィルタ */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">期間:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-500">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
          />
          <div className="flex gap-1 ml-2">
            {([
              { label: '今月', value: 'thisMonth' as const },
              { label: '先月', value: 'lastMonth' as const },
              { label: '3ヶ月', value: 'last3Months' as const },
              { label: '今年', value: 'thisYear' as const },
              { label: '全期間', value: 'all' as const },
            ]).map(q => (
              <button
                key={q.value}
                onClick={() => setQuickRange(q.value)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-300 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
          {(dateFrom || dateTo) && (
            <span className="text-xs text-gray-500 ml-2">
              {filteredLines.length.toLocaleString()}件 / {expenseLines.length.toLocaleString()}件
            </span>
          )}
        </div>
      </div>

      {/* AI Comment */}
      {aiComment && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <span className="font-semibold text-purple-800 dark:text-purple-300">AI経費分析コメント</span>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {aiComment}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">総経費額</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border-l-4 border-green-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">明細件数</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {filteredLines.length.toLocaleString()}件
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border-l-4 border-amber-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">勘定科目数</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {accountCount}科目
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border-l-4 border-purple-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">月平均経費</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {monthlyChartData.length > 0
              ? formatCurrency(Math.round(totalAmount / monthlyChartData.length))
              : '-'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {([
            { id: 'overview' as TabType, label: '概要・グラフ' },
            { id: 'monthly' as TabType, label: '月別' },
            { id: 'details' as TabType, label: '明細一覧' },
            { id: 'byAccount' as TabType, label: '勘定科目別' },
            { id: 'bySupplier' as TabType, label: '仕入先別' },
            { id: 'byProject' as TabType, label: 'プロジェクト別' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {monthlyChartData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">月別経費推移</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={tooltipFormatter} />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="金額" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pieData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">勘定科目別構成</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`¥${value.toLocaleString()}`, '金額']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">科目別ランキング（金額順）</h3>
                <div className="space-y-3">
                  {accountSummary.slice(0, 10).map((item, i) => {
                    const pct = totalAmount > 0 ? (Math.abs(item.amount) / Math.abs(totalAmount)) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i < 3 ? 'bg-blue-500' : 'bg-gray-400'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                              <span className="text-gray-400 font-mono text-xs mr-1">{item.code}</span>
                              {item.name}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-white ml-2">{formatCurrency(item.amount)}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MONTHLY TAB ===== */}
        {activeTab === 'monthly' && (
          <div className="space-y-4">
            {monthlyDetailData.length > 0 && renderCopyButton(generateMonthlyTSV)}
            {monthlyDetailData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="データなし" message="選択期間にデータがありません" />
            ) : (
              monthlyDetailData.map(md => {
                const isExpanded = expandedMonth === md.month;
                const sortedAccounts = [...md.accounts.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
                return (
                  <div key={md.month} className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                    {/* Month header */}
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : md.month)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <svg className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <span className="text-lg font-semibold text-slate-800 dark:text-white">{md.label}</span>
                        <span className="text-sm text-gray-500">{md.lines.length}件</span>
                      </div>
                      <span className="text-xl font-bold text-slate-800 dark:text-white">
                        {formatCurrency(md.total)}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        {/* 科目別サマリー */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">科目別内訳</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {sortedAccounts.map((acc, i) => {
                              const pct = md.total > 0 ? (Math.abs(acc.amount) / Math.abs(md.total)) * 100 : 0;
                              return (
                                <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded px-3 py-2">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                  <span className="text-xs font-mono text-gray-400">{acc.code}</span>
                                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{acc.name}</span>
                                  <span className="text-sm font-semibold text-slate-800 dark:text-white whitespace-nowrap">{formatCurrency(acc.amount)}</span>
                                  <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 明細テーブル */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">日付</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">科目</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">仕入先/摘要</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">金額</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {[...md.lines].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0)).map((line, i) => (
                                <tr key={line.journal_line_id || i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatDate(line.occurred_on)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                    <span className="font-mono text-xs text-gray-400 mr-1">{line.account_code}</span>
                                    {line.account_name || '-'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{line.supplier_name || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== DETAILS TAB ===== */}
        {activeTab === 'details' && (
          <div>
            {filteredLines.length > 0 && renderCopyButton(generateDetailsTSV)}
            <div className="overflow-x-auto">
            {filteredLines.length === 0 ? (
              <EmptyState icon={TrendingUp} title="データなし" message="選択期間にデータがありません" />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <SortableHeader label="発生日" sortKey="occurred_on" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="科目コード" sortKey="account_code" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="勘定科目" sortKey="account_name" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="仕入先/摘要" sortKey="supplier_name" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="金額" sortKey="amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {sortedExpenseLines.map((line, index) => (
                    <tr key={line.journal_line_id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDate(line.occurred_on)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{line.account_code || '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{line.account_name || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{line.supplier_name || '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        )}

        {/* ===== BY ACCOUNT TAB (ピボット表) ===== */}
        {activeTab === 'byAccount' && (() => {
          if (filteredByAccount.length === 0) {
            return <EmptyState icon={TrendingUp} title="データなし" message="選択期間にデータがありません" />;
          }
          const monthSet = new Set<string>();
          type AccEntry = { id: string; code: string; name: string; byMonth: Map<string, number> };
          const accountMap = new Map<string, AccEntry>();
          for (const item of filteredByAccount) {
            const mk = item.month ? item.month.slice(0, 7) : '';
            if (!mk) continue;
            monthSet.add(mk);
            const ak = item.account_id || item.account_code || 'x';
            if (!accountMap.has(ak)) {
              accountMap.set(ak, { id: item.account_id || ak, code: item.account_code || '', name: item.account_name || '不明', byMonth: new Map() });
            }
            const prev = accountMap.get(ak)!.byMonth.get(mk) || 0;
            accountMap.get(ak)!.byMonth.set(mk, prev + Number(item.total_amount || 0));
          }
          const months = [...monthSet].sort();
          const accounts = [...accountMap.values()]
            .map(a => ({ ...a, total: [...a.byMonth.values()].reduce((s, n) => s + n, 0) }))
            .sort((a, b) => b.total - a.total);
          const monthTotals = months.map(m => accounts.reduce((s, a) => s + (a.byMonth.get(m) || 0), 0));
          const grandTotal = monthTotals.reduce((s, n) => s + n, 0);

          return (
            <div>
              {renderCopyButton(generateByAccountTSV)}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                      <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-700 px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600 w-16">コード</th>
                      <th className="sticky left-[72px] z-10 bg-slate-100 dark:bg-slate-700 px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600 min-w-[180px]">科目名</th>
                      {months.map(m => {
                        const [y, mo] = m.split('-');
                        return (
                          <th key={m} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 border-l border-slate-100 dark:border-slate-600 min-w-[120px]">
                            {y}年{parseInt(mo)}月
                          </th>
                        );
                      })}
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-blue-700 dark:text-blue-300 border-l border-slate-200 dark:border-slate-600 bg-blue-50 dark:bg-blue-900/20 min-w-[130px]">合計</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {accounts.map(acc => {
                      const openCellMonth = expandedAccountKey?.startsWith(`${acc.id}::`) ? expandedAccountKey.slice(acc.id.length + 2) : null;
                      const detailLines = openCellMonth
                        ? filteredLines.filter(l => l.account_id === acc.id && l.occurred_on && l.occurred_on.slice(0, 7) === openCellMonth)
                            .sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
                        : [];
                      return (
                        <React.Fragment key={acc.id}>
                          <tr className="group hover:bg-slate-50 dark:hover:bg-slate-700/40">
                            <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/40 px-3 py-2.5 font-mono text-xs text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700">{acc.code}</td>
                            <td className="sticky left-[72px] z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/40 px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-700 min-w-[180px]">{acc.name}</td>
                            {months.map(m => {
                              const amt = acc.byMonth.get(m) || 0;
                              const cellKey = `${acc.id}::${m}`;
                              const isActive = expandedAccountKey === cellKey;
                              return (
                                <td
                                  key={m}
                                  onClick={() => amt > 0 && setExpandedAccountKey(isActive ? null : cellKey)}
                                  className={`px-4 py-2.5 text-right font-mono border-l border-slate-50 dark:border-slate-700/50 transition-colors
                                    ${amt > 0 ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-slate-200 dark:text-slate-700'}
                                    ${isActive ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' : amt > 0 ? 'text-slate-800 dark:text-slate-100' : ''}`}
                                >
                                  {amt > 0 ? `¥${Math.round(amt).toLocaleString()}` : '−'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300 border-l border-blue-100 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10">
                              ¥{Math.round(acc.total).toLocaleString()}
                            </td>
                          </tr>
                          {openCellMonth && (
                            <tr>
                              <td colSpan={2 + months.length + 1} className="p-0">
                                <div className="bg-blue-50 dark:bg-blue-900/10 border-b border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center justify-between px-6 py-2 bg-blue-100/60 dark:bg-blue-800/30">
                                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                                      {openCellMonth.split('-').map((v, i) => i === 0 ? `${v}年` : `${parseInt(v)}月`).join('')}
                                      {' / '}{acc.code} {acc.name} — {detailLines.length}件
                                    </span>
                                    <button onClick={() => setExpandedAccountKey(null)} className="text-xs text-blue-500 hover:text-blue-700">✕ 閉じる</button>
                                  </div>
                                  {detailLines.length === 0 ? (
                                    <p className="px-8 py-3 text-sm text-gray-400">明細データが見つかりません</p>
                                  ) : (
                                    <table className="min-w-full">
                                      <thead>
                                        <tr className="border-b border-blue-100 dark:border-blue-800/50">
                                          <th className="px-8 py-1.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-300">日付</th>
                                          <th className="px-4 py-1.5 text-left text-xs font-semibold text-blue-700 dark:text-blue-300">支払先 / 摘要</th>
                                          <th className="px-4 py-1.5 text-right text-xs font-semibold text-blue-700 dark:text-blue-300">金額</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-blue-100/70 dark:divide-blue-800/20">
                                        {detailLines.map((line, li) => (
                                          <tr key={line.journal_line_id || li} className="hover:bg-blue-100/40">
                                            <td className="px-8 py-1.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(line.occurred_on)}</td>
                                            <td className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate">{line.supplier_name || line.entry_description || line.description || '−'}</td>
                                            <td className="px-4 py-1.5 text-sm text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatCurrency(line.amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-700 font-bold border-t-2 border-slate-300 dark:border-slate-500">
                      <td colSpan={2} className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-700 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-600">月合計</td>
                      {monthTotals.map((total, i) => (
                        <td key={i} className="px-4 py-2.5 text-right font-mono text-sm text-slate-800 dark:text-slate-100 border-l border-slate-100 dark:border-slate-600">
                          ¥{Math.round(total).toLocaleString()}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-blue-700 dark:text-blue-300 border-l border-blue-200 dark:border-blue-800 bg-blue-100/50 dark:bg-blue-900/20">
                        ¥{Math.round(grandTotal).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 px-1 text-xs text-gray-400">※ 金額セルをクリックすると、その月・科目の明細が展開されます</p>
            </div>
          );
        })()}

        {/* ===== BY SUPPLIER TAB ===== */}
        {activeTab === 'bySupplier' && (
          <div>
            {filteredBySupplier.length > 0 && renderCopyButton(generateBySupplierTSV)}
            <div className="overflow-x-auto">
            {filteredBySupplier.length === 0 ? (
              <EmptyState icon={TrendingUp} title="データなし" message="選択期間にデータがありません" />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">月</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">仕入先名</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">件数</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">金額</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {filteredBySupplier.map((item, index) => (
                    <tr key={`${item.month}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatMonth(item.month)}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">{item.supplier_name || '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">{item.line_count}件</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        )}

        {/* ===== BY PROJECT TAB ===== */}
        {activeTab === 'byProject' && (
          <div>
            {filteredByProject.length > 0 && renderCopyButton(generateByProjectTSV)}
            <div className="overflow-x-auto">
            {filteredByProject.length === 0 ? (
              <EmptyState icon={TrendingUp} title="データなし" message="選択期間にデータがありません" />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">月</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">プロジェクトコード</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">件数</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">金額</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {filteredByProject.map((item, index) => (
                    <tr key={`${item.month}-${item.project_id || index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatMonth(item.month)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.project_code || '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">{item.line_count}件</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseAnalysisPage;
