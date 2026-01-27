import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileCheck, Search, Eye, Loader, X, RefreshCw } from 'lucide-react';
import { ApplicationWithDetails, AIJournalSuggestion, Page } from '../../../types';
import * as dataService from '../../../services/dataService';
import { suggestJournalEntry } from '../../../services/geminiService';

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
  title = '承認済み一覧',
  description = '承認済み申請の会計状態を表示します。',
  handlingStatusOnly,
  currentUserId,
}) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [accountItems, setAccountItems] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [aiSuggestion, setAiSuggestion] = useState<AIJournalSuggestion | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiAutoSuggest, setIsAiAutoSuggest] = useState(true);
  const [selectedDebitAccountId, setSelectedDebitAccountId] = useState<string>('');
  const [selectedCreditAccountId, setSelectedCreditAccountId] = useState<string>('');

  const normalizeHandlingStatus = (value: unknown): 'unhandled' | 'in_progress' | 'done' | 'blocked' => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw === 'in_progress' || raw === 'done' || raw === 'blocked') return raw;
    return 'unhandled';
  };

  const loadApprovedApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dataService.getApprovedApplications(codes);
      setApplications(data);
    } catch (err) {
      setError('承認済み申請の取得に失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    loadApprovedApplications();
  }, [loadApprovedApplications]);

  useEffect(() => {
    let isMounted = true;
    const loadAccountItems = async () => {
      try {
        const items = await dataService.getActiveAccountItems();
        if (!isMounted) return;
        setAccountItems(items.map(item => ({ id: item.id, code: item.code, name: item.name })));
      } catch (err) {
        console.warn('Failed to load account items:', err);
      }
    };
    loadAccountItems();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '';
    if (value <= 0) return '';
    return `¥${value.toLocaleString()}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    if (status === 'draft') return '仕訳下書き';
    if (status === 'posted') return '仕訳確定';
    return '仕訳未生成';
  };

  const getAccountingStatusBadgeClass = (status?: string) => {
    if (status === 'posted') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40';
    }
    if (status === 'draft') {
      return 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-400/30';
  };

  const buildTitle = (app: ApplicationWithDetails) => {
    const data = app.formData ?? {};
    const rawTitle =
      data.title ||
      data.subject ||
      data.documentName ||
      data.invoice?.supplierName ||
      data.invoice?.description ||
      data.notes ||
      '';
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    return title || app.application_code?.name || '件名未入力';
  };

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      const handlingStatus = normalizeHandlingStatus((app as any).handlingStatus);
      if (handlingStatusOnly && handlingStatus !== handlingStatusOnly) return false;
      const term = searchTerm.toLowerCase();
      const titleText = buildTitle(app).toLowerCase();
      const docName = (app.formData?.documentName || '').toLowerCase();
      const supplierName = (app.formData?.invoice?.supplierName || '').toLowerCase();
      const applicantName = (app.applicant?.name || '').toLowerCase();
      const codeName = (app.application_code?.name || '').toLowerCase();
      return (
        titleText.includes(term) ||
        docName.includes(term) ||
        supplierName.includes(term) ||
        applicantName.includes(term) ||
        codeName.includes(term)
      );
    });
  }, [applications, handlingStatusOnly, searchTerm]);

  const selectedApplication = filteredApps.find(app => app.id === selectedApplicationId) ?? null;

  useEffect(() => {
    setAiSuggestion(null);
    setAiError(null);
    setSelectedDebitAccountId('');
    setSelectedCreditAccountId('');
  }, [selectedApplicationId]);

  const resolveAccountId = useCallback(
    (raw: string | null | undefined): string => {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) return '';
      const codeMatch = text.match(/\b\d{3,6}\b/);
      if (codeMatch) {
        const byCode = accountItems.find(item => item.code === codeMatch[0]);
        if (byCode) return byCode.id;
      }
      const normalized = text.replace(/\s+/g, '');
      const byName = accountItems.find(item => item.name.replace(/\s+/g, '') === normalized);
      if (byName) return byName.id;
      const partial = accountItems.find(item => normalized.includes(item.name.replace(/\s+/g, '')));
      return partial?.id ?? '';
    },
    [accountItems]
  );

  useEffect(() => {
    if (!aiSuggestion) return;
    const debitId = resolveAccountId(aiSuggestion.debitAccount);
    const creditId = resolveAccountId(aiSuggestion.creditAccount);
    if (debitId) setSelectedDebitAccountId(debitId);
    if (creditId) setSelectedCreditAccountId(creditId);
  }, [aiSuggestion, resolveAccountId]);

  const buildSuggestionPrompt = useCallback(
    (app: ApplicationWithDetails): string => {
      const data = app.formData ?? {};
      const lines = (data.invoice?.lines || []) as any[];
      const linesText = lines
        .slice(0, 6)
        .map(line => `${line.description || ''} ${line.projectName || ''} ${line.amountExclTax || ''}`.trim())
        .filter(Boolean)
        .join('\n');
      const amount = deriveAmount(app);
      const amountText = amount ? `¥${amount.toLocaleString()}` : '';
      const body = [
        `件名: ${buildTitle(app)}`,
        `種別: ${app.application_code?.name || ''}`,
        `申請内容: ${data.details || data.notes || data.invoice?.description || ''}`,
        `金額: ${amountText}`,
        linesText ? `内訳:\n${linesText}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const candidates = accountItems
        .slice(0, 120)
        .map(item => `${item.code} ${item.name}`)
        .join('\n');

      return `${body}\n\n利用可能な勘定科目候補（この中から選んでください）:\n${candidates}`;
    },
    [accountItems, buildTitle, deriveAmount]
  );

  const handleAiSuggest = useCallback(async () => {
    if (!selectedApplication) return;
    if (accountItems.length === 0) {
      notify?.('勘定科目マスタの読み込み中です。少し待ってください。', 'info');
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    try {
      const prompt = buildSuggestionPrompt(selectedApplication);
      if (prompt.replace(/\s+/g, '').length < 30) {
        setAiError('申請内容が少なくAI提案ができません。');
        return;
      }
      const suggestion = await suggestJournalEntry(prompt);
      setAiSuggestion(suggestion);
    } catch (err: any) {
      console.error('Failed to suggest journal entry:', err);
      setAiError(err?.message || 'AI提案に失敗しました。');
    } finally {
      setIsAiLoading(false);
    }
  }, [accountItems.length, buildSuggestionPrompt, notify, selectedApplication]);

  useEffect(() => {
    if (!selectedApplication) return;
    if (!isAiAutoSuggest) return;
    if (aiSuggestion) return;
    if (accountItems.length === 0) return;
    const prompt = buildSuggestionPrompt(selectedApplication);
    if (prompt.replace(/\s+/g, '').length < 30) return;
    const timer = window.setTimeout(() => {
      handleAiSuggest();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [accountItems.length, aiSuggestion, buildSuggestionPrompt, handleAiSuggest, isAiAutoSuggest, selectedApplication]);

  const handleGenerateJournal = useCallback(async () => {
    if (!selectedApplication) return;
    setIsWorking(true);
    try {
      const debitAccountId = selectedDebitAccountId;
      const creditAccountId = selectedCreditAccountId;
      const amount = deriveAmount(selectedApplication);

      if (debitAccountId && creditAccountId && amount !== null && amount > 0) {
        const description = buildTitle(selectedApplication);
        await dataService.createJournalFromAiSelection({
          applicationId: selectedApplication.id,
          debitAccountId,
          creditAccountId,
          amount,
          description,
          reasoning: aiSuggestion?.reasoning,
          confidence: aiSuggestion?.confidence,
          createdBy: currentUserId || undefined,
        });
        await dataService.updateApplicationAccountingStatus(selectedApplication.id, 'draft');
        notify?.('仕訳を生成しました。', 'success');
        await loadApprovedApplications();
        return;
      }

      notify?.('勘定科目/金額が揃っていないため、自動仕訳生成を実行します。', 'info');
      await dataService.generateJournalLinesFromApplication(selectedApplication.id, currentUserId || undefined);
      notify?.('仕訳を生成しました。', 'success');
      await loadApprovedApplications();
    } catch (err: any) {
      console.error('Failed to generate journal lines:', err);
      notify?.(err?.message || '仕訳の生成に失敗しました。', 'error');
    } finally {
      setIsWorking(false);
    }
  }, [currentUserId, loadApprovedApplications, notify, selectedApplication, selectedCreditAccountId, selectedDebitAccountId]);

  const handlePostJournal = useCallback(async () => {
    if (!selectedApplication) return;
    const entryId = selectedApplication.journalEntry?.id;
    if (!entryId) {
      notify?.('仕訳が未生成のため確定できません。', 'error');
      return;
    }
    setIsWorking(true);
    try {
      await dataService.updateJournalEntryStatus(entryId, 'posted');
      notify?.('仕訳を確定しました。', 'success');
      await loadApprovedApplications();
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      notify?.(err?.message || '仕訳の確定に失敗しました。', 'error');
    } finally {
      setIsWorking(false);
    }
  }, [loadApprovedApplications, notify, selectedApplication]);

  const getAccountingSummary = (app: ApplicationWithDetails) => {
    const entry = app.journalEntry;
    if (!entry || !entry.lines || entry.lines.length === 0) {
      return '会計：仕訳未生成';
    }

    const debitLine = entry.lines.find(line => (line.debit_amount ?? 0) > 0);
    const creditLine = entry.lines.find(line => (line.credit_amount ?? 0) > 0);
    const debitName = debitLine?.account_name || debitLine?.account_code || '未設定';
    const creditName = creditLine?.account_name || creditLine?.account_code || '未設定';
    const amount = debitLine?.debit_amount ?? creditLine?.credit_amount ?? null;
    const amountText = formatCurrency(amount);
    const statusSuffix = entry.status === 'posted' ? '［確定］' : '';

    if (!amountText) {
      return `会計：${debitName} → ${creditName}${statusSuffix}`;
    }

    return `会計：${debitName} → ${creditName}（${amountText}）${statusSuffix}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-indigo-600" />
            {title}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{description}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="件名・申請者で検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-xl p-4 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-600 dark:text-slate-300">
              <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">種別</th>
                  <th className="px-6 py-4">件名</th>
                  <th className="px-6 py-4 hidden md:table-cell">申請者</th>
                  <th className="px-6 py-4 text-right">金額</th>
                  <th className="px-6 py-4 hidden lg:table-cell">承認日時</th>
                  <th className="px-6 py-4">会計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredApps.map((app) => {
                  const amount = deriveAmount(app);
                  const status = app.accountingStatus ?? app.accounting_status ?? 'none';
                  const amountText = formatCurrency(amount);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApplicationId(app.id)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40">
                          {app.application_code?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {buildTitle(app)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                          {buildTitle(app) === (app.formData?.invoice?.supplierName || '') ? '' : app.formData?.invoice?.supplierName || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="text-slate-700 dark:text-slate-200">{app.applicant?.name}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                        {amountText ? amountText : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        {formatDate(app.approvedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getAccountingStatusBadgeClass(
                              status
                            )}`}
                          >
                            {getAccountingStatusLabel(status)}
                          </span>
                          <div className="text-slate-700 dark:text-slate-200">
                            {getAccountingSummary(app)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      該当する承認済み申請がありません。
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
          aria-label="仕訳を見る"
          onClick={() => setSelectedApplicationId(null)}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">仕訳</p>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                  {buildTitle(selectedApplication)}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedApplication.application_code?.name || '種別未設定'} / {selectedApplication.applicant?.name || '申請者未設定'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(selectedApplication.journalEntry?.lines || []).length === 0 ? (
                  <button
                    type="button"
                    onClick={handleGenerateJournal}
                    disabled={isWorking}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isWorking ? <Loader className="w-4 h-4 animate-spin" /> : null}
                    仕訳生成
                  </button>
                ) : (selectedApplication.accountingStatus ?? selectedApplication.accounting_status ?? 'none') !== 'posted' ? (
                  <button
                    type="button"
                    onClick={handlePostJournal}
                    disabled={isWorking}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isWorking ? <Loader className="w-4 h-4 animate-spin" /> : null}
                    仕訳確定
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setSelectedApplicationId(null)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">AI仕訳提案</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">内容と振り分け先をAIが提案します。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={isAiAutoSuggest}
                        onChange={(e) => setIsAiAutoSuggest(e.target.checked)}
                      />
                      自動提案
                    </label>
                    <button
                      type="button"
                      onClick={handleAiSuggest}
                      disabled={isAiLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isAiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      再提案
                    </button>
                  </div>
                </div>

                {aiError && (
                  <div className="mt-3 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">{aiError}</div>
                )}

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">借方勘定科目</p>
                      <select
                        value={selectedDebitAccountId}
                        onChange={(e) => setSelectedDebitAccountId(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <option value="">未選択</option>
                        {accountItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.code} {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">貸方勘定科目</p>
                      <select
                        value={selectedCreditAccountId}
                        onChange={(e) => setSelectedCreditAccountId(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <option value="">未選択</option>
                        {accountItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.code} {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {aiSuggestion ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AI提案（借方）</p>
                        <p className="text-sm text-slate-800 dark:text-slate-100">
                          {aiSuggestion.debitAccount || '未提案'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AI提案（貸方）</p>
                        <p className="text-sm text-slate-800 dark:text-slate-100">
                          {aiSuggestion.creditAccount || '未提案'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">金額</p>
                        <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-100">
                          {typeof aiSuggestion.amount === 'number' ? formatCurrency(aiSuggestion.amount) : '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">AI提案は未取得です。</div>
                  )}

                  {aiSuggestion?.reasoning ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">根拠</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{aiSuggestion.reasoning}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-200">
                {getAccountingSummary(selectedApplication)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {getAccountingStatusLabel(selectedApplication.accountingStatus ?? selectedApplication.accounting_status ?? 'none')}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/40">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">申請内容</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedApplication.formData?.details ||
                    selectedApplication.formData?.notes ||
                    selectedApplication.formData?.invoice?.description ||
                    '内容が入力されていません。'}
                </p>
              </div>

              {(selectedApplication.formData?.invoice?.lines || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">内訳</p>
                  {(selectedApplication.formData?.invoice?.lines || []).map((line: any) => (
                    <div
                      key={line.id || `${line.description}-${line.amountExclTax}`}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {line.description || '内訳未入力'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {line.projectName || line.customerName || 'プロジェクト未設定'}
                        </div>
                      </div>
                      <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(toNumber(line.amountExclTax) ?? null) || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {(selectedApplication.journalEntry?.lines || []).length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">仕訳は未生成です。</div>
                ) : (
                  (selectedApplication.journalEntry?.lines || []).map(line => {
                    const amount = (line.debit_amount ?? 0) > 0 ? line.debit_amount : line.credit_amount;
                    const amountText = formatCurrency(amount ?? null);
                    return (
                      <div key={line.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {line.account_name || line.account_code || '未設定'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {line.debit_amount && line.debit_amount > 0 ? '借方' : '貸方'}
                          </div>
                        </div>
                        <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {amountText ? amountText : '-'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedApplications;
