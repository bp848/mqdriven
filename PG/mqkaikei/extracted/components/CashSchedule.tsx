
import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { CalendarClock, AlertTriangle, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';

interface CashScheduleProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

// Mock Data Types
type TransactionType = 'income' | 'expense';
interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
}

interface DailyData {
  day: number;
  balance: number; // End of day balance
  transactions: Transaction[];
  alert?: string;
}

export const CashSchedule: React.FC<CashScheduleProps> = ({ notify }) => {
  const [currentMonth, setCurrentMonth] = useState('2024年 5月');

  const handleNotify = (msg: string) => {
    if (notify) notify(msg, 'info');
  };

  // Mock Calendar Data for May 2024
  // Starting Balance: 12,500
  const calendarData: Record<number, DailyData> = {
    10: { day: 10, balance: 13500, transactions: [] },
    20: { day: 20, balance: 13500, transactions: [
      { id: 't1', title: '売掛入金 (A社)', amount: 550, type: 'income', category: '売掛金' }
    ]},
    23: { day: 23, balance: 15200, transactions: [
      { id: 't2', title: '大口入金 (B出版)', amount: 1800, type: 'income', category: '売掛金' }
    ]},
    25: { day: 25, balance: 9500, alert: 'Low Balance', transactions: [
      { id: 't3', title: '従業員給与', amount: 4200, type: 'expense', category: '人件費' },
      { id: 't4', title: '小森コーポレーション', amount: 1400, type: 'expense', category: 'リース料' }
    ]},
    31: { day: 31, balance: 16500, transactions: [
      { id: 't5', title: '定期入金 (C社)', amount: 12000, type: 'income', category: '売掛金' },
      { id: 't6', title: '〇〇洋紙店', amount: 1800, type: 'expense', category: '仕入' },
      { id: 't7', title: 'XXインキ', amount: 200, type: 'expense', category: '仕入' },
    ]},
  };

  // Generate Chart Data from Calendar Data (Simplified for visual)
  const chartData = Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    // Simple interpolation for demo
    let balance = 13000;
    if (d >= 23) balance = 15200;
    if (d >= 25) balance = 9500;
    if (d >= 31) balance = 16500;
    
    return {
        day: `5/${d}`,
        balance: balance,
        limit: 5000 // Danger line
    };
  });

  const formatCurrency = (val: number) => val.toLocaleString();

  // Helper to render calendar grid
  const renderCalendarDays = () => {
    const days = [];
    const emptyStartDays = 3; // May 1st 2024 is Wednesday (Index 3 if Sun=0)
    
    // Empty cells for previous month
    for (let i = 0; i < emptyStartDays; i++) {
      days.push(<div key={`empty-${i}`} className="bg-slate-50/50 border-r border-b border-slate-200 min-h-[120px]"></div>);
    }

    // Days 1-31
    for (let d = 1; d <= 31; d++) {
      const data = calendarData[d];
      const hasAlert = data?.alert;
      const isToday = d === 20; // Assume today is 20th
      
      days.push(
        <div key={d} 
            className={`border-r border-b border-slate-200 min-h-[120px] p-2 relative group hover:bg-slate-50 transition cursor-pointer ${isToday ? 'bg-indigo-50/30' : 'bg-white'}`}
            onClick={() => handleNotify(`5月${d}日の詳細データを表示します`)}
        >
          <div className="flex justify-between items-start mb-2">
            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
              {d}
            </span>
            {data?.balance && (
                <div className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    data.balance < 10000 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                }`}>
                    ¥{formatCurrency(data.balance)}k
                </div>
            )}
          </div>

          <div className="space-y-1">
            {data?.transactions.map((t, idx) => (
               <div key={idx} className={`text-[10px] px-1.5 py-1 rounded border truncate flex justify-between items-center ${
                   t.type === 'income' 
                   ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                   : 'bg-amber-50 border-amber-100 text-amber-700'
               }`}>
                   <span className="truncate">{t.title}</span>
                   <span className="font-bold ml-1">{t.type === 'expense' ? '▲' : ''}{t.amount}</span>
               </div>
            ))}
            {/* Placeholder for days without specific large tx but have balance calculation */}
            {!data && (
                <div className="opacity-0 group-hover:opacity-100 transition text-[10px] text-center text-slate-300 pt-4">
                    + Add
                </div>
            )}
          </div>
          
          {hasAlert && (
              <div className="absolute bottom-1 right-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <CalendarClock className="w-6 h-6 text-indigo-600" />
             AI資金繰りカレンダー (Cash Flow Calendar)
           </h2>
           <p className="text-slate-500 text-sm mt-1">
               入出金予定と日次資金残高のAI予測
           </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
                <button onClick={() => handleNotify('前月へ移動')} className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 font-bold text-slate-700 min-w-[120px] text-center">
                    {currentMonth}
                </div>
                <button onClick={() => handleNotify('翌月へ移動')} className="p-2 hover:bg-slate-100 rounded transition text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="hidden md:flex flex-col items-end">
                <span className="text-xs text-slate-500 font-bold uppercase">Current Balance</span>
                <span className="text-xl font-bold text-indigo-700 font-mono">¥13,500,000</span>
            </div>
        </div>
      </div>

      {/* Chart Section (Collapsible or Small) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-500" /> 資金残高推移 (Forecast Trend)
            </h3>
            <div className="flex gap-4 text-xs">
                 <span className="flex items-center gap-1 text-slate-500"><div className="w-2 h-2 bg-indigo-500 rounded-full"></div> 予測残高</span>
                 <span className="flex items-center gap-1 text-red-500"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 危険ライン (¥5,000k)</span>
            </div>
          </div>
          <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBalCal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tick={{fontSize: 10}} interval={2} />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`¥${value.toLocaleString()}k`, '残高']}
                        />
                        <ReferenceLine y={5000} stroke="red" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorBalCal)" />
                    </AreaChart>
                </ResponsiveContainer>
          </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div key={day} className={`py-2 text-center text-xs font-bold uppercase ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                      {day}
                  </div>
              ))}
          </div>
          
          {/* Calendar Body */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
              {renderCalendarDays()}
          </div>
      </div>
    </div>
  );
};
