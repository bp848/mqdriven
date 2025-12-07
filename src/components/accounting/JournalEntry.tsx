import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, FileText, ArrowRight, Wand2, RefreshCw, X, Loader } from 'lucide-react';
import { DraftJournalEntry } from '../../../types';
import * as dataService from '../../../services/dataService';

interface JournalReviewPageProps {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export const JournalReviewPage: React.FC<JournalReviewPageProps> = ({ notify }) => {
  const [drafts, setDrafts] = useState<DraftJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedDrafts = await dataService.getDraftJournalEntries();
      setDrafts(fetchedDrafts);
      if (fetchedDrafts.length > 0) {
        const firstPending = fetchedDrafts.find(d => d.status === 'draft');
        setSelectedId(firstPending ? firstPending.batchId : fetchedDrafts[0].batchId);
      } else {
        setSelectedId(null);
      }
    } catch (error) {
      console.error('Failed to load draft journal entries:', error);
      if (notify) notify('仕訳下書きの読み込みに失敗しました。', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);
  
  const selectedDraft = drafts.find(d => d.batchId === selectedId);

  const handleApprove = async (batchId: string) => {
    try {
      await dataService.approveJournalBatch(batchId);
      if (notify) notify(`仕訳バッチID: ${batchId} を承認しました`, 'success');
      await loadDrafts(); // Refresh the list
    } catch (error) {
        console.error('Failed to approve journal batch:', error);
        if (notify) notify('仕訳の承認に失敗しました。', 'error');
    }
  };

  const getSourceIcon = (source: string) => {
    switch(source) {
      case 'application': return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200">System</span>;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-indigo-600" />
              自動仕訳レビュー
            </h2>
            <p className="text-slate-500 text-sm mt-1">システムが生成した仕訳候補を承認します。</p>
         </div>
         <div className="flex gap-2">
             <button 
                onClick={loadDrafts}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
            >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 更新
            </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
         {/* Left: Draft Queue */}
         <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 text-sm">承認待ち ({drafts.filter(d => d.status === 'draft').length}件)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
               {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center">
                       <Loader className="w-5 h-5 animate-spin mr-2" /> 読み込み中...
                   </div>
               ) : drafts.length === 0 ? (
                   <div className="p-8 text-center text-slate-400 text-sm">
                       承認待ちの仕訳はありません。
                   </div>
               ) : (
                   drafts.map(draft => (
                     <div 
                       key={draft.batchId} 
                       onClick={() => setSelectedId(draft.batchId)}
                       className={`p-3 rounded-lg border cursor-pointer transition relative ${
                          draft.status === 'posted' ? 'bg-slate-50 border-transparent opacity-60' :
                          selectedId === draft.batchId ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                       }`}
                     >
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex items-center gap-2">
                              {getSourceIcon(draft.source)}
                              <span className="text-xs font-mono text-slate-500">{draft.date}</span>
                           </div>
                           {draft.status === 'posted' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                           {draft.confidence && draft.confidence < 0.8 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="font-bold text-slate-800 text-sm mb-1 truncate">{draft.description}</div>
                        <div className="flex justify-between items-end">
                           <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{draft.debitAccount}</span>
                           <span className="font-mono font-bold text-slate-700">¥{(draft.debitAmount ?? 0).toLocaleString()}</span>
                        </div>
                     </div>
                   ))
               )}
            </div>
         </div>

         {/* Right: Detail & Action */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
            {selectedDraft ? (
                <>
                   {/* Slip View */}
                   <div className="p-8 flex-1 overflow-y-auto">
                       <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
                           <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                               <h3 className="font-bold text-slate-700 text-lg">振替伝票</h3>
                               <div className="font-mono text-slate-400 text-sm">ID: {selectedDraft.batchId}</div>
                           </div>
                           <div className="p-8 space-y-8">
                               {/* Accounts */}
                               <div className="grid grid-cols-2 gap-12">
                                   {/* Debit */}
                                   <div className="space-y-4 relative">
                                       <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
                                       <div>
                                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-wider">借方科目</label>
                                           <div className="text-xl font-bold text-slate-900 mt-1 pb-1 border-b border-slate-200">
                                               {selectedDraft.debitAccount}
                                           </div>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">金額</label>
                                           <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                                               ¥{(selectedDraft.debitAmount ?? 0).toLocaleString()}
                                           </div>
                                       </div>
                                   </div>

                                   {/* Credit */}
                                   <div className="space-y-4 relative text-right">
                                       <div className="absolute -right-4 top-0 bottom-0 w-1 bg-slate-400 rounded-full"></div>
                                       <div className="flex flex-col items-end">
                                           <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">貸方科目</label>
                                           <div className="text-xl font-bold text-slate-900 mt-1 pb-1 border-b border-slate-200 w-full text-right">
                                               {selectedDraft.creditAccount}
                                           </div>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">金額</label>
                                           <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                                               ¥{(selectedDraft.creditAmount ?? 0).toLocaleString()}
                                           </div>
                                       </div>
                                   </div>
                               </div>

                               {/* Description */}
                               <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">摘要</label>
                                   <div className="text-lg font-medium text-slate-800 mt-1">{selectedDraft.description}</div>
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* Footer Actions */}
                   <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-center gap-4">
                       <button className="px-6 py-3 bg-white text-slate-600 border border-slate-300 rounded-lg font-bold hover:bg-slate-100 transition shadow-sm flex items-center gap-2">
                           <X className="w-5 h-5" /> 修正
                       </button>
                       <button 
                           onClick={() => handleApprove(selectedDraft.batchId)}
                           disabled={selectedDraft.status === 'posted'}
                           className={`px-12 py-3 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95 ${
                               selectedDraft.status === 'posted' ? 'bg-emerald-500 cursor-default' : 'bg-indigo-600 hover:bg-indigo-700'
                           }`}
                       >
                           {selectedDraft.status === 'posted' ? (
                               <>
                                <CheckCircle className="w-5 h-5" /> 承認済み
                               </>
                           ) : (
                               <>
                                <ArrowRight className="w-5 h-5" /> 承認する
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
