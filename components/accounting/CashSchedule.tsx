import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { CalendarClock, ChevronLeft, ChevronRight, Wallet, Loader } from 'lucide-react';
import { CashScheduleData } from '../../types';
import * as dataService from '../../services/dataService';

export const CashSchedulePage: React.FC = () => {
  const [scheduleData, setScheduleData] = useState<CashScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const data = await dataService.getCashSchedule({ startDate, endDate });
      setScheduleData(data);
    } catch (err) {
      setError('資金繰りデータの読み込みに失敗しました。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() + offset);
        return newDate;
    });
  };

  const chartData = scheduleData.map(d => ({
      day: new Date(d.date).getDate(),
      balance: d.closing_balance / 1000, // in thousands
  }));

  const monthlySummary = scheduleData.reduce((acc, d) => {
    acc.totalInflows += d.inflows;
    acc.totalOutflows += d.outflows;
    return acc;
  }, { totalInflows: 0, totalOutflows: 0 });
  const monthOpenBalance = scheduleData.length > 0 ? scheduleData[0].opening_balance : 0;
  const monthCloseBalance = scheduleData.length > 0 ? scheduleData[scheduleData.length - 1].closing_balance : 0;
  const netChange = monthlySummary.totalInflows - monthlySummary.totalOutflows;

  const formatCurrency = (val: number) => val.toLocaleString();

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <CalendarClock className="w-6 h-6 text-indigo-600" />
             資金繰りカレンダー
           </h2>
           <p className="text-slate-500 text-sm mt-1">
               入出金予定と日次資金残高の予測
           </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 font-bold text-slate-700 min-w-[120px] text-center">
                    {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                </div>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><Loader className="w-10 h-10 animate-spin text-indigo-600" /></div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>
      ) : (
        <>
            {/* Chart Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-500" /> 資金残高推移
                </h3>
                <div className="h-48 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="day" tick={{fontSize: 10}} />
                            <YAxis tickFormatter={(val) => `${val.toLocaleString()}k`} tick={{fontSize: 10}} />
                            <Tooltip formatter={(value: number) => [`¥${(value * 1000).toLocaleString()}`, '残高']} />
                            <ReferenceLine y={0} stroke="#f00" strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">月初残高</p>
                <p className="font-mono font-medium text-slate-700">¥{formatCurrency(monthOpenBalance)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                <p className="text-[10px] text-green-600 uppercase tracking-wide">入金合計</p>
                <p className="font-mono font-medium text-green-600">¥{formatCurrency(monthlySummary.totalInflows)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                <p className="text-[10px] text-red-600 uppercase tracking-wide">出金合計</p>
                <p className="font-mono font-medium text-red-600">¥{formatCurrency(monthlySummary.totalOutflows)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">純増減</p>
                <p className={`font-mono font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netChange >= 0 ? '+' : ''}¥{formatCurrency(netChange)}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 shadow-sm text-center">
                <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-bold">月末残高</p>
                <p className="font-mono font-bold text-indigo-700">¥{formatCurrency(monthCloseBalance)}</p>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">日付</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">前日残高</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-green-600">入金額</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-red-600">出金額</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-700">当日残高</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {scheduleData.map(d => (
                                <tr key={d.date}>
                                    <td className="px-4 py-3 font-mono text-slate-600">{d.date}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-500">¥{formatCurrency(d.opening_balance)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-green-600">+ ¥{formatCurrency(d.inflows)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-red-600">- ¥{formatCurrency(d.outflows)}</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">¥{formatCurrency(d.closing_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default CashSchedulePage;