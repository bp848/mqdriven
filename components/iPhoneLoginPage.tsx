import React, { useState } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient.ts';
import { Package } from './Icons';

const IPhoneLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleMagicLinkOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setIsError(true);
      setMessage('メールアドレスを入力してください。');
      return;
    }

    setIsSending(true);
    setMessage(null);
    setIsError(false);

    try {
      const supabaseClient = getSupabase();
      
      // iPhone専用: 完全クリーンアップ
      localStorage.clear();
      sessionStorage.clear();
      await supabaseClient.auth.signOut();
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?iphone=1&t=${Date.now()}`,
        },
      });

      if (error) {
        setIsError(true);
        setMessage(`エラー: ${error.message}`);
      } else {
        setIsError(false);
        setMessage(`📧 マジックリンクを送信しました！\n\n${email} にログイン用のリンクを送信しました。\n\nメールを確認してリンクをクリックしてください。`);
      }
    } catch (error: any) {
      setIsError(true);
      setMessage(`送信に失敗しました: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-3xl shadow-2xl">
        {/* ヘッダー */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Package className="w-12 h-12 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">MQ会計ERP</h1>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📱</span>
              <h2 className="text-lg font-semibold text-blue-900">ログイン</h2>
            </div>
          </div>
        </div>

        {/* フォーム */}
        <form onSubmit={handleMagicLinkOnly} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@company.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? '送信中...' : '📧 マジックリンクでログイン'}
          </button>
        </form>

        {/* メッセージ表示 */}
        {message && (
          <div className={`p-4 rounded-xl ${isError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{isError ? '❌' : '✅'}</span>
              <p className={`text-sm font-medium whitespace-pre-line ${isError ? 'text-red-800' : 'text-green-800'}`}>
                {message}
              </p>
            </div>
          </div>
        )}


        {/* 通常ログインへのリンク */}
        <div className="text-center">
          <button
            onClick={() => {
              // iPhone専用ページの使用記録を削除
              localStorage.removeItem('mq_iphone_login_used');
              window.location.href = '/?force=normal';
            }}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            通常のログインページに戻る
          </button>
        </div>
      </div>
    </div>
  );
};

export default IPhoneLoginPage;
