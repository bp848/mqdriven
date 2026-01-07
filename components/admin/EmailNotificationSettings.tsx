import React, { useState, useEffect } from 'react';
import { getEnvValue } from '../../utils';
import { sendEmail } from '../../services/emailService';

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface EmailNotificationSettings {
  smtp: SMTPConfig;
  enableNotifications: boolean;
  notificationTypes: {
    submitted: boolean;
    approved: boolean;
    rejected: boolean;
    step_forward: boolean;
  };
}

const EmailNotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<EmailNotificationSettings>({
    smtp: {
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      fromEmail: '',
      fromName: '文唱堂印刷株式会社'
    },
    enableNotifications: true,
    notificationTypes: {
      submitted: true,
      approved: true,
      rejected: true,
      step_forward: true
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('emailNotificationSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          smtp: { ...prev.smtp, ...(parsed.smtp || {}) },
        }));
        return;
      }
      
      // Load from environment variables as defaults
      const envSmtp: Partial<SMTPConfig> = {};
      const envHost = getEnvValue('SMTP_HOST');
      if (envHost) envSmtp.host = envHost;
      const envPort = getEnvValue('SMTP_PORT');
      if (envPort) envSmtp.port = Number(envPort) || 587;
      const envSecure = getEnvValue('SMTP_SECURE');
      if (envSecure !== undefined && envSecure !== null) envSmtp.secure = envSecure === 'true';
      const envUser = getEnvValue('SMTP_USERNAME');
      if (envUser) envSmtp.username = envUser;
      const envPass = getEnvValue('SMTP_PASSWORD');
      if (envPass) envSmtp.password = envPass;
      const envFromEmail = getEnvValue('SMTP_FROM_EMAIL');
      if (envFromEmail) envSmtp.fromEmail = envFromEmail;
      const envFromName = getEnvValue('SMTP_FROM_NAME');
      if (envFromName) envSmtp.fromName = envFromName;

      setSettings(prev => ({
        ...prev,
        smtp: { ...prev.smtp, ...envSmtp }
      }));
    } catch (error) {
      console.error('Failed to load email settings:', error);
      setMessage('設定の読み込みに失敗しました。');
      setMessageType('error');
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('emailNotificationSettings', JSON.stringify(settings));
      setMessage('設定を保存しました。');
      setMessageType('success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage('設定の保存に失敗しました。');
      setMessageType('error');
    }
  };

  const handleSMTPChange = (field: keyof SMTPConfig, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        [field]: value
      }
    }));
  };

  const handleNotificationTypeChange = (type: keyof EmailNotificationSettings['notificationTypes'], enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      notificationTypes: {
        ...prev.notificationTypes,
        [type]: enabled
      }
    }));
  };

  const testEmailConfiguration = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setMessage('テスト用メールアドレスを入力してください。');
      setMessageType('error');
      return;
    }

    if (!settings.smtp.host || !settings.smtp.username || !settings.smtp.password || !settings.smtp.fromEmail) {
      setMessage('SMTP設定をすべて入力してください。');
      setMessageType('error');
      return;
    }

    setIsTesting(true);
    setMessage('');

    try {
      await sendEmail({
        to: [testEmail],
        subject: '【テスト】メール通知設定確認',
        body: `これはメール通知設定のテストメールです。

設定内容:
- SMTPホスト: ${settings.smtp.host}:${settings.smtp.port}
- 送信元: ${settings.smtp.fromName} <${settings.smtp.fromEmail}>
- 通知設定: ${settings.enableNotifications ? '有効' : '無効'}

このメールが正常に受信できていれば、SMTP設定は正しく構成されています。

送信日時: ${new Date().toLocaleString('ja-JP')}`,
      });

      setMessage('テストメールを送信しました。受信を確認してください。');
      setMessageType('success');
    } catch (error) {
      console.error('Test email failed:', error);
      setMessage('テストメールの送信に失敗しました。SMTP設定を確認してください。');
      setMessageType('error');
    } finally {
      setIsTesting(false);
    }
  };

  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
  const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
  const checkboxClass = "h-4 w-4 text-blue-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500";

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">通知メール設定 (SMTP)</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          申請の承認・却下などの通知をメールで送信するためのSMTP設定を構成します。
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' ? 'bg-green-100 text-green-700 border border-green-300' :
          messageType === 'error' ? 'bg-red-100 text-red-700 border border-red-300' :
          'bg-blue-100 text-blue-700 border border-blue-300'
        }`}>
          {message}
        </div>
      )}

      {/* 全体設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">基本設定</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="enableNotifications"
            checked={settings.enableNotifications}
            onChange={(e) => setSettings(prev => ({ ...prev, enableNotifications: e.target.checked }))}
            className={checkboxClass}
          />
          <label htmlFor="enableNotifications" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            メール通知を有効にする
          </label>
        </div>
      </div>

      {/* SMTP設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">SMTPサーバー設定</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="smtpHost" className={labelClass}>SMTPホスト *</label>
            <input
              type="text"
              id="smtpHost"
              value={settings.smtp.host}
              onChange={(e) => handleSMTPChange('host', e.target.value)}
              className={inputClass}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label htmlFor="smtpPort" className={labelClass}>ポート番号 *</label>
            <input
              type="number"
              id="smtpPort"
              value={settings.smtp.port}
              onChange={(e) => handleSMTPChange('port', parseInt(e.target.value) || 587)}
              className={inputClass}
              placeholder="587"
            />
          </div>

          <div>
            <label htmlFor="smtpUsername" className={labelClass}>ユーザー名 *</label>
            <input
              type="text"
              id="smtpUsername"
              value={settings.smtp.username}
              onChange={(e) => handleSMTPChange('username', e.target.value)}
              className={inputClass}
              placeholder="your-email@example.com"
            />
          </div>

          <div>
            <label htmlFor="smtpPassword" className={labelClass}>パスワード *</label>
            <input
              type="password"
              id="smtpPassword"
              value={settings.smtp.password}
              onChange={(e) => handleSMTPChange('password', e.target.value)}
              className={inputClass}
              placeholder="アプリパスワード"
            />
          </div>

          <div>
            <label htmlFor="fromEmail" className={labelClass}>送信元メールアドレス *</label>
            <input
              type="email"
              id="fromEmail"
              value={settings.smtp.fromEmail}
              onChange={(e) => handleSMTPChange('fromEmail', e.target.value)}
              className={inputClass}
              placeholder="noreply@example.com"
            />
          </div>

          <div>
            <label htmlFor="fromName" className={labelClass}>送信者名</label>
            <input
              type="text"
              id="fromName"
              value={settings.smtp.fromName}
              onChange={(e) => handleSMTPChange('fromName', e.target.value)}
              className={inputClass}
              placeholder="文唱堂印刷株式会社"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="smtpSecure"
            checked={settings.smtp.secure}
            onChange={(e) => handleSMTPChange('secure', e.target.checked)}
            className={checkboxClass}
          />
          <label htmlFor="smtpSecure" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            SSL/TLSを使用する (通常ポート465の場合に有効)
          </label>
        </div>
      </div>

      {/* 通知タイプ設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">通知タイプ</h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifySubmitted"
              checked={settings.notificationTypes.submitted}
              onChange={(e) => handleNotificationTypeChange('submitted', e.target.checked)}
              className={checkboxClass}
            />
            <label htmlFor="notifySubmitted" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              申請提出時の通知
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifyApproved"
              checked={settings.notificationTypes.approved}
              onChange={(e) => handleNotificationTypeChange('approved', e.target.checked)}
              className={checkboxClass}
            />
            <label htmlFor="notifyApproved" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              承認完了時の通知
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifyRejected"
              checked={settings.notificationTypes.rejected}
              onChange={(e) => handleNotificationTypeChange('rejected', e.target.checked)}
              className={checkboxClass}
            />
            <label htmlFor="notifyRejected" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              却下・差戻し時の通知
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="notifyStepForward"
              checked={settings.notificationTypes.step_forward}
              onChange={(e) => handleNotificationTypeChange('step_forward', e.target.checked)}
              className={checkboxClass}
            />
            <label htmlFor="notifyStepForward" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              次の承認ステップへの通知
            </label>
          </div>
        </div>
      </div>

      {/* テスト送信 */}
      <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">テスト送信</h3>
        
        <div className="flex gap-4">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className={inputClass}
            placeholder="テスト送信先メールアドレス"
          />
          <button
            onClick={testEmailConfiguration}
            disabled={isTesting || !testEmail}
            className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isTesting ? '送信中...' : 'テストメール送信'}
          </button>
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="flex justify-end space-x-4 border-t border-slate-200 dark:border-slate-700 pt-6">
        <button
          onClick={saveSettings}
          disabled={isLoading}
          className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          設定を保存
        </button>
      </div>
    </div>
  );
};

export default EmailNotificationSettings;
