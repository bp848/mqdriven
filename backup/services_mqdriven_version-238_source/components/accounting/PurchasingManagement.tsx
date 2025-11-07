import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../../types';
import { ArrowUpDown, ChevronDown } from '../Icons';

interface PurchasingManagementProps {
    purchaseOrders: PurchaseOrder[];
}

const statusStyles: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Ordered]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PurchaseOrderStatus.Received]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PurchaseOrderStatus.Cancelled]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const StatusBadge: React.FC<{ status: PurchaseOrderStatus }> = ({ status }) => {
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusStyles[status]}`}>
      {status}
    </span>
  );
};


const PurchasingManagement: React.FC<PurchasingManagementProps> = ({ purchaseOrders }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'orderDate', direction: 'descending' });

    const sortedOrders = useMemo(() => {
        let sortableItems = [...purchaseOrders];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof PurchaseOrder];
                const bValue = b[sortConfig.key as keyof PurchaseOrder];
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
    }, [purchaseOrders, sortConfig]);

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
            <div className="p-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">発注管理</h2>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    資材や外注サービスなどの発注履歴を管理します。
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th scope="col" className="px-6 py-3">発注ID</th>
                            <SortableHeader sortKey="orderDate" label="発注日" />
                            <SortableHeader sortKey="supplierName" label="発注先" />
                            <th scope="col" className="px-6 py-3">品目</th>
                            <th scope="col" className="px-6 py-3 text-right">合計金額</th>
                            <SortableHeader sortKey="status" label="ステータス" />
                        </tr>
                    </thead>
                    <tbody>
                        {sortedOrders.map((order) => (
                            <tr key={order.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-6 py-4 font-mono text-sm">{order.id}</td>
                                <td className="px-6 py-4">{order.orderDate}</td>
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{order.supplierName}</td>
                                <td className="px-6 py-4">{order.itemName}</td>
                                <td className="px-6 py-4 text-right font-semibold">¥{(order.quantity * order.unitPrice).toLocaleString()}</td>
                                <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                            </tr>
                        ))}
                         {sortedOrders.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-16 text-slate-500 dark:text-slate-400">
                                    <p>発注データがありません。</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(PurchasingManagement);