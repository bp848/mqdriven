import React from 'react';
import EmailNotificationSettings from './admin/EmailNotificationSettings';
import DatabaseConnectionTest from './admin/DatabaseConnectionTest';

interface EmailNotificationSettingsPageProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  currentUser: any;
}

const EmailNotificationSettingsPage: React.FC<EmailNotificationSettingsPageProps> = ({ 
  addToast, 
  currentUser 
}) => {
  // Only allow admin users to access email settings
  if (currentUser?.role !== 'admin') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            アクセス権限がありません
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            通知メール設定の管理は管理者のみが実行できます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            通知メール設定
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            申請の承認・却下などの通知をメールで送信するためのSMTP設定を構成します。
          </p>
        </div>
      </div>
      
      <EmailNotificationSettings />
      <DatabaseConnectionTest />
    </div>
  );
};

export default EmailNotificationSettingsPage;
