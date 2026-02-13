
import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  message?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message, description, action }) => {
  const bodyText = message ?? description ?? '';
  return (
    <div className="text-center py-16 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
      <div className="inline-block p-4 bg-slate-200 dark:bg-slate-700 rounded-full">
        <Icon className="w-8 h-8 text-slate-500 dark:text-slate-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
      <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{bodyText}</p>
      {action && (
        <div className="mt-6">
          <button
            onClick={action.onClick}
            className="flex items-center justify-center mx-auto gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700"
          >
            {action.icon && <action.icon className="w-5 h-5" />}
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
