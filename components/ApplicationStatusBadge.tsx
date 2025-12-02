import React from 'react';

interface ApplicationStatusBadgeProps {
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
}

const statusStyles: Record<ApplicationStatusBadgeProps['status'], { text: string; className: string }> = {
  draft: { text: '下書き', className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
  pending_approval: { text: '承認待ち', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  approved: { text: '承認済', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  rejected: { text: '却下', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  cancelled: { text: '取下げ', className: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
};

const ApplicationStatusBadge: React.FC<ApplicationStatusBadgeProps> = ({ status }) => {
  const { text, className } = statusStyles[status] || statusStyles.draft;
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {text}
    </span>
  );
};

export default ApplicationStatusBadge;
