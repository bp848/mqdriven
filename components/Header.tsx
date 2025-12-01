import React, { useEffect, useState } from 'react';
import { Search } from './Icons';

type HeaderAction = {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
  disabled?: boolean;
  tooltip?: string;
};

interface HeaderProps {
  title: string;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
}

const ActionButton: React.FC<{ action: HeaderAction; variant?: 'primary' | 'secondary' }> = ({
  action,
  variant = 'primary',
}) => {
  const baseClasses =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50';
  return (
    <div className="relative group">
      <button
        onClick={action.onClick}
        disabled={action.disabled}
        className={`flex items-center gap-2 font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:text-white disabled:cursor-not-allowed disabled:transform-none ${baseClasses}`}
      >
        {action.icon && <action.icon className="w-5 h-5" />}
        {action.label}
      </button>
      {action.disabled && action.tooltip && (
        <div className="absolute bottom-full mb-2 w-64 bg-slate-800 text-white text-center text-sm rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none left-1/2 -translate-x-1/2 z-10">
          {action.tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ title, primaryAction, secondaryActions, search }) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const timeString = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-700">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white capitalize">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
          {timeString}
        </div>
        {search && (
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder={search.placeholder}
                    value={search.value}
                    onChange={(e) => search.onChange(e.target.value)}
                    className="w-80 text-base bg-slate-100 dark:bg-slate-700/50 border border-transparent dark:border-transparent text-slate-900 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
        )}
        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="flex items-center gap-2">
            {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
            {secondaryActions?.map(action => (
              <ActionButton key={action.label} action={action} variant="secondary" />
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
