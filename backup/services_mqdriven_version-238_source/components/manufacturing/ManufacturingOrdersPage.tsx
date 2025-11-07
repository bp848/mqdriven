import React, { useMemo } from 'react';
import { Job, ManufacturingStatus } from '../../types';
import { HardHat } from '../Icons';
import EmptyState from '../ui/EmptyState';
import { formatDate } from '../../utils';

interface ManufacturingOrdersPageProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
}

const ManufacturingOrdersPage: React.FC<ManufacturingOrdersPageProps> = ({ jobs, onSelectJob }) => {
    
    const manufacturingJobs = useMemo(() => {
        return jobs.filter(job => 
            job.manufacturingStatus && 
            job.manufacturingStatus !== ManufacturingStatus.Delivered
        ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [jobs]);

    if (manufacturingJobs.length === 0) {
        return (
            <EmptyState 
                icon={HardHat}
                title="製造中の案件はありません"
                message="案件が受注されると、ここに製造指示が表示されます。"
            />
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                            <th scope="col" className="px-6 py-3 font-medium">案件番号</th>
                            <th scope="col" className="px-6 py-3 font-medium">顧客名 / 案件名</th>
                            <th scope="col" className="px-6 py-3 font-medium">数量</th>
                            <th scope="col" className="px-6 py-3 font-medium">仕様</th>
                            <th scope="col" className="px-6 py-3 font-medium">納期</th>
                            <th scope="col" className="px-6 py-3 font-medium">現在の工程</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {manufacturingJobs.map(job => (
                            <tr key={job.id} onClick={() => onSelectJob(job)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                <td className="px-6 py-4 font-mono">{job.jobNumber}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{job.clientName}</div>
                                    <div className="text-sm">{job.title}</div>
                                </td>
                                <td className="px-6 py-4">{job.quantity.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm">{job.paperType}, {job.finishing}</td>
                                <td className="px-6 py-4">{formatDate(job.dueDate)}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                        {job.manufacturingStatus}
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

export default ManufacturingOrdersPage;