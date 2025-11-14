import React, { useEffect, useState } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient';
import { Package } from './Icons';

const AuthCallbackPage: React.FC = () => {
  const [message, setMessage] = useState('ログイン処理中です。しばらくお待ちください...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      if (!hasSupabaseCredentials()) {
        setIsError(true);
        setMessage('Supabaseの接続情報が設定されていません。管理者に連絡してください。');
        return;
      }

      try {
        const supabaseClient = getSupabase();
        const currentUrl = window.location.href;

        if (!currentUrl.includes('code=') && !currentUrl.includes('access_token=')) {
          setIsError(true);
          setMessage('無効なログインリンクです。ログインページから再度お試しください。');
          return;
        }

        const { error } = await supabaseClient.auth.exchangeCodeForSession(currentUrl);
        if (error) {
          setIsError(true);
          setMessage(`ログイン処理に失敗しました。\n\n${error.message}`);
          return;
        }

        setMessage('ログインに成功しました。ダッシュボードへ移動します...');
        setTimeout(() => {
          if (!isMounted) return;
          window.history.replaceState({}, document.title, '/');
          window.location.replace('/');
        }, 1200);
      } catch (error) {
        setIsError(true);
        setMessage(`予期しないエラーが発生しました。\n\n${error instanceof Error ? error.message : ''}`);
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Package className="w-10 h-10 text-blue-600" />
            <h2 className="text-2xl font-bold">MQ会計ERP</h2>
          </div>
          {!isError && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600" />
            </div>
          )}
          <p
            className={`text-sm whitespace-pre-line leading-relaxed ${
              isError ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {message}
          </p>
          {isError && (
            <button
              type="button"
              onClick={() => window.location.replace('/')}
              className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ログインページに戻る
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
