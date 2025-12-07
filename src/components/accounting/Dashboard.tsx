import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Page } from '../../../types';
import { WorkflowNavigator } from './WorkflowNavigator';
import { Bell, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import * as dataService from '../../../services/dataService';

interface AccountingDashboardProps {
  setCurrentView: (view: Page) => void;
  initialPendingDraftsCount?: number;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({
  setCurrentView,
  initialPendingDraftsCount,
}) => {
  const [pendingDraftsCount, setPendingDraftsCount] = useState(initialPendingDraftsCount ?? 0);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPendingDrafts = useCallback(async () => {
    setIsLoadingDrafts(true);
    setError(null);
    try {
      const drafts = await dataService.getDraftJournalEntries();
      setPendingDraftsCount(drafts.filter(d => d.status === 'draft').length);
    } catch (err) {
      console.error('Failed to load draft journal entries', err);
      setError('仕訳下書き件数の取得に失敗しました。');
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    refreshPendingDrafts();
  }, [refreshPendingDrafts]);

  const todaySummary = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
    return formatter.format(now);
  }, []);

  return (
    <div className="space-y-6">
      {/* Intro Section */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold mb-1">会計ダッシュボード</h1>
          <p className="text-slate-300 text-sm">
            本日は <span className="font-semibold text-indigo-200">{todaySummary}</span>。AI仕訳の承認待ちは{' '}
            <span className="font-semibold">{pendingDraftsCount}件</span> です。
          </p>
          {error && <p className="text-xs text-rose-200 mt-1">{error}</p>}
        </div>
        <button
          type="button"
          onClick={refreshPendingDrafts}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          {isLoadingDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          再読み込み
        </button>
      </div>

      <WorkflowNavigator navigateTo={setCurrentView} pendingCount={pendingDraftsCount} />

      {/* To-Do List (Actionable Items Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" /> 今日のタスク
            </h3>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
              {pendingDraftsCount}件
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            <button
              onClick={() => setCurrentView('accounting_journal_review')}
              className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group"
            >
              <div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">AI仕訳の承認待ち</p>
                <p className="text-xs text-slate-500 mt-1">OCR/申請経由の仕訳 {pendingDraftsCount}件 を確認。</p>
              </div>
            </button>
            <button
              onClick={() => setCurrentView('accounting_payables')}
              className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group"
            >
              <div className="mt-1 w-2 h-2 rounded-full bg-amber-500"></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">支払管理</p>
                <p className="text-xs text-slate-500 mt-1">銀行振込データを作成し、FBファイルを出力。</p>
              </div>
            </button>
            <button
              onClick={() => setCurrentView('accounting_receivables')}
              className="w-full text-left p-4 hover:bg-slate-50 transition flex items-start gap-3 group"
            >
              <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">売掛金管理</p>
                <p className="text-xs text-slate-500 mt-1">入金済みデータと請求書の消込を実行。</p>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" /> 最近の処理
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="p-4 flex items-center gap-3 opacity-70">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">請求書PDF取込 (25件)</p>
                <p className="text-xs text-slate-500">AI-OCR解析完了</p>
              </div>
              <div className="text-xs text-slate-400">08:45</div>
            </div>
            <div className="p-4 flex items-center gap-3 opacity-70">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">工場IoTデータ同期</p>
                <p className="text-xs text-slate-500">GL-840P 稼働データ取得</p>
              </div>
              <div className="text-xs text-slate-400">08:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingDashboard;
