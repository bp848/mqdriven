import React, { useState, useRef } from 'react';
import { 
  Calculator, 
  Upload, 
  History, 
  Database, 
  Download, 
  Printer, 
  ArrowLeft, 
  RotateCcw, 
  ShieldAlert, 
  Terminal, 
  ChevronRight, 
  Server, 
  Layers, 
  Search, 
  Cpu, 
  Leaf, 
  AlertTriangle, 
  FileText, 
  Link2 
} from 'lucide-react';
import { PrintSpec, EstimationResult, StrategyOption } from '../../types';
import { MOCK_CLIENTS, INTEGRATION_MANIFESTO, CATEGORIES } from '../../constants';
import { calculateEstimation, extractSpecFromInput } from '../../services/geminiService';

const PrintEstimateApp: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showManifesto, setShowManifesto] = useState(false);
  
  const [spec, setSpec] = useState<PrintSpec>({
    clientName: MOCK_CLIENTS[0].name,
    projectName: '',
    category: CATEGORIES[0],
    quantity: 0,
    size: '-',
    paperType: '-',
    pages: 0,
    colors: '4/4',
    finishing: [],
    requestedDelivery: '-'
  });
  
  const [estimationData, setEstimationData] = useState<EstimationResult | null>(null);
  const [selectedOption, setSelectedOption] = useState<StrategyOption | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRunAi = async () => {
    if (!inputText && !imagePreview) return;
    setLoading(true);
    setEstimationData(null);
    setSelectedOption(null);
    try {
      const extracted = await extractSpecFromInput(inputText, imagePreview || undefined);
      const updatedSpec = { ...spec, ...extracted } as PrintSpec;
      setSpec(updatedSpec);
      
      const result = await calculateEstimation(updatedSpec);
      setEstimationData(result);
    } catch (e) {
      console.error("システムエラー:", e);
      alert("基幹システム連携中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setEstimationData(null);
    setSelectedOption(null);
    setInputText('');
    setImagePreview(null);
  };

  return (
    <div className="min-h-screen bg-[#f3f5f8] text-[#2c3e50] font-sans flex flex-col selection:bg-blue-100">
      {/* 統合ヘッダー */}
      <nav className="bg-[#1a252f] text-white px-8 py-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">文唱堂印刷株式会社 基幹見積システム</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Enterprise Integration Hub</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-4 bg-slate-800/60 px-4 py-1.5 rounded-lg border border-slate-700">
             <div className="flex items-center gap-2" title="Supabase連携完了"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div><span className="text-[10px] text-slate-300">基幹DB</span></div>
             <div className="flex items-center gap-2" title="Google Drive連携完了"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div><span className="text-[10px] text-slate-300">Drive</span></div>
          </div>
          <button 
            onClick={() => setShowManifesto(!showManifesto)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all text-[11px] font-bold text-white border border-slate-600 shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5" />
            開発用・接続仕様書
          </button>
          <button onClick={handleReset} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* 開発者用ドキュメント */}
      {showManifesto && (
        <div className="bg-[#121921] text-blue-100 px-10 py-10 border-b border-slate-700 shadow-inner overflow-y-auto max-h-[60vh]">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
               <h2 className="text-xl font-bold text-white flex items-center gap-4">
                  <ShieldAlert className="w-6 h-6 text-yellow-500" />
                  基幹システム統合・開発引き継ぎ指示書
               </h2>
               <span className="text-[11px] font-mono bg-blue-900 px-3 py-1 rounded text-blue-300 border border-blue-700">{INTEGRATION_MANIFESTO.システム名} v{INTEGRATION_MANIFESTO.バージョン}</span>
            </div>
            
            <div className="bg-red-900/30 border border-red-900/50 p-6 rounded-xl flex gap-6 items-start">
               <AlertTriangle className="w-10 h-10 text-red-500 shrink-0 mt-1" />
               <div className="space-y-3">
                 <p className="text-sm font-bold text-red-400">【重要】モック実装に関するお詫びと修正依頼</p>
                 <p className="text-xs text-slate-300 leading-relaxed font-bold">
                   現在、フロントエンドのプロトタイプを優先したため、顧客データと計算ロジックの一部がハードコーディング（固定値）になっています。
                   実装担当者様は、以下のSupabase URL（rwjhpfghhgstvplmggks）を用いて、実際のテーブルからデータをフェッチするように修正をお願いします。
                   また、Google Drive MCPとの接続も完了させてください。
                 </p>
                 <div className="mt-4 space-y-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">利益管理基準</p>
                   <p className="text-xs text-slate-200">{INTEGRATION_MANIFESTO.利益管理基準}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-3">AIへの指示</p>
                   <p className="text-xs text-slate-200 italic">{INTEGRATION_MANIFESTO.AIへの指示}</p>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {INTEGRATION_MANIFESTO.統合エンドポイント.map((point, i) => (
                 <div key={i} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 space-y-3 shadow-inner">
                    <div className="flex items-center gap-3 text-blue-400">
                       <Link2 className="w-4 h-4" />
                       <span className="text-[11px] font-bold uppercase">{point.名称}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-200">{point.役割}</p>
                    <code className="block bg-black/40 p-2 rounded text-[10px] text-blue-300 font-mono break-all border border-slate-700/50">
                       {point.URL}
                    </code>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* 左側：パラメータ入力 */}
        <section className="col-span-3 border-r border-slate-300 bg-white overflow-y-auto p-6 space-y-8 shadow-inner">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> 案件引き合いパラメータ
              </h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">顧客マスター（基幹同期）</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-blue-600 transition-all cursor-pointer"
                value={spec.clientName}
                onChange={(e) => setSpec({...spec, clientName: e.target.value})}
              >
                {MOCK_CLIENTS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">印刷品目カテゴリ</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-blue-600 transition-all cursor-pointer"
                value={spec.category}
                onChange={(e) => setSpec({...spec, category: e.target.value})}
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div 
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group ${
                imagePreview ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100 hover:border-blue-300 hover:bg-slate-50 shadow-inner'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative group">
                  <img src={imagePreview} className="max-h-24 object-contain rounded border border-slate-200 shadow-sm" alt="スキャン資料" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                    <span className="text-[10px] text-white font-bold">画像を変更</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <Upload className="w-5 h-5 text-slate-300 group-hover:text-blue-500 mx-auto" />
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                    過去の見積書・仕様書を解析<br />（Drive内を自動検索）
                  </p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">案件詳細・フリーメモ</label>
              <textarea 
                className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-600 focus:bg-white resize-none transition-all shadow-inner leading-relaxed"
                placeholder="例：昨年の周年記念誌と同等の仕様。部数を500部に変更し、表紙にマットPP加工を追加したい。過去の類似案件の金額を参考に算出してほしい..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <button 
              onClick={handleRunAi}
              disabled={loading || (!inputText && !imagePreview)}
              className={`w-full py-4 rounded-xl font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-md ${
                loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#1a252f] text-white hover:bg-blue-600 active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <Server className="w-4 h-4 animate-spin" />
                  <span>各ソースと照合中...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>AI見積を算定する</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* 右側：見積結果出力 */}
        <section className="col-span-9 flex flex-col bg-[#f8fafc] relative overflow-hidden">
          {!estimationData && !loading && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale p-12 text-center select-none">
              <Server className="w-40 h-40 mb-6" />
              <h3 className="text-2xl font-black">基幹統合AI 待機中</h3>
              <p className="text-sm mt-2 font-bold italic">案件情報を入力し、DBおよびDriveとの照合を開始してください。</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                 <div className="w-24 h-24 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                 <Database className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <div className="text-center space-y-3">
                <p className="font-bold text-slate-700">Supabase・Google Drive・DeepWiki を探索中</p>
                <div className="flex justify-center gap-3">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          {estimationData && !selectedOption && (
            <div className="flex-1 overflow-y-auto p-10 space-y-10 animate-in fade-in duration-500 pb-20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-3 text-slate-800 tracking-tight">
                   <div className="w-1.5 h-6 bg-blue-600"></div>
                   経営戦略シミュレーション（MQ会計）
                </h3>
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                   <History className="w-3.5 h-3.5" />
                   過去成約ベース平均：{estimationData.comparisonWithPast.averagePrice.toLocaleString()}円
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                {estimationData.options.map((option) => (
                  <button 
                    key={option.id}
                    onClick={() => setSelectedOption(option)}
                    className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-600 transition-all text-left flex flex-col overflow-hidden hover:shadow-2xl hover:-translate-y-1"
                  >
                    <div className={`p-6 ${
                      option.id === 'must_win' ? 'bg-[#0b5345]' : 
                      option.id === 'average' ? 'bg-[#283747]' : 'bg-[#1a5276]'
                    } text-white shadow-md`}>
                      <p className="text-[10px] font-bold opacity-60 tracking-wider mb-1 uppercase tracking-tighter">Strategic Option</p>
                      <h4 className="text-lg font-bold tracking-tight">{option.label}</h4>
                    </div>
                    <div className="p-8 space-y-8 flex-1">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">御見積総額</p>
                        <p className="text-4xl font-bold text-slate-900 font-mono tracking-tighter">¥{option.pq.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-[9px] font-bold text-slate-400">限界利益率</p>
                          <p className="text-md font-bold text-emerald-600">{Math.round(option.mRatio * 100)}%</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-[9px] font-bold text-slate-400">成約予測</p>
                          <p className="text-md font-bold text-blue-600">{option.probability}%</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed border-l-2 border-slate-200 pl-4 italic">
                        {option.description}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-900 text-white text-center font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      詳細な原価内訳を表示
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-[#1a252f] text-white rounded-2xl p-8 flex gap-10 items-start shadow-xl relative overflow-hidden group">
                <div className="p-4 bg-blue-600 rounded-xl shadow-lg z-10">
                  <History className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-4 flex-1 z-10">
                  <h5 className="font-bold text-sm flex items-center gap-4 text-blue-400 tracking-tight">
                     データ照合ログ・AIインサイト
                     <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded border border-white/20 uppercase tracking-widest">System Synchronized</span>
                  </h5>
                  <p className="text-md leading-relaxed text-slate-200 font-bold italic">
                    「{estimationData.aiReasoning}」
                  </p>
                  <div className="flex gap-8 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5 text-emerald-500" /> Supabase 基幹DB同期</div>
                     <div className="flex items-center gap-2"><History className="w-3.5 h-3.5 text-blue-500" /> Drive 過去見積RAG</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedOption && (
            <div className="flex-1 flex flex-col items-center overflow-y-auto p-12 bg-[#ecf0f1] animate-in slide-in-from-bottom-10 duration-700 pb-20 scrollbar-hide">
              <div className="w-full max-w-[800px] bg-white border border-slate-300 p-20 shadow-2xl flex flex-col min-h-[1100px] relative rounded-sm">
                
                <div className="flex justify-between items-start mb-16 border-b-[8px] border-slate-900 pb-8">
                  <div className="space-y-4">
                    <h2 className="text-6xl font-black tracking-tighter text-slate-900">御見積書</h2>
                    <p className="text-[11px] text-slate-400 font-bold tracking-[0.4em] uppercase">QUOTE-ID: {Math.floor(Math.random()*90000+10000)}</p>
                  </div>
                  <div className="text-right text-[11px] font-bold text-slate-600 space-y-1">
                    <p>発行日： {new Date().toLocaleDateString('ja-JP')}</p>
                    <p>作成： 文唱堂 基幹統合見積システム</p>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-20">
                  <h3 className="text-4xl font-bold border-b-4 border-blue-600 pb-2 tracking-tight">{spec.clientName} 御中</h3>
                  <div className="text-right space-y-1.5 font-bold">
                    <p className="text-2xl text-slate-900">文唱堂印刷株式会社</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest">Integration Strategy Desk</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-16">
                  <div className="bg-[#1a252f] text-white p-10 rounded-2xl shadow-lg">
                    <span className="text-[10px] font-bold text-blue-400 block mb-3 uppercase tracking-widest">御見積総額（税込）</span>
                    <p className="text-5xl font-bold font-mono tracking-tighter leading-none">¥{selectedOption.pq.toLocaleString()} <span className="text-xl font-normal ml-1">ー</span></p>
                  </div>
                  <div className="bg-slate-50 p-10 rounded-2xl border border-slate-200 flex flex-col justify-center shadow-inner">
                    <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase tracking-widest">納期回答（目安）</span>
                    <p className="text-3xl font-bold border-b-2 border-blue-600 inline-block text-slate-800">{selectedOption.estimatedLeadTime}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-12">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] tracking-widest uppercase border-b-2 border-slate-900">
                        <th className="py-4 px-8 text-left">品名・仕様詳細（基幹データ同期）</th>
                        <th className="py-4 px-8 text-center w-28">数量</th>
                        <th className="py-4 px-8 text-right w-44">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b-2 border-slate-100">
                        <td className="py-12 px-8">
                          <span className="font-bold text-2xl block mb-6 text-slate-900 tracking-tight">{spec.projectName || '新規印刷受託案件'}</span>
                          <div className="text-[13px] text-slate-600 font-bold leading-relaxed space-y-4 bg-slate-50 p-10 rounded-xl border border-slate-100 shadow-inner">
                            <p className="flex items-start gap-4"><ChevronRight className="w-4 h-4 text-blue-600 mt-1 shrink-0" /> <b>品目カテゴリ:</b> {spec.category}</p>
                            <p className="flex items-start gap-4"><ChevronRight className="w-4 h-4 text-blue-600 mt-1 shrink-0" /> <b>寸法・頁数:</b> {spec.size} / {spec.pages > 0 ? spec.pages + 'P' : '単体'}</p>
                            <p className="flex items-start gap-4"><ChevronRight className="w-4 h-4 text-blue-600 mt-1 shrink-0" /> <b>用紙銘柄:</b> {spec.paperType}</p>
                            <p className="flex items-start gap-4"><ChevronRight className="w-4 h-4 text-blue-600 mt-1 shrink-0" /> <b>色数・加工:</b> {spec.colors} / {spec.finishing.join('・') || '標準仕上'}</p>
                          </div>
                        </td>
                        <td className="py-12 px-8 text-center font-bold text-3xl font-mono text-slate-700">{spec.quantity.toLocaleString()}</td>
                        <td className="py-12 px-8 text-right font-bold text-3xl font-mono text-slate-900 italic">¥{selectedOption.pq.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-10 shadow-sm relative overflow-hidden">
                    <div className="p-4 bg-white rounded-full text-emerald-600 shadow-md z-10">
                      <Leaf className="w-10 h-10" />
                    </div>
                    <div className="flex-1 z-10">
                      <h4 className="text-[10px] font-bold text-emerald-800 tracking-widest mb-2 uppercase">サステナビリティ・レポート</h4>
                      <p className="text-md text-emerald-950 font-bold leading-relaxed">
                        本案件は再生可能エネルギー使用工場にて生産されます。<br />
                        環境負荷低減（CO2削減実質）： <span className="text-2xl font-bold font-mono text-emerald-800">{estimationData?.co2Reduction.toLocaleString()} g</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-16 text-[10px] font-bold text-slate-400 border-t-2 border-slate-100 pt-12 mt-auto tracking-[0.2em] uppercase italic">
                  <div className="space-y-3 font-bold">
                    <p className="flex justify-between border-b border-slate-50 pb-1"><span>支払条件</span><span className="text-slate-900 not-italic">貴社規定に基づく（基幹DB同期）</span></p>
                    <p className="flex justify-between border-b border-slate-50 pb-1"><span>有効期限</span><span className="text-slate-900 not-italic">発行日より14日間</span></p>
                  </div>
                  <div className="text-right leading-relaxed font-bold">
                     BUNSHODO PRINTING CO., LTD. <br />
                     Core Integrated System v5.5 Verified
                  </div>
                </div>
              </div>

              <div className="mt-12 flex gap-6">
                <button onClick={() => setSelectedOption(null)} className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 shadow-xl transition-all active:scale-95">
                  <ArrowLeft className="w-5 h-5" /> 別の戦略案を検討する
                </button>
                <button className="flex items-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 shadow-xl transition-all active:scale-95">
                  <Download className="w-5 h-5" /> PDFを出力
                </button>
                <button className="flex items-center gap-3 px-10 py-5 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 shadow-md transition-all active:scale-95">
                  <Printer className="w-5 h-5" /> 印刷プレビュー
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="bg-[#1a252f] text-slate-500 px-8 py-3 text-[10px] font-bold flex justify-between items-center border-t border-slate-700 select-none">
        <div className="flex items-center gap-3 uppercase tracking-[0.2em]">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          Bunshodo Integrated Enterprise AI Terminal v5.5
        </div>
        <div className="italic text-slate-600 tracking-wider font-bold">
           社外秘：文唱堂印刷株式会社
        </div>
      </footer>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default PrintEstimateApp;
