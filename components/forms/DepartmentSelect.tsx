import React, { useEffect, useState } from 'react';
import { getDepartments } from '../../services/dataService';
import { Department } from '../../types';

type Props = {
  value?: string; // id
  onChange: (id: string) => void;
  required?: boolean;
  name?: string;
  id?: string;
};

export default function DepartmentSelect({ value, onChange, required, name = 'departmentId', id = 'departmentId' }: Props) {
  const [list, setList] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartments().then(setList).finally(() => setLoading(false));
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
      <option value="">部門を選択</option>
      {list.map(d => (
        <option key={d.id} value={d.id}>{d.name}</option>
      ))}
    </select>
  );
}