import React, { useState, useRef, useEffect } from 'react';
import { processAIQuote, updateQuoteWithFeedback } from '../services/Gemini';
import type { ViewState, QuoteFormData, QuoteResultData } from '../types';
import { MAIN_CATEGORIES, SUB_CATEGORIES, BOOK_SIZES, BINDING_OPTIONS, PAPER_TYPES, COLOR_OPTIONS, KEYWORD_MAP, SPECIAL_PROCESSING_OPTIONS } from '../types';
import { createSupabaseBrowser } from '../services/supabase';

/**
 * Shared UI Components (Internal to QuoteCenter)
 */
const FormInput = ({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="space-y-1.5">
    <label htmlFor={name} className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <input
      id={name}
      name={name}
      {...props}
      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
    />
  </div>
);

const FormSelect = ({ label, name, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { id: string, label: string }[] | string[] }) => (
  <div className="space-y-1.5">
    <label htmlFor={name} className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <select
      id={name}
      name={name}
      {...props}
      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:border-blue-500 transition-all outline-none"
    >
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.id;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  </div>
);

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="font-bold text-white tracking-widest uppercase">Analyzing Specifications...</p>
    <p className="text-white/60 text-xs mt-2">AI積算エンジンが処理を継続しています</p>
  </div>
);

const QuoteCenter: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuoteResultData | null>(null);
  const [feedback, setFeedback] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSuggested, setIsSuggested] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowser();

  // 現在のユーザー情報を取得
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          // ユーザー情報をフォームに自動入力
          setFormData(prev => ({
            ...prev,
            salesStaff: user.user_metadata?.name || user.email || '未設定'
          }));
        }
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    };
    getCurrentUser();
  }, [supabase]);

  const [formData, setFormData] = useState<QuoteFormData>({
    customerName: '', salesStaff: '', mainCategory: 'print-book', subCategory: '冊子/雑誌/機関誌/社内報',
    title: '', periodStart: '', periodEnd: '', pages: 64, size: 'A4',
    coverPaper: 'アートポスト 180kg', innerPaper: '上質 70kg',
    color: COLOR_OPTIONS[0], binding: BINDING_OPTIONS[0], quantity: 1000, markup: 30,
    specialProcessing: SPECIAL_PROCESSING_OPTIONS[0],
    rawInput: '', imageInput: ''
  });

  // 自動推定機能
  useEffect(() => {
    if (formData.title) {
      for (const [key, categoryId] of Object.entries(KEYWORD_MAP)) {
        if (formData.title.includes(key)) {
          setFormData(prev => ({ ...prev, mainCategory: categoryId }));
          setIsSuggested(true);
          return;
        }
      }
    }
    setIsSuggested(false);
  }, [formData.title]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (['pages', 'quantity', 'markup'].includes(name)) ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setFormData(prev => ({ ...prev, imageInput: base64, rawInput: '' }));
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCalculate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    try {
      const data = await processAIQuote(formData);
      setResult(data);
      setView('dashboard');
    } catch (error) {
      alert("積算に失敗しました。仕様を確認してください。");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFeedback = async () => {
    if (!feedback || !result) return;
    setIsLoading(true);
    try {
      const updated = await updateQuoteWithFeedback(feedback, result);
      setResult(updated);
      setFeedback('');
    } catch (error) {
      alert("修正の反映に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 print:bg-white print:text-black">
      {isLoading && <LoadingOverlay />}

      {/* App Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
          <div className="bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm">Q</div>
          <span className="font-bold text-lg">QUANTUM<span className="text-blue-600">PRINT</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 font-medium">担当者</span>
            <span className="text-sm font-medium text-slate-700">{formData.salesStaff || 'Guest User'}</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <button onClick={() => setView('landing')} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-slate-200">
            ダッシュボード
          </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-10 print:p-0">
        {/* LANDING VIEW */}
        {view === 'landing' && (
          <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">見積作成センター</h1>
              <p className="text-slate-600">作成方法を選択してください。</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => { setView('edit'); setImagePreview(null); setFormData(f => ({ ...f, imageInput: '', rawInput: '' })); }} className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl mb-4">📄</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">手動入力</h3>
                <p className="text-sm text-slate-600">詳細な仕様を指定して、精密な積算を行います。</p>
              </button>

              <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:border-slate-300 hover:shadow-sm transition-all">
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={onImageUpload} />
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl mb-4">📸</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">仕様書スキャン</h3>
                <p className="text-sm text-slate-600">写真から文字情報を読み取り、フォームを自動補完します。</p>
              </button>

              <button onClick={() => { setView('edit'); setFormData(f => ({ ...f, imageInput: '', rawInput: ' ' })); }} className="bg-white border border-slate-200 rounded-lg p-6 text-left hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl mb-4">✍️</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">自由記述</h3>
                <p className="text-sm text-slate-600">依頼メールの本文などを貼り付けて積算を開始します。</p>
              </button>
            </div>

            {imagePreview && (
              <div className="mt-8 bg-slate-50 border border-slate-200 rounded-lg p-6 flex items-center gap-6">
                <img src={imagePreview} className="w-32 h-32 object-cover rounded-lg" />
                <div className="flex-grow">
                  <h4 className="font-semibold text-lg mb-2 text-slate-900">仕様書画像が準備完了</h4>
                  <p className="text-sm text-slate-600 mb-4">AIが画像を解析し、仕様を自動でフォームに入力します。</p>
                  <div className="flex gap-3">
                    <button onClick={() => setView('edit')} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                      解析して編集へ進む
                    </button>
                    <button onClick={() => { setImagePreview(null); setFormData(prev => ({ ...prev, imageInput: '' })); }} className="bg-white text-slate-600 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors">
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EDIT VIEW */}
        {view === 'edit' && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-7xl mx-auto">
            <form onSubmit={handleCalculate} className="grid grid-cols-1 xl:grid-cols-12 gap-10">
              <div className="xl:col-span-8 space-y-8">
                <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                  <h2 className="text-2xl font-black tracking-tight mb-8 border-b border-slate-100 pb-4">案件情報</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormInput label="顧客名" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="株式会社 〇〇" required />
                    <FormInput label="営業担当" name="salesStaff" value={formData.salesStaff} onChange={handleInputChange} placeholder="担当者名" required />
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                        品名 / 案件名
                        {isSuggested && <span className="ml-4 text-blue-500 bg-blue-50 px-3 py-1 rounded-full text-[9px]">推定完了</span>}
                      </label>
                      <input name="title" value={formData.title} onChange={handleInputChange} className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-blue-600 focus:bg-white focus:border-blue-500 transition-all outline-none" placeholder="品名（例：名刺 12月分）" required />
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                  <h2 className="text-2xl font-black tracking-tight mb-8 border-b border-slate-100 pb-4">積算詳細</h2>
                  {formData.rawInput !== undefined && (
                    <div className="mb-10">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">依頼テキスト / 自由記述</label>
                      <textarea name="rawInput" value={formData.rawInput} onChange={handleInputChange} className="w-full h-40 px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:bg-white transition-all outline-none resize-none" placeholder="依頼内容を貼り付け"></textarea>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <FormSelect label="主カテゴリ" name="mainCategory" value={formData.mainCategory} onChange={handleInputChange} options={MAIN_CATEGORIES} />
                    <FormInput label="部数" name="quantity" type="number" value={formData.quantity} onChange={handleInputChange} />
                    <FormSelect label="サイズ" name="size" value={formData.size} onChange={handleInputChange} options={BOOK_SIZES} />
                    <FormInput label="ページ数" name="pages" type="number" value={formData.pages} onChange={handleInputChange} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 border-t border-slate-50 pt-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">対象期間</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input name="periodStart" type="date" value={formData.periodStart} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                        <input name="periodEnd" type="date" value={formData.periodEnd} onChange={handleInputChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                      </div>
                    </div>
                    <FormSelect label="副カテゴリ" name="subCategory" value={formData.subCategory} onChange={handleInputChange} options={SUB_CATEGORIES} />
                  </div>
                </section>

                <button type="submit" className="w-full py-8 bg-[#0F172A] text-white font-black text-2xl rounded-[2.5rem] shadow-2xl hover:bg-slate-800 transition-all">
                  AI積算を開始する
                </button>
              </div>

              <div className="xl:col-span-4">
                <div className="sticky top-28 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
                    <p className="text-[11px] font-bold text-slate-400 uppercase mb-4">目標利益率 (Markup)</p>
                    <div className="flex items-end gap-3">
                      <input name="markup" type="number" value={formData.markup} onChange={handleInputChange} className="bg-transparent border-b-2 border-blue-500 w-24 text-4xl font-black text-blue-600 focus:outline-none" />
                      <span className="text-xl font-black text-slate-400 mb-1">%</span>
                    </div>
                  </div>
                  {imagePreview && <img src={imagePreview} className="w-full rounded-2xl border border-slate-100 shadow-sm" />}
                </div>
              </div>
            </form>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && result && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in slide-in-from-bottom-12 max-w-7xl mx-auto">
            <div className="xl:col-span-4 space-y-8">
              <div className="bg-[#1E293B] text-white p-10 rounded-[3rem] shadow-2xl space-y-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">想定粗利 (MQ)</p>
                  <p className="text-7xl font-black tabular-nums tracking-tighter text-emerald-400">¥{result.mq.toLocaleString()}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="bg-emerald-500 text-[#1E293B] text-[10px] font-black px-3 py-1 rounded-full">MARGIN {result.profitMargin}%</span>
                  </div>
                </div>
                <div className="space-y-3 border-t border-white/10 pt-10">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">原価構成 (VQ)</h4>
                  {result.costBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-400">{item.item}</span>
                      <span className="font-black tabular-nums">¥{item.cost.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
                <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-6">AI修正指示</h3>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-medium outline-none focus:bg-white transition-all mb-4 resize-none leading-relaxed" placeholder="例: 部数を2000部に増やした再計算は？"></textarea>
                <button onClick={applyFeedback} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all text-xs tracking-widest uppercase">Update Quote</button>
              </div>
            </div>

            <div className="xl:col-span-8 space-y-8">
              <div className="bg-white border border-slate-200 p-12 rounded-[3rem] shadow-sm">
                <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black tracking-tighter text-slate-900">積算サマリー</h2>
                  <button onClick={() => setView('formal')} className="bg-[#0F172A] text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-all">正式見積書を作成 📄</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="bg-blue-50 border border-blue-100 p-10 rounded-[2.5rem]">
                    <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-2">提示価格 (PQ: 税抜)</p>
                    <p className="text-6xl font-black tracking-tighter text-blue-800 tabular-nums">¥{result.pq.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2.5rem]">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">総原価 (VQ)</p>
                    <p className="text-4xl font-black tracking-tighter text-slate-700 tabular-nums">¥{result.vq.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">AI制作所見</h4>
                  <p className="text-sm font-bold leading-relaxed text-slate-600 whitespace-pre-wrap italic">"{result.internalNotes}"</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FORMAL VIEW (PDF Optimized) */}
        {view === 'formal' && result && (
          <div className="animate-in fade-in duration-700 flex flex-col items-center pb-32 print:pb-0">
            {/* Header Control for PDF Printing */}
            <div className="w-full max-w-[800px] mb-8 flex justify-between items-center print:hidden">
              <button onClick={() => setView('dashboard')} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">← ダッシュボード</button>
              <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                PDF保存 / 印刷
              </button>
            </div>

            {/* Formal Quote Document */}
            <div className="w-full max-w-[800px] bg-white p-12 text-slate-900 print:p-8">
              <div className="flex justify-between items-start mb-12 border-b border-slate-300 pb-8">
                <div>
                  <h1 className="text-3xl font-bold mb-4">御見積書</h1>
                  <div className="mb-4">
                    <span className="text-xl font-semibold">{formData.customerName}</span>
                    <span className="text-lg font-medium ml-2">御中</span>
                  </div>
                  <p className="text-sm text-slate-600">下記の通り、謹んで御見積申し上げます。</p>
                </div>
                <div className="text-right space-y-2">
                  <div className="text-sm">
                    <p>発行日：{new Date().toLocaleDateString('ja-JP')}</p>
                    <p>見積番号：QT-{Math.floor(Date.now() / 100000)}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p className="font-semibold">文唱堂印刷</p>
                    <p className="text-xs">担当：{formData.salesStaff}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-6 flex items-center justify-between mb-12">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">御見積合計額 (税込)</p>
                  <p className="text-4xl font-bold tabular-nums">¥{(Math.floor(result.pq * 1.1)).toLocaleString()}</p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>本体価格：¥{result.pq.toLocaleString()}</p>
                  <p>消費税10%：¥{(Math.floor(result.pq * 0.1)).toLocaleString()}</p>
                </div>
              </div>

              <table className="w-full text-left mb-12 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="py-3 px-4 text-left text-sm font-medium text-slate-700">項目 / 摘要</th>
                    <th className="py-3 px-4 text-center text-sm font-medium text-slate-700">数量</th>
                    <th className="py-3 px-4 text-center text-sm font-medium text-slate-700">単位</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-slate-700">単価</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-slate-700">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 font-medium">件名：{formData.title}</td>
                  </tr>
                  {result.formalItems.map((item, i) => (
                    <tr key={i} className="text-sm">
                      <td className="py-3 px-4">{item.name}</td>
                      <td className="py-3 px-4 text-center">{item.qty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">{item.unit}</td>
                      <td className="py-3 px-4 text-right">¥{item.unitPrice.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium">¥{item.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50">
                    <td colSpan={3} className="py-4 px-4 font-medium text-slate-700">合計</td>
                    <td colSpan={2} className="py-4 px-4 text-right font-bold">¥{(Math.floor(result.pq * 1.1)).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="space-y-8 pt-8 border-t border-slate-200">
                <div className="text-sm text-slate-600 space-y-1">
                  <p>・お支払条件：納品月末締め、翌月末現金振込</p>
                  <p>・有効期限：発行日より30日間</p>
                  <p>・想定納期：校了後、約{result.estimatedProductionDays}営業日</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">仕様明細</p>
                  <p className="text-sm text-slate-600">
                    {formData.pages}P / {formData.binding} / {formData.size} / {formData.color}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 border-t border-slate-200 text-center text-sm text-slate-500 print:hidden">
        <p>© 2025 文唱堂印刷 見積作成システム</p>
      </footer>
    </div>
  );
};

export default QuoteCenter;
