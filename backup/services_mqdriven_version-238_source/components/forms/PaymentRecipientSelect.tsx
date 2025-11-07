import React, { useEffect, useMemo, useState } from 'react';
import { getPaymentRecipients } from '../../services/dataService';
import { PaymentRecipient } from '../../types';

type Props = {
  value?: string; // id
  onChange: (id: string) => void;
  required?: boolean;
  name?: string;
  id?: string;
};

export default function PaymentRecipientSelect({ value, onChange, required, name = 'paymentRecipientId', id = 'paymentRecipientId' }: Props) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<PaymentRecipient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPaymentRecipients(q).then(setList).finally(() => setLoading(false));
  }, [q]);

  const options = useMemo(() => list, [list]);

  const selectClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500";
  const inputClass = "w-full text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500";


  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="支払先検索（社名）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={inputClass}
        autoComplete="organization"
      />
      <select
        id={id}
        name={name}
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className={selectClass}
      >
        <option value="">支払先を選択</option>
        {options.map(v => (
          <option key={v.id} value={v.id}>
            {v.companyName ?? ''} {v.recipientName ? `（${v.recipientName}）` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}