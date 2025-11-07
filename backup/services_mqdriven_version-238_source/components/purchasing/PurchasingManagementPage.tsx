import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../../types';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { ShoppingCart } from '../Icons';
import { formatDate, formatJPY } from '../../utils';

interface PurchasingManagementPageProps {
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

const PurchasingManagementPage: React.FC<PurchasingManagementPageProps> = ({ purchaseOrders }) => {
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

    if (purchaseOrders.length === 0) {
        return <EmptyState icon={ShoppingCart} title="発注履歴がありません" message="最初の発注を登録しましょう。" />
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th scope="col" className="px-6 py-3 font-medium">発注ID</th>
                            <SortableHeader sortKey="orderDate" label="発注日" sortConfig={sortConfig} requestSort={requestSort} />
                            <SortableHeader sortKey="supplierName" label="発注先" sortConfig={sortConfig} requestSort={requestSort} />
                            <th scope="col" className="px-6 py-3 font-medium">品目</th>
                            <th scope="col" className="px-6 py-3 font-medium text-right">合計金額</th>
                            <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                        </tr>
                    </thead>
                    <tbody>
                        {sortedOrders.map((order) => (
                            <tr key={order.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-6 py-4 font-mono text-sm">{order.id.substring(0, 8)}...</td>
                                <td className="px-6 py-4">{formatDate(order.orderDate)}</td>
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{order.supplierName}</td>
                                <td className="px-6 py-4">{order.itemName}</td>
                                <td className="px-6 py-4 text-right font-semibold">{formatJPY(order.quantity * order.unitPrice)}</td>
                                <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(PurchasingManagementPage);