import React, { useMemo, useState } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient.ts';
import { Package, GoogleIcon } from './Icons';

const LoginPage: React.FC = () => {
  const isSupabaseConfigured = useMemo(() => hasSupabaseCredentials(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleSendMagicLink = async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('メールアドレスを入力してください。');
      return;
    }

    // ドメインチェック
    const allowedDomains = ['@bunsyodo.jp', '@b-p.co.jp'];
    const isAllowedDomain = allowedDomains.some(domain => trimmedEmail.endsWith(domain));
    
    if (!isAllowedDomain) {
      const domainsList = allowedDomains.join(' / ');
      setErrorMessage(`許可されたドメインのメールアドレスを使用してください。\n許可ドメイン: ${domainsList}`);
      return;
    }

    setIsSendingMagicLink(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        setErrorMessage(`マジックリンク送信エラー: ${error.message}`);
      } else {
        setSuccessMessage(`✅ マジックリンクを送信しました\n\n${trimmedEmail} にログイン用のリンクを送信しました。\nメールを確認してリンクをクリックしてください。`);
      }
    } catch (error: any) {
      setErrorMessage(`マジックリンク送信に失敗しました: ${error.message}`);
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleLoginWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErrorMessage(error.message ?? 'Googleログインに失敗しました。');
    }
  };

  const formDisabled = !isSupabaseConfigured || isSubmitting;
  const magicLinkDisabled = !isSupabaseConfigured || isSendingMagicLink || isSubmitting;


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
          <button
            type="button"
            onClick={handleSendMagicLink}
            disabled={magicLinkDisabled}
            className="w-full px-4 py-4 text-base font-semibold text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
          >
            {isSendingMagicLink ? '送信中...' : '📧 マジックリンクでログイン'}
          </button>
          
          {/* マジックリンク送信後のメッセージ */}
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 whitespace-pre-line">
                    {successMessage}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    メールが届かない場合は、迷惑メールフォルダを確認してください。
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300 dark:border-slate-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">または</span>
            </div>
          </div>
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
            onClick={handleLoginWithGoogle}
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
        
        {/* 新規登録リンク */}
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            アカウントをお持ちでない方は{' '}
            <button
              onClick={() => window.location.href = '/register'}
              className="text-blue-600 hover:text-blue-700 font-medium underline"
            >
              新規登録申請
            </button>
          </p>
        </div>
      </div>
      
    </div>
  );
};

export default LoginPage;