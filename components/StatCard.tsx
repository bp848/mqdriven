
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center gap-4 sm:gap-6">
      <div className="bg-blue-100 dark:bg-blue-900/50 p-3 sm:p-4 rounded-full shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight break-words">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
