
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-center gap-6">
      <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
