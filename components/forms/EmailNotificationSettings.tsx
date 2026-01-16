import React, { useState, useEffect } from 'react';
import { Mail, Settings, Send, Save, X } from '../Icons';

interface EmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
  notificationTypes: {
    onSubmit: boolean;
    onApprove: boolean;
    onReject: boolean;
    onNextStep: boolean;
  };
  testEmail: string;
}

const EmailNotificationSettings: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: EmailSettings) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<EmailSettings>({
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: 'noreply@example.com',
    fromName: '文唱堂印刷株式会社',
    useSSL: true,
    notificationTypes: {
      onSubmit: true,
      onApprove: true,
      onReject: true,
      onNextStep: true,
    },
    testEmail: '',
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('emailNotificationSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to load email settings:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('emailNotificationSettings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const handleTestEmail = async () => {
    if (!settings.smtpUsername || !settings.smtpPassword || !settings.testEmail) {
      setTestResult('SMTP設定とテストメールアドレスを入力してください');
      return;
    }

    setIsTesting(true);
    setTestResult('');

    try {
      // Test email configuration
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          testEmail: settings.testEmail,
        }),
      });

      if (response.ok) {
        setTestResult('テストメールを送信しました。確認してください。');
      } else {
        const error = await response.text();
        setTestResult(`送信失敗: ${error}`);
      }
    } catch (error: any) {
      setTestResult(`送信エラー: ${error?.message || error}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            通知メール設定 (SMTP)
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">基本設定</h3>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="email-enabled"
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="email-enabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                メール通知を有効にする
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  SMTPホスト *
                </label>
                <input
                  type="text"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="smtp.gmail.com"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ポート番号 *
                </label>
                <input
                  type="number"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="587"
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ユーザー名 *
                </label>
                <input
                  type="email"
                  value={settings.smtpUsername}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpUsername: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="your-email@example.com"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  パスワード *
                </label>
                <input
                  type="password"
                  value={settings.smtpPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, smtpPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="アプリパスワード"
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  送信元メールアドレス *
                </label>
                <input
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => setSettings(prev => ({ ...prev, fromEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="noreply@example.com"
                  disabled={!settings.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  送信者名
                </label>
                <input
                  type="text"
                  value={settings.fromName}
                  onChange={(e) => setSettings(prev => ({ ...prev, fromName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="文唱堂印刷株式会社"
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-ssl"
                checked={settings.useSSL}
                onChange={(e) => setSettings(prev => ({ ...prev, useSSL: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                disabled={!settings.enabled}
              />
              <label htmlFor="use-ssl" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                SSL/TLSを使用する (通常ポート465の場合に有効)
              </label>
            </div>
          </div>

          {/* 通知タイプ */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">通知タイプ</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="notify-on-submit"
                  checked={settings.notificationTypes.onSubmit}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notificationTypes: { ...prev.notificationTypes, onSubmit: e.target.checked }
                  }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={!settings.enabled}
                />
                <label htmlFor="notify-on-submit" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  申請提出時の通知
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="notify-on-approve"
                  checked={settings.notificationTypes.onApprove}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notificationTypes: { ...prev.notificationTypes, onApprove: e.target.checked }
                  }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={!settings.enabled}
                />
                <label htmlFor="notify-on-approve" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  承認完了時の通知
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="notify-on-reject"
                  checked={settings.notificationTypes.onReject}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notificationTypes: { ...prev.notificationTypes, onReject: e.target.checked }
                  }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={!settings.enabled}
                />
                <label htmlFor="notify-on-reject" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  却下・差戻し時の通知
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="notify-on-next-step"
                  checked={settings.notificationTypes.onNextStep}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    notificationTypes: { ...prev.notificationTypes, onNextStep: e.target.checked }
                  }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={!settings.enabled}
                />
                <label htmlFor="notify-on-next-step" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  次の承認ステップへの通知
                </label>
              </div>
            </div>
          </div>

          {/* テスト送信 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">テスト送信</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  テスト送信先メールアドレス
                </label>
                <input
                  type="email"
                  value={settings.testEmail}
                  onChange={(e) => setSettings(prev => ({ ...prev, testEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="test@example.com"
                  disabled={!settings.enabled}
                />
              </div>

              <button
                onClick={handleTestEmail}
                disabled={isTesting || !settings.enabled}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-transparent animate-spin rounded-full" />
                    <span>テスト送信中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>テストメール送信</span>
                  </>
                )}
              </button>

              {testResult && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${
                  testResult.includes('失敗') || testResult.includes('エラー') 
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
                    : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                }`}>
                  {testResult}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 mt-4">
            ここに100回くらい保存していますが。
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            閉じる
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailNotificationSettings;
