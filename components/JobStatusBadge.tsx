import React from 'react';
import { JobStatus } from '../types';

interface JobStatusBadgeProps {
  status: JobStatus;
}

const statusStyles: Record<JobStatus, string> = {
  [JobStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [JobStatus.InProgress]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [JobStatus.Completed]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [JobStatus.Cancelled]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ status }) => {
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full inline-block text-center ${statusStyles[status]}`}>
      {status}
    </span>
  );
};

export default JobStatusBadge;