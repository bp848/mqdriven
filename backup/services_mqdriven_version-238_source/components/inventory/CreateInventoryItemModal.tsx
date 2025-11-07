import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../../types';
import { Loader, X, Save } from '../Icons';

interface CreateInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<InventoryItem>) => Promise<void>;
  item: InventoryItem | null;
}

const CreateInventoryItemModal: React.FC<CreateInventoryItemModalProps> = ({ isOpen, onClose, onSave, item }) => {
    const [formData, setFormData] = useState<Partial<InventoryItem>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    
    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            setFormData({ name: '', category: '', quantity: 0, unit: '', unitPrice: 0 });
        }
    }, [item, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.category || !formData.unit) {
            setError('品目名、カテゴリ、単位は必須です。');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await onSave(formData);
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const total = (formData.quantity || 0) * (formData.unitPrice || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold">{item ? '在庫品目編集' : '新規在庫品目作成'}</h2>
                    <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className={labelClass}>品目名 *</label>
                            <input id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required className={inputClass} />
                        </div>
                         <div>
                            <label htmlFor="category" className={labelClass}>カテゴリ *</label>
                            <input id="category" name="category" type="text" value={formData.category || ''} onChange={handleChange} required className={inputClass} placeholder="用紙、インクなど"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className={labelClass}>数量 *</label>
                            <input id="quantity" name="quantity" type="number" value={formData.quantity || 0} onChange={handleChange} required className={inputClass} />
                        </div>
                        <div>
                           <label htmlFor="unit" className={labelClass}>単位 *</label>
                            <input id="unit" name="unit" type="text" value={formData.unit || ''} onChange={handleChange} required className={inputClass} placeholder="枚, kg, L" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="unitPrice" className={labelClass}>単価 *</label>
                        <input id="unitPrice" name="unitPrice" type="number" value={formData.unitPrice || 0} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div className="text-right pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500">在庫金額: </span>
                        <span className="text-xl font-bold">¥{total.toLocaleString()}</span>
                    </div>
                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} disabled={isSaving} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                    <button type="submit" disabled={isSaving} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-slate-400">
                        {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateInventoryItemModal;