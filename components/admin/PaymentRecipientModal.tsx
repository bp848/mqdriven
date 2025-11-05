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
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{item ? '支払先編集' : '支払先作成'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* 基本情報 */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">基本情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="recipientCode" className={labelClass}>支払先コード *</label>
                  <input id="recipientCode" name="recipientCode" type="text" value={formData.recipientCode || ''} onChange={handleChange} className={inputClass} required />
                </div>
                <div className="flex items-center gap-2 md:col-start-2 md:row-start-1 md:justify-end md:pt-6">
                  <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive !== false} onChange={handleCheckboxChange} className="h-5 w-5 rounded" />
                  <label htmlFor="isActive" className="text-sm font-medium">有効</label>
                </div>
                <div>
                  <label htmlFor="companyName" className={labelClass}>会社名</label>
                  <input id="companyName" name="companyName" type="text" value={formData.companyName || ''} onChange={handleChange} className={inputClass} placeholder="株式会社〇〇" />
                </div>
                <div>
                  <label htmlFor="recipientName" className={labelClass}>受取人名</label>
                  <input id="recipientName" name="recipientName" type="text" value={formData.recipientName || ''} onChange={handleChange} className={inputClass} placeholder="山田 太郎" />
                </div>
              </div>
            </div>

            {/* 銀行口座情報 */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">銀行口座情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bankName" className={labelClass}>金融機関名</label>
                  <input id="bankName" name="bankName" type="text" value={formData.bankName || ''} onChange={handleChange} className={inputClass} placeholder="三菱UFJ銀行" />
                </div>
                <div>
                  <label htmlFor="bankBranch" className={labelClass}>支店名</label>
                  <input id="bankBranch" name="bankBranch" type="text" value={formData.bankBranch || ''} onChange={handleChange} className={inputClass} placeholder="新宿支店" />
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
              </div>
            </div>

            {/* マイナンバー */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">税務情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="myNumber" className={labelClass}>マイナンバー</label>
                  <input id="myNumber" name="myNumber" type="text" value={formData.myNumber || ''} onChange={handleChange} className={inputClass} placeholder="123456789012" maxLength={12} />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">12桁の個人番号または13桁の法人番号</p>
                </div>
              </div>
            </div>

            {/* 振分先候補 */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">振分先候補</h3>
              <div>
                <label htmlFor="allocationTargets" className={labelClass}>振分先候補（1行1件）</label>
                <textarea
                  id="allocationTargets"
                  value={allocationTargetsText}
                  onChange={event => setAllocationTargetsText(event.target.value)}
                  className={`${inputClass} h-32 resize-y`}
                  placeholder="本社 経理課&#10;営業サポートチーム&#10;製造部"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">経費精算時の振分先として表示される候補を入力してください</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            キャンセル
          </button>
          <button 
            type="submit" 
            disabled={isSaving} 
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentRecipientModal;
