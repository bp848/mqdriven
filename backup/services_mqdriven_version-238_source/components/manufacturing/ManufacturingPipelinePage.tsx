import React, { useMemo } from 'react';
import { Job, ManufacturingStatus } from '../../types';

interface ManufacturingPipelinePageProps {
  jobs: Job[];
  onUpdateJob: (jobId: string, updatedData: Partial<Job>) => Promise<void>;
  onCardClick: (job: Job) => void;
}

const COLUMNS_ORDER: ManufacturingStatus[] = [
  ManufacturingStatus.OrderReceived,
  ManufacturingStatus.DataCheck,
  ManufacturingStatus.Prepress,
  ManufacturingStatus.Printing,
  ManufacturingStatus.Finishing,
  ManufacturingStatus.AwaitingShipment,
  ManufacturingStatus.Delivered,
];

const JobCard: React.FC<{ job: Job; onClick: () => void; }> = ({ job, onClick }) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('jobId', job.id);
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
    };

    const margin = job.price - job.variableCost;

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={onClick}
            className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200"
        >
            <h4 className="font-bold text-slate-800 dark:text-white truncate">{job.title}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">{job.clientName}</p>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">¥{margin.toLocaleString()}</p>
                <p className="text-xs text-slate-400">納期: {job.dueDate}</p>
            </div>
        </div>
    );
};


const ManufacturingPipelinePage: React.FC<ManufacturingPipelinePageProps> = ({ jobs, onUpdateJob, onCardClick }) => {
    
    const handleDropOnColumn = (e: React.DragEvent<HTMLDivElement>, newStatus: ManufacturingStatus) => {
        e.preventDefault();
        const jobId = e.dataTransfer.getData('jobId');
        const droppedJob = jobs.find(j => j.id === jobId);
        
        if (droppedJob && droppedJob.manufacturingStatus !== newStatus) {
            onUpdateJob(jobId, { manufacturingStatus: newStatus });
        }
        e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const handleDragLeaveColumn = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const jobsByStatus = useMemo(() => {
        return COLUMNS_ORDER.reduce((acc, status) => {
            if (status === ManufacturingStatus.OrderReceived) {
                // 「受注」カラムには、ステータスが「受注」のものと、ステータスが未設定のものを両方含める
                acc[status] = jobs.filter(j => !j.manufacturingStatus || j.manufacturingStatus === status);
            } else {
                acc[status] = jobs.filter(j => j.manufacturingStatus === status);
            }
            return acc;
        }, {} as Record<ManufacturingStatus, Job[]>);
    }, [jobs]);

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-8 px-8 h-full">
            {COLUMNS_ORDER.map(status => {
                const jobsInColumn = jobsByStatus[status] || [];
                const totalP = jobsInColumn.reduce((sum, job) => sum + job.price, 0);
                const totalM = jobsInColumn.reduce((sum, job) => sum + (job.price - job.variableCost), 0);
                const totalQ = jobsInColumn.reduce((sum, job) => sum + job.quantity, 0);

                return (
                    <div
                        key={status}
                        onDrop={(e) => handleDropOnColumn(e, status)}
                        onDragOver={handleDragOverColumn}
                        onDragLeave={handleDragLeaveColumn}
                        className="w-80 flex-shrink-0 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 transition-colors duration-200 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-2 px-1 flex-shrink-0">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{status}</h3>
                            <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{jobsInColumn.length}</span>
                        </div>

                        <div className="flex-shrink-0 mb-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-xs">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                <div className="font-semibold text-slate-500">案件数:</div>
                                <div className="text-right font-bold text-slate-700 dark:text-slate-200">{jobsInColumn.length} 件</div>

                                <div className="font-semibold text-slate-500">数量 (Q):</div>
                                <div className="text-right font-bold text-slate-700 dark:text-slate-200">{totalQ.toLocaleString()}</div>
                                
                                <div className="font-semibold text-slate-500">売上 (P):</div>
                                <div className="text-right font-bold text-slate-700 dark:text-slate-200">¥{totalP.toLocaleString()}</div>
                                
                                <div className="font-semibold text-slate-500">利益 (M):</div>
                                <div className="text-right font-bold text-blue-600 dark:text-blue-400">¥{totalM.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                            {jobsInColumn.map(job => (
                                <JobCard key={job.id} job={job} onClick={() => onCardClick(job)} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ManufacturingPipelinePage;