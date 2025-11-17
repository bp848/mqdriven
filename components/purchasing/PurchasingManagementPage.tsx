import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../../types';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { Briefcase } from '../Icons';
import { formatDate, formatJPY } from '../../utils';

interface PurchasingManagementPageProps {
    purchaseOrders: PurchaseOrder[];
}

type OrderRow = PurchaseOrder & {
  projectCode: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

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

    const orderRows = useMemo<OrderRow[]>(() => {
        return purchaseOrders.map(order => {
            const projectCode = order.itemName ? String(order.itemName) : '';
            const quantity = Number(order.quantity ?? 0);
            const unitPrice = Number(order.unitPrice ?? 0);
            const totalAmount = quantity * unitPrice;
            return {
                ...order,
                projectCode,
                quantity,
                unitPrice,
                totalAmount,
            };
        });
    }, [purchaseOrders]);

    const sortedOrders = useMemo(() => {
        if (!sortConfig) return orderRows;
        const sortableItems = [...orderRows];
        sortableItems.sort((a, b) => {
            const aValue = (a as any)[sortConfig.key];
            const bValue = (b as any)[sortConfig.key];
            if (aValue === bValue) return 0;
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
        return sortableItems;
    }, [orderRows, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/80">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">受注一覧</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Supabase の orders テーブルに蓄積された受注・発注データを一覧で確認できます。
                </p>
            </div>
            {orderRows.length === 0 ? (
                <div className="px-6 py-12">
                    <EmptyState
                        icon={Briefcase}
                        title="ordersテーブルにデータがありません"
                        message="案件登録やFAX-OCRの取り込みで受注データを追加すると、ここに表示されます。"
                    />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left text-slate-600 dark:text-slate-300">
                        <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-medium">受注ID</th>
                                <SortableHeader sortKey="supplierName" label="顧客名" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="projectCode" label="案件番号" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="orderDate" label="受注日" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="quantity" label="数量" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                                <SortableHeader sortKey="unitPrice" label="単価" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                                <SortableHeader sortKey="totalAmount" label="受注金額" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                                <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedOrders.map((order) => (
                                <tr key={order.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60">
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{order.id?.slice(0, 8)}...</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900 dark:text-white">{order.supplierName || '-'}</div>
                                        {order.paymentRecipientId && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400">支払先ID: {order.paymentRecipientId}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-200">{order.projectCode || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(order.orderDate)}</td>
                                    <td className="px-6 py-4 text-right font-mono">{order.quantity.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">{formatJPY(order.unitPrice)}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                                        {formatJPY(order.totalAmount)}
                                    </td>
                                    <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default React.memo(PurchasingManagementPage);
