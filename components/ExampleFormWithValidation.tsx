import React, { useState } from 'react';
import { Send } from './Icons';
import FriendlyErrorDisplay from './FriendlyErrorDisplay';
import {
  validateEmail,
  validatePostalCode,
  validatePhoneNumber,
  validateAmount,
  validateRequired,
  validateDate,
  ValidationError,
} from '../utils/friendlyValidation';

/**
 * バリデーション付きフォームの使用例
 * 経費精算フォームを例に実装
 */
const ExampleFormWithValidation: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    date: '',
    amount: '',
    purpose: '',
    postalCode: '',
    phoneNumber: '',
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: ValidationError[] = [];

    // 各項目をバリデーション
    const nameError = validateRequired(formData.name, '氏名');
    if (nameError) validationErrors.push(nameError);

    const emailError = validateEmail(formData.email);
    if (emailError) validationErrors.push(emailError);

    const dateError = validateDate(formData.date, '使用日');
    if (dateError) validationErrors.push(dateError);

    const amountError = validateAmount(formData.amount, '金額');
    if (amountError) validationErrors.push(amountError);

    const purposeError = validateRequired(formData.purpose, '使用目的');
    if (purposeError) validationErrors.push(purposeError);

    const postalCodeError = validatePostalCode(formData.postalCode);
    if (postalCodeError) validationErrors.push(postalCodeError);

    const phoneNumberError = validatePhoneNumber(formData.phoneNumber);
    if (phoneNumberError) validationErrors.push(phoneNumberError);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setShowErrors(true);
    } else {
      // バリデーション成功
      alert('✅ 送信成功！全ての項目が正しく入力されています。');
      console.log('Form data:', formData);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
      <h2 className="text-2xl font-bold mb-6">経費精算フォーム（バリデーション例）</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 氏名 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            氏名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="山田太郎"
          />
          <p className="text-xs text-slate-500 mt-1">💡 あなたの名前を入力してください</p>
        </div>

        {/* メールアドレス */}
        <div>
          <label className="block text-sm font-medium mb-2">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="yamada@example.com"
          />
          <p className="text-xs text-slate-500 mt-1">💡 @マークを含むメールアドレスを入力してください</p>
        </div>

        {/* 使用日 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            使用日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">💡 カレンダーから日付を選択してください</p>
        </div>

        {/* 金額 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            金額 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="5000"
          />
          <p className="text-xs text-slate-500 mt-1">💡 数字だけを入力してください（例：5000 または 5,000）</p>
        </div>

        {/* 使用目的 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            使用目的 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="タクシー代"
            rows={3}
          />
          <p className="text-xs text-slate-500 mt-1">💡 何に使ったかを入力してください</p>
        </div>

        {/* 郵便番号 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            郵便番号 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="123-4567 または 1234567"
          />
          <p className="text-xs text-slate-500 mt-1">💡 ハイフン（-）は入れても入れなくてもOKです</p>
        </div>

        {/* 電話番号 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            電話番号 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="03-1234-5678 または 090-1234-5678"
          />
          <p className="text-xs text-slate-500 mt-1">💡 ハイフン（-）は入れても入れなくてもOKです</p>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <Send className="w-6 h-6" />
          送信する
        </button>
      </form>

      {/* エラー表示 */}
      {showErrors && (
        <FriendlyErrorDisplay
          errors={errors}
          onClose={() => setShowErrors(false)}
        />
      )}
    </div>
  );
};

export default ExampleFormWithValidation;
