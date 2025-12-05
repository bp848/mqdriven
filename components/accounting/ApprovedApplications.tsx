
import React, { useState, useEffect, useCallback } from 'react';
import { FileCheck, Search, Eye, Download, Calendar, Filter, FileJson, Loader } from 'lucide-react';
import { ApplicationWithDetails } from '../../types';
import * as dataService from '../../services/dataService';

interface ApprovedApplicationsProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export const ApprovedApplications: React.FC<ApprovedApplicationsProps> = ({ notify }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredApps = applications.filter(app => 
    app.formData?.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    app.applicant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.applicationCode?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <FileCheck className="w-6 h-6 text-indigo-600" />
             承認済申請一覧
           </h2>
           <p className="text-slate-500 text-sm mt-1">
             会計処理の元となる、承認が完了した申請データです。
           </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="件名、申請者名、種別で検索..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            {isLoading ? (
                <div className="p-16 text-center"><Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>
            ) : error ? (
                <div className="p-16 text-center text-red-500">{error}</div>
            ) : (
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">種別</th>
                            <th className="px-6 py-4">件名 / 申請内容</th>
                            <th className="px-6 py-4">申請者</th>
                            <th className="px-6 py-4 text-right">金額</th>
                            <th className="px-6 py-4">承認日時</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredApps.map((app) => (
                            <tr key={app.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100">
                                        {app.applicationCode?.name || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{app.formData?.title}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-slate-700">{app.applicant?.name}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                                    {app.formData?.amount ? `¥${formatCurrency(app.formData.amount)}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                    {formatDate(app.approvedAt)}
                                </td>
                            </tr>
                        ))}
                        {filteredApps.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    該当する承認済み申請データが見つかりません。
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};

export default ApprovedApplications;
