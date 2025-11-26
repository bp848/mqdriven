import React, { useEffect, useState } from 'react';
import { Search } from './Icons';

interface HeaderProps {
  title: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
    disabled?: boolean;
    tooltip?: string;
  };
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
}

const Header: React.FC<HeaderProps> = ({ title, primaryAction, search }) => {
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
        {primaryAction && (
          <div className="relative group">
              <button
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none"
              >
                {primaryAction.icon && <primaryAction.icon className="w-5 h-5" />}
                {primaryAction.label}
              </button>
              {primaryAction.disabled && primaryAction.tooltip && (
                  <div className="absolute bottom-full mb-2 w-64 bg-slate-800 text-white text-center text-sm rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none left-1/2 -translate-x-1/2 z-10">
                      {primaryAction.tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
                  </div>
              )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;