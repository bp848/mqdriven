import React, { useMemo, useState, useEffect } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient';
import { Package, GoogleIcon } from './Icons';

const LoginPage: React.FC = () => {
  const isSupabaseConfigured = useMemo(() => hasSupabaseCredentials(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  
  // Surface explicit errors passed from auth flow (e.g., domain_not_allowed)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const loginError = params.get('login_error');
      const emailParam = params.get('email') || '';
      if (loginError === 'domain_not_allowed') {
        const allowed = ['@bunsyodo.jp', '@b-p.co.jp'];
        const domainsList = allowed.join(' / ');
        setErrorMessage(
          `❌ ログインできません\n\n現在、${emailParam} でログインしようとされています。\n\n申し訳ございませんが、このシステムは社員専用です。\n\n許可ドメイン: ${domainsList}\n\n会社メールアドレスでログインしてください。`
        );
        // Clean query to avoid persisting the message on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      // Fallback: read last stored error
      const raw = localStorage.getItem('mq.lastLoginError');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.type === 'domain_not_allowed') {
          const allowed = Array.isArray(payload.allowed) ? payload.allowed : ['@bunsyodo.jp', '@b-p.co.jp'];
          const domainsList = allowed.join(' / ');
          setErrorMessage(
            `❌ ログインできません\n\n現在、${payload.email || ''} でログインしようとされています。\n\n申し訳ございませんが、このシステムは社員専用です。\n\n許可ドメイン: ${domainsList}\n\n会社メールアドレスでログインしてください。`
          );
        }
        localStorage.removeItem('mq.lastLoginError');
      }
    } catch {}
  }, []);
  

  const handleLoginWithEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setErrorMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: trimmedEmail,
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

  

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const supabaseClient = getSupabase();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isiPhone = /iPhone|iPod/i.test(navigator.userAgent);
    
    
    // Androidやその他のモバイル用の処理
    if (isMobile) {
      try {
        await supabaseClient.auth.signOut();
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('supabase.') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (cleanupError) {
        console.warn('Mobile cleanup failed:', cleanupError);
      }
    }
    
    // デスクトップとAndroid用のOAuth
    const timestamp = Date.now();
    const redirectUrl = `${window.location.origin}/auth/callback?t=${timestamp}&mobile=${isMobile ? '1' : '0'}`;
    
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    });
    
    if (error) {
      console.error('Google OAuth error:', error);
      setErrorMessage(`Googleログインエラー: ${error.message}`);
    } else {
      console.log('Google OAuth initiated successfully');
    }
  };

  const formDisabled = !isSupabaseConfigured || isSubmitting;


  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 font-sans px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 sm:space-y-8 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Package className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold">MQ会計ERP</h2>
          </div>
          <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
            ログイン方法を選択してください
          </p>
        </div>
        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 whitespace-pre-line">
              {successMessage}
            </p>
          </div>
        )}

        <form onSubmit={handleLoginWithEmail} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="your@company.com"
            />
          </div>
          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 whitespace-pre-line">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="パスワードを入力"
            />
          </div>
          <button
            type="submit"
            disabled={formDisabled}
            className="w-full px-4 py-4 text-base font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
          >
            {isSubmitting ? 'ログイン中...' : 'パスワードでログイン'}
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
            type="button"
            onClick={handleGoogleLogin}
            disabled={formDisabled}
            className="w-full flex justify-center items-center gap-3 px-4 py-4 text-base font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
          >
            <GoogleIcon className="w-5 h-5" />
            Googleでログイン
          </button>
          
          {!isSupabaseConfigured && (
            <p className="mt-3 text-sm text-red-600 text-center">
              Supabaseの接続情報が未設定のため、デモモードでご利用ください。
            </p>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default LoginPage;