import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Building2, Leaf, Info, ShieldCheck, AlertTriangle, Plus, RefreshCw, Upload,
    Printer, Zap, MessageSquare, Send, X, ExternalLink, MapPin,
    Eye, Trash2, FileCheck
} from 'lucide-react';
import { EstimateState, ChatMessage, QuoteItem } from '../../types';
import {
    extractSpecsFromContent,
    suggestCostBreakdown,
    calculateDeliveryImpact,
    getChatResponse
} from '../../services/estimateAiEngine';

const AIEstimateCreation: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'specs' | 'costs' | 'params'>('specs');
    const [isProcessing, setIsProcessing] = useState(false);
    const [clientName, setClientName] = useState('株式会社 ○○○○ 様');
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [state, setState] = useState<EstimateState>({
        specs: {
            title: '印刷案件 (PDF解析待ち)',
            quantity: 1000,
            size: 'A4',
            paperType: 'マットコート135kg',
            colors: '4C/4C',
            finishing: '中綴じ製本',
            deadline: '2025-05-30',
            destination: '貴社指定場所',
            managerName: '営業担当',
            analysisEvidence: {
                sizeReasoning: '解析前',
                paperReasoning: '解析前',
                colorReasoning: '解析前',
                pageReasoning: '解析前'
            }
        },
        costs: [],
        quoteItems: [],
        taxRate: 0.1,
        profitMarginTarget: 0.35,
        scenarios: [],
        engineParams: {
            paperBaseMargin: 15,
            pressHourlyRate: 15000,
            bindingBaseFee: 5000,
            ctpPlateCost: 2000,
            inkBaseRate: 800,
            setupFee: 10000,
            minimumProfitRate: 20
        },
        groundingSources: []
    });

    const totalCost = useMemo(() => state.costs.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0), [state.costs]);
    const specOneLiner = useMemo(() => `${state.specs.size} / ${state.specs.paperType} / ${state.specs.colors} / ${state.specs.finishing}`, [state.specs]);
    const co2Reduction = useMemo(() => (state.specs.quantity * 0.0012).toFixed(2), [state.specs.quantity]);

    useEffect(() => {
        const markup = 1 / (1 - state.profitMarginTarget);
        const newQuoteItems: QuoteItem[] = state.costs.map(cost => ({
            id: cost.id,
            name: cost.name,
            quantity: cost.quantity,
            unitPrice: Math.ceil((cost.unitPrice * markup * 1.05) / 10) * 10,
            description: cost.formula
        }));
        setState(prev => ({ ...prev, quoteItems: newQuoteItems }));
    }, [state.costs, state.profitMarginTarget]);

    const quoteSubtotal = useMemo(() => state.quoteItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0), [state.quoteItems]);
    const quoteTax = useMemo(() => Math.floor(quoteSubtotal * state.taxRate), [quoteSubtotal, state.taxRate]);
    const quoteTotal = useMemo(() => quoteSubtotal + quoteTax, [quoteSubtotal, quoteTax]);
    const profit = useMemo(() => quoteSubtotal - totalCost, [quoteSubtotal, totalCost]);

    const handleFileUpload = async (file: File) => {
        if (!file) return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target?.result?.toString().split(',')[1];
            if (!base64Data) return setIsProcessing(false);
            try {
                const { specs } = await extractSpecsFromContent("精密DTP検版", { data: base64Data, mimeType: file.type });
                const { costs, sources } = await suggestCostBreakdown(specs);
                const mapSources = await calculateDeliveryImpact(specs.destination);

                setState(prev => ({
                    ...prev,
                    specs,
                    costs,
                    groundingSources: [...sources, ...mapSources]
                }));
                setActiveTab('costs');
            } catch (err) {
                alert("解析エラーが発生しました。資料の内容を確認してください。");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg: ChatMessage = { role: 'user', content: chatInput };
        setMessages(prev => [...prev, userMsg]);
        setChatInput('');
        try {
            const response = await getChatResponse(chatInput, messages);
            setMessages(prev => [...prev, { role: 'model', content: response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'model', content: "エラーが発生しました。" }]);
        }
    };

    const removeCostItem = (id: string) => {
        setState(prev => ({ ...prev, costs: prev.costs.filter(c => c.id !== id) }));
    };

    useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden h-full relative font-sans text-slate-700">
            {isProcessing && (
                <div className="absolute inset-0 z-[100] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center max-w-sm text-center">
                        <RefreshCw className="animate-spin text-slate-900 mb-6" size={40} />
                        <h2 className="text-[14px] font-medium text-slate-900 tracking-widest uppercase mb-2">Analyzing PDF...</h2>
                        <p className="text-[10px] text-slate-400">実務基準の精密スキャンと根拠抽出を実行中</p>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className="w-full md:w-[360px] border-r border-slate-200 bg-white flex flex-col no-print h-full z-10 shrink-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-slate-900" />
                        <span className="text-[12px] font-medium tracking-tighter uppercase">Bunshodo AI Engine</span>
                    </div>
                    <Zap size={12} className="text-yellow-500" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <div className="flex gap-1 border-b border-slate-100">
                        {['specs', 'costs', 'params'].map((t) => (
                            <button key={t} onClick={() => setActiveTab(t as any)}
                                className={`flex-1 py-2 text-[10px] font-medium transition-all ${activeTab === t ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400'}`}>
                                {t === 'specs' ? '解析・根拠' : t === 'costs' ? '適正検証' : '積算定数'}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'specs' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="space-y-3">
                                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-900 hover:bg-black text-white text-[11px] py-2.5 rounded flex items-center justify-center gap-2 font-medium transition-all shadow-md">
                                    <Upload size={14} /> PDF資料を解析
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                            </div>

                            {state.specs.analysisEvidence && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-[10px] space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 font-medium">
                                        <FileCheck size={14} className="text-blue-500" />
                                        <span>解析根拠レポート</span>
                                    </div>
                                    <div className="space-y-3 text-slate-600 leading-relaxed">
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 font-medium text-[8px] uppercase">判型</span>
                                            <p>{state.specs.analysisEvidence.sizeReasoning}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 font-medium text-[8px] uppercase">用紙・構成</span>
                                            <p>{state.specs.analysisEvidence.paperReasoning}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 font-medium text-[8px] uppercase">色分解</span>
                                            <p>{state.specs.analysisEvidence.colorReasoning}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {state.groundingSources.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[8px] text-slate-400 uppercase tracking-widest font-medium">参考ソース (Grounding)</label>
                                    <div className="space-y-1">
                                        {state.groundingSources.map((s, i) => (
                                            <a key={i} href={s.uri} target="_blank" className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded text-[9px] hover:border-slate-300 transition-all">
                                                <span className="truncate w-40">{s.title}</span>
                                                <ExternalLink size={10} className="text-slate-400" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'costs' && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">社内原価内訳 (省略なし)</span>
                                <button onClick={() => { }} className="text-slate-400 hover:text-slate-900"><Plus size={14} /></button>
                            </div>
                            {state.costs.map(cost => (
                                <div key={cost.id} className={`p-3 border rounded transition-all ${cost.isAlert ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-medium text-slate-900 truncate">{cost.name}</span>
                                        <button onClick={() => removeCostItem(cost.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                        <span>¥{cost.unitPrice.toLocaleString()} × {cost.quantity.toLocaleString()}</span>
                                        <span className="font-medium text-slate-900">¥{(cost.unitPrice * cost.quantity).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[8px] text-slate-400 italic mb-1">計算式: {cost.formula}</p>

                                    {cost.pdfReference && (
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-start gap-1.5">
                                            <Eye size={10} className="text-blue-400 mt-0.5 shrink-0" />
                                            <p className="text-[8px] text-slate-500 leading-tight">
                                                <span className="font-medium text-blue-600">PDF根拠:</span> {cost.pdfReference}
                                            </p>
                                        </div>
                                    )}

                                    {cost.isAlert && (
                                        <div className="mt-2 text-[8px] bg-white border border-red-100 p-1.5 rounded flex items-center justify-between">
                                            <span className="text-red-500 font-medium">推奨単価: ¥{cost.aiRecommendation?.toLocaleString()}</span>
                                            <button onClick={() => setState(prev => ({ ...prev, costs: prev.costs.map(c => c.id === cost.id ? { ...c, unitPrice: cost.aiRecommendation! } : c) }))} className="text-blue-500 hover:underline">更新</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'params' && (
                        <div className="space-y-4 animate-in fade-in duration-300 text-[10px]">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded text-blue-700 leading-relaxed">
                                <ShieldCheck size={14} className="mb-1" />
                                <span>他社員の見積妥当性を判定するための標準定数設定です。</span>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { label: '用紙粗利 (%)', key: 'paperBaseMargin' },
                                    { label: '印刷機単価 (円/h)', key: 'pressHourlyRate' },
                                    { label: '製本基本料 (円)', key: 'bindingBaseFee' },
                                    { label: 'CTP出力代 (円/版)', key: 'ctpPlateCost' },
                                    { label: '最低粗利率 (%)', key: 'minimumProfitRate' }
                                ].map(p => (
                                    <div key={p.key} className="flex flex-col gap-1">
                                        <label className="text-[8px] text-slate-400 uppercase font-medium">{p.label}</label>
                                        <input type="number" className="p-2 border border-slate-200 rounded text-[10px] font-medium outline-none focus:border-slate-400"
                                            value={(state.engineParams as any)[p.key]}
                                            onChange={(e) => setState(prev => ({ ...prev, engineParams: { ...prev.engineParams, [p.key]: parseFloat(e.target.value) } }))} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Console Footer */}
                <div className="p-4 border-t border-slate-200 bg-white space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-widest">
                        <span className="text-slate-400">目標粗利率</span>
                        <span className="text-slate-900">{(state.profitMarginTarget * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="0.7" step="0.05" className="w-full h-1 bg-slate-100 appearance-none accent-slate-900 cursor-pointer rounded-full"
                        value={state.profitMarginTarget} onChange={(e) => setState(prev => ({ ...prev, profitMarginTarget: parseFloat(e.target.value) }))} />
                    <div className="flex justify-between pt-1">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-slate-400 uppercase font-medium">合計原価</span>
                            <span className="text-[12px] font-medium text-slate-900">¥{totalCost.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-end text-right">
                            <span className="text-[8px] text-slate-400 uppercase font-medium">想定粗利</span>
                            <span className={`text-[12px] font-medium ${profit > 0 ? 'text-blue-600' : 'text-red-500'}`}>¥{profit.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main View */}
            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 print:bg-white print:p-0">
                <div className="max-w-[840px] mx-auto w-full no-print flex justify-between mb-6 items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded text-[11px] hover:bg-slate-50 transition-all font-medium shadow-sm flex items-center gap-2">
                            <Printer size={14} /> 見積書出力
                        </button>
                        {profit / quoteSubtotal < state.engineParams.minimumProfitRate / 100 && (
                            <div className="px-2 py-1 bg-red-50 text-red-500 border border-red-100 rounded text-[9px] font-medium flex items-center gap-1.5">
                                <AlertTriangle size={12} /> 採算警告
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                        <Leaf size={12} className="text-green-600/60" /> Zero Emission Factory
                    </div>
                </div>

                {/* The Document */}
                <div className="max-w-[840px] mx-auto w-full bg-white px-16 py-20 min-h-[1131px] flex flex-col shadow-sm text-slate-900 print:shadow-none print:p-0 print-area border border-slate-100">
                    <header className="flex justify-between items-start mb-16">
                        <div className="w-2/3">
                            <h1 className="text-2xl tracking-[0.5em] mb-12 border-b-2 border-slate-900 pb-2 inline-block font-medium uppercase text-slate-900">御見積書</h1>
                            <div className="flex items-end gap-2 border-b border-slate-300 pb-1 mb-6 max-w-[90%]">
                                <input className="text-xl w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-medium"
                                    value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="クライアント名を入力" />
                                <span className="text-sm font-medium text-slate-500">御中</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed max-w-[90%]">
                                拝啓、時下ますますご清栄のこととお慶び申し上げます。平素は格別のお引き立てを賜り、厚く御礼申し上げます。
                                DTPデータ解析に基づき、詳細な積算内訳を下記の通り御見積申し上げます。
                            </p>
                        </div>
                        <div className="text-right text-[10px] space-y-1 text-slate-500 pt-4 font-sans">
                            <p className="tracking-widest opacity-60 uppercase text-[8px]">QT-{new Date().getFullYear()}-{Math.floor(Date.now() / 100000) % 10000}</p>
                            <p>{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <div className="mt-10">
                                <p className="text-base font-medium mb-1 border-b border-slate-900 inline-block text-slate-900">文唱堂印刷株式会社</p>
                                <div className="text-[10px] space-y-0.5 opacity-90 text-slate-600 font-sans">
                                    <p>〒101-0025 東京都千代田区神田佐久間町3-37</p>
                                    <p>TEL: 03-3851-0111 / FAX: 03-3861-1979</p>
                                    <div className="pt-2 flex justify-end items-center gap-2">
                                        <span className="text-slate-400 uppercase font-medium text-[8px] tracking-widest">Manager:</span>
                                        <input className="bg-transparent border-none p-0 focus:ring-0 text-right w-32 text-slate-900 font-medium border-b border-slate-100"
                                            value={state.specs.managerName} onChange={(e) => setState(prev => ({ ...prev, specs: { ...prev.specs, managerName: e.target.value } }))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <section className="mb-14">
                        <div className="flex items-end gap-3 border-b-2 border-slate-900 pb-3 mb-8">
                            <span className="text-[11px] font-medium text-slate-400 mb-1.5 tracking-widest uppercase">御見積合計金額</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-medium text-slate-900">¥</span>
                                <span className="text-4xl font-normal tracking-tighter text-slate-900">{quoteTotal.toLocaleString()}</span>
                                <span className="text-xl font-light text-slate-300 mx-3">-</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mb-2 font-sans">(税込 / 消費税 ¥{quoteTax.toLocaleString()} 含む)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-[11px] bg-slate-50/50 p-6 border border-slate-100 rounded">
                            <div className="flex gap-4 border-b border-slate-100 pb-2 items-center"><span className="text-slate-400 shrink-0 w-16 font-medium uppercase tracking-widest text-[8px]">Subject</span> <span className="text-slate-900 font-medium truncate">{state.specs.title}</span></div>
                            <div className="flex gap-4 border-b border-slate-100 pb-2 items-center"><span className="text-slate-400 shrink-0 w-16 font-medium uppercase tracking-widest text-[8px]">Delivery</span> <span className="text-slate-900 font-medium truncate">{state.specs.deadline}</span></div>
                            <div className="flex gap-4 border-b border-slate-100 pb-2 items-center"><span className="text-slate-400 shrink-0 w-16 font-medium uppercase tracking-widest text-[8px]">Quantity</span> <span className="text-slate-900 font-medium">{state.specs.quantity.toLocaleString()} 部</span></div>
                            <div className="flex gap-4 border-b border-slate-100 pb-2 items-center"><span className="text-slate-400 shrink-0 w-16 font-medium uppercase tracking-widest text-[8px]">Spec</span> <span className="text-slate-900 font-medium truncate">{specOneLiner}</span></div>
                        </div>
                    </section>

                    <table className="w-full text-[11px] border-collapse mb-12 flex-1">
                        <thead>
                            <tr className="border-y border-slate-200 text-slate-400 font-medium tracking-[0.2em] uppercase bg-slate-50/30">
                                <th className="py-3 px-5 text-left font-medium text-[9px]">内訳項目</th>
                                <th className="py-3 px-5 text-right w-24 font-medium text-[9px]">数量</th>
                                <th className="py-3 px-5 text-right w-32 font-medium text-[9px]">単価</th>
                                <th className="py-3 px-5 text-right w-32 font-medium text-[9px]">金額</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 border-b border-slate-200">
                            {state.quoteItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/20 group">
                                    <td className="py-4 px-5">
                                        <span className="block text-[11px] text-slate-900 font-medium">{item.name}</span>
                                        <span className="text-[9px] text-slate-400 font-normal block mt-0.5">{item.description}</span>
                                    </td>
                                    <td className="py-4 px-5 text-right font-medium text-slate-500">
                                        {item.quantity.toLocaleString()}
                                    </td>
                                    <td className="py-4 px-5 text-right font-medium text-slate-900">
                                        ¥{item.unitPrice.toLocaleString()}
                                    </td>
                                    <td className="py-4 px-5 text-right text-slate-900 font-medium">
                                        ¥{(item.quantity * item.unitPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {Array.from({ length: Math.max(0, 5 - state.quoteItems.length) }).map((_, i) => (
                                <tr key={`spacer-${i}`} className="h-14"><td></td><td></td><td></td><td></td></tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-auto pt-8 border-t border-slate-100">
                        <div className="flex justify-between items-start mb-10 gap-10">
                            <div className="p-4 bg-green-50/30 border border-green-100 rounded text-[9px] text-green-800 max-w-[60%] animate-in fade-in duration-700">
                                <div className="flex items-center gap-2 font-medium tracking-widest mb-1.5 uppercase text-green-700">
                                    <Leaf size={14} /> <span>環境貢献レポート</span>
                                </div>
                                <p className="leading-relaxed opacity-80">
                                    文唱堂印刷町屋工場は再生可能エネルギー100%運用です。DTPデータ解析と物流ルートの最適化により、
                                    CO2削減量（目安）：約 <span className="font-medium underline decoration-green-300 decoration-2 underline-offset-4">{co2Reduction} kg-CO2</span> を達成。
                                </p>
                            </div>
                            <div className="w-64 space-y-1.5">
                                <div className="flex justify-between items-center text-slate-400 pb-1.5 px-2 border-b border-slate-50 text-[10px]">
                                    <span className="uppercase font-medium text-[8px] tracking-widest">小計 (税別)</span>
                                    <span className="text-slate-800 font-medium">¥{quoteSubtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-400 pb-1.5 px-2 border-b border-slate-50 text-[10px]">
                                    <span className="uppercase font-medium text-[8px] tracking-widest">消費税 (10%)</span>
                                    <span className="text-slate-800 font-medium">¥{quoteTax.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2.5 px-2 border-t border-slate-900 mt-2">
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">御見積合計金額</span>
                                    <span className="text-xl font-medium tracking-tighter text-slate-900">¥{quoteTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <footer className="flex justify-between gap-16 pt-6 border-t border-slate-100 font-sans">
                            <div className="flex-1 space-y-3">
                                <h4 className="text-[9px] text-slate-400 uppercase font-medium border-b border-slate-50 pb-1 inline-block tracking-widest">特記事項</h4>
                                <div className="text-[9px] text-slate-500 leading-relaxed space-y-1 font-sans">
                                    <p>・本見積は提供されたDTPデータの解析根拠に基づいています。</p>
                                    <p>・見積有効期限：発行日より30日間（市場相場の変動がない場合）。</p>
                                    <p>・入稿データに著しい不備がある場合は別途費用がかかる場合があります。</p>
                                </div>
                            </div>
                            <div className="w-1/3 space-y-3">
                                <h4 className="text-[9px] text-slate-400 uppercase font-medium border-b border-slate-50 pb-1 inline-block tracking-widest">納品条件</h4>
                                <div className="text-[10px] text-slate-800 font-medium leading-relaxed font-sans">
                                    <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-400" /> {state.specs.destination}</p>
                                    <p className="mt-2 text-[8px] text-slate-400 font-normal italic">※ 町屋工場より一括配送。分納は別途費用。</p>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </main>

            {/* Chat Bot UI */}
            <div className={`fixed bottom-6 right-6 z-[100] flex flex-col items-end transition-all ${chatOpen ? 'w-[360px]' : 'w-12'}`}>
                {chatOpen && (
                    <div className="w-full h-[500px] bg-white border border-slate-200 shadow-xl rounded-xl flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={14} />
                                <span className="text-[11px] font-medium uppercase tracking-widest">AI Audit Chat</span>
                            </div>
                            <button onClick={() => setChatOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                            {messages.length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center mt-10">解析結果の根拠や市場乖離について回答します。</p>
                            )}
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-lg text-[11px] leading-relaxed ${m.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
                            <input
                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none focus:border-slate-400 transition-all font-sans"
                                placeholder="質問を入力..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                            />
                            <button onClick={handleSendChat} className="p-2 bg-slate-900 text-white rounded hover:bg-black transition-all">
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                )}
                <button onClick={() => setChatOpen(!chatOpen)} className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95">
                    {chatOpen ? <X size={20} /> : <MessageSquare size={20} />}
                </button>
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
        @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            main { background: white !important; padding: 0 !important; }
        }
      `}</style>
        </div>
    );
};

export default AIEstimateCreation;
