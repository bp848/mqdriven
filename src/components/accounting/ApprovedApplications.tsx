import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileCheck, Search, Eye, Loader, X } from 'lucide-react';
import { ApplicationWithDetails, Page } from '../../../types';
import * as dataService from '../../../services/dataService';

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
}) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

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
                  <th className="px-6 py-4">申請者</th>
                  <th className="px-6 py-4 text-right">金額</th>
                  <th className="px-6 py-4">承認日時</th>
                  <th className="px-6 py-4">会計</th>
                  <th className="px-6 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredApps.map((app) => {
                  const amount = deriveAmount(app);
                  const status = app.accountingStatus ?? app.accounting_status ?? 'none';
                  const amountText = formatCurrency(amount);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40">
                          {app.application_code?.name || 'N/A'}
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
                        {amountText ? amountText : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {formatDate(app.approvedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 dark:text-slate-200">
                          {getAccountingSummary(app)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {getAccountingStatusLabel(status)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedApplicationId(app.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                        >
                          <Eye className="w-4 h-4" />
                          仕訳を見る
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
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
              <button
                type="button"
                onClick={() => setSelectedApplicationId(null)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
