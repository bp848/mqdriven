import React, { useState } from 'react';
import { PaymentRecipient } from '../../types';
import { Loader, Save, X } from '../Icons';

interface PaymentRecipientModalProps {
  item: PaymentRecipient | null;
  onClose: () => void;
  onSave: (item: Partial<PaymentRecipient>) => Promise<void>;
}

const PaymentRecipientModal: React.FC<PaymentRecipientModalProps> = ({ item, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<PaymentRecipient>>(item || { recipientCode: '', companyName: '', recipientName: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{item ? '支払先編集' : '支払先作成'}</h2>
          <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="recipientCode" className={labelClass}>支払先コード</label>
            <input id="recipientCode" name="recipientCode" type="text" value={formData.recipientCode || ''} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="companyName" className={labelClass}>会社名</label>
            <input id="companyName" name="companyName" type="text" value={formData.companyName || ''} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="recipientName" className={labelClass}>受取人名</label>
            <input id="recipientName" name="recipientName" type="text" value={formData.recipientName || ''} onChange={handleChange} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-4 p-6 border-t">
          <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
          <button type="submit" disabled={isSaving} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2">
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            保存
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentRecipientModal;
