import React, { useState } from 'react';
import { Users, AlertTriangle, Loader } from './Icons';

interface EmployeeNumberModalProps {
  email: string;
  userName: string;
  onSubmit: (employeeNumber: string) => Promise<void>;
  onCancel: () => void;
}

const EmployeeNumberModal: React.FC<EmployeeNumberModalProps> = ({
  email,
  userName,
  onSubmit,
  onCancel,
}) => {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeNumber.trim()) {
      setError('社員番号を入力してください');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      await onSubmit(employeeNumber.trim());
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">初回ログイン設定</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            ようこそ、<strong>{userName}</strong> さん
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">アカウント設定が必要です</p>
                <p>
                  初回ログインのため、社員番号の登録が必要です。<br />
                  社員番号がわからない場合は、システム管理者にお問い合わせください。
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-500 dark:text-slate-400"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="employeeNumber" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
              社員番号 <span className="text-red-500">*</span>
            </label>
            <input
              id="employeeNumber"
              type="text"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="例: 12345"
              autoFocus
              disabled={isSubmitting}
              className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !employeeNumber.trim()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader className="w-5 h-5 animate-spin" />}
              {isSubmitting ? '登録中...' : '登録してログイン'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeNumberModal;
