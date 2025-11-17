import React, { useState, useMemo } from 'react';
import { Job, PurchaseOrder, PurchaseOrderStatus, SortConfig } from '../types';
import JobStatusBadge from './JobStatusBadge';
import { formatJPY, formatDate } from '../utils';
import EmptyState from './ui/EmptyState';
import { Briefcase, PlusCircle } from './Icons';
import SortableHeader from './ui/SortableHeader';

interface JobListProps {
  jobs: Job[];
  searchTerm: string;
  onSelectJob: (job: Job) => void;
  onNewJob: () => void;
  ordersByProject?: Record<string, PurchaseOrder[]>;
}

const orderStatusStyles: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.Ordered]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PurchaseOrderStatus.Received]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PurchaseOrderStatus.Cancelled]: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

const JobList: React.FC<JobListProps> = ({ jobs, searchTerm, onSelectJob, onNewJob, ordersByProject }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'jobNumber', direction: 'descending' });

  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs;
    const lowercasedTerm = searchTerm.toLowerCase();
    return jobs.filter(job => 
      job.clientName.toLowerCase().includes(lowercasedTerm) ||
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
        const aValue = a[sortConfig.key as keyof Job] as any;
        const bValue = b[sortConfig.key as keyof Job] as any;

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
              <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
                <React.Fragment key={job.id}>
                  <tr onClick={() => onSelectJob(job)} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer odd:bg-slate-50 dark:odd:bg-slate-800/50">
                    <td className="px-6 py-5 font-mono text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {job.jobNumber}
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-medium text-base text-slate-800 dark:text-slate-200">{job.clientName}</div>
                      <div className="text-slate-500 dark:text-slate-400">{job.title}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">{formatDate(job.dueDate)}</td>
                    <td className="px-6 py-5 whitespace-nowrap">{(job.totalQuantity ?? job.quantity ?? 0).toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap font-semibold">{formatJPY(job.totalAmount ?? job.price ?? 0)}</td>
                    <td className="px-6 py-5 whitespace-nowrap">{formatJPY(job.totalCost ?? job.variableCost ?? 0)}</td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              (job.grossMargin ?? 0) >= 0
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                          }`}
                      >
                          {formatJPY(job.grossMargin ?? (job.totalAmount ?? 0) - (job.totalCost ?? 0))}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <JobStatusBadge status={job.status} />
                    </td>
                  </tr>
                  {(() => {
                    const projectKey = job.projectCode
                        ? String(job.projectCode)
                        : job.jobNumber
                            ? String(job.jobNumber)
                            : '';
                    const relatedOrders = projectKey && ordersByProject ? ordersByProject[projectKey] : undefined;
                    if (!relatedOrders || relatedOrders.length === 0) return null;
                    return (
                        <tr className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-700/40">
                          <td colSpan={8} className="px-6 py-4">
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
                                    const total = (order.quantity ?? 0) * (order.unitPrice ?? 0);
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
                    );
                  })()}
                </React.Fragment>
              ))}
             {sortedJobs.length === 0 && (
                <tr>
                    <td colSpan={7}>
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
