import React, { useEffect, useMemo, useState } from 'react';
import { EmployeeUser, ApplicationWithDetails, JournalEntry } from '../../types';
import { getSupabase } from '../../services/supabaseClient';
import { formatJPY } from '../../utils';
import {
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Eye,
  ArrowRight
} from '../Icons';

interface AdminDashboardProps {
  currentUser: EmployeeUser;
  onNavigateToExpenseApprovals: () => void;
  onNavigateToJournalReview: () => void;
  onNavigateToReceivables: () => void;
  onNavigateToPayables: () => void;
  onNavigateToCashIn: () => void;
  onNavigateToCashOut: () => void;
}

interface DashboardStats {
  pendingExpenseCount: number;
  pendingExpenseAmount: number;
  approvedExpenseCount: number;
  approvedExpenseAmount: number;
  pendingJournalCount: number;
  receivablesCount: number;
  receivablesAmount: number;
  payablesCount: number;
  payablesAmount: number;
  cashInScheduleCount: number;
  cashInScheduleAmount: number;
  cashOutScheduleCount: number;
  cashOutScheduleAmount: number;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onNavigateToExpenseApprovals,
  onNavigateToJournalReview,
  onNavigateToReceivables,
  onNavigateToPayables,
  onNavigateToCashIn,
  onNavigateToCashOut,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    pendingExpenseCount: 0,
    pendingExpenseAmount: 0,
    approvedExpenseCount: 0,
    approvedExpenseAmount: 0,
    pendingJournalCount: 0,
    receivablesCount: 0,
    receivablesAmount: 0,
    payablesCount: 0,
    payablesAmount: 0,
    cashInScheduleCount: 0,
    cashInScheduleAmount: 0,
    cashOutScheduleCount: 0,
    cashOutScheduleAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  // 経費申請データ取得
  const fetchExpenseStats = async () => {
    try {
      const supabase = getSupabase();

      // 未承認の経費申請
      const { data: pendingData, error: pendingError } = await supabase
        .from('applications')
        .select('*')
        .eq('status', 'pending_approval');

      // 承認済みの経費申請（今月）
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: approvedData, error: approvedError } = await supabase
        .from('applications')
        .select('*')
        .eq('status', 'approved')
        .like('created_at', `${currentMonth}%`);

      if (pendingError || approvedError) {
        console.error('Error fetching expense stats:', pendingError || approvedError);
        return;
      }

      const pendingAmount = (pendingData || []).reduce((sum, app) => {
        const formData = app.formData as any;
        const amount = formData?.totalAmount || formData?.amount || 0;
        return sum + Number(amount);
      }, 0);

      const approvedAmount = (approvedData || []).reduce((sum, app) => {
        const formData = app.formData as any;
        const amount = formData?.totalAmount || formData?.amount || 0;
        return sum + Number(amount);
      }, 0);

      return {
        pendingExpenseCount: pendingData?.length || 0,
        pendingExpenseAmount: pendingAmount,
        approvedExpenseCount: approvedData?.length || 0,
        approvedExpenseAmount: approvedAmount,
      };
    } catch (error) {
      console.error('Error in fetchExpenseStats:', error);
      return {
        pendingExpenseCount: 0,
        pendingExpenseAmount: 0,
        approvedExpenseCount: 0,
        approvedExpenseAmount: 0,
      };
    }
  };

  // 仕分けレビューデータ取得
  const fetchJournalStats = async () => {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('status', 'pending_review');

      if (error) {
        console.error('Error fetching journal stats:', error);
        return { pendingJournalCount: 0 };
      }

      return { pendingJournalCount: data?.length || 0 };
    } catch (error) {
      console.error('Error in fetchJournalStats:', error);
      return { pendingJournalCount: 0 };
    }
  };

  // 売掛・買掛データ取得
  const fetchReceivablesPayables = async () => {
    try {
      const supabase = getSupabase();

      // 売掛金（未回収の売上）
      const { data: receivablesData, error: receivablesError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('account_type', 'receivable')
        .eq('status', 'posted');

      // 買掛金（未支払の仕入）
      const { data: payablesData, error: payablesError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('account_type', 'payable')
        .eq('status', 'posted');

      if (receivablesError || payablesError) {
        console.error('Error fetching receivables/payables:', receivablesError || payablesError);
        return {
          receivablesCount: 0,
          receivablesAmount: 0,
          payablesCount: 0,
          payablesAmount: 0,
        };
      }

      const receivablesAmount = (receivablesData || []).reduce((sum, entry) => {
        return sum + Number(entry.debit || entry.credit || 0);
      }, 0);

      const payablesAmount = (payablesData || []).reduce((sum, entry) => {
        return sum + Number(entry.debit || entry.credit || 0);
      }, 0);

      return {
        receivablesCount: receivablesData?.length || 0,
        receivablesAmount,
        payablesCount: payablesData?.length || 0,
        payablesAmount,
      };
    } catch (error) {
      console.error('Error in fetchReceivablesPayables:', error);
      return {
        receivablesCount: 0,
        receivablesAmount: 0,
        payablesCount: 0,
        payablesAmount: 0,
      };
    }
  };

  // 入金・出金スケジュールデータ取得
  const fetchCashSchedules = async () => {
    try {
      const supabase = getSupabase();

      // 入金スケジュール
      const { data: cashInData, error: cashInError } = await supabase
        .from('cash_schedules')
        .select('*')
        .eq('type', 'in')
        .gte('scheduled_date', new Date().toISOString().slice(0, 10));

      // 出金スケジュール
      const { data: cashOutData, error: cashOutError } = await supabase
        .from('cash_schedules')
        .select('*')
        .eq('type', 'out')
        .gte('scheduled_date', new Date().toISOString().slice(0, 10));

      if (cashInError || cashOutError) {
        console.error('Error fetching cash schedules:', cashInError || cashOutError);
        return {
          cashInScheduleCount: 0,
          cashInScheduleAmount: 0,
          cashOutScheduleCount: 0,
          cashOutScheduleAmount: 0,
        };
      }

      const cashInAmount = (cashInData || []).reduce((sum, schedule) => {
        return sum + Number(schedule.amount || 0);
      }, 0);

      const cashOutAmount = (cashOutData || []).reduce((sum, schedule) => {
        return sum + Number(schedule.amount || 0);
      }, 0);

      return {
        cashInScheduleCount: cashInData?.length || 0,
        cashInScheduleAmount: cashInAmount,
        cashOutScheduleCount: cashOutData?.length || 0,
        cashOutScheduleAmount: cashOutAmount,
      };
    } catch (error) {
      console.error('Error in fetchCashSchedules:', error);
      return {
        cashInScheduleCount: 0,
        cashInScheduleAmount: 0,
        cashOutScheduleCount: 0,
        cashOutScheduleAmount: 0,
      };
    }
  };

  // 全データ取得
  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      try {
        const [expenseStats, journalStats, receivablesPayables, cashSchedules] = await Promise.all([
          fetchExpenseStats(),
          fetchJournalStats(),
          fetchReceivablesPayables(),
          fetchCashSchedules(),
        ]);

        setStats({
          ...expenseStats,
          ...journalStats,
          ...receivablesPayables,
          ...cashSchedules,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllStats();
  }, []);

  // クリック可能なカードコンポーネント
  const ClickableCard: React.FC<{
    title: string;
    count: number;
    amount?: number;
    icon: React.ReactNode;
    colorClass: string;
    onClick: () => void;
    subtitle?: string;
  }> = ({ title, count, amount, icon, colorClass, onClick, subtitle }) => (
    <button
      onClick={onClick}
      className={`w-full p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md hover:scale-[1.02] ${colorClass} text-left`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-white/20">
              {icon}
            </div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-white">
              {count.toLocaleString()} 件
            </p>
            {amount !== undefined && (
              <p className="text-lg text-white/90">
                {formatJPY(amount)}
              </p>
            )}
            {subtitle && (
              <p className="text-sm text-white/80">{subtitle}</p>
            )}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-white/60" />
      </div>
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">管理者ダッシュボードを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">管理者ダッシュボード</h1>
        <p className="text-white/80">
          {currentUser.name}さん、ようこそ。システム全体の状況を把握できます。
        </p>
      </div>

      {/* 経費申請サマリー */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          経費申請サマリー
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ClickableCard
            title="未承認申請"
            count={stats.pendingExpenseCount}
            amount={stats.pendingExpenseAmount}
            icon={<AlertTriangle className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-red-500 to-red-600"
            onClick={onNavigateToExpenseApprovals}
            subtitle="クリックで未承認一覧へ"
          />
          <ClickableCard
            title="今月承認済み"
            count={stats.approvedExpenseCount}
            amount={stats.approvedExpenseAmount}
            icon={<CheckCircle className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-green-500 to-green-600"
            onClick={() => { /* 承認済み一覧への遷移 */ }}
            subtitle="今月の承認実績"
          />
        </div>
      </div>

      {/* 仕分けと財務状況 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-600" />
          仕分け・財務状況
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ClickableCard
            title="仕分けレビュー待ち"
            count={stats.pendingJournalCount}
            icon={<Eye className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-amber-500 to-amber-600"
            onClick={onNavigateToJournalReview}
            subtitle="仕分け承認が必要"
          />
          <ClickableCard
            title="売掛金"
            count={stats.receivablesCount}
            amount={stats.receivablesAmount}
            icon={<TrendingUp className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
            onClick={onNavigateToReceivables}
            subtitle="未回収の売上"
          />
          <ClickableCard
            title="買掛金"
            count={stats.payablesCount}
            amount={stats.payablesAmount}
            icon={<TrendingDown className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-orange-500 to-orange-600"
            onClick={onNavigateToPayables}
            subtitle="未支払の仕入"
          />
        </div>
      </div>

      {/* 資金スケジュール */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-600" />
          資金スケジュール
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ClickableCard
            title="入金スケジュール"
            count={stats.cashInScheduleCount}
            amount={stats.cashInScheduleAmount}
            icon={<TrendingUp className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600"
            onClick={onNavigateToCashIn}
            subtitle="今後の入金予定"
          />
          <ClickableCard
            title="出金スケジュール"
            count={stats.cashOutScheduleCount}
            amount={stats.cashOutScheduleAmount}
            icon={<TrendingDown className="w-5 h-5" />}
            colorClass="bg-gradient-to-br from-rose-500 to-rose-600"
            onClick={onNavigateToCashOut}
            subtitle="今後の出金予定"
          />
        </div>
      </div>

      {/* クイックアクション */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          クイックアクション
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={onNavigateToExpenseApprovals}
            className="p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-colors"
          >
            経費承認
          </button>
          <button
            onClick={onNavigateToJournalReview}
            className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors"
          >
            仕分けレビュー
          </button>
          <button
            onClick={onNavigateToReceivables}
            className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors"
          >
            売掛管理
          </button>
          <button
            onClick={onNavigateToPayables}
            className="p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-medium transition-colors"
          >
            買掛管理
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
