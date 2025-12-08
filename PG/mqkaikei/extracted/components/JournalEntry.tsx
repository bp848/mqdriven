
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, FileText, ArrowRight, Wand2, RefreshCw, X, Plus } from 'lucide-react';
import { DraftEntry } from '../App';

interface JournalEntryProps {
  drafts: DraftEntry[];
  setDrafts: (drafts: DraftEntry[]) => void;
  notify?: (message: string, type: 'success' | 'info') => void;
}

export const JournalEntry: React.FC<JournalEntryProps> = ({ drafts, setDrafts, notify }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Set initial selected ID when drafts change or mount
  useEffect(() => {
      if (drafts.length > 0 && !selectedId) {
          // Prefer selecting the first pending item
          const firstPending = drafts.find(d => d.status === 'pending');
          if (firstPending) {
              setSelectedId(firstPending.id);
          } else {
              setSelectedId(drafts[0].id);
          }
      }
  }, [drafts, selectedId]);
  
  const selectedDraft = drafts.find(d => d.id === selectedId);

  const handleApprove = (id: string) => {
    // Update local drafts state via parent
    const updatedDrafts = drafts.map(d => d.id === id ? { ...d, status: 'approved' as const } : d);
    setDrafts(updatedDrafts);

    if (notify) notify(`仕訳ID: ${id} を承認しました`, 'success');

    // Auto-advance to next pending
    const next = updatedDrafts.find(d => d.id !== id && d.status === 'pending');
    if (next) setSelectedId(next.id);
  };

  const handleBatchApprove = () => {
      // Approve all high confidence items
      let count = 0;
      const updatedDrafts = drafts.map(d => {
          if (d.status === 'pending' && d.confidence >= 0.98) {
              count++;
              return { ...d, status: 'approved' as const };
          }
          return d;
      });
      setDrafts(updatedDrafts);
      if (notify && count > 0) notify(`${count}件の高確度仕訳を一括承認しました`, 'success');
  };

  const handleGenerateAI = () => {
      // Simulate adding a random AI generated draft
      const newId = `AI-${Date.now().toString().slice(-6)}`;
      const newDraft: DraftEntry = {
          id: newId,
          source: 'API',
          date: '2024/05/22',
          description: 'AI自動生成: 交通費精算 (推定)',
          debitAccount: '旅費交通費',
          debitAmount: Math.floor(Math.random() * 5000) + 1000,
          creditAccount: '未払金',
          creditAmount: 0, // Will be same
          confidence: 0.75,
          status: 'pending',
          alert: '類似取引パターンから生成'
      };
      newDraft.creditAmount = newDraft.debitAmount;
      setDrafts([newDraft, ...drafts]);
      setSelectedId(newId);
      if (notify) notify('AIが新しい仕訳候補を生成しました', 'info');
  };

  const getSourceIcon = (source: string) => {
    switch(source) {
      case 'OCR': return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200">Scan</span>;
      case 'Excel': return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold border border-green-200">Import</span>;
      case 'API': return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200">System</span>;
      case 'Recurring': return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200">Recur</span>;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-indigo-600" />
              自動仕訳レビュー (AI Journal Review)
            </h2>
            <p className="text-slate-500 text-sm mt-1">スキャン・インポートされた取引データから生成された仕訳候補を承認します。</p>
         </div>
         <div className="flex gap-2">
             <button 
                onClick={handleGenerateAI}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> AI生成テスト
            </button>
             <button 
                onClick={handleBatchApprove}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
            >
                <CheckCircle className="w-4 h-4" /> 確度98%以上を一括承認
            </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
         {/* Left: Draft Queue */}
         <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 text-sm">承認待ち ({drafts.filter(d => d.status === 'pending').length}件)</h3>
               <span className="text-xs text-slate-400">Sort by: Date</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
               {drafts.length === 0 ? (
                   <div className="p-8 text-center text-slate-400 text-sm">
                       承認待ちの仕訳はありません。<br/>OCRやExcelからデータを取り込んでください。
                   </div>
               ) : (
                   drafts.map(draft => (
                     <div 
                       key={draft.id} 
                       onClick={() => setSelectedId(draft.id)}
                       className={`p-3 rounded-lg border cursor-pointer transition relative ${
                          draft.status === 'approved' ? 'bg-slate-50 border-transparent opacity-60' :
                          selectedId === draft.id ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                       }`}
                     >
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex items-center gap-2">
                              {getSourceIcon(draft.source)}
                              <span className="text-xs font-mono text-slate-500">{draft.date}</span>
                           </div>
                           {draft.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                           {draft.status === 'pending' && draft.confidence < 0.8 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="font-bold text-slate-800 text-sm mb-1 truncate">{draft.description}</div>
                        <div className="flex justify-between items-end">
                           <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{draft.debitAccount}</span>
                           <span className="font-mono font-bold text-slate-700">¥{draft.debitAmount.toLocaleString()}</span>
                        </div>
                        {/* Progress Bar for Confidence */}
                        {draft.status === 'pending' && (
                            <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${draft.confidence > 0.9 ? 'bg-emerald-400' : draft.confidence > 0.7 ? 'bg-amber-400' : 'bg-red-400'}`} 
                                    style={{ width: `${draft.confidence * 100}%` }}
                                ></div>
                            </div>
                        )}
                     </div>
                   ))
               )}
            </div>
         </div>

         {/* Right: Detail & Action */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            {selectedDraft ? (
                <>
                   {/* Status Banner */}
                   <div className={`p-4 flex items-center gap-3 ${
                       selectedDraft.confidence < 0.8 ? 'bg-amber-50 border-b border-amber-100' : 
                       'bg-indigo-50/30 border-b border-slate-100'
                   }`}>
                       {selectedDraft.confidence < 0.8 ? (
                           <>
                             <AlertTriangle className="w-5 h-5 text-amber-500" />
                             <div className="flex-1">
                                <p className="text-sm font-bold text-amber-800">要確認: AI確度が低いため、科目の確認を推奨します</p>
                                <p className="text-xs text-amber-600">{selectedDraft.alert || '過去の取引パターンと一致しません。'}</p>
                             </div>
                           </>
                       ) : (
                           <>
                             <Wand2 className="w-5 h-5 text-indigo-500" />
                             <div className="flex-1">
                                <p className="text-sm font-bold text-indigo-900">AI推奨仕訳</p>
                                <p className="text-xs text-indigo-600">過去の取引履歴(OCR)から{Math.round(selectedDraft.confidence * 100)}%の確率で推論されました。</p>
                             </div>
                           </>
                       )}
                   </div>

                   {/* Slip View */}
                   <div className="p-8 flex-1 overflow-y-auto">
                       <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
                           <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                               <h3 className="font-bold text-slate-700 text-lg">振替伝票</h3>
                               <div className="font-mono text-slate-400 text-sm">ID: {selectedDraft.id}</div>
                           </div>
                           <div className="p-8 space-y-8">
                               {/* Accounts */}
                               <div className="grid grid-cols-2 gap-12">
                                   {/* Debit */}
                                   <div className="space-y-4 relative">
                                       <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
                                       <div>
                                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-wider">借方科目 (Debit)</label>
                                           <div className="text-xl font-bold text-slate-900 mt-1 pb-1 border-b border-slate-200">
                                               {selectedDraft.debitAccount}
                                           </div>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">金額</label>
                                           <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                                               ¥{selectedDraft.debitAmount.toLocaleString()}
                                           </div>
                                       </div>
                                   </div>

                                   {/* Credit */}
                                   <div className="space-y-4 relative text-right">
                                       <div className="absolute -right-4 top-0 bottom-0 w-1 bg-slate-400 rounded-full"></div>
                                       <div className="flex flex-col items-end">
                                           <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">貸方科目 (Credit)</label>
                                           <div className="text-xl font-bold text-slate-900 mt-1 pb-1 border-b border-slate-200 w-full text-right">
                                               {selectedDraft.creditAccount}
                                           </div>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">金額</label>
                                           <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                                               ¥{selectedDraft.creditAmount.toLocaleString()}
                                           </div>
                                       </div>
                                   </div>
                               </div>

                               {/* Description */}
                               <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">摘要 (Description)</label>
                                   <div className="text-lg font-medium text-slate-800 mt-1">{selectedDraft.description}</div>
                                   <div className="mt-2 flex gap-2">
                                       <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">Source: {selectedDraft.source}</span>
                                       <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">Date: {selectedDraft.date}</span>
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* Footer Actions */}
                   <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-center gap-4">
                       <button className="px-6 py-3 bg-white text-slate-600 border border-slate-300 rounded-lg font-bold hover:bg-slate-100 transition shadow-sm flex items-center gap-2">
                           <X className="w-5 h-5" /> 修正・保留
                       </button>
                       <button 
                           onClick={() => handleApprove(selectedDraft.id)}
                           disabled={selectedDraft.status === 'approved'}
                           className={`px-12 py-3 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95 ${
                               selectedDraft.status === 'approved' ? 'bg-emerald-500 cursor-default' : 'bg-indigo-600 hover:bg-indigo-700'
                           }`}
                       >
                           {selectedDraft.status === 'approved' ? (
                               <>
                                <CheckCircle className="w-5 h-5" /> 承認済み (Approved)
                               </>
                           ) : (
                               <>
                                <ArrowRight className="w-5 h-5" /> 承認する (Approve)
                               </>
                           )}
                       </button>
                   </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                    <FileText className="w-12 h-12 mb-2 opacity-20" />
                    <p>左側のリストから仕訳を選択してください</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};
