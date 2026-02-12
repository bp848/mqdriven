import React, { useEffect, useState } from 'react';
import { Briefcase, Moon, Search, Sun, Users } from './Icons';
import { applyThemePreference, setStoredThemePreference } from '../src/theme';

type HeaderAction = {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
  disabled?: boolean;
  tooltip?: string;
};

type SearchSuggestion = {
  id: string;
  value: string;
  label: string;
  subLabel?: string;
  type?: 'customer' | 'job';
};

const SUGGESTION_ICON_MAP: Record<'customer' | 'job', React.ElementType> = {
  customer: Users,
  job: Briefcase,
};

interface HeaderProps {
  title: string;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    suggestions?: SearchSuggestion[];
    onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
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
        className={`flex items-center gap-2 font-semibold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors disabled:bg-slate-400 disabled:text-white disabled:cursor-not-allowed ${baseClasses}`}
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!search) {
      setIsSearchFocused(false);
    }
  }, [search]);


  useEffect(() => {
    const syncThemeState = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('storage', syncThemeState);
    return () => window.removeEventListener('storage', syncThemeState);
  }, []);

  const handleToggleTheme = () => {
    const nextIsDark = !isDarkTheme;
    const nextPreference = nextIsDark ? 'dark' : 'light';
    setStoredThemePreference(nextPreference);
    applyThemePreference(nextPreference);
    setIsDarkTheme(nextIsDark);
  };

  const timeString = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const suggestions = search?.suggestions ?? [];
  const showSuggestions = Boolean(
    search && search.value.trim() && suggestions.length > 0 && isSearchFocused
  );

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (!search) return;
    search.onChange(suggestion.value);
    search.onSuggestionSelect?.(suggestion);
    setIsSearchFocused(false);
  };

  return (
    <header className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-700">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-white capitalize">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
          {timeString}
        </div>
        <button
          type="button"
          onClick={handleToggleTheme}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80"
          aria-label={isDarkTheme ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        >
          {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDarkTheme ? 'ライト' : 'ダーク'}
        </button>
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
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-80 text-base bg-slate-100 dark:bg-slate-700/50 border border-transparent dark:border-transparent text-slate-900 dark:text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {showSuggestions && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 max-h-72 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  サジェスト候補
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {suggestions.map((suggestion) => {
                    const Icon =
                      (suggestion.type && SUGGESTION_ICON_MAP[suggestion.type]) || Search;
                    return (
                      <li key={suggestion.id}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700/60 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionSelect(suggestion);
                          }}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {suggestion.label}
                            </p>
                            {suggestion.subLabel && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {suggestion.subLabel}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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
