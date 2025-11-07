import React, { useEffect, useState } from 'react';
import { getActiveAccountItems } from '../../services/dataService';
import { MasterAccountItem } from '../../types';

type Props = {
  value?: string; // id
  onChange: (id: string) => void;
  required?: boolean;
  name?: string;
  id?: string;
};

export default function AccountItemSelect({ value, onChange, required, name = 'accountItemId', id = 'accountItemId' }: Props) {
  const [items, setItems] = useState<MasterAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveAccountItems().then(setItems).finally(() => setLoading(false));
  }, []);

  return (
    <select
      id={id}
      name={name}
      required={required}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">勘定科目を選択</option>
      {items.map(it => (
        <option key={it.id} value={it.id}>
          {it.code}：{it.name}
        </option>
      ))}
    </select>
  );
}