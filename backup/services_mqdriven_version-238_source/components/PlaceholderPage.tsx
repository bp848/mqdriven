import React from 'react';
import { HardHat } from './Icons';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
      <div className="p-6 bg-slate-200 dark:bg-slate-700 rounded-full">
        <HardHat className="w-16 h-16 text-slate-500 dark:text-slate-400" />
      </div>
      <h2 className="mt-8 text-2xl font-bold text-slate-700 dark:text-slate-200">
        「{title}」機能
      </h2>
      <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
        この機能は現在開発中です。今後のアップデートにご期待ください。
      </p>
    </div>
  );
};

export default PlaceholderPage;
