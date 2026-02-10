import React, { useState, useMemo } from 'react';
import { ApplicationWithDetails, SortConfig } from '../types';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import { ArrowUpDown, ChevronDown, Eye, RefreshCw, Trash2, X, FileText } from './Icons';
import { formatDateTime, formatJPY } from '../utils';

interface ApplicationListProps {
  applications: ApplicationWithDetails[];
  onApplicationSelect: (app: ApplicationWithDetails) => void;
  selectedApplicationId: string | null;
  onResumeDraft?: (app: ApplicationWithDetails) => void;
  currentUserId?: string | null;
  onCancelApplication?: (app: ApplicationWithDetails) => void;
  onDeleteDraft?: (app: ApplicationWithDetails) => void;
  onCreateJournal?: (app: ApplicationWithDetails) => void;
  resubmittedParentIds?: string[];
  resubmissionChildrenMap?: Record<string, string>;
}

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

const sumNumericArray = (values: any[]): number | null => {
  if (!Array.isArray(values)) return null;
  const total = values.reduce((sum, value) => {
    const amount = toNumber(value?.amount ?? value);
    return sum + (amount || 0);
  }, 0);
  return total > 0 ? total : null;
};

const pickFirstString = (values: any[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const buildDailyReportSummary = (data: any): string | null => {
  if (!data || typeof data !== 'object') return null;
  const planItems = Array.isArray(data.planItems) ? data.planItems : [];
  const actualItems = Array.isArray(data.actualItems) ? data.actualItems : [];

  const pickFromItem = (item: any): string | null => {
    if (!item || typeof item !== 'object') return null;
    const customer = typeof item.customerName === 'string' ? item.customerName.trim() : '';
    const action = typeof item.action === 'string' ? item.action.trim() : '';
    if (customer && action) return `${customer} / ${action}`;
    return customer || action || null;
  };

  const planSummary = pickFromItem(planItems[0]);
  const actualSummary = pickFromItem(actualItems[0]);
  const activitySummary =
    typeof data.activityContent === 'string' ? data.activityContent.trim().split('\n')[0] : null;
  const reportDate = typeof data.reportDate === 'string' ? data.reportDate : null;

  return pickFirstString([
    planSummary,
    actualSummary,
    data.customerName,
    activitySummary,
    reportDate,
  ]);
};

const deriveApplicationSummary = (app: ApplicationWithDetails) => {
  const data: any = app.formData || {};
  const invoice = data.invoice || {};

  const amountCandidates = [
    toNumber(data.amount),
    toNumber(data.totalAmount),
    toNumber(data.requestedAmount),
    toNumber(data.estimatedAmount),
    toNumber(invoice.totalGross),
    toNumber(invoice.totalNet),
    toNumber(invoice.totalAmount),
    toNumber(invoice.total),
    sumNumericArray(data.details),
    sumNumericArray(invoice.lines),
  ].filter((value): value is number => value !== null);

  const amount = amountCandidates.length > 0 ? amountCandidates[0] : null;
  const formattedAmount = amount !== null ? formatJPY(amount) : '-';

  const payee = pickFirstString([
    invoice.supplierName,
    data.supplierName,
    data.paymentRecipientName,
    data.payee,
    data.payeeName,
    data.vendorName,
    data.recipientName,
  ]) || '-';

  const customer = pickFirstString([
    data.customerName,
    data.clientName,
    data.projectName,
    invoice.customerName,
    data.companyName,
    data.customer?.name,
    data.client?.name,
  ]) || '-';

  const isDailyReport = (app.applicationCode?.code || '').toUpperCase() === 'DLY';
  if (isDailyReport) {
    const dailySummary = buildDailyReportSummary(data);
    return { amount: formattedAmount, payee, customer: dailySummary || customer };
  }

  return { amount: formattedAmount, payee, customer };
};

const ApplicationList: React.FC<ApplicationListProps> = ({
  applications,
  onApplicationSelect,
  selectedApplicationId,
  onResumeDraft,
  currentUserId,
  onCancelApplication,
  onDeleteDraft,
  onCreateJournal,
  resubmittedParentIds,
  resubmissionChildrenMap,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'updatedAt', direction: 'descending' });
  const resubmittedParentIdSet = useMemo(() => new Set(resubmittedParentIds || []), [resubmittedParentIds]);
  const resubmissionChildLookup = resubmissionChildrenMap || {};

  const sortedApplications = useMemo(() => {
    let sortableItems = [...applications];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
            case 'applicant':
                aValue = a.applicant?.name?.toLowerCase() || '';
                bValue = b.applicant?.name?.toLowerCase() || '';
                break;
            case 'type':
                aValue = a.applicationCode?.name?.toLowerCase() || '';
                bValue = b.applicationCode?.name?.toLowerCase() || '';
                break;
            case 'updatedAt':
                aValue = a.updatedAt || a.createdAt;
                bValue = b.updatedAt || b.createdAt;
                break;
            default:
                aValue = a[sortConfig.key as keyof ApplicationWithDetails] || '';
                bValue = b[sortConfig.key as keyof ApplicationWithDetails] || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [applications, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader: React.FC<{ sortKey: string; label: string; className?: string }> = ({ sortKey, label, className }) => {
    const isActive = sortConfig?.key === sortKey;
    const isAscending = sortConfig?.direction === 'ascending';

    return (
      <th scope="col" className={`px-6 py-3 ${className || ''}`}>
          <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 group">
              <span className={isActive ? 'font-bold text-slate-800 dark:text-slate-100' : ''}>{label}</span>
              <div className="w-4 h-4">
                  {isActive ? (
                      <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-200 transition-transform duration-200 ${isAscending ? 'rotate-180' : 'rotate-0'}`} />
                  ) : (
                      <ArrowUpDown className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
              </div>
          </button>
      </th>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
          <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
            <tr>
              <SortableHeader sortKey="type" label="申請種別" />
              <SortableHeader sortKey="applicant" label="申請者" />
              <th scope="col" className="px-6 py-3 text-right">金額</th>
              <th scope="col" className="px-6 py-3">支払先</th>
              <th scope="col" className="px-6 py-3">顧客 / 案件</th>
              <SortableHeader sortKey="updatedAt" label="更新日時" />
              <SortableHeader sortKey="status" label="ステータス" />
              <th scope="col" className="px-6 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedApplications.map((app) => {
              const canResumeDraft = Boolean(onResumeDraft) && app.status === 'draft';
              const canResubmit =
                Boolean(onResumeDraft) && app.status === 'rejected' && currentUserId && currentUserId === app.applicantId;
              const canCancel =
                Boolean(onCancelApplication) && currentUserId === app.applicantId && app.status === 'pending_approval';
              const canDeleteDraft = Boolean(onDeleteDraft) && app.status === 'draft' && currentUserId === app.applicantId;
              const canCreateJournal = Boolean(onCreateJournal) && app.status === 'approved' && (!app.accounting_status || app.accounting_status === 'none');
              const isResubmissionChild = Boolean(resubmissionChildLookup[app.id]);
              const isResubmittedParent = resubmittedParentIdSet.has(app.id);

              const summary = deriveApplicationSummary(app);
              return (
              <tr
                key={app.id}
                className={`border-b dark:border-slate-700 border-l-4 transition-colors duration-150 cursor-pointer ${
                  selectedApplicationId === app.id
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                } ${
                  isResubmittedParent
                    ? 'border-purple-300 dark:border-purple-500/70'
                    : isResubmissionChild
                    ? 'border-indigo-300 dark:border-indigo-500/70'
                    : 'border-transparent'
                }`}
                onClick={() => onApplicationSelect(app)}
              >
                <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{app.applicationCode?.name || 'N/A'}</td>
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{app.applicant?.name || '不明なユーザー'}</td>
                <td className="px-6 py-4 text-right tabular-nums">{summary.amount}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{summary.payee}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{summary.customer}</td>
                <td className="px-6 py-4">{formatDateTime(app.updatedAt || app.createdAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ApplicationStatusBadge status={app.status} />
                    {isResubmissionChild && (
                      <span
                        className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                        title={`元申請ID: ${resubmissionChildLookup[app.id]}`}
                      >
                        再申請
                      </span>
                    )}
                    {isResubmittedParent && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        再申請済
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-stretch gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if ((canResumeDraft || canResubmit) && onResumeDraft) {
                          onResumeDraft(app);
                          return;
                        }
                        onApplicationSelect(app);
                      }}
                      className="flex items-center justify-center gap-1.5 w-full text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      {canResumeDraft || canResubmit ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>{canResumeDraft ? '下書きを再開' : '再申請'}</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>詳細表示</span>
                        </>
                      )}
                    </button>
                    {canCancel && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onCancelApplication?.(app);
                        }}
                        className="flex items-center justify-center gap-1.5 w-full text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                      >
                        <X className="w-4 h-4" />
                        <span>申請を取り消す</span>
                      </button>
                    )}
                    {canDeleteDraft && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteDraft?.(app);
                        }}
                        className="flex items-center justify-center gap-1.5 w-full text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>下書きを削除</span>
                      </button>
                    )}
                    {canCreateJournal && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onCreateJournal?.(app);
                        }}
                        className="flex items-center justify-center gap-1.5 w-full text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        <span>仕訳レビューへ</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
            })}
            {sortedApplications.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-slate-500 dark:text-slate-400">
                  <p>表示する申請がありません。</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApplicationList;
