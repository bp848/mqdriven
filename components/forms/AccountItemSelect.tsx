import React, { useEffect, useMemo, useState } from 'react';
import { MasterAccountItem } from '../../types';
import { normalizeSearchText } from '../../utils';

const DEFAULT_LIMIT = 20;

type Props = {
  accountItems: MasterAccountItem[];
  value?: string; // id
  onChange: (id: string) => void;
  required?: boolean;
  name?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
};

const formatAccountItemLabel = (item: MasterAccountItem): string => {
    return `${item.code}：${item.name}`;
};

export default function AccountItemSelect({
  accountItems,
  value,
  onChange,
  required,
  name = 'accountItemId',
  id = 'accountItemId',
  disabled,
  placeholder = '勘定科目コード/名称で検索',
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLimit(DEFAULT_LIMIT);
  }, [debouncedQuery]);

  const selectedItem = useMemo(
    () => accountItems.find(item => item.id === value) ?? null,
    [accountItems, value]
  );

  useEffect(() => {
    if (selectedItem) {
      setQuery(formatAccountItemLabel(selectedItem));
    } else if (!value) {
        setQuery('');
    }
  }, [selectedItem, value]);

  const normalizedQuery = normalizeSearchText(debouncedQuery);

  const { visibleItems, hasMore } = useMemo(() => {
    if (!normalizedQuery) {
      return {
        visibleItems: accountItems.slice(0, limit),
        hasMore: accountItems.length > limit,
      };
    }
    const prefix: MasterAccountItem[] = [];
    const partial: MasterAccountItem[] = [];
    
    accountItems.forEach(item => {
        const target = normalizeSearchText(
            [item.code, item.name].filter(Boolean).join(' ')
        );
        if (target.startsWith(normalizedQuery)) {
            prefix.push(item);
        } else if (target.includes(normalizedQuery)) {
            partial.push(item);
        }
    });

    const combined = [...prefix, ...partial];
    return {
      visibleItems: combined.slice(0, limit),
      hasMore: combined.length > limit,
    };
  }, [accountItems, normalizedQuery, limit]);

  const inputClass = 'w-full text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500';
  const selectClass = 'w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-1">
        <input
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className={inputClass}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
        />
        <select
            id={id}
            name={name}
            value={value ?? ''}
            required={required}
            onChange={event => {
                const item = accountItems.find(i => i.id === event.target.value) ?? null;
                if (item) {
                    setQuery(formatAccountItemLabel(item));
                }
                onChange(event.target.value);
            }}
            disabled={disabled}
            className={selectClass}
        >
            <option value="">勘定科目を選択</option>
            {visibleItems.map(item => (
                <option key={item.id} value={item.id}>
                    {formatAccountItemLabel(item)}
                </option>
            ))}
        </select>
        {!disabled && visibleItems.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">候補が見つかりません。</p>
        )}
        {hasMore && (
            <button
                type="button"
                onClick={() => setLimit(prev => prev + DEFAULT_LIMIT)}
                className="text-xs text-blue-600 hover:text-blue-700"
            >
                さらに表示
            </button>
        )}
    </div>
  );
}