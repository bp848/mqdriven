import React, { useState, useEffect, useMemo } from 'react';
import { getJournalBookData } from '../../services/dataService';
import { Loader, BookOpen } from '../Icons';
import EmptyState from '../ui/EmptyState';
import SortableHeader from '../ui/SortableHeader';

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

interface JournalLedgerProps {
  onAddEntry: (entry: Omit<any, 'id' | 'date'>) => void;
  isAIOff: boolean;
}

const JournalLedger: React.FC<JournalLedgerProps> = ({ onAddEntry, isAIOff }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">仕訳帳</h2>
        <div className="text-sm text-gray-500">
          参照専用（編集不可）
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader
                title="日付"
                sortKey="date"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
              <SortableHeader
                title="科目コード"
                sortKey="code"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
              <SortableHeader
                title="科目名"
                sortKey="name"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
              <SortableHeader
                title="借方"
                sortKey="debit_amount"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
              <SortableHeader
                title="貸方"
                sortKey="credit_amount"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
              <SortableHeader
                title="ステータス"
                sortKey="status"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedEntries.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.debit_amount > 0 ? `¥${entry.debit_amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.credit_amount > 0 ? `¥${entry.credit_amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    entry.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {entry.status === 'posted' ? '確定' : '草案'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JournalLedger;
