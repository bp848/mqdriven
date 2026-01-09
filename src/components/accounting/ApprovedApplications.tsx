
import React, { useState, useEffect, useCallback } from 'react';
import { FileCheck, Search, Eye, Download, Calendar, Filter, FileJson, Loader } from 'lucide-react';
import { ApplicationWithDetails } from '../../../types';
import * as dataService from '../../../services/dataService';

interface ApprovedApplicationsProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export const ApprovedApplications: React.FC<ApprovedApplicationsProps> = ({ notify }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'approvedAt' | 'amount' | 'title'>('approvedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadApprovedApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dataService.getApprovedApplications();
      setApplications(data);
    } catch (err) {
      setError('承認済み申請の読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovedApplications();
  }, [loadApprovedApplications]);


  const formatCurrency = (val?: number) => val ? val.toLocaleString() : '-';
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const filteredApps = applications.filter(app => {
    const term = searchTerm.toLowerCase();
    const title = (app.formData?.title || app.formData?.subject || '').toLowerCase();
    const applicantName = (app.applicant?.name || '').toLowerCase();
    const codeName = (app.applicationCode?.name || '').toLowerCase();
    return title.includes(term) || applicantName.includes(term) || codeName.includes(term);
  });

  const selectedApplication = filteredApps.find((app) => app.id === selectedApplicationId) ?? null;
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
        const av = Number(a.formData?.amount ?? 0);
        const bv = Number(b.formData?.amount ?? 0);
        return (av - bv) * dir;
      }
      const at = buildTitle(a).toLowerCase();
      const bt = buildTitle(b).toLowerCase();
      return at.localeCompare(bt) * dir;
    });
    return safe;
  }, [filteredApps, sortDir, sortKey]);

  const totals = React.useMemo(() => {
    const count = filteredApps.length;
    const amountSum = filteredApps.reduce((sum, app) => sum + (Number(app.formData?.amount) || 0), 0);
    return { count, amountSum };
  }, [filteredApps]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
             <FileCheck className="w-6 h-6 text-indigo-600" />
             承認済申請一覧
           </h2>
           <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
             会計処理の元となる、承認が完了した申請データです（status=approved）。
            </p>
        </div>
        <div className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
            件数 {totals.count}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50">
            金額合計 ¥{formatCurrency(totals.amountSum)}
          </span>
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
                            <th className="px-6 py-4">詳細</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {sortedApps.map((app) => (
                            <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition">
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
                                <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                                    {app.formData?.amount ? `¥${formatCurrency(app.formData.amount)}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                                    {formatDate(app.approvedAt)}
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
                        ))}
                        {filteredApps.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">詳細</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{buildTitle(selectedApplication)}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {selectedApplication.applicationCode?.name || '種別未設定'} / {selectedApplication.applicant?.name || '申請者未設定'}
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              承認日時: {formatDate(selectedApplication.approvedAt)}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">金額</p>
              <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                {selectedApplication.formData?.amount ? `¥${formatCurrency(selectedApplication.formData.amount)}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">申請ID</p>
              <p className="font-mono text-slate-800 dark:text-slate-100 break-all">{selectedApplication.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">申請者メール</p>
              <p className="text-slate-800 dark:text-slate-100">{selectedApplication.applicant?.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">申請コード</p>
              <p className="text-slate-800 dark:text-slate-100">
                {selectedApplication.applicationCode?.code || '-'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">申請内容 (form_data)</p>
            <pre className="text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(selectedApplication.formData ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedApplications;
