import React, { useState, useEffect, useMemo } from 'react';
import {
  getExpenseLinesData,
  getExpenseByMonthAccount,
  getExpenseByMonthSupplier,
  getExpenseByMonthProject
} from '../../services/dataService';
import { Loader, TrendingUp } from '../Icons';
import EmptyState from '../ui/EmptyState';
import SortableHeader from '../ui/SortableHeader';

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

type TabType = 'details' | 'byAccount' | 'bySupplier' | 'byProject';

const ExpenseAnalysisPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [expenseLines, setExpenseLines] = useState<any[]>([]);
  const [byAccount, setByAccount] = useState<any[]>([]);
  const [bySupplier, setBySupplier] = useState<any[]>([]);
  const [byProject, setByProject] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'occurred_on', direction: 'descending' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lines, accounts, suppliers, projects] = await Promise.all([
          getExpenseLinesData(),
          getExpenseByMonthAccount(),
          getExpenseByMonthSupplier(),
          getExpenseByMonthProject(),
        ]);
        setExpenseLines(lines);
        setByAccount(accounts);
        setBySupplier(suppliers);
        setByProject(projects);
      } catch (err) {
        console.error('Failed to fetch expense analysis data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sortedExpenseLines = useMemo(() => {
    let sortableItems = [...expenseLines];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

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
  }, [expenseLines, sortConfig]);

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || amount === 0) return '-';
    return `¥${Math.abs(amount).toLocaleString()}`;
  };

  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('ja-JP');
    } catch {
      return date;
    }
  };

  const formatMonth = (month: string | null | undefined): string => {
    if (!month) return '-';
    try {
      const date = new Date(month);
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    } catch {
      return month;
    }
  };

  const totalAmount = useMemo(() => {
    return expenseLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  }, [expenseLines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  const hasData = expenseLines.length > 0 || byAccount.length > 0 || bySupplier.length > 0 || byProject.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-8">
        <EmptyState
          icon={TrendingUp}
          title="データ未集計"
          message="経費データがまだ集計されていません"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">経費分析</h2>
        <div className="text-sm text-gray-500">
          参照専用（編集不可）
        </div>
      </div>

      {/* Summary Card */}
      <div className="rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">総経費額</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">明細件数</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {expenseLines.length.toLocaleString()}件
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">勘定科目数</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {new Set(expenseLines.map(l => l.account_id)).size}科目
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'details' as TabType, label: '明細一覧' },
            { id: 'byAccount' as TabType, label: '勘定科目別' },
            { id: 'bySupplier' as TabType, label: '仕入先別' },
            { id: 'byProject' as TabType, label: 'プロジェクト別' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'details' && (
          <div className="overflow-x-auto">
            {expenseLines.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="データ未集計"
                message="経費明細データがまだ集計されていません"
              />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <SortableHeader
                      label="発生日"
                      sortKey="occurred_on"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                    />
                    <SortableHeader
                      label="勘定科目コード"
                      sortKey="account_code"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                    />
                    <SortableHeader
                      label="勘定科目名"
                      sortKey="account_name"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                    />
                    <SortableHeader
                      label="プロジェクト"
                      sortKey="project_code"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                    />
                    <SortableHeader
                      label="仕入先"
                      sortKey="supplier_name"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                    />
                    <SortableHeader
                      label="金額"
                      sortKey="amount"
                      sortConfig={sortConfig}
                      requestSort={(key) => {
                        setSortConfig(prev => {
                          if (prev?.key === key) {
                            return { key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                          }
                          return { key, direction: 'descending' };
                        });
                      }}
                      className="text-right"
                    />
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      摘要
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {sortedExpenseLines.map((line, index) => (
                    <tr key={line.journal_line_id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(line.occurred_on)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {line.account_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {line.account_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {line.project_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {line.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(line.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {line.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'byAccount' && (
          <div className="overflow-x-auto">
            {byAccount.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="データ未集計"
                message="勘定科目別の集計データがまだ集計されていません"
              />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      月
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      科目コード
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      科目名
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      金額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {byAccount.map((item, index) => (
                    <tr key={`${item.month}-${item.account_id}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatMonth(item.month)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.account_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.account_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'bySupplier' && (
          <div className="overflow-x-auto">
            {bySupplier.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="データ未集計"
                message="仕入先別の集計データがまだ集計されていません"
              />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      月
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      仕入先名
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      金額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {bySupplier.map((item, index) => (
                    <tr key={`${item.month}-${item.supplier_id || index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatMonth(item.month)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.supplier_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'byProject' && (
          <div className="overflow-x-auto">
            {byProject.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="データ未集計"
                message="プロジェクト別の集計データがまだ集計されていません"
              />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      月
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      プロジェクトコード
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                      金額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-gray-700">
                  {byProject.map((item, index) => (
                    <tr key={`${item.month}-${item.project_id || index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatMonth(item.month)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.project_code || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseAnalysisPage;
