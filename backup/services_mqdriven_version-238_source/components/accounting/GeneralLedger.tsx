

import React, { useState, useMemo, useEffect } from 'react';
import { JournalEntry, AccountItem, SortConfig } from '../../types';
import { ArrowUpDown, ChevronDown } from '../Icons';

interface GeneralLedgerProps {
    entries: JournalEntry[];
    accountItems: AccountItem[];
}

const GeneralLedger: React.FC<GeneralLedgerProps> = ({ entries, accountItems }) => {
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'ascending' });

    const sortedAccountItems = useMemo(() => {
        return [...accountItems].sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            return a.code.localeCompare(b.code);
        });
    }, [accountItems]);

    useEffect(() => {
        if (!selectedAccount && sortedAccountItems.length > 0) {
            setSelectedAccount(sortedAccountItems[0].name);
        }
    }, [sortedAccountItems, selectedAccount]);

    const accountTransactions = useMemo(() => {
        if (!selectedAccount) return [];
        return entries
            .filter(e => e.account === selectedAccount)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries, selectedAccount]);

    const { transactionsWithBalance, finalBalance } = useMemo(() => {
        let balance = 0;
        const transactionsWithBalance = accountTransactions.map(entry => {
            balance += entry.debit - entry.credit;
            return { ...entry, balance };
        });
        return { transactionsWithBalance, finalBalance: balance };
    }, [accountTransactions]);
    
    const sortedTransactions = useMemo(() => {
        let sortableItems = [...transactionsWithBalance];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof (typeof sortableItems[0])];
                const bValue = b[sortConfig.key as keyof (typeof sortableItems[0])];
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
    }, [transactionsWithBalance, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ sortKey: string; label: string; className?: string }> = ({ sortKey, label, className }) => {
        const isActive = sortConfig?.key === sortKey;
        const isAscending = sortConfig?.direction === 'ascending';

        return (
            <th scope="col" className={`px-6 py-3 ${className || ''}`}>
                <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 group">
                    <span className={isActive ? 'font-bold text-slate-800 dark:text-slate-100' : ''}>{label}</span>
                    <div className="w-4 h-4">
                        {isActive ? (
                            <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-200 transition-transform duration-200 ${isAscending ? 'rotate-180' : 'rotate-0'}`} />
                        ) : (
                            <ArrowUpDown className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                </button>
            </th>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">総勘定元帳</h2>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    勘定科目を選択して、取引履歴と残高の推移を確認します。
                </p>
                <div className="mt-4 max-w-sm">
                    <label htmlFor="account-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">勘定科目</label>
                    <select
                        id="account-select"
                        value={selectedAccount || ''}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full text-base bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {sortedAccountItems.map(acc => <option key={acc.id} value={acc.name}>{acc.code} - {acc.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedAccount ? (
                <div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                                <tr>
                                    <SortableHeader sortKey="date" label="日付" />
                                    <SortableHeader sortKey="description" label="摘要" />
                                    <SortableHeader sortKey="debit" label="借方" className="text-right" />
                                    <SortableHeader sortKey="credit" label="貸方" className="text-right" />
                                    <SortableHeader sortKey="balance" label="残高" className="text-right" />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTransactions.map((entry) => (
                                    <tr key={entry.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{entry.description}</td>
                                        <td className="px-6 py-4 text-right">{entry.debit > 0 ? `¥${entry.debit.toLocaleString()}` : '-'}</td>
                                        <td className="px-6 py-4 text-right">{entry.credit > 0 ? `¥${entry.credit.toLocaleString()}` : '-'}</td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-200">¥{entry.balance.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {transactionsWithBalance.length > 0 && (
                        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 text-right">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">最終残高: </span>
                            <span className="font-bold text-lg text-slate-900 dark:text-white">¥{finalBalance.toLocaleString()}</span>
                        </div>
                     )}
                </div>
            ) : (
                <div className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <p>表示する勘定科目がありません。</p>
                    <p className="text-sm">仕訳帳に取引を記録してください。</p>
                </div>
            )}
        </div>
    );
};

export default React.memo(GeneralLedger);