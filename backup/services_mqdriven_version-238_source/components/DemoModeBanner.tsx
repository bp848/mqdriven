import React from 'react';
import { AlertTriangle, Settings, RefreshCw } from './Icons';

interface DemoModeBannerProps {
  error: string | null;
  onRetry: () => void;
  onShowSetup: () => void;
}

const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ error, onRetry, onShowSetup }) => {
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900/50 border-b-2 border-yellow-400 dark:border-yellow-600 p-4 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200">デモモードで実行中</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {error || 'データベースに接続できませんでした。'} 現在はサンプルデータを表示しており、変更は保存されません。
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button 
          onClick={onRetry} 
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" />
          再接続
        </button>
        <button 
          onClick={onShowSetup}
          className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <Settings className="w-4 h-4" />
          設定ガイド
        </button>
      </div>
    </div>
  );
};

export default DemoModeBanner;
