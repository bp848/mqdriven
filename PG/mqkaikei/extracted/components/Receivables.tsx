
import React, { useState } from 'react';
import { CreditCard, AlertCircle, CheckCircle2, Clock, Filter, Download, Briefcase, Factory, Coins, Import, RefreshCw } from 'lucide-react';

interface ReceivablesProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const Receivables: React.FC<ReceivablesProps> = ({ notify }) => {
  const [filterDept, setFilterDept] = useState('all');

  const handleAction = (msg: string, type: 'success' | 'info' = 'info') => {
    if (notify) notify(msg, type);
  };

  // Mock Data: Printing Company Context
  const invoices = [
    { id: 'INV-240501', client: '株式会社ABC出版', job: '初夏ファッションカタログ印刷', department: 'オフセット', date: '2024/04/30', due: '2024/05/31', amount: 850000, mq: 425000, status: 'unpaid', days: 25, source: 'MIS連携' },
    { id: 'INV-240412', client: '山田デザイン事務所', job: '展示会パネル・販促物一式', department: 'デジタル', date: '2024/03/31', due: '2024/04/30', amount: 120000, mq: 96000, status: 'overdue', days: 55, source: 'MIS連携' },
    { id: 'INV-240505', client: 'テックソリューションズ', job: '製品マニュアル製本', department: '製本・加工', date: '2024/04/15', due: '2024/05/15', amount: 330000, mq: 165000, status: 'paid', days: 40, source: 'PDF Import' },
    { id: 'INV-240301', client: '鈴木商会', job: '3月度チラシ輪転', department: 'オフセット', date: '2024/02/28', due: '2024/03/31', amount: 56000, mq: 15000, status: 'overdue_bad', days: 87, source: 'MIS連携' },
    { id: 'INV-240515', client: 'グローバル印刷', job: '名刺・封筒定期便', department: 'デジタル', date: '2024/05/10', due: '2024/06/30', amount: 1250000, mq: 850000, status: 'unpaid', days: 15, source: 'MIS連携' },
  ];

  // Logic to filter
  const filteredData = filterDept === 'all' 
    ? invoices 
    : invoices.filter(inv => inv.department === filterDept);

  // Stats
  const totalReceivables = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalUncollectedMQ = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.mq, 0);
  const overdueAmount = invoices.filter(i => i.status.includes('overdue')).reduce((sum, i) => sum + i.amount, 0);
  
  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unpaid': return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 inline-flex items-center gap-1">未入金</span>;
      case 'paid': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-200 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 入金済</span>;
      case 'overdue': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200 flex items-center gap-1"><Clock className="w-3 h-3" /> 期限超過</span>;
      case 'overdue_bad': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 滞留警告</span>;
      default: return null;
    }
  };

  const formatCurrency = (val: number) => val.toLocaleString();

  return (
    <div className="space-y-6">
       {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <CreditCard className="w-6 h-6 text-indigo-600" />
             売掛金・M回収管理 (Receivables)
           </h2>
           <p className="text-slate-500 text-sm mt-1">
             <span className="font-bold text-indigo-600">M (付加価値)</span> は現金を回収して初めて確定します。
           </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => handleAction('基幹システム(MIS)との同期を開始しました...', 'info')}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-700 transition shadow-sm flex items-center gap-2 border border-slate-700"
            >
                <RefreshCw className="w-4 h-4" /> 基幹システム(MIS)同期
            </button>
            <button 
                onClick={() => handleAction('請求書PDFフォルダのスキャンを実行中...', 'info')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
            >
                <Import className="w-4 h-4" /> 請求書PDF一括取込
            </button>
        </div>
      </div>

      {/* KPI Cards (MQ Focused) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">売掛金残高 (Total PQ)</p>
                      <h3 className="text-2xl font-black text-slate-800 mt-1">¥{formatCurrency(totalReceivables)}</h3>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                  </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>データ同期: 10分前</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
              </div>
          </div>

          <div className="bg-indigo-900 p-5 rounded-xl border border-indigo-800 shadow-sm relative overflow-hidden text-white">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">未回収MQ (Uncollected M)</p>
                      <h3 className="text-2xl font-black text-white mt-1">¥{formatCurrency(totalUncollectedMQ)}</h3>
                  </div>
                  <div className="p-2 bg-indigo-800 rounded-lg">
                      <Coins className="w-5 h-5 text-indigo-300" />
                  </div>
              </div>
              <div className="mt-4 pt-4 border-t border-indigo-800 text-xs text-indigo-300 flex justify-between">
                  <span>M回収率 (対売上)</span>
                  <span className="font-bold text-white">{(totalUncollectedMQ / totalReceivables * 100).toFixed(1)}%</span>
              </div>
              {/* Decorative Circle */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-800 rounded-full opacity-50"></div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start z-10 relative">
                  <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">滞留債権 (Overdue)</p>
                      <h3 className="text-2xl font-black text-red-600 mt-1">¥{formatCurrency(overdueAmount)}</h3>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>自動督促メール</span>
                  <button onClick={() => handleAction('滞留先2件への督促メールドラフトを作成しました', 'success')} className="font-bold text-slate-700 hover:text-indigo-600 hover:underline">送信準備中 (2件)</button>
              </div>
          </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          {['all', 'オフセット', 'デジタル', '製本・加工'].map(dept => (
              <button
                key={dept}
                onClick={() => setFilterDept(dept)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
                    filterDept === dept 
                    ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                  {dept === 'all' ? '全社案件' : dept}
                  {dept === 'オフセット' && <Factory className="w-3 h-3 inline ml-2 mb-0.5" />}
              </button>
          ))}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Source / No.</th>
                <th className="px-4 py-3">得意先 / 案件名 (Job Title)</th>
                <th className="px-4 py-3">部門 (Dept)</th>
                <th className="px-4 py-3 text-right">請求額 (PQ)</th>
                <th className="px-4 py-3 text-right text-indigo-600">内、MQ額</th>
                <th className="px-4 py-3">入金期限 (Due)</th>
                <th className="px-4 py-3 text-center">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => handleAction(`案件 ${row.id} の詳細を表示します`, 'info')}>
                  <td className="px-4 py-3">
                      <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 block w-fit mb-1">{row.source}</span>
                      <div className="font-bold text-slate-700 text-xs">{row.id}</div>
                  </td>
                  <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{row.client}</div>
                      <div className="text-xs text-slate-500">{row.job}</div>
                  </td>
                  <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {row.department}
                      </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                      ¥{formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                      ¥{formatCurrency(row.mq)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1">
                          {row.due}
                          {row.days > 30 && row.status === 'unpaid' && <span className="text-red-500 font-bold">!</span>}
                      </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                      {getStatusBadge(row.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
              ※ M回収額は、各案件の限界利益率に基づいて自動算出されています。
          </div>
      </div>
    </div>
  );
};
