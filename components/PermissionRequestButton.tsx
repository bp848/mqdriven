import React, { useState } from 'react';
import { Shield, Send, CheckCircle, Loader } from './Icons';
import { Toast } from '../types';

interface PermissionRequestButtonProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
  };
  addToast: (message: string, type: Toast['type']) => void;
}

const PermissionRequestButton: React.FC<PermissionRequestButtonProps> = ({
  currentUser,
  addToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // 管理者の場合は表示しない
  if (currentUser.role === 'admin') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      addToast('理由を入力してください', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // ここでSupabaseに権限リクエストを保存
      const response = await fetch('/api/permission-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          reason: reason.trim(),
          requestedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('リクエストの送信に失敗しました');
      }

      setHasRequested(true);
      addToast('管理者権限のリクエストを送信しました。管理者の承認をお待ちください。', 'success');
      setIsOpen(false);
      setReason('');
    } catch (error: any) {
      addToast(error.message || 'エラーが発生しました', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasRequested) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200 text-sm">
              リクエスト送信済み
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              管理者の承認をお待ちください
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 flex items-center gap-2 group"
        title="管理者権限をリクエスト"
      >
        <Shield className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-semibold">
          管理者権限をリクエスト
        </span>
      </button>

      {/* モーダル */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold">管理者権限のリクエスト</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                管理者メニューへのアクセスが必要な場合は、理由を記入してリクエストしてください。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>現在のアカウント:</strong><br />
                  {currentUser.name} ({currentUser.email})<br />
                  <span className="text-xs">権限: 一般ユーザー</span>
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  リクエスト理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例: 経営管理のため、全社のデータにアクセスする必要があります"
                  rows={4}
                  disabled={isSubmitting}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
                />
              </div>

              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  💡 このリクエストは管理者に通知されます。承認されるまでお待ちください。
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reason.trim()}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <Loader className="w-5 h-5 animate-spin" />}
                  {isSubmitting ? '送信中...' : (
                    <>
                      <Send className="w-5 h-5" />
                      リクエスト送信
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PermissionRequestButton;
