
import React, { useState, useMemo } from 'react';
import { JournalEntry, SortConfig } from '../types';
import { PlusCircle, Sparkles, Loader, BookOpen } from './Icons';
import { suggestJournalEntry } from '../services/geminiService';
import EmptyState from './ui/EmptyState';
import SortableHeader from './ui/SortableHeader';

interface JournalLedgerProps {
  entries: JournalEntry[];
  onAddEntry: (entry: Omit<JournalEntry, 'id' | 'date'>) => void;
  isAIOff: boolean;
}

const JournalLedger: React.FC<JournalLedgerProps> = ({ entries, onAddEntry, isAIOff }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    account: '',
    description: '',
    debit: 0,
    credit: 0,
  });
  const [error, setError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);


  const sortedEntries = useMemo(() => {
    let sortableItems = [...entries];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof JournalEntry];
        const bValue = b[sortConfig.key as keyof JournalEntry];

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [entries, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewEntry(prev => ({
      ...prev,
      [name]: (name === 'debit' || name === 'credit') ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAiGenerate = async () => {
    if (isAIOff) {
        setError("AI機能は現在無効です。");
        return;
    }
    if (!aiPrompt) {
        setError("AIへの依頼内容を入力してください。");
        return;
    }
    setIsAiLoading(true);
    setError('');
    try {
        const suggestion = await suggestJournalEntry(aiPrompt);
        setNewEntry({
            account: suggestion.account,
            description: suggestion.description,
            debit: suggestion.debit,
            credit: suggestion.credit
        });
    } catch (e: any) {
        if (e.name === 'AbortError') return; // Request was aborted, do nothing
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError("AIによる提案の生成中に不明なエラーが発生しました。");
        }
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.account || !newEntry.description) {
      setError('勘定科目と摘要は必須です。');
      return;
    }
    if (newEntry.debit === 0 && newEntry.credit === 0) {
      setError('借方または貸方のいずれかに数値を入力してください。');
      return;
    }
    if (newEntry.debit > 0 && newEntry.credit > 0) {
      setError('借方と貸方の両方を同時に入力することはできません。');
      return;
    }
    setError('');
    onAddEntry(newEntry);
    setNewEntry({ account: '', description: '', debit: 0, credit: 0 });
    setAiPrompt('');
    setShowForm(false);
  };

  const inputClass = "w-full bg-white dark:bg-slate-800 p-2 rounded-md border border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-white">仕訳帳</h3>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            すべての金銭的取引がここに記録されます。見出しをクリックしてソートできます。
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex-shrink-0 flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          <span>仕訳を追加</span>
        </button>
      </div>
      
      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6 border border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out">
          <div className="bg-blue-50 dark:bg-slate-900/50 p-4 rounded-lg border border-blue-200 dark:border-slate-700 mb-6">
              <label htmlFor="ai-prompt" className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              AIアシスタント (仕訳入力)
              </label>
              <div className="flex gap-2">
                  <input
                      type="text"
                      id="ai-prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="例: カフェでミーティング、コーヒー代1000円"
                      className={`${inputClass} flex-grow`}
                      disabled={isAiLoading || isAIOff}
                  />
                  <button type="button" onClick={handleAiGenerate} disabled={isAiLoading || !aiPrompt || isAIOff} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2 transition-colors">
                      {isAiLoading ? <Loader className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5" />}
                      <span>{isAiLoading ? '生成中...' : 'AIで生成'}</span>
                  </button>
              </div>
              {isAIOff && <p className="text-sm text-red-500 mt-2">AI機能無効のため、AIアシスタントは利用できません。</p>}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="account" className={labelClass}>勘定科目</label>
                    <input type="text" id="account" name="account" value={newEntry.account} onChange={handleInputChange} className={inputClass} required />
                </div>
                <div>
                    <label htmlFor="description" className={labelClass}>摘要</label>
                    <input type="text" id="description" name="description" value={newEntry.description} onChange={handleInputChange} className={inputClass} required />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="debit" className={labelClass}>借方</label>
                    <input type="number" id="debit" name="debit" value={newEntry.debit} onChange={handleInputChange} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="credit" className={labelClass}>貸方</label>
                    <input type="number" id="credit" name="credit" value={newEntry.credit} onChange={handleInputChange} className={inputClass} />
                </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="bg-slate-200 dark:bg-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-500">キャンセル</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">保存</button>
            </div>
          </form>
        </div>
      )}

      {sortedEntries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
            <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <SortableHeader sortKey="date" label="日付" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="account" label="勘定科目" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="description" label="摘要" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="debit" label="借方" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader sortKey="credit" label="貸方" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => (
                <tr key={entry.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{entry.account}</td>
                  <td className="px-6 py-4">{entry.description}</td>
                  <td className="px-6 py-4 text-right">{entry.debit > 0 ? `¥${entry.debit.toLocaleString()}` : '-'}</td>
                  <td className="px-6 py-4 text-right">{entry.credit > 0 ? `¥${entry.credit.toLocaleString()}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState 
            icon={BookOpen}
            title="仕訳がありません"
            message="「仕訳を追加」ボタンから最初の取引を記録してください。"
            action={{ label: '仕訳を追加', onClick: () => setShowForm(true), icon: PlusCircle }}
        />
      )}
    </div>
  );
};

export default React.memo(JournalLedger);