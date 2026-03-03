import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileCheck, Search, Eye, Loader, X, RefreshCw, Check, Pencil, Sparkles } from 'lucide-react';
import { ApplicationWithDetails, AIJournalSuggestion, Page } from '../../../types';
import * as dataService from '../../../services/dataService';
import { suggestJournalEntry } from '../../../services/geminiService';
import { isAccountingTargetApplication } from './accountingApplicationFilter';

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
  const [bulkAiRunning, setBulkAiRunning] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [confirmingAppId, setConfirmingAppId] = useState<string | null>(null);
  const [inlineWorkingId, setInlineWorkingId] = useState<string | null>(null);

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
      setApplications(data.filter(isAccountingTargetApplication));
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
  const selectedApplicationStatus =
    selectedApplication?.accountingStatus ?? selectedApplication?.accounting_status ?? 'none';
  const selectedApplicationAmount = selectedApplication ? deriveAmount(selectedApplication) : null;
  const canGenerateJournal =
    Boolean(selectedDebitAccountId) &&
    Boolean(selectedCreditAccountId) &&
    selectedApplicationAmount !== null &&
    selectedApplicationAmount > 0;

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

  const handleBulkAiGenerate = useCallback(async () => {
    if (accountItems.length === 0) {
      notify?.('勘定科目マスタの読み込み中です。', 'info');
      return;
    }
    const targets = applications.filter(app => {
      const st = app.accountingStatus ?? app.accounting_status ?? 'none';
      return st === 'none' || !st;
    });
    if (targets.length === 0) {
      notify?.('仕訳未生成の申請がありません。', 'info');
      return;
    }
    setBulkAiRunning(true);
    setBulkAiProgress({ done: 0, total: targets.length, errors: 0 });
    let errors = 0;
    const BATCH = 2;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (app) => {
          const prompt = buildSuggestionPrompt(app);
          if (prompt.replace(/\s+/g, '').length < 30) throw new Error('内容不足');
          const suggestion = await suggestJournalEntry(prompt);
          const debitId = resolveAccountId(suggestion.debitAccount);
          const creditId = resolveAccountId(suggestion.creditAccount);
          const amount = deriveAmount(app);
          if (!debitId || !creditId || !amount || amount <= 0) throw new Error('勘定科目未解決');
          await dataService.createJournalFromAiSelection({
            applicationId: app.id,
            debitAccountId: debitId,
            creditAccountId: creditId,
            amount,
            description: buildTitle(app),
            reasoning: suggestion.reasoning,
            confidence: suggestion.confidence,
            createdBy: currentUserId || undefined,
          });
          await dataService.updateApplicationAccountingStatus(app.id, 'draft');
        })
      );
      const batchErrors = results.filter(r => r.status === 'rejected').length;
      errors += batchErrors;
      setBulkAiProgress(prev => ({ ...prev, done: Math.min(i + BATCH, targets.length), errors }));
    }
    setBulkAiRunning(false);
    await loadApprovedApplications();
    notify?.(
      `AI仕訳提案完了: ${targets.length - errors}件成功${errors > 0 ? `、${errors}件失敗` : ''}`,
      errors > 0 ? 'info' : 'success'
    );
  }, [accountItems, applications, buildSuggestionPrompt, buildTitle, currentUserId, deriveAmount, loadApprovedApplications, notify, resolveAccountId]);

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

      notify?.('借方/貸方/金額を選択してから仕訳生成してください。', 'error');
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

  const handleInlineConfirm = useCallback(async (app: ApplicationWithDetails) => {
    const entryId = app.journalEntry?.id;
    if (!entryId) {
      notify?.('仕訳が未生成のため確定できません。', 'error');
      return;
    }
    setInlineWorkingId(app.id);
    try {
      await dataService.updateJournalEntryStatus(entryId, 'posted');
      notify?.('仕訳を確定しました。', 'success');
      setConfirmingAppId(null);
      await loadApprovedApplications();
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      notify?.(err?.message || '仕訳の確定に失敗しました。', 'error');
    } finally {
      setInlineWorkingId(null);
    }
  }, [loadApprovedApplications, notify]);

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
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 px-5 pt-6 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="text-slate-400 dark:text-slate-500 text-[13px] mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 w-56 bg-transparent border-b border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>
          {bulkAiRunning && (
            <span className="text-[13px] text-slate-500">
              <Loader className="w-3.5 h-3.5 animate-spin inline mr-1" />
              AI提案中 {bulkAiProgress.done}/{bulkAiProgress.total}
              {bulkAiProgress.errors > 0 && <span className="text-red-500 ml-1">({bulkAiProgress.errors}失敗)</span>}
            </span>
          )}
          <button
            type="button"
            onClick={handleBulkAiGenerate}
            disabled={bulkAiRunning || isLoading}
            className="text-[13px] text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50 whitespace-nowrap"
          >
            全件AI仕訳提案
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-600 dark:text-slate-300">
              <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">種別</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">件名</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">金額</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">日時</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">仕訳</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">提案</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">修正</th>
                  <th className="px-5 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">確定</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app) => {
                  const amount = deriveAmount(app);
                  const status = app.accountingStatus ?? app.accounting_status ?? 'none';
                  const amountText = formatCurrency(amount);
                  const hasJournal = (app.journalEntry?.lines || []).length > 0;
                  const isPosted = status === 'posted';
                  const isDraft = status === 'draft';
                  const journalSummary = hasJournal ? (() => {
                    const dl = app.journalEntry!.lines!.find((l: any) => (l.debit_amount ?? 0) > 0);
                    const cl = app.journalEntry!.lines!.find((l: any) => (l.credit_amount ?? 0) > 0);
                    return `${dl?.account_name || '?'} / ${cl?.account_name || '?'}`;
                  })() : null;
                  const isConfirming = confirmingAppId === app.id;
                  const isInlineWorking = inlineWorkingId === app.id;
                  return (
                    <tr key={app.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                      <td className="px-5 py-4 whitespace-nowrap text-[15px] text-slate-700 dark:text-slate-200">
                        {app.application_code?.name || '-'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedApplicationId(app.id)}
                          className="text-[15px] text-teal-700 dark:text-teal-400 hover:underline text-left truncate block max-w-md"
                        >
                          {buildTitle(app)}
                        </button>
                        <div className="text-[13px] text-slate-400 dark:text-slate-500 truncate max-w-md">
                          {app.applicant?.name}{buildTitle(app) !== (app.formData?.invoice?.supplierName || '') && app.formData?.invoice?.supplierName ? ` / ${app.formData.invoice.supplierName}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-[15px] tabular-nums text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {amountText || '-'}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDate(app.approvedAt)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {hasJournal ? (
                          <>
                            <div className="text-[13px] text-slate-700 dark:text-slate-200">{isPosted ? '確定済' : '下書き'}</div>
                            <div className="text-[12px] text-slate-400 dark:text-slate-500">{journalSummary}</div>
                          </>
                        ) : (
                          <span className="text-[13px] text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {!hasJournal && !isPosted ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedApplicationId(app.id); }} className="text-[13px] text-teal-700 dark:text-teal-400 hover:underline">
                            AI提案
                          </button>
                        ) : hasJournal && !isPosted ? (
                          <span className="text-[13px] text-slate-400">済</span>
                        ) : (
                          <span className="text-[13px] text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {hasJournal && !isPosted ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedApplicationId(app.id); }} className="text-[13px] text-teal-700 dark:text-teal-400 hover:underline">
                            修正
                          </button>
                        ) : (
                          <span className="text-[13px] text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isDraft && hasJournal && !isConfirming && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmingAppId(app.id); }} disabled={isInlineWorking} className="text-[13px] text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
                            確定
                          </button>
                        )}
                        {isDraft && hasJournal && isConfirming && (
                          <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => handleInlineConfirm(app)} disabled={isInlineWorking} className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50">
                              {isInlineWorking ? '処理中...' : '実行'}
                            </button>
                            <button type="button" onClick={() => setConfirmingAppId(null)} className="text-[13px] text-slate-400 hover:underline">
                              取消
                            </button>
                          </span>
                        )}
                        {isPosted && <span className="text-[13px] text-slate-400">確定済</span>}
                        {!isDraft && !isPosted && <span className="text-[13px] text-slate-300 dark:text-slate-600">-</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-400 dark:text-slate-500">
                      該当する承認済み申請がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
            className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden flex flex-col"
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
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getAccountingStatusBadgeClass(
                      selectedApplicationStatus
                    )}`}
                  >
                    {getAccountingStatusLabel(selectedApplicationStatus)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
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

            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
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

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {(selectedApplication.journalEntry?.lines || []).length === 0 ? (
                <button
                  type="button"
                  onClick={handleGenerateJournal}
                  disabled={isWorking || !canGenerateJournal}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white text-base font-semibold hover:bg-indigo-700 disabled:opacity-50 min-w-40"
                >
                  {isWorking ? <Loader className="w-5 h-5 animate-spin" /> : null}
                  仕訳生成
                </button>
              ) : (selectedApplication.accountingStatus ?? selectedApplication.accounting_status ?? 'none') !== 'posted' ? (
                <button
                  type="button"
                  onClick={handlePostJournal}
                  disabled={isWorking}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700 disabled:opacity-50 min-w-40"
                >
                  {isWorking ? <Loader className="w-5 h-5 animate-spin" /> : null}
                  仕訳確定
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedApplications;
