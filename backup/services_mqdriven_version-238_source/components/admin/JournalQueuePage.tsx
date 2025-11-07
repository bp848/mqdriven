import React from 'react';
import { ListOrdered } from '../Icons';

const JournalQueuePage: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">ジャーナル・キュー</h2>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                バックグラウンドで実行されるタスクのキューがここに表示されます。
            </p>
        </div>
        <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <ListOrdered className="w-12 h-12 mx-auto text-slate-400" />
            <p className="mt-4 font-semibold">ジャーナル・キュー機能は準備中です</p>
            <p className="mt-1 text-base">
                今後のアップデートで、非同期処理のステータスなどを確認できるようになります。
            </p>
        </div>
    </div>
  );
};

export default JournalQueuePage;
