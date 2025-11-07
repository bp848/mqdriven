import React from 'react';
import { Archive } from '../Icons';

const AuditLogPage: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">監査ログ</h2>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                システム内の主要な操作履歴がここに表示されます。
            </p>
        </div>
        <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <Archive className="w-12 h-12 mx-auto text-slate-400" />
            <p className="mt-4 font-semibold">監査ログ機能は準備中です</p>
            <p className="mt-1 text-base">
                今後のアップデートで、ユーザーの操作履歴などを確認できるようになります。
            </p>
        </div>
    </div>
  );
};

export default AuditLogPage;
