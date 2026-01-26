import React, { useState, useMemo, useEffect } from 'react';
import { 
  Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { SaleRecord, FixedCostBreakdown, SummaryStats } from '../../types';
import { fetchSupabaseData, analyzeDataWithGemini } from '../../services/analysisService';

// ==========================================
// 定数 (Constants)
// ==========================================

const INITIAL_DATA: SaleRecord[] = [
  { id: '1', customerName: 'ヒロセ電機株式会社', productName: '社内報　八要No.148', salesRep: '稲垣　直子', estPQ: 756000, estVQ: 65581, estMQ: 690419, finalPQ: 756000, finalVQ: 65581, finalMQ: 690419, deadline: '2025/12/23', lastUpdated: '2026/1/8', status: '入金待ち', industry: '製造' },
  { id: '2', customerName: '株式会社　武蔵野', productName: '投げ込みチラシ「経営者のための生成ＡＩ組織的活用の教科書」', salesRep: '稲垣　直子', estPQ: 181500, estVQ: 12890, estMQ: 168610, finalPQ: 181500, finalVQ: 12890, finalMQ: 168610, deadline: '2025/12/3', lastUpdated: '2026/1/9', status: '入金待ち', industry: 'コンサル' },
  { id: '3', customerName: '日本卓球 株式会社', productName: '剛力戦績カード A6【増刷】', salesRep: '稲垣　直子', estPQ: 81625, estVQ: 31920, estMQ: 49705, finalPQ: 81625, finalVQ: 31920, finalMQ: 49705, deadline: '2025/12/12', lastUpdated: '2025/12/15', status: '請求待ち', industry: '製造' },
  { id: '4', customerName: '山田美樹事務所', productName: '機関誌　自由民主 12/25発行', salesRep: '稲垣　直子', estPQ: 1120400, estVQ: 963384, estMQ: 157016, finalPQ: 1120400, finalVQ: 963384, finalMQ: 157016, deadline: '2025/12/25', lastUpdated: '2025/12/26', status: '請求待ち', industry: 'その他' },
  { id: '5', customerName: '一般財団法人　国際美容協会', productName: '皆伝列伝', salesRep: '稲垣　直子', estPQ: 1550000, estVQ: 143136, estMQ: 1406864, finalPQ: 1550000, finalVQ: 449136, finalMQ: 1100864, deadline: '2025/12/23', lastUpdated: '2025/12/3', status: '作業完了待ち', industry: '団体' }
];

// ==========================================
// サブコンポーネント (Sub-Components)
// ==========================================

const SummaryCards: React.FC<{ stats: SummaryStats }> = ({ stats }) => {
  const format = (v: number) => new Intl.NumberFormat('ja-JP').format(Math.round(v));
  const cards = [
    { label: '売上 (PQ)', value: `¥${format(stats.totalSales)}`, color: 'text-white', sub: `${stats.count}件` },
    { label: '限界利益 (MQ)', value: `¥${format(stats.totalProfit)}`, color: 'text-emerald-400', ratio: `${(stats.avgMarginRatio * 100).toFixed(1)}%` },
    { label: 'リピート率', value: `${stats.repeatRate.toFixed(1)}%`, color: 'text-indigo-400', sub: `${stats.repeatCustomerCount}/${stats.uniqueCustomerCount}社` },
    { label: '固定費 (F)', value: `¥${format(stats.fixedCost)}`, color: 'text-slate-400', sub: `回収率: ${(stats.fixedCost > 0 ? (stats.totalProfit/stats.fixedCost*100) : 0).toFixed(0)}%` },
    { label: '経常利益 (G)', value: `¥${format(stats.netGain)}`, color: stats.netGain >= 0 ? 'text-emerald-500' : 'text-rose-500', border: stats.netGain >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <div key={i} className={`bg-slate-800/60 p-4 rounded-xl border ${c.border || 'border-slate-700/50'} shadow-xl backdrop-blur transition-all hover:scale-[1.02]`}>
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.label}</span>
            {c.ratio && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">{c.ratio}</span>}
          </div>
          <div className={`text-xl font-mono font-black ${c.color} tracking-tight`}>{c.value}</div>
          {c.sub && <div className="text-[9px] font-bold text-slate-500 mt-2">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
};

const STRACVisualizer: React.FC<{ stats: SummaryStats }> = ({ stats }) => {
  const mqRatio = (stats.totalProfit / stats.totalSales) * 100 || 0;
  const bepRatio = (stats.fixedCost / stats.totalProfit) * 100 || 0;
  return (
    <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg shadow-2xl h-full flex flex-col space-y-6">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>STRAC構造分析
      </h3>
      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>売上 PQ</span><span className="text-slate-300">¥{stats.totalSales.toLocaleString()}</span></div>
          <div className="h-10 w-full flex rounded overflow-hidden border border-slate-900 shadow-inner">
            <div className="bg-rose-500/80 flex items-center justify-center text-[9px] font-black" style={{ width: `${100-mqRatio}%` }}>VQ</div>
            <div className="bg-emerald-500/80 flex items-center justify-center text-[9px] font-black" style={{ width: `${mqRatio}%` }}>MQ</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase"><span>利益配分 MQ</span><span className="text-emerald-400">¥{stats.totalProfit.toLocaleString()}</span></div>
          <div className="h-10 w-full flex rounded overflow-hidden border border-slate-900 bg-slate-900/50 shadow-inner">
            <div className="bg-slate-600 flex items-center justify-center text-[9px] font-black" style={{ width: `${Math.min(bepRatio, 100)}%` }}>F</div>
            <div className={`${stats.netGain >= 0 ? 'bg-indigo-600' : 'bg-rose-700'} flex items-center justify-center text-[9px] font-black`} style={{ width: `${Math.max(0, 100-bepRatio)}%` }}>G</div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-700">
           <p className="text-[8px] font-black text-slate-500 uppercase">BEP比率</p>
           <p className={`text-lg font-mono font-black ${bepRatio < 80 ? 'text-emerald-400' : 'text-rose-400'}`}>{bepRatio.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
};

const SensitivitySimulation: React.FC<{ stats: SummaryStats }> = ({ stats }) => {
  const [pChange, setPChange] = useState(0);
  const [qChange, setQChange] = useState(0);
  const simulatedG = useMemo(() => {
    const newPQ = stats.totalSales * (1 + pChange / 100) * (1 + qChange / 100);
    const newVQ = stats.totalVariableCost * (1 + qChange / 100);
    return (newPQ - newVQ) - stats.fixedCost;
  }, [stats, pChange, qChange]);

  return (
    <div className="bg-slate-800 border border-indigo-500/30 p-5 rounded-xl shadow-2xl h-full flex flex-col gap-4">
      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">感度シミュレーター</h3>
      <div className="space-y-4 flex-1">
        {[{ label: '単価 P', val: pChange, set: setPChange }, { label: '数量 Q', val: qChange, set: setQChange }].map(item => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase"><span>{item.label}</span><span className="text-indigo-400">{item.val > 0 ? '+' : ''}{item.val}%</span></div>
            <input type="range" min="-10" max="20" step="0.5" value={item.val} onChange={(e) => item.set(Number(e.target.value))} className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
          </div>
        ))}
        <div className="mt-4 p-4 bg-slate-950/50 rounded-lg border border-slate-700">
          <span className="text-[8px] font-black text-slate-500 uppercase">シミュレーション後の G</span>
          <p className={`text-xl font-mono font-black ${simulatedG >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>¥{Math.round(simulatedG).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

const CustomerRepeatTable: React.FC<{ data: SaleRecord[] }> = ({ data }) => {
  const customerAnalysis = useMemo(() => {
    const groups: Record<string, { count: number; totalMQ: number }> = {};
    data.forEach(d => {
      if (!groups[d.customerName]) groups[d.customerName] = { count: 0, totalMQ: 0 };
      groups[d.customerName].count += 1;
      groups[d.customerName].totalMQ += d.finalMQ;
    });
    return Object.entries(groups).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.count - a.count);
  }, [data]);
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700 bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">顧客別リピート分析</div>
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-left">
          <tbody className="divide-y divide-slate-700/30">
            {customerAnalysis.slice(0, 10).map((c) => (
              <tr key={c.name} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-[10px] font-bold text-slate-200 truncate max-w-[120px]">{c.name}</td>
                <td className="px-4 py-3 text-center text-[11px] font-black text-indigo-400">{c.count}回</td>
                <td className="px-4 py-3 text-right text-[10px] font-bold text-emerald-400">¥{Math.round(c.totalMQ/1000)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DataTable: React.FC<{ data: SaleRecord[], onSelect: (r: SaleRecord) => void }> = ({ data, onSelect }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden h-full flex flex-col">
    <div className="px-5 py-3 border-b border-slate-700 bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">案件別MQ明細</div>
    <div className="overflow-auto flex-1">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-slate-900 text-[9px] font-black uppercase text-slate-500 border-b border-slate-700">
          <tr><th className="px-5 py-3 text-left">顧客 / 案件</th><th className="px-5 py-3 text-right">売上 PQ</th><th className="px-5 py-3 text-right">利益 MQ</th><th className="px-5 py-3 text-center">率</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {data.map(r => (
            <tr key={r.id} onClick={() => onSelect(r)} className="hover:bg-indigo-500/10 cursor-pointer group">
              <td className="px-5 py-3"><div><p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400">{r.customerName}</p><p className="text-[9px] text-slate-500 truncate max-w-xs">{r.productName}</p></div></td>
              <td className="px-5 py-3 text-right text-[10px] font-mono">¥{r.finalPQ.toLocaleString()}</td>
              <td className="px-5 py-3 text-right text-[10px] font-bold text-emerald-400 font-mono">¥{r.finalMQ.toLocaleString()}</td>
              <td className="px-5 py-3 text-center text-[10px] text-slate-500 font-bold">{((r.finalMQ/r.finalPQ)*100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ==========================================
// メインアプリケーション (Main App)
// ==========================================

const STRACAnalysisPage: React.FC = () => {
  const [data, setData] = useState<SaleRecord[]>(() => {
    const saved = localStorage.getItem('strac_data');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [fixedCost, setFixedCost] = useState(3000000);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SaleRecord | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => { localStorage.setItem('strac_data', JSON.stringify(data)); }, [data]);

  const filtered = useMemo(() => data.filter(d => 
    d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.productName.toLowerCase().includes(searchTerm.toLowerCase())
  ), [data, searchTerm]);
  
  const stats: SummaryStats = useMemo(() => {
    const totalSales = filtered.reduce((s, i) => s + i.finalPQ, 0);
    const totalProfit = filtered.reduce((s, i) => s + i.finalMQ, 0);
    const totalVariableCost = filtered.reduce((s, i) => s + i.finalVQ, 0);
    const totalMaterialCost = filtered.reduce((s, i) => s + (i.materialCost || 0), 0);
    const totalOutsourcingCost = filtered.reduce((s, i) => s + (i.outsourcingCost || 0), 0);
    const customers = new Set(filtered.map(d => d.customerName));
    const repeats = Array.from(customers).filter(c => filtered.filter(d => d.customerName === c).length > 1).length;
    return {
      totalSales, 
      totalProfit, 
      totalVariableCost,
      totalMaterialCost,
      totalOutsourcingCost,
      avgMarginRatio: totalSales > 0 ? totalProfit / totalSales : 0,
      count: filtered.length, 
      fixedCost, 
      fixedCostBreakdown: { labor: 0, rent: 0, other: 0 },
      netGain: totalProfit - fixedCost, 
      uniqueCustomerCount: customers.size, 
      repeatCustomerCount: repeats,
      repeatRate: customers.size > 0 ? (repeats / customers.size) * 100 : 0
    };
  }, [filtered, fixedCost]);

  const handleSync = async () => {
    const key = prompt("Supabase Anon Key を入力してください (orders_v2 テーブルにアクセスします):");
    if (!key) return;
    setIsSyncing(true);
    try {
      const synced = await fetchSupabaseData({ 
        url: 'https://rwjhpfghhgstvplmggks.supabase.co', 
        key, 
        tableName: 'orders_v2' 
      });
      setData(synced);
    } catch (e) { 
      alert("同期に失敗しました。Keyまたは権限を確認してください。"); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  const handleAIChat = async () => {
    if (!chatInput.trim()) return;
    setAiResponse("分析中...");
    const res = await analyzeDataWithGemini(filtered, chatInput, fixedCost);
    setAiResponse(res);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20 rotate-3">MQ</div>
          <h1 className="text-sm font-black text-white uppercase tracking-tighter">Strategic MQ Dashboard</h1>
        </div>
        <button 
          onClick={handleSync} 
          disabled={isSyncing} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          {isSyncing ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
          {isSyncing ? "同期中..." : "Supabase同期"}
        </button>
      </header>

      <main className="p-4 space-y-4 max-w-[1600px] mx-auto w-full">
        <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 backdrop-blur flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <input 
              type="text" 
              placeholder="顧客・案件でフィルタ..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-1.5 text-xs font-bold outline-none w-full focus:border-indigo-500 transition-colors" 
            />
          </div>
          <div className="flex items-center gap-6 ml-auto">
            <div className="flex flex-col">
              <span className="text-[8px] text-slate-500 font-black uppercase">固定費 F 設定 (月額)</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-600">¥</span>
                <input 
                  type="number" 
                  value={fixedCost} 
                  onChange={e => setFixedCost(Number(e.target.value))} 
                  className="bg-transparent text-sm font-mono font-black text-indigo-400 border-b border-slate-700 w-24 outline-none focus:border-indigo-500" 
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-[8px] text-slate-500 font-black uppercase block">BEP比率</span>
              <span className={`text-sm font-mono font-black ${stats.totalProfit > 0 && stats.fixedCost/stats.totalProfit < 0.8 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(stats.totalProfit > 0 ? stats.fixedCost/stats.totalProfit*100 : 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <SummaryCards stats={stats} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="h-[320px]"><STRACVisualizer stats={stats} /></div>
          <div className="h-[320px]"><SensitivitySimulation stats={stats} /></div>
          <div className="h-[320px]"><CustomerRepeatTable data={filtered} /></div>
          <div className="h-[320px] bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl overflow-hidden flex flex-col">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">業種分布</h3>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={Object.entries(filtered.reduce((acc: any, curr) => { const ind = curr.industry || '未分類'; acc[ind] = (acc[ind] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }))} 
                    innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value"
                  >
                    {['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'].map((color, index) => <Cell key={index} fill={color} />)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[500px] mb-20">
          <DataTable data={filtered} onSelect={setSelectedRecord} />
        </div>
      </main>

      {/* AI チャット UI */}
      <div className={`fixed bottom-6 right-6 flex flex-col items-end z-[60] gap-3`}>
        {isAIChatOpen && (
          <div className="w-[350px] sm:w-[400px] h-[500px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
            <div className="p-4 bg-slate-800 flex justify-between items-center border-b border-slate-700">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>AI 経営顧問
              </span>
              <button onClick={() => setIsAIChatOpen(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
              <div className="bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-700 text-[11px] leading-relaxed">
                現在のSTRACデータに基づき、利益Gを増やすための戦略を提案します。何を知りたいですか？
              </div>
              {aiResponse && (
                <div className="bg-indigo-600/10 p-3 rounded-xl rounded-tl-none border border-indigo-500/20 text-[11px] leading-relaxed text-slate-200">
                  {aiResponse.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
              <input 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                onKeyPress={e => e.key === 'Enter' && handleAIChat()}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors" 
                placeholder="例: 利益を20%増やすには？" 
              />
              <button onClick={handleAIChat} className="bg-indigo-600 p-2 rounded-lg text-white hover:bg-indigo-500 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </button>
            </div>
          </div>
        )}
        <button 
          onClick={() => setIsAIChatOpen(!isAIChatOpen)} 
          className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all border border-indigo-400/30"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
      </div>

      {/* 詳細モーダル */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
          <div className="bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedRecord.customerName}</h3>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">{selectedRecord.productName}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="space-y-4 font-mono">
              <div className="flex justify-between items-center text-xs"><span className="text-slate-500">売上 PQ:</span><span className="text-white font-black">¥{selectedRecord.finalPQ.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-xs"><span className="text-slate-500">変動費 VQ:</span><span className="text-rose-400 font-bold">¥{selectedRecord.finalVQ.toLocaleString()}</span></div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-3 text-sm font-black text-emerald-400"><span>限界利益 MQ:</span><span>¥{selectedRecord.finalMQ.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-xs pt-1"><span className="text-slate-500">利益率:</span><span className="text-indigo-400 font-black">{((selectedRecord.finalMQ/selectedRecord.finalPQ)*100).toFixed(1)}%</span></div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-bold">
              <div className="bg-slate-950/50 p-2 rounded">納期: {selectedRecord.deadline}</div>
              <div className="bg-slate-950/50 p-2 rounded text-right">ステータス: {selectedRecord.status}</div>
            </div>
            <button onClick={() => setSelectedRecord(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white mt-8 py-3 rounded-xl font-black transition-colors">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default STRACAnalysisPage;
