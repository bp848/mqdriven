import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { User, ApplicationStatus, AccountingStatus } from '../../types';
import * as dataService from '../../services/dataService';

interface AccountingDashboardProps {
  currentUser?: User | null;
}

interface DashboardMetrics {
  pendingReview: number;        // 承認済×未レビュー件数
  draftStaleDays: number;      // draft仕訳の滞留日数
  unclosedPeriods: number;     // 締処理未完了期間
  monthlyTotal: number;        // 今月の仕訳件数
  errorCount: number;          // エラー件数
}

const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ currentUser }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    pendingReview: 0,
    draftStaleDays: 0,
    unclosedPeriods: 0,
    monthlyTotal: 0,
    errorCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [currentUser]);

  const loadMetrics = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const applications = await dataService.getApplications(currentUser.id);
      
      // 承認済×未レビュー件数
      const pendingReview = applications.filter(app => 
        app.status === ApplicationStatus.APPROVED && 
        (!app.accounting_status || app.accounting_status === AccountingStatus.NONE)
      ).length;

      // draft仕訳の滞留日数（最大値）
      const draftJournals = await dataService.getJournalEntries('draft');
      const now = new Date();
      const draftStaleDays = draftJournals.reduce((max, journal) => {
        const days = Math.floor((now.getTime() - new Date(journal.date).getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(max, days);
      }, 0);

      // 今月の仕訳件数
      const currentMonth = new Date().toISOString().substring(0, 7);
      const monthlyTotal = draftJournals.filter(j => 
        j.date.startsWith(currentMonth)
      ).length;

      setMetrics({
        pendingReview,
        draftStaleDays,
        unclosedPeriods: 0, // TODO: 締処理テーブルから取得
        monthlyTotal,
        errorCount: 0, // TODO: エラーログから取得
      });
    } catch (error) {
      console.error('ダッシュボードデータ読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    alert 
  }: { 
    title: string; 
    value: number | string; 
    icon: any; 
    color: string; 
    alert?: boolean;
  }) => (
    <div className={`p-6 rounded-xl border ${alert ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${alert ? 'text-red-600' : 'text-slate-600'}`}>{title}</p>
          <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${alert ? 'bg-red-100' : `${color}100`}`}>
          <Icon className={`w-6 h-6 ${alert ? 'text-red-600' : color}`} />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* アラートセクション */}
      {metrics.pendingReview > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-800">要対応</h3>
              <p className="text-red-600 text-sm">
                承認済み申請が{metrics.pendingReview}件、仕訳レビュー待ちです
              </p>
            </div>
          </div>
        </div>
      )}

      {/* メトリクスグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="仕訳レビュー待ち"
          value={metrics.pendingReview}
          icon={FileText}
          color="text-blue-600"
          alert={metrics.pendingReview > 0}
        />
        
        <MetricCard
          title="Draft滞留日数"
          value={`${metrics.draftStaleDays}日`}
          icon={Clock}
          color="text-orange-600"
          alert={metrics.draftStaleDays > 7}
        />
        
        <MetricCard
          title="今月仕訳件数"
          value={metrics.monthlyTotal}
          icon={TrendingUp}
          color="text-green-600"
        />
        
        <MetricCard
          title="締処理未完了"
          value={metrics.unclosedPeriods}
          icon={CheckCircle}
          color="text-purple-600"
          alert={metrics.unclosedPeriods > 0}
        />
      </div>

      {/* クイックアクション */}
      <div className="p-6 bg-slate-50 rounded-xl">
        <h3 className="font-semibold text-slate-800 mb-4">クイックアクション</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {metrics.pendingReview > 0 && (
            <button className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              仕訳レビューへ
            </button>
          )}
          
          {metrics.draftStaleDays > 7 && (
            <button className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              仕訳確認
            </button>
          )}
          
          <button className="p-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            月次締め
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;
