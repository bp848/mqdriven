
import React, { useState } from 'react';
import { FileCheck, Search, Eye, Download, Calendar, Filter, FileJson } from 'lucide-react';

interface ApprovedApplicationsProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

// Schema based on provided 'applications' table
interface ApplicationData {
  id: string; // uuid
  applicant_id: string; // uuid -> mapped to name for display
  applicant_name: string; // derived
  application_code_id: string; // uuid -> mapped to type
  application_type: string; // derived
  form_data: {
    title: string;
    amount?: number;
    department?: string;
    vendor?: string;
    description?: string;
  }; // jsonb
  status: string; // public.application_status
  approved_at: string; // timestamp with time zone
  submitted_at: string; // timestamp with time zone
}

export const ApprovedApplications: React.FC<ApprovedApplicationsProps> = ({ notify }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleAction = (msg: string, type: 'success' | 'info' = 'info') => {
    if (notify) notify(msg, type);
  };

  // Mock Data mimicking the 'applications' table
  const applications: ApplicationData[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      applicant_id: 'user-001',
      applicant_name: '山田 太郎',
      application_code_id: 'code-purchase',
      application_type: '購買稟議',
      form_data: {
        title: 'ハイデルベルグ交換部品購入',
        amount: 450000,
        vendor: '小森コーポレーション',
        description: '給紙ユニットの摩耗部品交換のため'
      },
      status: 'approved',
      submitted_at: '2024-05-18T10:00:00+09:00',
      approved_at: '2024-05-20T14:30:00+09:00'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      applicant_id: 'user-005',
      applicant_name: '佐藤 花子',
      application_code_id: 'code-expense',
      application_type: '経費精算',
      form_data: {
        title: '5月度 営業交通費',
        amount: 24500,
        department: '営業部'
      },
      status: 'approved',
      submitted_at: '2024-05-25T09:15:00+09:00',
      approved_at: '2024-05-26T11:00:00+09:00'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      applicant_id: 'user-003',
      applicant_name: '鈴木 一郎',
      application_code_id: 'code-wip',
      application_type: '在庫評価修正',
      form_data: {
        title: '5月末 仕掛品評価額確定',
        amount: 2800000,
        description: '工場IoTデータとの差異調整'
      },
      status: 'approved',
      submitted_at: '2024-05-31T17:00:00+09:00',
      approved_at: '2024-06-01T09:00:00+09:00'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      applicant_id: 'user-002',
      applicant_name: '田中 次郎',
      application_code_id: 'code-vendor',
      application_type: '新規取引先登録',
      form_data: {
        title: '株式会社テックサプライ',
        vendor: '株式会社テックサプライ',
        description: 'デジタル印刷機トナー供給契約'
      },
      status: 'approved',
      submitted_at: '2024-05-15T13:45:00+09:00',
      approved_at: '2024-05-16T10:20:00+09:00'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      applicant_id: 'user-001',
      applicant_name: '山田 太郎',
      application_code_id: 'code-purchase',
      application_type: '購買稟議',
      form_data: {
        title: '上質紙 90kg 100連',
        amount: 850000,
        vendor: '〇〇洋紙店'
      },
      status: 'approved',
      submitted_at: '2024-05-10T11:30:00+09:00',
      approved_at: '2024-05-12T15:00:00+09:00'
    }
  ];

  const formatCurrency = (val?: number) => val ? val.toLocaleString() : '-';
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const filteredApps = applications.filter(app => 
    app.form_data.title.includes(searchTerm) || 
    app.applicant_name.includes(searchTerm) ||
    app.application_type.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <FileCheck className="w-6 h-6 text-indigo-600" />
             承認済申請一覧 (Approved Applications)
           </h2>
           <p className="text-slate-500 text-sm mt-1">
             完了した稟議・申請データの閲覧とエクスポート
           </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => handleAction('CSVエクスポートを開始しました', 'success')}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
            >
                <Download className="w-4 h-4" /> CSV出力
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="件名、申請者名、種別で検索..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                <Calendar className="w-4 h-4" /> 承認日: 2024/05
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                <Filter className="w-4 h-4" /> 種別: すべて
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4">種別 (Type)</th>
                        <th className="px-6 py-4">件名 / 申請内容 (Title)</th>
                        <th className="px-6 py-4">申請者 (Applicant)</th>
                        <th className="px-6 py-4 text-right">金額 (Amount)</th>
                        <th className="px-6 py-4">承認日時 (Approved At)</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredApps.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100">
                                    {app.application_type}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-800">{app.form_data.title}</div>
                                {app.form_data.vendor && (
                                    <div className="text-xs text-slate-500 mt-0.5">支払先: {app.form_data.vendor}</div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-slate-700">{app.applicant_name}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                                {app.form_data.amount ? `¥${formatCurrency(app.form_data.amount)}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                {formatDate(app.approved_at)}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <FileCheck className="w-3 h-3" /> Approved
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleAction(`JSONデータ確認: ${app.id}`, 'info')}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                        title="Raw JSON Data"
                                    >
                                        <FileJson className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleAction(`申請詳細を表示: ${app.form_data.title}`, 'info')}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredApps.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                該当する申請データが見つかりません。
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>Showing {filteredApps.length} records</span>
            <div className="flex gap-2">
                <span className="font-mono bg-slate-200 px-2 py-1 rounded">Table: public.applications</span>
            </div>
        </div>
      </div>
    </div>
  );
};
