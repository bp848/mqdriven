import React, { useState } from 'react';
import { AccountItem } from '../../types';
import { Loader, Save, X } from '../Icons';

interface AccountItemModalProps {
  item: AccountItem | null;
  onClose: () => void;
  onSave: (item: Partial<AccountItem>) => Promise<void>;
}

const AccountItemModal: React.FC<AccountItemModalProps> = ({ item, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<AccountItem>>(item || { code: '', name: '', categoryCode: '', isActive: true, sortOrder: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value) }));
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
          <h2 className="text-xl font-bold">{item ? '勘定科目編集' : '勘定科目作成'}</h2>
          <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="code" className={labelClass}>コード *</label>
            <input id="code" name="code" type="text" value={formData.code || ''} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="name" className={labelClass}>名称 *</label>
            <input id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="categoryCode" className={labelClass}>カテゴリコード</label>
            <input id="categoryCode" name="categoryCode" type="text" value={formData.categoryCode || ''} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sortOrder" className={labelClass}>表示順</label>
            <input id="sortOrder" name="sortOrder" type="number" value={formData.sortOrder || 0} onChange={handleChange} className={inputClass} />
          </div>
          <div className="flex items-center gap-2">
            <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange} className="h-4 w-4 rounded" />
            <label htmlFor="isActive">有効</label>
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

export default AccountItemModal;
