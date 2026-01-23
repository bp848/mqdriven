
import React, { useState, useEffect, useCallback } from 'react';
import { FileCheck, Search, Eye, Calendar, ArrowRight, Loader, X } from 'lucide-react';
import { ApplicationWithDetails, Page } from '../../../types';
import * as dataService from '../../../services/dataService';
import { getSupabase } from '../../../services/supabaseClient';

interface ApprovedApplicationsProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
  codes?: string[];
  title?: string;
  description?: string;
  showLeaveSync?: boolean;
  currentUserId?: string | null;
  onNavigate?: (page: Page) => void;
  handlingStatusOnly?: 'unhandled' | 'in_progress' | 'done' | 'blocked';
}

export const ApprovedApplications: React.FC<ApprovedApplicationsProps> = ({
  notify,
  codes,
  title = '承認済申請一覧',
  description = '会計処理の元となる、承認が完了した申請データです（status=approved）。',
  showLeaveSync = codes ? codes.includes('LEV') : true,
  currentUserId,
  onNavigate,
  handlingStatusOnly,
}) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'approvedAt' | 'amount' | 'title'>('approvedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isSyncingLeave, setIsSyncingLeave] = useState(false);
  const [isCreatingJournalFor, setIsCreatingJournalFor] = useState<string | null>(null);
  const [isUpdatingHandlingFor, setIsUpdatingHandlingFor] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeHandlingStatus = (value: unknown): 'unhandled' | 'in_progress' | 'done' | 'blocked' => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw === 'in_progress' || raw === 'done' || raw === 'blocked') return raw;
    return 'unhandled';
  };

  const getHandlingStatusLabel = (status: ReturnType<typeof normalizeHandlingStatus>) => {
    if (status === 'in_progress') return '対応中';
    if (status === 'done') return '対応済';
    if (status === 'blocked') return '保留';
    return '未対応';
  };

  const getHandlingBadgeClass = (status: ReturnType<typeof normalizeHandlingStatus>) => {
    if (status === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800';
    if (status === 'blocked') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800';
    return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800';
  };

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabase();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setAuthUserId(data.session?.user?.id ?? null);
      })
      .catch((err) => {
        console.error('[ApprovedApplications] getSession failed', err);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadApprovedApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dataService.getApprovedApplications(codes);
      setApplications(data);
    } catch (err) {
      setError('承認済み申請の読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    loadApprovedApplications();
  }, [loadApprovedApplications]);


	  const formatCurrency = (val?: number | null) => (val === null || val === undefined ? '-' : val.toLocaleString());
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const toNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      if (!normalized) return null;
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const deriveAmount = (app: ApplicationWithDetails): number | null => {
    const data = app.formData ?? {};
    return (
      toNumber(data.amount) ??
      toNumber(data.totalAmount) ??
      toNumber(data.requestedAmount) ??
      toNumber(data.invoice?.totalGross) ??
      toNumber(data.invoice?.totalNet) ??
      null
    );
  };

  const getAccountingStatusLabel = (status?: string) => {
    if (status === 'drafted') return '仕訳作成済';
    if (status === 'posted') return '転記済';
    return '未処理';
  };

  const filteredApps = applications.filter(app => {
    const handlingStatus = normalizeHandlingStatus((app as any).handlingStatus);
    if (handlingStatusOnly && handlingStatus !== handlingStatusOnly) return false;
    const term = searchTerm.toLowerCase();
    const title = (app.formData?.title || app.formData?.subject || '').toLowerCase();
    const applicantName = (app.applicant?.name || '').toLowerCase();
    const codeName = (app.applicationCode?.name || '').toLowerCase();
    return title.includes(term) || applicantName.includes(term) || codeName.includes(term);
  });

  const buildTitle = (app: ApplicationWithDetails) =>
    app.formData?.title || app.formData?.subject || app.applicationCode?.name || '件名未入力';

	  const sortedApps = React.useMemo(() => {
	    const safe = [...filteredApps];
	    safe.sort((a, b) => {
	      const dir = sortDir === 'asc' ? 1 : -1;
	      if (sortKey === 'approvedAt') {
	        const av = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
	        const bv = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
	        return (av - bv) * dir;
	      }
	      if (sortKey === 'amount') {
	        const av = deriveAmount(a) ?? 0;
	        const bv = deriveAmount(b) ?? 0;
	        return (av - bv) * dir;
	      }
	      const at = buildTitle(a).toLowerCase();
	      const bt = buildTitle(b).toLowerCase();
	      return at.localeCompare(bt) * dir;
    });
    return safe;
  }, [filteredApps, sortDir, sortKey]);

  const selectedApplication =
    [...sortedApps, ...filteredApps].find((app) => app.id === selectedApplicationId) ?? null;

	  const totals = React.useMemo(() => {
	    const count = filteredApps.length;
	    const amountSum = filteredApps.reduce((sum, app) => sum + (deriveAmount(app) || 0), 0);
	    const avg = count > 0 ? Math.round(amountSum / count) : 0;
	    return { count, amountSum, avg };
	  }, [filteredApps]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleSyncLeaveToCalendars = async () => {
    setIsSyncingLeave(true);
    setActionError(null);
    try {
      const result = await dataService.syncApprovedLeaveToCalendars();
      notify?.(
        `休暇予定をカレンダーへ登録: 作成 ${result.created} / スキップ ${result.skipped}`,
        'success'
      );
    } catch (err: any) {
      console.error('[ApprovedApplications] sync leave failed', err);
      const message = err?.message || '休暇予定の登録に失敗しました。';
      setActionError(message);
      notify?.(message, 'error');
    } finally {
      setIsSyncingLeave(false);
    }
  };

  const handleCreateJournal = async (applicationId: string) => {
    const operatorId = authUserId ?? currentUserId;
    if (!operatorId) {
      const message = 'ログインユーザーが特定できないため、仕訳を作成できません。';
      setActionError(message);
      notify?.(message, 'error');
      return;
    }
    setActionError(null);
    setIsCreatingJournalFor(applicationId);
    try {
      const batchId = await dataService.createJournalFromApplication(applicationId, operatorId);
      notify?.(`仕訳ドラフトを作成しました（バッチID: ${batchId}）`, 'success');
      await loadApprovedApplications();
      onNavigate?.('accounting_journal_review');
    } catch (err: any) {
      console.error('[ApprovedApplications] create journal failed', err);
      const rawMessage = err?.message || '仕訳ドラフトの作成に失敗しました。';
      const message =
        typeof rawMessage === 'string' && /Could not determine accounts/i.test(rawMessage)
          ? `${rawMessage}\n（勘定科目マスタ: public.account_items に必要な勘定科目コードがあるか確認してください）`
          : rawMessage;
      setActionError(message);
      notify?.(message, 'error');
    } finally {
      setIsCreatingJournalFor(null);
    }
  };

  const handleUpdateHandlingStatus = async (
    applicationId: string,
    nextStatus: ReturnType<typeof normalizeHandlingStatus>,
  ) => {
    const operatorId = authUserId ?? currentUserId;
    if (!operatorId) {
      const message = 'ログインユーザーが特定できないため、対応ステータスを更新できません。';
      setActionError(message);
      notify?.(message, 'error');
      return;
    }
    setActionError(null);
    setIsUpdatingHandlingFor(applicationId);
    try {
      await dataService.setApplicationHandlingStatus(applicationId, operatorId, nextStatus);
      setApplications(prev =>
        prev.map(app =>
          app.id === applicationId
            ? {
              ...app,
              handlingStatus: nextStatus,
              handlingUpdatedAt: new Date().toISOString(),
              handlingUpdatedBy: operatorId,
            }
            : app
        )
      );
      notify?.('対応ステータスを更新しました。', 'success');
    } catch (err: any) {
      console.error('[ApprovedApplications] update handling status failed', err);
      const message = err?.message || '対応ステータスの更新に失敗しました。';
      setActionError(message);
      notify?.(message, 'error');
    } finally {
      setIsUpdatingHandlingFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
             <FileCheck className="w-6 h-6 text-indigo-600" />
             {title}
           </h2>
           <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
             {description}
            </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
            件数 {totals.count}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
            合計 ¥{formatCurrency(totals.amountSum)}
          </span>
	          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
	            平均 ¥{formatCurrency(totals.avg)}
	          </span>
	            {onNavigate && (
	              <button
	                type="button"
	                onClick={() => onNavigate('accounting_journal_review')}
	                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
	                title="自動仕訳レビューへ移動します"
	              >
	                <ArrowRight className="w-4 h-4" />
	                仕訳レビューへ
	              </button>
	            )}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(handlingStatusOnly === 'unhandled' ? 'accounting_approved_applications' : 'accounting_approved_unhandled')
                  }
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-60"
                  title={handlingStatusOnly === 'unhandled' ? '承認済み一覧（全件）へ戻ります' : '未対応のみを別ページで管理します'}
                >
                  <ArrowRight className="w-4 h-4" />
                  {handlingStatusOnly === 'unhandled' ? '全件へ' : '未対応を管理'}
                </button>
              )}
		          {showLeaveSync && (
		            <button
		              type="button"
	              onClick={handleSyncLeaveToCalendars}
	              disabled={isSyncingLeave}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              title="承認済み休暇(L﻿EV)を全員のカレンダーに終日予定として書き込みます"
            >
              <Calendar className="w-4 h-4" />
              {isSyncingLeave ? '同期中…' : '休暇をカレンダーへ'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input 
                type="text" 
                placeholder="件名、申請者名、種別で検索..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-xl p-4 text-sm whitespace-pre-wrap">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
            {isLoading ? (
                <div className="p-16 text-center text-slate-600 dark:text-slate-300"><Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>
            ) : error ? (
                <div className="p-16 text-center text-red-500">{error}</div>
            ) : (
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
                    <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4">種別</th>
                            <th className="px-6 py-4">
                              <button type="button" onClick={() => toggleSort('title')} className="flex items-center gap-1">
                                件名 / 申請内容
                                {sortKey === 'title' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                              </button>
                            </th>
                            <th className="px-6 py-4">申請者</th>
                            <th className="px-6 py-4 text-right">
                              <button type="button" onClick={() => toggleSort('amount')} className="flex items-center gap-1 w-full justify-end">
                                金額
                                {sortKey === 'amount' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                              </button>
                            </th>
	                            <th className="px-6 py-4">
	                              <button type="button" onClick={() => toggleSort('approvedAt')} className="flex items-center gap-1">
	                                承認日時
	                                {sortKey === 'approvedAt' && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
		                          </button>
		                        </th>
                            <th className="px-6 py-4">対応</th>
	                            <th className="px-6 py-4">会計</th>
		                            <th className="px-6 py-4">詳細</th>
		                        </tr>
	                    </thead>
	                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
		                        {sortedApps.map((app) => {
		                                const amount = deriveAmount(app);
                                    const handlingStatus = normalizeHandlingStatus((app as any).handlingStatus);
                                    const isHandlingUpdating = isUpdatingHandlingFor === app.id;
		                                const accountingStatus = app.accountingStatus ?? 'none';
		                                const canCreateJournal = (accountingStatus === 'none' || accountingStatus === 'pending') && amount !== null && amount > 0;
		                                const isDrafted = accountingStatus === 'drafted';
		                                const isPosted = accountingStatus === 'posted';
	                                return (
	                            <tr
	                                key={app.id}
	                                className={`transition ${
	                                    selectedApplicationId === app.id
	                                        ? 'bg-indigo-50/50 dark:bg-indigo-900/30 border-l-4 border-indigo-400'
                                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/40'
                                }`}
                            >
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40">
                                        {app.applicationCode?.name || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">
                                        {buildTitle(app)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-slate-700 dark:text-slate-200">{app.applicant?.name}</div>
                                </td>
	                                <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300">
	                                    {amount !== null ? `¥${formatCurrency(amount)}` : '-'}
	                                </td>
		                                <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
		                                    {formatDate(app.approvedAt)}
		                                </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getHandlingBadgeClass(handlingStatus)}`}>
                                          {getHandlingStatusLabel(handlingStatus)}
                                        </span>
                                        <select
                                          value={handlingStatus}
                                          onChange={(e) => handleUpdateHandlingStatus(app.id, normalizeHandlingStatus(e.target.value))}
                                          disabled={isHandlingUpdating}
                                          className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 disabled:opacity-60"
                                          aria-label="対応ステータス"
                                        >
                                          <option value="unhandled">未対応</option>
                                          <option value="in_progress">対応中</option>
                                          <option value="done">対応済</option>
                                          <option value="blocked">保留</option>
                                        </select>
                                        {isHandlingUpdating && <Loader className="w-4 h-4 animate-spin text-slate-500" />}
                                      </div>
                                    </td>
	                                    <td className="px-6 py-4">
	                                      <div className="flex items-center gap-2">
	                                        <span className="text-xs text-slate-500 dark:text-slate-300">
	                                          {getAccountingStatusLabel(accountingStatus)}
	                                        </span>
                                        {canCreateJournal && (
                                          <button
                                            type="button"
                                            onClick={() => handleCreateJournal(app.id)}
                                            disabled={isCreatingJournalFor === app.id}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 disabled:opacity-60"
                                            title="仕訳ドラフトを作成し、レビュー画面へ移動します"
                                          >
                                            {isCreatingJournalFor === app.id ? (
                                              <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <ArrowRight className="w-4 h-4" />
                                            )}
                                            次へ
                                          </button>
                                        )}
                                        {isDrafted && (
                                          onNavigate ? (
                                            <button
                                              type="button"
                                              onClick={() => onNavigate('accounting_journal_review')}
                                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                                              title="仕訳レビューへ移動します"
                                            >
                                              <ArrowRight className="w-4 h-4" />
                                              レビュー
                                            </button>
                                          ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                                              レビューで確認
                                            </span>
                                          )
                                        )}
                                        {isPosted && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                            転記済
                                          </span>
                                        )}
                                      </div>
                                    </td>
	                                <td className="px-6 py-4">
	                                    <button
	                                        type="button"
	                                        onClick={() =>
	                                            setSelectedApplicationId((prev) => (prev === app.id ? null : app.id))
                                        }
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {selectedApplicationId === app.id ? '閉じる' : '見る'}
	                                    </button>
	                                </td>
	                            </tr>
                                );
	                        })}
		                        {filteredApps.length === 0 && (
		                            <tr>
		                                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
		                                    該当する承認済み申請データが見つかりません。
		                                </td>
		                            </tr>
		                        )}
	                    </tbody>
	                </table>
            )}
        </div>
      </div>

      {selectedApplication && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="承認済申請 詳細"
          onClick={() => setSelectedApplicationId(null)}
        >
          <div
            className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">詳細</p>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                  {buildTitle(selectedApplication)}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedApplication.applicationCode?.name || '種別未設定'} / {selectedApplication.applicant?.name || '申請者未設定'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  承認日時: {formatDate(selectedApplication.approvedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApplicationId(null)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">金額</p>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {(() => {
                      const amount = deriveAmount(selectedApplication);
                      return amount !== null ? `¥${formatCurrency(amount)}` : '-';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">会計ステータス</p>
                  <p className="text-slate-800 dark:text-slate-100">
                    {getAccountingStatusLabel(selectedApplication.accountingStatus ?? 'none')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">申請ID</p>
                  <p className="font-mono text-slate-800 dark:text-slate-100 break-all">{selectedApplication.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">申請コード</p>
                  <p className="text-slate-800 dark:text-slate-100">
                    {selectedApplication.applicationCode?.code || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">申請者メール</p>
                  <p className="text-slate-800 dark:text-slate-100">{selectedApplication.applicant?.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">添付</p>
                  {selectedApplication.documentUrl ? (
                    <a
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200 underline break-all"
                      href={selectedApplication.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedApplication.documentUrl}
                    </a>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">-</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">申請内容 (form_data)</p>
                <pre className="text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {JSON.stringify(selectedApplication.formData ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedApplications;
