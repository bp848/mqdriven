
import React from 'react';
import { ArrowUpDown, ChevronDown } from '../Icons';

type SortableHeaderSortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: SortableHeaderSortConfig | null;
  requestSort: (key: string) => void;
  className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ sortKey, label, sortConfig, requestSort, className }) => {
  const isActive = sortConfig?.key === sortKey;
  const isAscending = sortConfig?.direction === 'ascending';

  return (
    <th scope="col" className={`px-6 py-3 font-medium ${className || ''}`}>
      <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 group">
        <span className={isActive ? 'font-bold text-slate-800 dark:text-slate-100' : ''}>{label}</span>
        <div className="w-4 h-4">
          {isActive ? (
            <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-200 transition-transform duration-200 ${isAscending ? 'rotate-180' : 'rotate-0'}`} />
          ) : (
            <ArrowUpDown className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>
    </th>
  );
};

export default SortableHeader;
