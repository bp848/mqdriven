import React, { useState, useEffect, useRef } from 'react';
import { Loader, CheckCircle, AlertTriangle, FileText, ArrowRight } from '../Icons';
import { Toast, ClosingChecklistItem, Job, ApplicationWithDetails, Page, JournalEntry } from '../../types';
import { generateClosingSummary } from '../../services/geminiService';

interface PeriodClosingPageProps {
  addToast: (message: string, type: Toast['type']) => void;
  jobs: Job[];
  applications: ApplicationWithDetails[];
  journalEntries: JournalEntry[];
  onNavigate: (page: Page) => void;
}

const PeriodClosingPage: React.FC<PeriodClosingPageProps> = ({ addToast, jobs, applications, journalEntries, onNavigate }) => {
  const [isMonthlyClosing, setIsMonthlyClosing] = useState(false);
  const [lastMonthlyClose, setLastMonthlyClose] = useState('2024-06-30');
  const [checklist, setChecklist] = useState<ClosingChecklistItem[]>([]);
  const [isChecklistLoading, setIsChecklistLoading] = useState(true);
  const [closingSummary, setClosingSummary] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // AIにチェックリストを生成させる代わりに、クライアントサイドでロジックを組む
    const generateChecklist = () => {
        setIsChecklistLoading(true);
        const items: ClosingChecklistItem[] = [];

        // 1. 未承認の申請
        const pendingApps = applications.filter(app => app.status === 'pending_approval');
        items.push({
            id: 'pending_apps',
            description: '未承認の申請',
            count: pendingApps.length,
            status: pendingApps.length > 0 ? 'needs_review' : 'ok',
            actionPage: 'approval_list'
        });

        // 2. 未請求の完了案件
        const uninvoicedJobs = jobs.filter(job => job.status === '完了' && job.invoiceStatus === '未請求');
        items.push({
            id: 'uninvoiced_jobs',
            description: '請求書が未発行の完了案件',
            count: uninvoicedJobs.length,
            status: uninvoicedJobs.length > 0 ? 'needs_review' : 'ok',
            actionPage: 'sales_billing'
        });
        
        // 3. 未払いの買掛金
        const unpaidPayables = journalEntries.reduce((acc, entry) => {
            if (entry.account === '買掛金') {
                return acc + (entry.credit - entry.debit);
            }
            return acc;
        }, 0);
        items.push({
            id: 'unpaid_payables',
            description: '未払いの買掛金残高',
            count: unpaidPayables > 0 ? 1 : 0, // 1 for exists, 0 for not
            status: unpaidPayables > 0 ? 'needs_review' : 'ok',
            actionPage: 'purchasing_payments'
        });

        setChecklist(items);
        setIsChecklistLoading(false);
    };

    generateChecklist();
  }, [jobs, applications, journalEntries]);

  const allChecksOk = checklist.every(item => item.status === 'ok');

  const handleMonthlyClose = async () => {
    setIsMonthlyClosing(true);
    setClosingSummary(null);
    try {
        const currentDate = new Date(lastMonthlyClose);
        const closingMonth = currentDate.getMonth();
        const closingYear = currentDate.getFullYear();

        const currentMonthJobs = jobs.filter(j => {
            const d = new Date(j.createdAt);
            return d.getFullYear() === closingYear && d.getMonth() === closingMonth;
        });
        const currentMonthJournal = journalEntries.filter(j => {
            const d = new Date(j.date);
            return d.getFullYear() === closingYear && d.getMonth() === closingMonth;
        });

        const prevMonthDate = new Date(closingYear, closingMonth - 1, 15);
        const prevMonth = prevMonthDate.getMonth();
        const prevYear = prevMonthDate.getFullYear();

        const prevMonthJobs = jobs.filter(j => {
            const d = new Date(j.createdAt);
            return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
        });
        const prevMonthJournal = journalEntries.filter(j => {
            const d = new Date(j.date);
            return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
        });
        
        const summary = await generateClosingSummary('月次', currentMonthJobs, prevMonthJobs, currentMonthJournal, prevMonthJournal);
        
        if (mounted.current) {
            setClosingSummary(summary);
            
            const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
            setLastMonthlyClose(nextDate.toISOString().split('T')[0]);
            addToast('月次締処理が完了し、AIによる決算サマリーが生成されました。', 'success');
        }

    } catch (e) {
        if (mounted.current) {
            addToast(e instanceof Error ? e.message : 'AIサマリーの生成に失敗しました。', 'error');
        }
    } finally {
        if (mounted.current) {
            setIsMonthlyClosing(false);
        }
    }
  };
  
  const ChecklistItem: React.FC<{ item: ClosingChecklistItem }> = ({ item }) => (
    <div className={`p-4 rounded-lg flex items-center justify-between transition-all duration-300 ${item.status === 'ok' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'}`}>
        <div className="flex items-center gap-3">
            {item.status === 'ok'
                ? <CheckCircle className="w-6 h-6 text-green-500" />
                : <AlertTriangle className="w-6 h-6 text-yellow-500" />
            }
            <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{item.description}</p>
                {item.status === 'needs_review' && <p className="text-sm text-slate-600 dark:text-slate-400">{item.count}件の未処理項目があります。</p>}
            </div>
        </div>
        {item.status === 'needs_review' && (
            <button onClick={() => onNavigate(item.actionPage)} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                確認する <ArrowRight className="w-4 h-4" />
            </button>
        )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">締処理</h2>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            AIが締処理前の確認事項をチェックし、月次決算のサマリーを自動生成します。
          </p>
        </div>
        <div className="p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">AI 締前チェックリスト</h3>
                {isChecklistLoading ? (
                     <div className="flex items-center justify-center gap-2 text-slate-500 p-4"><Loader className="w-5 h-5 animate-spin"/><span>確認項目をチェック中...</span></div>
                ) : (
                    <div className="space-y-3">{checklist.map(item => <ChecklistItem key={item.id} item={item} />)}</div>
                )}
            </div>
          
            <div className={`p-6 rounded-lg border ${allChecksOk ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30' : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30'}`}>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">月次締処理</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                前回の締日: <span className="font-medium text-slate-700 dark:text-slate-300">{lastMonthlyClose}</span>
              </p>
              {!allChecksOk && (
                  <div className="mt-3 text-sm text-yellow-800 dark:text-yellow-200 p-3 bg-yellow-100 dark:bg-yellow-800/30 rounded-md">
                      <p>未処理の項目があります。締処理を実行する前に、上記の項目を確認してください。</p>
                  </div>
              )}
              <button
                onClick={handleMonthlyClose}
                disabled={isMonthlyClosing}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400"
              >
                {isMonthlyClosing ? <Loader className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5" />}
                月次締を実行してAIサマリーを生成
              </button>
            </div>
        </div>
      </div>
      
      {(isMonthlyClosing || closingSummary) && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">AI 月次決算サマリー</h2>
            </div>
            <div className="p-6">
                {isMonthlyClosing ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Loader className="w-10 h-10 text-blue-600 animate-spin" />
                        <p className="mt-4 text-slate-500 dark:text-slate-400">AIが決算データを分析し、サマリーを生成しています...</p>
                    </div>
                ) : closingSummary && (
                    <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap">
                       {closingSummary}
                    </div>
                )}
            </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button className="flex items-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600">
                    <FileText className="w-5 h-5"/> レポートをダウンロード
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default PeriodClosingPage;