import React, { useState } from 'react';
import { Title } from '../../types';
import { Loader, Save, X } from '../Icons';

interface TitleModalProps {
  item: Title | null;
  onClose: () => void;
  onSave: (item: Partial<Title>) => Promise<void>;
}

const TitleModal: React.FC<TitleModalProps> = ({ item, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Title>>(item || { name: '', isActive: true });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
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
          <h2 className="text-xl font-bold">{item ? '役職 編集' : '役職 作成'}</h2>
          <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>役職名 *</label>
            <input id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required className={inputClass} />
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

export default TitleModal;