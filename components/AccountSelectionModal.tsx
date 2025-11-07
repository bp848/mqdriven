import React, { useState } from 'react';
import { Users, AlertTriangle } from './Icons';

interface AccountOption {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface AccountSelectionModalProps {
  accounts: AccountOption[];
  email: string;
  onSelect: (accountId: string) => void;
  onCancel: () => void;
}

const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
  accounts,
  email,
  onSelect,
  onCancel,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">アカウントの選択</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            <strong>{email}</strong> で複数のアカウントが見つかりました。<br />
            使用するアカウントを選択してください。
          </p>
        </div>

        <div className="p-6 space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => setSelectedId(account.id)}
              className={`
                p-4 rounded-lg border-2 cursor-pointer transition-all
                ${
                  selectedId === account.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${
                      selectedId === account.id
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-slate-300 dark:border-slate-600'
                    }
                  `}
                  >
                    {selectedId === account.id && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-lg">{account.name}</span>
                    {account.role === 'admin' && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded">
                        管理者
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    登録日: {formatDate(account.created_at)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-1 font-mono">
                    ID: {account.id.substring(0, 8)}...
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>ヒント:</strong> 通常は最新の登録日のアカウントを選択してください。
              <br />
              不明な場合は、システム管理者にお問い合わせください。
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedId}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              このアカウントでログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionModal;
