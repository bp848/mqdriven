import React, { useState, useEffect, useMemo } from 'react';
import { getJournalBookData, updateJournalEntryStatus } from '../../services/dataService';
import { Loader, BookOpen, Edit, Save, X, CheckCircle } from '../Icons';
import EmptyState from '../ui/EmptyState';
import SortableHeader from '../ui/SortableHeader';
import { EmployeeUser } from '../../types';

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

interface JournalLedgerProps {
  onAddEntry: (entry: Omit<any, 'id' | 'date'>) => void;
  isAIOff: boolean;
  currentUser?: EmployeeUser | null;
}

const JournalLedger: React.FC<JournalLedgerProps> = ({ onAddEntry, isAIOff, currentUser }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // 管理者権限チェック
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getJournalBookData();
        setEntries(data);
      } catch (err) {
        console.error('Failed to fetch journal book data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sortedEntries = useMemo(() => {
    let sortableItems = [...entries];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];

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

  const handleEdit = (entry: any) => {
    if (!isAdmin) return;
    setEditingId(entry.id);
    setEditingEntry({ ...entry });
  };

  const handleSave = async () => {
    if (!isAdmin || !editingId) return;

    setIsSaving(true);
    try {
      // 仕分け更新用のAPIを呼び出し（仮実装）
      await updateJournalEntryStatus(editingId, 'updated');
      setEntries(prev => prev.map(entry =>
        entry.id === editingId ? { ...entry, ...editingEntry } : entry
      ));
      setEditingId(null);
      setEditingEntry({});
    } catch (error) {
      console.error('Failed to update journal entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingEntry({});
  };

  const handleFieldChange = (field: string, value: string | number) => {
    setEditingEntry(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <EmptyState
          icon={BookOpen}
          title="データ未集計"
          description="仕訳データがまだ集計されていません"
        />
      </div>
    );
  }

  const inputClass = "w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">仕分け済み一覧（修正用）</h2>
        <div className="text-sm text-gray-500">
          {isAdmin ? '管理者編集可能' : '参照専用'}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <SortableHeader
                label="日付"
                sortKey="date"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="科目コード"
                sortKey="code"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="科目名"
                sortKey="name"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="借方"
                sortKey="debit_amount"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="貸方"
                sortKey="credit_amount"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="仕分け"
                sortKey="category"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              <SortableHeader
                label="ステータス"
                sortKey="status"
                sortConfig={sortConfig}
                requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
              />
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedEntries.map((entry, index) => (
              <tr key={entry.id || index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <input
                      type="date"
                      value={editingEntry.date || ''}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    entry.date
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <input
                      type="text"
                      value={editingEntry.code || ''}
                      onChange={(e) => handleFieldChange('code', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    entry.code
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <input
                      type="text"
                      value={editingEntry.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    entry.name
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <input
                      type="number"
                      value={editingEntry.debit_amount || ''}
                      onChange={(e) => handleFieldChange('debit_amount', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    entry.debit_amount > 0 ? `¥${entry.debit_amount.toLocaleString()}` : '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <input
                      type="number"
                      value={editingEntry.credit_amount || ''}
                      onChange={(e) => handleFieldChange('credit_amount', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    entry.credit_amount > 0 ? `¥${entry.credit_amount.toLocaleString()}` : '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === entry.id ? (
                    <select
                      value={editingEntry.category || ''}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="">選択してください</option>
                      <option value="売上">売上</option>
                      <option value="仕入">仕入</option>
                      <option value="経費">経費</option>
                      <option value="人件費">人件費</option>
                      <option value="その他">その他</option>
                    </select>
                  ) : (
                    entry.category || '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {entry.status === 'posted' ? '確定' : '草案'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === entry.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JournalLedger;
