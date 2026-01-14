import React, { useMemo, useState } from 'react';
import JobList from '../JobList';
import EmptyState from '../ui/EmptyState';
import SortableHeader from '../ui/SortableHeader';
import { Briefcase } from '../Icons';
import { ProjectBudgetSummary, PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../../types';
import { formatDate, formatJPY } from '../../utils';

interface SalesOrdersPageProps {
  projectSummaries: ProjectBudgetSummary[];
  orders: PurchaseOrder[];
  searchTerm: string;
  onSelectJob: (job: ProjectBudgetSummary) => void;
  onNewJob: () => void;
  onRefresh?: () => void | Promise<void>;
  isLoading?: boolean;
}

type OrderRow = PurchaseOrder & {
  projectCode: string;
  linkedProject?: ProjectBudgetSummary;
  totalAmount: number;
};

const statusStyles: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Ordered]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PurchaseOrderStatus.Received]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PurchaseOrderStatus.Cancelled]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const StatusBadge: React.FC<{ status: PurchaseOrderStatus }> = ({ status }) => (
  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusStyles[status]}`}>
    {status}
  </span>
);

const OrdersSection: React.FC<{ orders: PurchaseOrder[]; projects: ProjectBudgetSummary[] }> = ({ orders, projects }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'orderDate', direction: 'descending' });

  const jobLookup = useMemo(() => {
    const lookup = new Map<string, ProjectBudgetSummary>();
    projects.forEach(project => {
      if (project.projectCode) {
        lookup.set(String(project.projectCode), project);
      }
      if (project.jobNumber) {
        lookup.set(String(project.jobNumber), project);
      }
    });
    return lookup;
  }, [projects]);

  const orderRows = useMemo<OrderRow[]>(() => {
    return orders.map(order => {
      const projectCode = order.projectCode ? String(order.projectCode) : order.itemName ? String(order.itemName) : '';
      const normalizedQuantity = Number(order.quantity ?? 0);
      const normalizedUnitPrice = Number(order.unitPrice ?? 0);
      const totalAmount = normalizedQuantity * normalizedUnitPrice;
      return {
        ...order,
        quantity: normalizedQuantity,
        unitPrice: normalizedUnitPrice,
        projectCode,
        linkedProject: projectCode ? jobLookup.get(projectCode) : undefined,
        totalAmount,
      };
    });
  }, [orders, jobLookup]);

  const sortedOrders = useMemo(() => {
    if (!sortConfig) return orderRows;
    const items = [...orderRows];
    items.sort((a, b) => {
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
    return items;
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
      <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">受注テーブル（orders）</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Supabase の orders テーブルに保存された受注・発注行を、案件単位で照会できます。
        </p>
      </div>
      {orderRows.length === 0 ? (
        <div className="px-6 py-12">
          <EmptyState
            icon={Briefcase}
            title="ordersテーブルにデータがありません"
            message="新規案件を登録すると、初期受注データがここに表示されます。"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base text-left text-slate-600 dark:text-slate-300">
            <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">受注ID</th>
                <SortableHeader sortKey="projectCode" label="案件番号" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="supplierName" label="顧客 / 案件名" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="orderDate" label="受注日" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader sortKey="quantity" label="数量" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader sortKey="unitPrice" label="単価" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader sortKey="totalAmount" label="売上高" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => (
                <tr key={order.id} className="bg-white dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/60">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{order.id?.slice(0, 8)}...</td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-slate-700 dark:text-slate-200">{order.projectCode || '-'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{order.linkedProject ? '紐付済み' : '未紐付'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {order.linkedProject?.clientName ?? order.supplierName}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {order.linkedProject?.title ?? '案件情報なし'}
                    </div>
                  </td>
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

const SalesOrdersPage: React.FC<SalesOrdersPageProps> = ({
  projectSummaries,
  orders,
  searchTerm,
  onSelectJob,
  onNewJob,
  onRefresh,
  isLoading = false,
}) => {
  return (
    <div className="space-y-10">
      {onRefresh && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            再読み込み
          </button>
        </div>
      )}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">案件 / プロジェクト一覧</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            projects + orders のハイブリッド集計で、売上高 (P)・限界利益 (M)・受注件数を同一テーブルで確認できます。案件を選択すると詳細モーダルが開きます。
          </p>
        </div>
        <JobList
          jobs={projectSummaries}
          searchTerm={searchTerm}
          onSelectJob={onSelectJob}
          onNewJob={onNewJob}
        />
      </section>

      <section className="space-y-4">
        <OrdersSection orders={orders} projects={projectSummaries} />
      </section>
    </div>
  );
};

export default React.memo(SalesOrdersPage);
