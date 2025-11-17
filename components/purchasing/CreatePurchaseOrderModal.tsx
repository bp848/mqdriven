import React, { useState } from 'react';
import { PaymentRecipient, PurchaseOrder, PurchaseOrderStatus } from '../../types';
import { Loader, X, Save } from '../Icons';
import SupplierSearchSelect from '../forms/SupplierSearchSelect';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPurchaseOrder: (order: Omit<PurchaseOrder, 'id'>) => Promise<void>;
  paymentRecipients: PaymentRecipient[];
  onCreatePaymentRecipient: (input: Partial<PaymentRecipient>) => Promise<PaymentRecipient>;
}

const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({ isOpen, onClose, onAddPurchaseOrder, paymentRecipients, onCreatePaymentRecipient }) => {
    const [formData, setFormData] = useState({
        supplierName: '',
        itemName: '',
        orderDate: new Date().toISOString().split('T')[0],
        quantity: 1,
        unitPrice: 0,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId || !formData.supplierName || !formData.itemName || formData.quantity <= 0 || formData.unitPrice <= 0) {
            setError('発注先とすべての項目を正しく入力してください。');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await onAddPurchaseOrder({
                ...formData,
                paymentRecipientId: selectedSupplierId,
                status: PurchaseOrderStatus.Ordered,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const total = formData.quantity * formData.unitPrice;

    const handleSupplierChange = (id: string, supplier?: PaymentRecipient | null) => {
        setSelectedSupplierId(id);
        setFormData(prev => ({
            ...prev,
            supplierName: supplier?.companyName || supplier?.recipientName || prev.supplierName,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold">新規発注作成</h2>
                    <button type="button" onClick={onClose}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="supplierName" className={labelClass}>発注先 *</label>
                            <SupplierSearchSelect
                                suppliers={paymentRecipients}
                                value={selectedSupplierId}
                                onChange={handleSupplierChange}
                                onCreateSupplier={async (name) => {
                                    const created = await onCreatePaymentRecipient({ companyName: name });
                                    handleSupplierChange(created.id, created);
                                    return created;
                                }}
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label htmlFor="orderDate" className={labelClass}>発注日 *</label>
                            <input id="orderDate" name="orderDate" type="date" value={formData.orderDate} onChange={handleChange} required className={inputClass} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="itemName" className={labelClass}>品目 *</label>
                        <input id="itemName" name="itemName" type="text" value={formData.itemName} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className={labelClass}>数量 *</label>
                            <input id="quantity" name="quantity" type="number" value={formData.quantity} onChange={handleChange} required className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="unitPrice" className={labelClass}>単価 *</label>
                            <input id="unitPrice" name="unitPrice" type="number" value={formData.unitPrice} onChange={handleChange} required className={inputClass} />
                        </div>
                    </div>
                    <div className="text-right pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500">合計金額: </span>
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

export default CreatePurchaseOrderModal;
