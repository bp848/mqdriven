
import React, { useState } from 'react';
import { Upload, Camera, CheckCircle, AlertTriangle, ArrowRight, RefreshCw, FileText, ScanLine, X } from 'lucide-react';
import { DraftEntry, ViewState } from '../App';

interface BankOCRProps {
  onAddDrafts: (drafts: DraftEntry[]) => void;
  onNavigate: (view: ViewState) => void;
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const BankOCR: React.FC<BankOCRProps> = ({ onAddDrafts, onNavigate, notify }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResults, setHasResults] = useState(false);

  const handleUpload = () => {
    setIsProcessing(true);
    // Simulate AI processing time
    setTimeout(() => {
        setIsProcessing(false);
        setHasResults(true);
    }, 2000);
  };

  const ocrResults = [
    { id: 1, date: '2024/05/20', desc: 'フリコミ Aショウジ', amount: 550000, type: '入金', candidate: '売掛金 (A商事)', confidence: 0.98, status: 'confirmed', debitAcc: '普通預金', creditAcc: '売掛金' },
    { id: 2, date: '2024/05/20', desc: 'デンリヨク', amount: 24500, type: '出金', candidate: '水道光熱費', confidence: 0.95, status: 'confirmed', debitAcc: '水道光熱費', creditAcc: '普通預金' },
    { id: 3, date: '2024/05/21', desc: 'カードケッサイ', amount: 15800, type: '出金', candidate: '未払金 (カード分)', confidence: 0.65, status: 'review', debitAcc: '未払金', creditAcc: '普通預金' },
    { id: 4, date: '2024/05/22', desc: 'テスウリヨウ', amount: 440, type: '出金', candidate: '支払手数料', confidence: 0.92, status: 'confirmed', debitAcc: '支払手数料', creditAcc: '普通預金' },
  ];

  const handleSendToJournal = () => {
    // Convert OCR results to DraftEntry format
    const newDrafts: DraftEntry[] = ocrResults.map(item => ({
        id: `OCR-${Date.now()}-${item.id}`,
        source: 'OCR',
        date: item.date,
        description: item.desc,
        debitAccount: item.debitAcc,
        debitAmount: item.amount,
        creditAccount: item.creditAcc,
        creditAmount: item.amount,
        confidence: item.confidence,
        status: 'pending',
        alert: item.confidence < 0.8 ? 'AI確度低: 科目要確認' : undefined
    }));

    onAddDrafts(newDrafts);
    if (notify) notify(`${newDrafts.length}件のデータを仕訳候補として送信しました`, 'success');
    
    // Reset state and navigate to journal
    setHasResults(false);
    onNavigate('journal');
  };

  return (
    <div className="h-full flex flex-col gap-6">
       <div className="flex justify-between items-center">
          <div>
              <h2 className="text-2xl font-bold text-slate-900">銀行通帳・明細取込</h2>
              <p className="text-slate-500 text-sm mt-1">通帳のコピーや、ネットバンキングのPDFをここに置くだけで自動入力します。</p>
          </div>
       </div>

       <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left: Upload / Camera Area */}
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col relative group">
             
             {isProcessing ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden bg-slate-900">
                     {/* Scanning Animation */}
                     <div className="absolute top-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                     
                     <div className="bg-slate-800 p-6 rounded-full mb-6 relative">
                         <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
                         <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                     </div>
                     <h3 className="text-xl font-bold text-white mb-2">解析中...</h3>
                     <p className="text-slate-400 text-sm">文字を読み取っています。<br/>そのままお待ちください。</p>
                 </div>
             ) : hasResults ? (
                 <div className="flex-1 bg-slate-800 flex items-center justify-center p-4 relative">
                     {/* Preview of scanned doc */}
                     <div className="relative w-3/4 h-3/4 border border-slate-600 bg-white opacity-90 rounded shadow-2xl overflow-hidden transform group-hover:scale-105 transition duration-500">
                         <div className="absolute top-0 left-0 w-full h-8 bg-slate-200 border-b border-slate-300"></div>
                         <div className="p-4 space-y-2">
                             <div className="h-2 bg-slate-200 rounded w-1/3"></div>
                             <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                             <div className="h-2 bg-slate-200 rounded w-full"></div>
                             <div className="h-2 bg-slate-200 rounded w-full"></div>
                         </div>
                         {/* Overlay Badge */}
                         <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10">
                             <div className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                                 <CheckCircle className="w-5 h-5" /> 読み取り完了
                             </div>
                         </div>
                     </div>
                     
                     <button 
                        onClick={() => setHasResults(false)}
                        className="absolute top-4 right-4 p-2 bg-slate-700 text-white rounded-full hover:bg-slate-600 transition"
                     >
                         <X className="w-5 h-5" />
                     </button>
                 </div>
             ) : (
                 <div 
                    className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 m-4 rounded-xl hover:bg-slate-800/50 hover:border-indigo-500 transition cursor-pointer group/upload"
                    onClick={handleUpload}
                 >
                     <div className="bg-slate-800 p-6 rounded-full mb-6 group-hover/upload:scale-110 transition duration-300 ring-4 ring-slate-800 group-hover/upload:ring-indigo-500/30">
                         <ScanLine className="w-10 h-10 text-indigo-400" />
                     </div>
                     <h3 className="text-xl font-bold text-slate-200">ここにファイルを置く</h3>
                     <p className="text-slate-500 text-sm mt-2 mb-6">PDF, 写真データ(JPG) など</p>
                     
                     <div className="flex gap-3">
                         <span className="text-xs bg-slate-800 px-3 py-1 rounded text-slate-400 border border-slate-700">通帳のコピー</span>
                         <span className="text-xs bg-slate-800 px-3 py-1 rounded text-slate-400 border border-slate-700">ネットバンク明細</span>
                     </div>
                 </div>
             )}
          </div>

          {/* Right: Results Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <FileText className="w-4 h-4 text-slate-500" />
                     読み取り結果
                 </h3>
                 {hasResults && (
                     <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">4件 見つかりました</span>
                 )}
             </div>

             <div className="flex-1 overflow-auto bg-slate-50/30">
                 {hasResults ? (
                     <div className="divide-y divide-slate-100">
                         {ocrResults.map((row) => (
                             <div key={row.id} className="p-4 hover:bg-white transition flex items-center gap-4 group">
                                 <div className="w-16 text-center">
                                     <div className="text-[10px] text-slate-400 font-mono">{row.date.split('/')[0]}</div>
                                     <div className="text-sm font-bold text-slate-700">{row.date.slice(5)}</div>
                                 </div>
                                 
                                 <div className="flex-1 min-w-0">
                                     <div className="font-medium text-slate-800 truncate">{row.desc}</div>
                                     <div className="flex items-center gap-2 mt-1">
                                         <span className={`text-xs px-2 py-0.5 rounded border ${
                                             row.confidence > 0.9 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                         }`}>
                                             {row.candidate}
                                         </span>
                                         <span className="text-[10px] text-slate-400">一致率: {Math.round(row.confidence * 100)}%</span>
                                     </div>
                                 </div>

                                 <div className={`text-right font-mono font-bold ${row.type === '入金' ? 'text-indigo-600' : 'text-slate-600'}`}>
                                     {row.type === '出金' && '▲'} {row.amount.toLocaleString()}
                                 </div>
                                 
                                 <div className="w-6 flex justify-center">
                                     {row.confidence > 0.8 ? (
                                         <CheckCircle className="w-5 h-5 text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                                     ) : (
                                         <AlertTriangle className="w-5 h-5 text-amber-400" />
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                         <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-slate-300" />
                         </div>
                         <h4 className="font-medium text-slate-600">データがありません</h4>
                         <p className="text-sm mt-1">左側のエリアに通帳やファイルを置いてください。<br/>自動で文字を読み取ります。</p>
                     </div>
                 )}
             </div>

             <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                 <button 
                    disabled={!hasResults}
                    onClick={handleSendToJournal}
                    className={`w-full py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition ${hasResults ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                 >
                     内容を確認して登録 <ArrowRight className="w-4 h-4" />
                 </button>
             </div>
          </div>
       </div>
    </div>
  );
};
