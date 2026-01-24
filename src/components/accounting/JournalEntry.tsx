import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader, CheckCircle, FileText, Plus, ArrowRight } from 'lucide-react';
import { ApplicationWithDetails } from '../../../types';
import * as dataService from '../../../services/dataService';

interface JournalReviewPageProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export const JournalReviewPage: React.FC<JournalReviewPageProps> = ({ notify }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApprovedApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dataService.getApprovedApplications();
      setApplications(data);
      setSelectedId(data[0]?.id ?? null);
    } catch (err) {
      console.error('Failed to load approved applications:', err);
      setError('承認済み申請の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovedApplications();
  }, [loadApprovedApplications]);

  const selectedApplication = applications.find(app => app.id === selectedId) ?? null;
  const status = selectedApplication?.accountingStatus ?? selectedApplication?.accounting_status ?? 'none';
  const lines = selectedApplication?.journalEntry?.lines ?? [];
  const hasLines = lines.length > 0;
  const isPosted = status === 'posted';
  const isDraft = status === 'draft';

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '';
    if (value <= 0) return '';
    return `¥${value.toLocaleString()}`;
  };

  const getAccountingStatusLabel = (value?: string) => {
    if (value === 'draft') return '仕訳下書き';
    if (value === 'posted') return '仕訳確定';
    return '仕訳未生成';
  };

  const handleGenerateJournal = async () => {
    if (!selectedApplication) return;
    setIsWorking(true);
    try {
      await dataService.generateJournalLinesFromApplication(selectedApplication.id);
      notify?.('仕訳を生成しました。', 'success');
      await loadApprovedApplications();
    } catch (err: any) {
      console.error('Failed to generate journal lines:', err);
      notify?.(err?.message || '仕訳の生成に失敗しました。', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const handlePostJournal = async () => {
    if (!selectedApplication?.journalEntry?.id) return;
    setIsWorking(true);
    try {
      await dataService.updateJournalEntryStatus(selectedApplication.journalEntry.id, 'posted');
      notify?.('仕訳を確定しました。', 'success');
      await loadApprovedApplications();
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      notify?.(err?.message || '仕訳の確定に失敗しました。', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            自動仕訳レビュー
          </h2>
          <p className="text-slate-500 text-sm mt-1">この画面で仕訳の生成・確定を行います。</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadApprovedApplications}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 更新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">承認済み一覧 ({applications.length}件)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center">
                <Loader className="w-5 h-5 animate-spin mr-2" /> 読み込み中...
              </div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">対象の申請がありません。</div>
            ) : (
              applications.map(app => {
                const entryStatus = app.accountingStatus ?? app.accounting_status ?? 'none';
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedId(app.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition relative ${
                      selectedId === app.id
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">{app.application_code?.name || 'N/A'}</div>
                    <div className="font-bold text-slate-800 text-sm mb-1 truncate">
                      {app.formData?.title || app.formData?.subject || '件名未入力'}
                    </div>
                    <div className="text-xs text-slate-500">{getAccountingStatusLabel(entryStatus)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
          {selectedApplication ? (
            <>
              <div className="p-6 border-b border-slate-200 bg-slate-50/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{selectedApplication.application_code?.name || 'N/A'}</div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedApplication.formData?.title || selectedApplication.formData?.subject || '件名未入力'}
                    </h3>
                  </div>
                  <div className="text-sm text-slate-600">
                    {getAccountingStatusLabel(status)}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {hasLines ? (
                  <div className="space-y-2">
                    {lines.map(line => {
                      const amount = (line.debit_amount ?? 0) > 0 ? line.debit_amount : line.credit_amount;
                      const amountText = formatCurrency(amount ?? null);
                      return (
                        <div
                          key={line.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {line.account_name || line.account_code || '未設定'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {(line.debit_amount ?? 0) > 0 ? '借方' : '貸方'}
                            </div>
                          </div>
                          <div className="text-sm font-mono font-semibold text-slate-700">
                            {amountText ? amountText : '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">仕訳が未生成です。</div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-center gap-4">
                {!isPosted && !hasLines && (
                  <button
                    onClick={handleGenerateJournal}
                    disabled={isWorking}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" /> 仕訳を生成
                  </button>
                )}
                {isDraft && hasLines && (
                  <button
                    onClick={handlePostJournal}
                    disabled={isWorking}
                    className="px-8 py-3 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <ArrowRight className="w-5 h-5" /> 仕訳を確定
                  </button>
                )}
                {isPosted && (
                  <div className="px-8 py-3 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-center flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> 仕訳確定済み
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <FileText className="w-12 h-12 mb-2 opacity-20" />
              <p>承認済み申請を選択してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
