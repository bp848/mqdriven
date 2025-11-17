import React, { useState, useMemo } from 'react';
import { Job, PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../../types';
import SortableHeader from '../ui/SortableHeader';
import EmptyState from '../ui/EmptyState';
import { Briefcase } from '../Icons';
import { formatDate, formatJPY } from '../../utils';

interface PurchasingManagementPageProps {
    purchaseOrders: PurchaseOrder[];
    jobs: Job[];
}

type OrderRow = PurchaseOrder & {
    projectCode: string;
    projectId: string | null;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    customerName: string;
    raw: Record<string, any>;
};

const RAW_ORDER_FIELD_KEYS = [
    'id',
    'order_code',
    'project_id',
    'project_code',
    'copies',
    'amount',
    'subamount',
    'order_date',
    'delivery_date',
    'create_user_id',
    'create_user_code',
    'update_user_id',
    'update_user_code',
    'user_code',
    'user_id',
    'applicant_id',
    'approval1',
    'approval2',
    'approval3',
    'approval4',
    'approval_status1',
    'approval_status2',
    'approval_status3',
    'approval_status4',
    'version',
    'delivery_form',
    'quality',
    'quantity',
    'reserve_cnt',
    'delivery_cnt',
    'size',
    'total_page',
    'first_proof',
    'second_proof',
    'end_proof',
    'lower_version',
    'before_note',
    'after_note',
    'client_custmer',
    'repayment_id',
    'repayment_comment',
    'specialsize_remarks',
    'claim_date',
    'claim_month',
    'delivery_note',
    'create_date',
    'update_date',
] as const;

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

const PRIMARY_HEADERS = [
    { key: 'id', label: '受注ID (id)', sortKey: 'id' },
    { key: 'customerName', label: '顧客名 (project_id参照)', sortKey: 'customerName' },
    { key: 'projectCode', label: '案件番号 (project_code)', sortKey: 'projectCode' },
    { key: 'orderDate', label: '受注日 (order_date)', sortKey: 'orderDate' },
    { key: 'quantity', label: '数量 (quantity)', sortKey: 'quantity', alignRight: true },
    { key: 'unitPrice', label: '単価', sortKey: 'unitPrice', alignRight: true },
    { key: 'totalAmount', label: '受注金額', sortKey: 'totalAmount', alignRight: true },
    { key: 'status', label: 'ステータス', sortKey: 'status' },
] as const;

const formatRawValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string') return value;
    return String(value);
};

const PurchasingManagementPage: React.FC<PurchasingManagementPageProps> = ({ purchaseOrders, jobs }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'orderDate', direction: 'descending' });

    const jobsById = useMemo(() => {
        const lookup = new Map<string, Job>();
        jobs.forEach(job => {
            if (job.id) lookup.set(job.id, job);
        });
        return lookup;
    }, [jobs]);

    const jobsByProjectCode = useMemo(() => {
        const lookup = new Map<string, Job>();
        jobs.forEach(job => {
            if (job.projectCode) lookup.set(String(job.projectCode), job);
            if (job.jobNumber) lookup.set(String(job.jobNumber), job);
        });
        return lookup;
    }, [jobs]);

    const orderRows = useMemo<OrderRow[]>(() => {
        return purchaseOrders.map(order => {
            const raw = order.raw || {};
            const projectId = order.projectId ?? raw.project_id ?? null;
            const projectCodeValue = order.projectCode ?? raw.project_code ?? order.itemName ?? '';
            const projectCode = projectCodeValue ? String(projectCodeValue) : '';
            const linkedJob = (projectId && jobsById.get(projectId)) || (projectCode && jobsByProjectCode.get(projectCode)) || null;
            const quantity = Number(order.quantity ?? raw.quantity ?? raw.copies ?? 0);
            const unitPrice = Number(order.unitPrice ?? 0);
            const totalAmount =
                Number(order.amount ?? raw.amount ?? order.subamount ?? raw.subamount ?? quantity * unitPrice) || 0;
            const customerName = linkedJob?.clientName || raw.client_custmer || order.supplierName || '-';

            return {
                ...order,
                projectId,
                projectCode,
                quantity,
                unitPrice,
                totalAmount,
                customerName,
                raw,
            };
        });
    }, [purchaseOrders, jobsById, jobsByProjectCode]);

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
                    <table className="min-w-full text-left text-slate-600 dark:text-slate-300 text-sm">
                        <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200">
                            <tr>
                                {PRIMARY_HEADERS.map(header => (
                                    <SortableHeader
                                        key={header.key}
                                        sortKey={header.sortKey}
                                        label={header.label}
                                        sortConfig={sortConfig}
                                        requestSort={requestSort}
                                        className={header.alignRight ? 'text-right min-w-[120px]' : 'min-w-[160px]'}
                                    />
                                ))}
                                {RAW_ORDER_FIELD_KEYS.map(fieldKey => (
                                    <th key={fieldKey} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                                        {fieldKey}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedOrders.map((order) => (
                                <tr key={order.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60 align-top">
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{order.id || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900 dark:text-white">{order.customerName}</div>
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
                                    {RAW_ORDER_FIELD_KEYS.map(fieldKey => (
                                        <td key={`${order.id}-${fieldKey}`} className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                                            {formatRawValue(order.raw?.[fieldKey])}
                                        </td>
                                    ))}
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
