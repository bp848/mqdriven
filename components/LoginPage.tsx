import React, { useMemo, useState } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient.ts';
import { Package, GoogleIcon } from './Icons';
import LoginSupportChat from './LoginSupportChat';

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
          emailRedirectTo: `${window.location.origin}/`,
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
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setErrorMessage(error.message ?? 'Googleログインに失敗しました。');
    }
  };

  const formDisabled = !isSupabaseConfigured || isSubmitting;
  const magicLinkDisabled = !isSupabaseConfigured || isSendingMagicLink || isSubmitting;

  const handleLoginAssist = async (email: string, employeeNumber?: string) => {
    // ログイン支援処理（将来的にSupabaseでユーザー検索や管理者通知を実装）
    console.log('Login assist requested:', { email, employeeNumber });
    // TODO: 管理者に通知を送る、またはユーザー情報を検証する
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="your@company.com"
            />
          </div>
          <button
            type="button"
            onClick={handleSendMagicLink}
            disabled={magicLinkDisabled}
            className="w-full px-4 py-3 font-semibold text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSendingMagicLink ? '送信中...' : '📧 マジックリンクでログイン'}
          </button>
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="パスワードを入力"
            />
          </div>
          <button
            type="submit"
            disabled={formDisabled}
            className="w-full px-4 py-3 font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 whitespace-pre-line">
                {successMessage}
              </p>
            </div>
          )}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 whitespace-pre-line">
                {errorMessage}
              </p>
            </div>
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
      
      {/* 常時開いているログインサポートチャット */}
      <LoginSupportChat onLoginAssist={handleLoginAssist} />
    </div>
  );
};

export default LoginPage;