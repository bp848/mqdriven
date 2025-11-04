import React, { useMemo, useState } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient.ts';
import { Package, GoogleIcon } from './Icons';

const LoginPage: React.FC = () => {
  const isSupabaseConfigured = useMemo(() => hasSupabaseCredentials(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginWithEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      alert('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    if (!email || !password) {
      setErrorMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMessage(error.message ?? 'ログインに失敗しました。');
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('不明なエラーが発生しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      alert(`ログインエラー: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Package className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold">MQ会計ERP</h2>
          </div>
          <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
            ログイン方法を選択してください
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleLoginWithEmail}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!isSupabaseConfigured || isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!isSupabaseConfigured || isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="パスワード"
            />
          </div>
          <button
            type="submit"
            disabled={!isSupabaseConfigured || isSubmitting}
            className="w-full flex justify-center items-center gap-3 px-4 py-3 font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'ログイン中...' : 'メールアドレスでログイン'}
          </button>
        </form>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">または</span>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={handleLoginWithGoogle}
            disabled={!isSupabaseConfigured || isSubmitting}
            className="w-full flex justify-center items-center gap-3 px-4 py-3 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon className="w-5 h-5" />
            Googleでログイン
          </button>
          {!isSupabaseConfigured && (
            <p className="mt-3 text-sm text-red-600 text-center">
              Supabaseの接続情報が未設定のため、デモモードでご利用ください。
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-red-600 text-center">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;