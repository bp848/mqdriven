import React, { useState, useMemo } from 'react';
import { ProjectBudgetSummary, PurchaseOrderStatus, SortConfig } from '../types';
import JobStatusBadge from './JobStatusBadge';
import { formatJPY, formatDate } from '../utils';
import EmptyState from './ui/EmptyState';
import { Briefcase, PlusCircle } from './Icons';
import SortableHeader from './ui/SortableHeader';

interface JobListProps {
  jobs: ProjectBudgetSummary[];
  searchTerm: string;
  onSelectJob: (job: ProjectBudgetSummary) => void;
  onNewJob: () => void;
}

const orderStatusStyles: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Ordered]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PurchaseOrderStatus.Received]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PurchaseOrderStatus.Cancelled]: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

const JobList: React.FC<JobListProps> = ({ jobs, searchTerm, onSelectJob, onNewJob }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'jobNumber', direction: 'descending' });

  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs;
    const lowercasedTerm = searchTerm.toLowerCase();
    return jobs.filter(job => 
      (job.clientName && job.clientName.toLowerCase().includes(lowercasedTerm)) ||
      (job.customerCode && job.customerCode.toLowerCase().includes(lowercasedTerm)) ||
      job.title.toLowerCase().includes(lowercasedTerm) ||
      String(job.jobNumber).includes(lowercasedTerm)
    );
  }, [jobs, searchTerm]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedJobs = useMemo(() => {
    let sortableItems = [...filteredJobs];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof ProjectBudgetSummary] as any;
        const bValue = b[sortConfig.key as keyof ProjectBudgetSummary] as any;

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
  }, [filteredJobs, sortConfig]);

  if (jobs.length === 0 && !searchTerm) {
    return (
        <EmptyState 
            icon={Briefcase}
            title="案件がありません"
            message="最初の案件を登録して、ビジネスの管理を始めましょう。"
            action={{ label: "新規案件作成", onClick: onNewJob, icon: PlusCircle }}
        />
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
          <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
            <tr>
              <SortableHeader sortKey="jobNumber" label="案件番号" sortConfig={sortConfig} requestSort={requestSort}/>
              <SortableHeader sortKey="clientName" label="顧客名 / 案件名" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="dueDate" label="納期" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="totalQuantity" label="部数" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="totalAmount" label="売上高" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="totalCost" label="原価" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="grossMargin" label="限界利益" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="orderCount" label="受注件数" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => {
                const displayedQuantity = job.orderTotalQuantity ?? job.totalQuantity ?? job.quantity ?? 0;
                const totalAmount = job.orderTotalAmount ?? job.totalAmount ?? job.price ?? 0;
                const totalCost = job.orderTotalCost ?? job.totalCost ?? job.variableCost ?? 0;
                const grossMargin = job.grossMargin ?? (totalAmount - totalCost);
                const orderCount = job.orderCount ?? (job.orders?.length ?? 0);
                const relatedOrders = job.orders ?? [];
                const projectKey = job.projectCode ? String(job.projectCode) : job.jobNumber ? String(job.jobNumber) : '-';

                const customerLabel = job.clientName?.trim() || '顧客名未設定';
                const customerSubLabelParts = [] as string[];
                if (job.customerCode) customerSubLabelParts.push(`コード: ${job.customerCode}`);
                if (job.customerId) customerSubLabelParts.push(`ID: ${job.customerId}`);
                const customerSubLabel = customerSubLabelParts.join(' / ');

                return (
                    <React.Fragment key={job.id}>
                      <tr onClick={() => onSelectJob(job)} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer odd:bg-slate-50 dark:odd:bg-slate-800/50">
                        <td className="px-6 py-5 font-mono text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {job.jobNumber}
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-medium text-base text-slate-800 dark:text-slate-200">{customerLabel}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-sm">
                            {job.title || '案件名未設定'}
                          </div>
                          {customerSubLabel && (
                            <div className="text-xs text-slate-400 mt-1">
                              {customerSubLabel}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">{formatDate(job.dueDate)}</td>
                        <td className="px-6 py-5 whitespace-nowrap">{displayedQuantity.toLocaleString()}</td>
                        <td className="px-6 py-5 whitespace-nowrap font-semibold">{formatJPY(totalAmount)}</td>
                        <td className="px-6 py-5 whitespace-nowrap">{formatJPY(totalCost)}</td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  grossMargin >= 0
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                              }`}
                          >
                              {formatJPY(grossMargin)}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right font-mono">{orderCount.toLocaleString()}</td>
                        <td className="px-6 py-5">
                          <JobStatusBadge status={job.status} />
                        </td>
                      </tr>
                      {relatedOrders.length > 0 && (
                        <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-700/40">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">関連受注（orders）</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">project_code / jobNumber: {projectKey}</p>
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {relatedOrders.length}件
                              </span>
                            </div>
                            <div className="mt-3 overflow-x-auto">
                              <table className="min-w-full text-sm text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 rounded-lg">
                                <thead className="bg-white dark:bg-slate-800 text-slate-500 uppercase text-xs">
                                  <tr>
                                    <th className="px-3 py-2 text-left">受注ID</th>
                                    <th className="px-3 py-2 text-left">受注日</th>
                                    <th className="px-3 py-2 text-right">数量</th>
                                    <th className="px-3 py-2 text-right">単価</th>
                                    <th className="px-3 py-2 text-right">売上高</th>
                                    <th className="px-3 py-2 text-right">ステータス</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {relatedOrders.map(order => {
                                    const total = Number(order.quantity ?? 0) * Number(order.unitPrice ?? 0);
                                    return (
                                      <tr key={order.id} className="odd:bg-slate-50/60 dark:odd:bg-slate-900/30">
                                        <td className="px-3 py-2 font-mono text-xs">{order.id?.slice(0, 8)}...</td>
                                        <td className="px-3 py-2">{formatDate(order.orderDate)}</td>
                                        <td className="px-3 py-2 text-right">{Number(order.quantity ?? 0).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right">{formatJPY(order.unitPrice ?? 0)}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{formatJPY(total)}</td>
                                        <td className="px-3 py-2 text-right">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${orderStatusStyles[order.status] || 'bg-slate-200 text-slate-700'}`}>
                                            {order.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                );
              })}
             {sortedJobs.length === 0 && (
                <tr>
                    <td colSpan={9}>
                        <EmptyState 
                            icon={Briefcase}
                            title="検索結果がありません"
                            message="検索条件を変更して、もう一度お試しください。"
                        />
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(JobList);
