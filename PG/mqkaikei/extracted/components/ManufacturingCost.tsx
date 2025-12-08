
import React, { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ReferenceLine
} from 'recharts';
import { Factory, Zap, Box, Cog, AlertTriangle, Activity, Database, Truck, Calculator, TrendingUp, Sliders, Settings } from 'lucide-react';

interface ManufacturingCostProps {
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const ManufacturingCost: React.FC<ManufacturingCostProps> = ({ notify }) => {
  // State for Cost Simulator
  const [paperPriceIndex, setPaperPriceIndex] = useState(105); // 105% of standard
  const [machineSpeed, setMachineSpeed] = useState(12500); // SPH (Sheets Per Hour)
  const [hourlyLaborCost, setHourlyLaborCost] = useState(3500); // Yen/Hour (Team cost)

  const handleNotify = (msg: string) => {
    if (notify) notify(msg, 'info');
  };

  // Calculation Logic (Simplified for UI)
  // Standard Base: Material ¥1.5, Overhead ¥0.8
  const baseMaterialCost = 1.5;
  const overheadCost = 0.8;
  
  // Dynamic Calculations
  const calcMaterial = baseMaterialCost * (paperPriceIndex / 100);
  const calcLabor = (hourlyLaborCost / machineSpeed) * 1000; // Labor cost per 1000 sheets
  const calcTotalUnit = calcMaterial + (calcLabor/1000) + overheadCost; // per sheet
  
  // Assuming Sales Price ¥5.0 per sheet
  const salesPrice = 5.0;
  const estimatedProfit = salesPrice - calcTotalUnit; 
  const profitMargin = (estimatedProfit / salesPrice) * 100;

  // Mock Data: VQ Breakdown (Imported from Purchase System)
  const vqBreakdown = [
    { name: '用紙代 (Paper)', value: 5800, color: '#6366f1' },
    { name: 'インキ・材料 (Ink/Mat)', value: 1200, color: '#0ea5e9' },
    { name: '刷版代 (Plates)', value: 850, color: '#64748b' },
    { name: '外注加工費 (Outsource)', value: 2400, color: '#f59e0b' },
  ];

  // Mock Data: Factory IoT (Machine Performance)
  const machineData = [
    { id: 1, name: 'Komori GL-840P', status: 'Running', speed: machineSpeed, waste: 2.1, power: 45, job: 'JB-2405-001: Summer Catalog' },
    { id: 2, name: 'Heidelberg XL106', status: 'Setup', speed: 0, waste: 0, power: 5, job: 'Setting up: JB-2405-003' },
    { id: 3, name: 'Horizon Stitchliner', status: 'Running', speed: 4500, waste: 0.5, power: 12, job: 'JB-2405-001: Binding' },
  ];

  // Mock Data: Unit Cost Trend (Automated Calc)
  const unitCostTrend = [
    { month: '11月', material: 1.4, labor: 1.2, overhead: 0.8 },
    { month: '12月', material: 1.4, labor: 1.1, overhead: 0.8 },
    { month: '1月', material: 1.5, labor: 1.3, overhead: 0.9 },
    { month: '2月', material: 1.6, labor: 1.2, overhead: 0.8 }, 
    { month: '3月', material: 1.55, labor: 1.1, overhead: 0.8 },
    { month: '4月', material: 1.5, labor: 1.0, overhead: 0.8 },
    { month: '5月(Current)', material: calcMaterial, labor: calcLabor/1000, overhead: overheadCost },
  ];

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <Factory className="w-6 h-6 text-indigo-600" />
             製造原価・工場 (Factory Cost)
           </h2>
           <p className="text-slate-500 text-sm mt-1">IoT連携によるリアルタイム原価計算 & シミュレーション</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => handleNotify('IoTデバイス(Komori/Heidelberg)と通信中...')} className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 hover:bg-emerald-100 transition">
              <Activity className="w-3 h-3" /> Machine Data: Live
           </button>
           <button onClick={() => handleNotify('購買管理DBから最新単価を同期しました')} className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 transition">
              <Database className="w-3 h-3" /> Purchase DB: Synced
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Unit Cost (1枚あたり)</p>
                  <Calculator className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-800">¥{formatCurrency(calcTotalUnit)}</div>
              <p className="text-xs text-slate-400 mt-1">目標: ¥2.40以内</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Profit G (1枚あたり)</p>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600">¥{formatCurrency(estimatedProfit)}</div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                   <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(profitMargin, 100)}%` }}></div>
              </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Avg Machine Speed</p>
                  <Settings className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-indigo-600">{machineSpeed.toLocaleString()} <span className="text-xs font-medium text-slate-500">sph</span></div>
              <p className="text-xs text-slate-400 mt-1">IoT Real-time Value</p>
          </div>

           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Waste Rate (損紙)</p>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-500">2.1 <span className="text-xs font-medium text-slate-500">%</span></div>
              <p className="text-xs text-slate-400 mt-1">許容範囲: 3.0%未満</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Smart Cost Simulator */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-indigo-600" />
                      原価シミュレーター (Smart Cost Simulator)
                  </h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Auto-Calc</span>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                      <div>
                          <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                              <span>機械回転速度 (Machine Speed)</span>
                              <span className="text-indigo-600">{machineSpeed.toLocaleString()} sph</span>
                          </label>
                          <input 
                              type="range" min="8000" max="16000" step="100"
                              value={machineSpeed}
                              onChange={(e) => setMachineSpeed(Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <p className="text-xs text-slate-400 mt-1">IoT連動中: 回転数が上がると固定費単価が下がります</p>
                      </div>

                      <div>
                          <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                              <span>用紙仕入価格指数 (Paper Price)</span>
                              <span className="text-indigo-600">{paperPriceIndex}%</span>
                          </label>
                          <input 
                              type="range" min="80" max="150" step="1"
                              value={paperPriceIndex}
                              onChange={(e) => setPaperPriceIndex(Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <p className="text-xs text-slate-400 mt-1">市場価格連動 (基準価格比)</p>
                      </div>

                       <div>
                          <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                              <span>時間あたりチャージ (Labor/Hour)</span>
                              <span className="text-indigo-600">¥{hourlyLaborCost.toLocaleString()}</span>
                          </label>
                          <input 
                              type="range" min="2500" max="5000" step="100"
                              value={hourlyLaborCost}
                              onChange={(e) => setHourlyLaborCost(Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                      </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center relative">
                       <h4 className="text-sm font-bold text-slate-500 mb-4 w-full text-left">シミュレーション結果 (Profit Impact)</h4>
                       
                       <div className="relative w-48 h-48">
                           <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                   <Pie
                                       data={[
                                           { name: 'Material', value: calcMaterial, fill: '#6366f1' },
                                           { name: 'Labor', value: calcLabor/1000, fill: '#0ea5e9' },
                                           { name: 'Overhead', value: overheadCost, fill: '#cbd5e1' },
                                       ]}
                                       cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                                       dataKey="value"
                                   >
                                       <Cell fill="#6366f1" />
                                       <Cell fill="#0ea5e9" />
                                       <Cell fill="#cbd5e1" />
                                   </Pie>
                                   <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                               </PieChart>
                           </ResponsiveContainer>
                           {/* Center Text */}
                           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                               <span className="text-xs text-slate-400">Total Cost</span>
                               <span className="text-xl font-bold text-slate-800">¥{calcTotalUnit.toFixed(2)}</span>
                           </div>
                       </div>

                       <div className="w-full mt-4 space-y-2">
                           <div className="flex justify-between text-xs">
                               <span className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-500 rounded-full"></div> 材料費</span>
                               <span className="font-mono">¥{calcMaterial.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-xs">
                               <span className="flex items-center gap-1"><div className="w-2 h-2 bg-sky-500 rounded-full"></div> 加工費(変動)</span>
                               <span className="font-mono">¥{(calcLabor/1000).toFixed(2)}</span>
                           </div>
                       </div>
                  </div>
              </div>
          </div>

          {/* VQ Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
               <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Box className="w-5 h-5 text-indigo-500" />
                  製造原価内訳 (Actual)
               </h3>
               <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={vqBreakdown} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                            <Tooltip cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                {vqBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
               </div>
               <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-100 text-xs text-slate-500">
                   <p className="font-bold mb-1">AI Insight:</p>
                   用紙代が全体の60%を占めています。損紙率(Waste)を0.5%削減すると、月間¥120kのコストダウンが見込まれます。
               </div>
          </div>
      </div>

      {/* Bottom Section: Trend & IoT Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unit Cost Trend */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">単位原価推移 (Unit Cost Trend)</h3>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={unitCostTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{fontSize: 12}} />
                          <YAxis domain={[0, 6]} tick={{fontSize: 12}} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="material" name="材料費" stroke="#6366f1" strokeWidth={2} />
                          <Line type="monotone" dataKey="labor" name="加工費" stroke="#0ea5e9" strokeWidth={2} />
                          <Line type="monotone" dataKey="overhead" name="固定費配賦" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* IoT Machine Status */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      工場稼働状況 (IoT Live)
                  </h3>
                  <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      <span className="text-xs text-slate-400">Updating</span>
                  </div>
              </div>
              
              <div className="flex-1 space-y-3">
                  {machineData.map((machine) => (
                      <div key={machine.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className={`w-2 h-12 rounded-full ${machine.status === 'Running' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                              <div>
                                  <div className="font-bold text-sm">{machine.name}</div>
                                  <div className="text-xs text-slate-400">{machine.job}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-mono font-bold text-lg">{machine.speed.toLocaleString()} <span className="text-xs font-sans text-slate-500">sph</span></div>
                              <div className="text-xs text-slate-400">Waste: {machine.waste}%</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};
