import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Truck, AlertCircle, CheckCircle, FileText, Download, Calendar, ArrowRight, Zap, Filter, ListFilter, Loader } from 'lucide-react';
import { PayableItem } from '../../types';
import * as dataService from '../../services/dataService';

const STATUS_MAP = {
    outstanding: { text: '支払待ち', color: 'bg-amber-100 text-amber-800', icon: <AlertCircle className="w-3 h-3" /> },
    partially_paid: { text: '一部支払済', color: 'bg-blue-100 text-blue-800', icon: <CreditCard className="w-3 h-3" /> },
    paid: { text: '支払済', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="w-3 h-3" /> },
};

const PayablesPage: React.FC = () => {
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>('outstanding');

  const loadPayables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = {
        status: filterStatus === 'all' ? undefined : filterStatus,
      };
      const data = await dataService.getPayables(filters);
      setPayables(data);
    } catch (err) {
      setError('買掛金データの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadPayables();
  }, [loadPayables]);

  const totalPayable = payables
    .filter(p => p.status === 'outstanding' || p.status === 'partially_paid')
    .reduce((sum, p) => sum + (p.amount - p.paidAmount), 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800">買掛金管理</h2>
            <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                    <Zap className="w-4 h-4" />支払実行
                </button>
            </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="pl-2 pr-8 py-1 bg-white border border-slate-300 rounded text-sm text-slate-600"
                >
                    <option value="all">すべてのステータス</option>
                    <option value="outstanding">支払待ち</option>
                    <option value="partially_paid">一部支払済</option>
                    <option value="paid">支払済</option>
                </select>
            </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-slate-200">
        <p className="text-sm text-slate-600">現在の買掛金残高</p>
        <p className="text-3xl font-bold text-slate-800">¥{totalPayable.toLocaleString()}</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-2">支払先</th>
                  <th className="px-4 py-2">カテゴリ</th>
                  <th className="px-4 py-2 text-right">金額</th>
                  <th className="px-4 py-2">発生日</th>
                  <th className="px-4 py-2">支払期日</th>
                  <th className="px-4 py-2">ステータス</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {payables.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.supplier}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">¥{item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.date}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-red-600">{item.due}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.color || ''}`}>
                        {STATUS_MAP[item.status]?.icon}
                        {STATUS_MAP[item.status]?.text || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default PayablesPage;