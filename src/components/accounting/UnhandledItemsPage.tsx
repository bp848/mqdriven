import React, { useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Loader } from 'lucide-react';
import type { Lead, Page } from '../../../types';
import { LeadStatus } from '../../../types';
import ApprovedApplications from './ApprovedApplications';

interface UnhandledItemsPageProps {
  leads: Lead[];
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  onNavigate?: (page: Page) => void;
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
  currentUserId?: string | null;
}

const buildLeadSubtitle = (lead: Lead): string => {
  const parts = [lead.company, lead.name].map(v => v?.trim()).filter(Boolean);
  return parts.join(' / ') || lead.id;
};

const formatDateTime = (raw: string | null | undefined): string => {
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const UnhandledItemsPage: React.FC<UnhandledItemsPageProps> = ({
  leads,
  onUpdateLead,
  onNavigate,
  notify,
  currentUserId,
}) => {
  const [leadSearch, setLeadSearch] = useState('');
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const untouchedLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    return leads
      .filter(lead => lead.status === LeadStatus.Untouched)
      .filter(lead => {
        if (!term) return true;
        const hay = [
          lead.company,
          lead.name,
          lead.email ?? '',
          lead.phone ?? '',
          lead.message ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
  }, [leadSearch, leads]);

  const handleLeadStatusChange = async (leadId: string, nextStatus: LeadStatus) => {
    setUpdatingLeadId(leadId);
    try {
      await onUpdateLead(leadId, { status: nextStatus });
    } catch (err: any) {
      console.error('[UnhandledItems] update lead failed', err);
      notify?.(err?.message || 'リードの更新に失敗しました。', 'error');
    } finally {
      setUpdatingLeadId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-rose-600" />
            未対応管理
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            承認済み申請（対応ステータス）と、リード（未対応）をまとめて管理します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('accounting_approved_applications')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              title="承認済み一覧へ"
            >
              <ArrowRight className="w-4 h-4" />
              承認済一覧へ
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('sales_leads')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
              title="リード管理へ"
            >
              <ArrowRight className="w-4 h-4" />
              リード管理へ
            </button>
          )}
        </div>
      </div>

      <ApprovedApplications
        notify={notify}
        title="承認済み（未対応）"
        description="承認済み申請のうち、対応ステータスが未対応のものです。"
        currentUserId={currentUserId}
        onNavigate={onNavigate}
        handlingStatusOnly="unhandled"
      />

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">リード（未対応）</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              件数 {untouchedLeads.length}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <input
              type="text"
              placeholder="会社名/氏名/メールなどで検索"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">作成</th>
                <th className="px-4 py-3">リード</th>
                <th className="px-4 py-3">連絡先</th>
                <th className="px-4 py-3">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {untouchedLeads.map(lead => {
                const isUpdating = updatingLeadId === lead.id;
                const contact = [lead.email, lead.phone].filter(Boolean).join(' / ') || '-';
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatDateTime(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {buildLeadSubtitle(lead)}
                      </div>
                      {lead.message && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {lead.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {contact}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) => handleLeadStatusChange(lead.id, e.target.value as LeadStatus)}
                          disabled={isUpdating}
                          className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 disabled:opacity-60"
                        >
                          {Object.values(LeadStatus).map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {isUpdating && <Loader className="w-4 h-4 animate-spin text-slate-500" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {untouchedLeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    未対応のリードはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UnhandledItemsPage;
