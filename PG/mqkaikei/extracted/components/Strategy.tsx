
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import { Layers, Box, Edit3, RefreshCw, Save, BrainCircuit, Target, ArrowRight, TrendingDown, LineChart } from 'lucide-react';
import { JobTable } from './JobTable';
import { AIInsights } from './AIInsights';

// 経営計画書に基づく初期値 (2025年度計画)
const INITIAL_PQ = 25000;
const INITIAL_VQ = 11250;
const INITIAL_F = 9800;

interface StrategyProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const Strategy: React.FC<StrategyProps> = ({ notify }) => {
  // 経営数値の状態管理 (単位: 千円)
  const [pq, setPq] = useState(INITIAL_PQ);
  const [vq, setVq] = useState(INITIAL_VQ);
  const [f, setF] = useState(INITIAL_F);
  const [isEditing, setIsEditing] = useState(false);

  // 計算フィールド
  const mq = pq - vq;
  const g = mq - f;
  const vqRate = pq > 0 ? (vq / pq) * 100 : 0;
  const mqRate = pq > 0 ? (mq / pq) * 100 : 0;
  const breakEvenPQ = mqRate > 0 ? f / (mqRate / 100) : 0;
  const breakEvenRate = pq > 0 ? (breakEvenPQ / pq) * 100 : 0;

  // グラフ用データ生成
  const mqStructure = [
    { name: 'PQ (売上)', value: pq, fill: '#6366f1' }, 
    { name: 'VQ (変動)', value: vq, fill: '#94a3b8' }, 
    { name: 'MQ (粗利)', value: mq, fill: '#0ea5e9' }, 
    { name: 'F (固定)', value: f, fill: '#f59e0b' }, 
    { name: 'G (利益)', value: g, fill: g >= 0 ? '#10b981' : '#ef4444' }, 
  ];

  const generateTrendData = () => {
    const months = ['11月', '12月', '1月', '2月', '3月', '4月', '5月(計画)'];
    return months.map((month, i) => {
      if (i === 6) return { name: month, MQ: mq, F: f, G: g };
      const factor = 0.8 + (Math.random() * 0.4); 
      const pastMQ = Math.floor(mq * factor * 0.9);
      const pastF = Math.floor(f * (0.98 + Math.random() * 0.05));
      return { name: month, MQ: pastMQ, F: pastF, G: pastMQ - pastF };
    });
  };

  const [trendData, setTrendData] = useState(generateTrendData());

  useEffect(() => {
     setTrendData(prev => {
         const newData = [...prev];
         newData[6] = { name: '5月(計画)', MQ: mq, F: f, G: g };
         return newData;
     });
  }, [mq, f, g]);

  const handleReset = () => {
      setPq(INITIAL_PQ);
      setVq(INITIAL_VQ);
      setF(INITIAL_F);
      if (notify) notify('シミュレーション値を初期化しました', 'info');
  };

  const formatCurrency = (val: number) => val.toLocaleString();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <BrainCircuit className="w-6 h-6 text-indigo-600" />
             経営戦略コックピット (Strategy)
           </h2>
           <p className="text-slate-500 text-sm mt-1">MQ会計シミュレーションとAI経営分析</p>
        </div>
        <div className="flex space-x-2">
            <button 
              onClick={() => notify && notify('年計グラフの生成を開始しました...', 'info')}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm text-slate-600"
            >
              年計グラフ
            </button>
            <button 
              onClick={() => notify && notify('MQ会計表(PDF)のダウンロードを開始しました', 'success')}
              className="px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition shadow-sm flex items-center gap-2"
            >
              MQ会計表(PDF)
            </button>
        </div>
      </div>

      {/* Simulator Controls */}
      <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-700">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <Target className="w-5 h-5" />
              </div>
              <div>
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    2025年度 経営計画シミュレーター
                  </h2>
                  <p className="text-xs text-slate-300">数値を変更して、利益(G)への感度分析を行います。</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
             {isEditing ? (
                 <button 
                    onClick={() => { setIsEditing(false); if (notify) notify('シミュレーション結果を保存しました', 'success'); }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition shadow-sm"
                 >
                    <Save className="w-4 h-4" /> 確定
                 </button>
             ) : (
                 <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg font-bold transition shadow-sm border border-slate-600"
                 >
                    <Edit3 className="w-4 h-4" /> 数値を修正
                 </button>
             )}
             <button onClick={handleReset} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
                <RefreshCw className="w-4 h-4" />
             </button>
          </div>
      </div>

      {/* MQ Input Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* PQ Card */}
        <div className={`p-5 rounded-xl border shadow-sm transition-all relative overflow-hidden bg-white ${isEditing ? 'ring-2 ring-indigo-400 border-indigo-500 shadow-md transform scale-105 z-10' : 'border-slate-200'}`}>
            <h2 className="text-2xl font-black text-indigo-600">PQ <span className="text-xs font-bold text-slate-500 ml-1">売上高</span></h2>
            <div className="mt-2">
                {isEditing ? (
                    <input type="number" value={pq} onChange={(e) => setPq(Number(e.target.value))} className="w-full text-2xl font-bold text-slate-800 border-b-2 border-indigo-300 focus:outline-none bg-transparent" />
                ) : (
                    <div className="text-3xl font-bold text-slate-800 tracking-tight">¥{formatCurrency(pq)}k</div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-indigo-600"></div>
        </div>

        {/* VQ Card */}
        <div className={`p-5 rounded-xl border shadow-sm transition-all relative overflow-hidden bg-white ${isEditing ? 'ring-2 ring-slate-400 border-slate-500 shadow-md transform scale-105 z-10' : 'border-slate-200'}`}>
            <div className="flex justify-between">
                <h2 className="text-2xl font-black text-slate-500">VQ <span className="text-xs font-bold text-slate-500 ml-1">変動費</span></h2>
                <div className="text-right"><span className="text-xs font-mono text-slate-400">VQ率</span><div className="text-sm font-bold text-slate-600">{vqRate.toFixed(1)}%</div></div>
            </div>
            <div className="mt-2">
                {isEditing ? (
                    <input type="number" value={vq} onChange={(e) => setVq(Number(e.target.value))} className="w-full text-2xl font-bold text-slate-800 border-b-2 border-slate-300 focus:outline-none bg-transparent" />
                ) : (
                    <div className="text-3xl font-bold text-slate-800 tracking-tight">¥{formatCurrency(vq)}k</div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-500"></div>
        </div>

        {/* MQ Card */}
        <div className="p-5 rounded-xl border border-slate-200 shadow-sm bg-indigo-50/50 relative overflow-hidden">
             <div className="flex justify-between">
                <h2 className="text-2xl font-black text-sky-600">MQ <span className="text-xs font-bold text-slate-500 ml-1">付加価値</span></h2>
                <div className="text-right"><span className="text-xs font-mono text-slate-400">MQ率</span><div className="text-sm font-bold text-sky-700">{mqRate.toFixed(1)}%</div></div>
            </div>
            <div className="mt-2 text-3xl font-bold text-sky-700 tracking-tight">¥{formatCurrency(mq)}k</div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-sky-600"></div>
        </div>

        {/* F Card */}
        <div className={`p-5 rounded-xl border shadow-sm transition-all relative overflow-hidden bg-white ${isEditing ? 'ring-2 ring-amber-400 border-amber-500 shadow-md transform scale-105 z-10' : 'border-slate-200'}`}>
            <h2 className="text-2xl font-black text-amber-600">F <span className="text-xs font-bold text-slate-500 ml-1">固定費</span></h2>
            <div className="mt-2">
                {isEditing ? (
                    <input type="number" value={f} onChange={(e) => setF(Number(e.target.value))} className="w-full text-2xl font-bold text-slate-800 border-b-2 border-amber-300 focus:outline-none bg-transparent" />
                ) : (
                    <div className="text-3xl font-bold text-slate-800 tracking-tight">¥{formatCurrency(f)}k</div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-amber-600"></div>
        </div>

        {/* G Card */}
        <div className={`p-5 rounded-xl border shadow-sm relative overflow-hidden ${g >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
             <div className="flex justify-between">
                <h2 className={`text-2xl font-black ${g >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>G <span className="text-xs font-bold text-slate-500 ml-1">利益</span></h2>
                <div className="text-right"><span className="text-xs font-mono text-slate-400">G率</span><div className={`text-sm font-bold ${g >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{pq > 0 ? ((g / pq) * 100).toFixed(1) : 0}%</div></div>
            </div>
            <div className={`mt-2 text-3xl font-bold tracking-tight ${g >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>¥{formatCurrency(g)}k</div>
            <div className={`absolute bottom-0 left-0 h-1 w-full ${g >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> MQ会計推移図</h3>
            <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-sky-500 rounded-sm"></div> MQ</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div> F</span>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="MQ" name="MQ" fill="#0ea5e9" barSize={32} radius={[4, 4, 0, 0]} />
                <Line type="step" dataKey="F" name="F" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Structure & Break-even */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <h3 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-2"><Box className="w-5 h-5 text-indigo-500" /> MQ構造分析</h3>
           <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mqStructure} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fontWeight: 'bold'}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]}>
                  {mqStructure.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
           </div>
           <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-500">損益分岐点 PQ</span>
                    <span className="text-sm font-bold text-slate-700">¥{formatCurrency(Math.round(breakEvenPQ))}k</span>
                </div>
                <div className="relative w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${breakEvenRate > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(breakEvenRate, 100)}%` }}></div>
                </div>
                <div className="flex justify-between mt-1"><span className="text-[10px] text-slate-400">0</span><span className="text-[10px] text-slate-500">安全余裕率: {(100 - breakEvenRate).toFixed(1)}%</span></div>
           </div>
        </div>
      </div>

      <AIInsights />

      {/* Department Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">部門別MQ会計表</h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">詳細を見る &rarr;</button>
        </div>
        <JobTable />
      </div>
    </div>
  );
};
