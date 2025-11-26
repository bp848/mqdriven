import React, { useState, useMemo } from 'react';
import { getSupabase, hasSupabaseCredentials } from '../services/supabaseClient';
import { Package, GoogleIcon, User, Mail, Building, Phone } from './Icons';
import { useSubmitWithConfirmation } from '../hooks/useSubmitWithConfirmation';

interface RegisterPageProps {
  onBackToLogin?: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onBackToLogin }) => {
  const isSupabaseConfigured = useMemo(() => hasSupabaseCredentials(), []);
  
  // フォーム状態
  const FIXED_COMPANY = '文唱堂印刷株式会社';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: FIXED_COMPANY,
    phone: '',
    department: '',
    position: '',
    reason: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useSubmitWithConfirmation();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'company') {
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value, company: FIXED_COMPANY }));
  };

  const handleEmailRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。管理者に連絡してください。');
      return;
    }

    // バリデーション
    if (!formData.name || !formData.email) {
      setErrorMessage('必須項目を入力してください。');
      return;
    }

    // メールドメインチェック
    const allowedDomains = ['@bunsyodo.jp', '@b-p.co.jp'];
    const isAllowedDomain = allowedDomains.some(domain => formData.email.endsWith(domain));
    
    if (!isAllowedDomain) {
      const domainsList = allowedDomains.join(' / ');
      setErrorMessage(`許可されたドメインのメールアドレスを使用してください。\n許可ドメイン: ${domainsList}`);
      return;
    }

    requestConfirmation({
      label: '登録申請を送信',
      title: '登録申請を送信しますか？',
      description: '入力内容で管理者に承認依頼を送信します。',
      confirmLabel: '送信する',
      onConfirm: submitEmailRegistration,
    });
  };

  const submitEmailRegistration = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabaseClient = getSupabase();

      const registrationRequest = {
        type: 'user_registration_request',
        timestamp: new Date().toISOString(),
        user_name: formData.name,
        user_email: formData.email,
        company: formData.company,
        phone: formData.phone || null,
        department: formData.department || null,
        position: formData.position || null,
        reason: formData.reason || null,
        status: 'pending_approval',
        source: 'registration_form',
        user_agent: navigator.userAgent,
        message: `新規ユーザー登録申請: ${formData.name} (${formData.email}) から ${formData.company} での登録申請がありました。`
      };

      const { error } = await supabaseClient
        .from('user_registration_requests')
        .insert([registrationRequest]);

      if (error) {
        throw new Error(`登録申請の送信に失敗しました: ${error.message}`);
      }

      try {
        await supabaseClient.from('admin_notifications').insert([{
          type: 'new_registration_request',
          timestamp: new Date().toISOString(),
          message: `新規ユーザー登録申請: ${formData.name} (${formData.email})`,
          source: 'registration_form',
          user_email: formData.email,
          user_name: formData.name
        }]);
      } catch (notifyError) {
        console.warn('管理者通知の送信に失敗:', notifyError);
      }

      setSuccessMessage(`✅ 登録申請を送信しました。\n\n${formData.name} 様\n\n管理者による承認後、ログイン可能になります。\n承認完了時にメールでお知らせいたします。\n\n申請内容:\n・メールアドレス: ${formData.email}\n・会社名: ${formData.company}\n・部署: ${formData.department || '未入力'}\n・役職: ${formData.position || '未入力'}`);

      setFormData({
        name: '',
        email: '',
        company: FIXED_COMPANY,
        phone: '',
        department: '',
        position: '',
        reason: ''
      });

    } catch (error: any) {
      setErrorMessage(`登録申請に失敗しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage('Supabaseの認証情報が設定されていません。');
      return;
    }

    requestConfirmation({
      label: 'Googleアカウントで登録申請',
      title: 'Googleアカウントで登録を開始しますか？',
      description: 'Google OAuth画面に遷移します。続行してよろしいですか？',
      confirmLabel: '開始する',
      onConfirm: submitGoogleRegistration,
    });
  };

  const submitGoogleRegistration = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabaseClient = getSupabase();

      const preAuthNotification = {
        type: 'google_registration_initiated',
        timestamp: new Date().toISOString(),
        message: 'ユーザーがGoogleアカウントでの登録を開始しました。',
        source: 'registration_page_google_button',
        user_agent: navigator.userAgent
      };

      try {
        await supabaseClient.from('admin_notifications').insert([preAuthNotification]);
      } catch (notifyError) {
        console.warn('管理者通知の送信に失敗:', notifyError);
      }

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?registration=google`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setErrorMessage(`Google登録エラー: ${error.message}`);
      } else {
        setSuccessMessage('✅ Googleアカウントでの登録を開始しています...');
      }
    } catch (error: any) {
      setErrorMessage(`Google登録に失敗しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-2xl p-8 space-y-8 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Package className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold">MQ会計ERP</h2>
          </div>
          <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
            新規ユーザー登録
          </p>
          <p className="mt-1 text-sm text-center text-slate-500 dark:text-slate-400">
            管理者承認後にログイン可能になります
          </p>
        </div>

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 whitespace-pre-line">
              {successMessage}
            </p>
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 whitespace-pre-line">
              {errorMessage}
            </p>
          </div>
        )}

        {/* 登録フォーム */}
        <form onSubmit={handleEmailRegister} className="space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              基本情報
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="山田 太郎"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="yamada@bunsyodo.jp"
                />
                <p className="mt-1 text-xs text-slate-500">
                  @bunsyodo.jp または @b-p.co.jp のメールアドレスを使用してください
                </p>
              </div>
            </div>
          </div>

          {/* 会社情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5" />
              会社情報
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  会社名
                </label>
                <input
                  type="text"
                  value={FIXED_COMPANY}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  部署
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="営業部"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  役職
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="課長"
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  電話番号
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  placeholder="03-1234-5678"
                />
              </div>
            </div>
          </div>

          {/* 申請理由 */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              利用目的・申請理由
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              placeholder="会計業務でシステムを利用したいため..."
            />
          </div>

          {/* 送信ボタン */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting || !isSupabaseConfigured}
              className="w-full flex justify-center items-center gap-3 px-4 py-3 font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Mail className="w-5 h-5" />
              {isSubmitting ? '送信中...' : '登録申請を送信'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300 dark:border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">または</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={isSubmitting || !isSupabaseConfigured}
              className="w-full flex justify-center items-center gap-3 px-4 py-3 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <GoogleIcon className="w-5 h-5" />
              Googleアカウントで登録申請
            </button>
          </div>

          {!isSupabaseConfigured && (
            <p className="mt-3 text-sm text-red-600 text-center">
              Supabaseの接続情報が未設定のため、デモモードでご利用ください。
            </p>
          )}
        </form>

        {onBackToLogin && (
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            既にアカウントをお持ちの方は{' '}
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              ログインページへ
            </button>
          </p>
        )}
      </div>
    </div>
    {ConfirmationDialog}
    </>
  );
};

export default RegisterPage;
