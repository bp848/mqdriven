import React, { useState } from 'react';
import { PaymentRecipient } from '../../types';
import { Loader, Save, X } from '../Icons';

interface PaymentRecipientModalProps {
  item: PaymentRecipient | null;
  onClose: () => void;
  onSave: (item: Partial<PaymentRecipient>) => Promise<void>;
}

const PaymentRecipientModal: React.FC<PaymentRecipientModalProps> = ({ item, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<PaymentRecipient>>(item || { 
    recipientCode: '', 
    companyName: '', 
    recipientName: '', 
    bankName: '', 
    bankBranch: '', 
    bankAccountType: null,
    bankAccountNumber: '', 
    myNumber: '',
    isActive: true 
  });
  const [allocationTargetsText, setAllocationTargetsText] = useState<string>(() =>
    (item?.allocationTargets ?? []).map(target => target.name).join('\n')
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || null }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const normalizeAllocationTargets = (): PaymentRecipient['allocationTargets'] => {
    const lines = allocationTargetsText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    const existingTargets = item?.allocationTargets ?? [];
    return lines.map((name, index) => ({
      id: existingTargets[index]?.id,
      name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({
      ...formData,
      allocationTargets: normalizeAllocationTargets(),
    });
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
          <div>
            <label htmlFor="bankName" className={labelClass}>金融機関名</label>
            <input id="bankName" name="bankName" type="text" value={formData.bankName || ''} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="bankBranch" className={labelClass}>支店名</label>
            <input id="bankBranch" name="bankBranch" type="text" value={formData.bankBranch || ''} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="bankAccountType" className={labelClass}>口座種別</label>
            <select id="bankAccountType" name="bankAccountType" value={formData.bankAccountType || ''} onChange={handleChange} className={inputClass}>
              <option value="">選択してください</option>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </div>
          <div>
            <label htmlFor="bankAccountNumber" className={labelClass}>口座番号</label>
            <input id="bankAccountNumber" name="bankAccountNumber" type="text" value={formData.bankAccountNumber || ''} onChange={handleChange} className={inputClass} placeholder="1234567" />
          </div>
          <div>
            <label htmlFor="myNumber" className={labelClass}>マイナンバー</label>
            <input id="myNumber" name="myNumber" type="text" value={formData.myNumber || ''} onChange={handleChange} className={inputClass} placeholder="123456789012" maxLength={12} />
          </div>
          <div>
            <label htmlFor="allocationTargets" className={labelClass}>振分先候補（1行1件）</label>
            <textarea
              id="allocationTargets"
              value={allocationTargetsText}
              onChange={event => setAllocationTargetsText(event.target.value)}
              className={`${inputClass} h-24 resize-y`}
              placeholder="本社 経理課\n営業サポートチーム"
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive !== false} onChange={handleCheckboxChange} className="h-4 w-4 rounded" />
            <label htmlFor="isActive" className="text-sm">有効</label>
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
