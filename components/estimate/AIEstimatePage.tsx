import React from 'react';
import { AIEstimateGenerator } from './AIEstimateGenerator';
import { Lead } from '../../types';

type Props = {
  lead?: Lead | null;
  onGenerated?: () => void;
};

/**
 * AI見積もり作成専用ページラッパー。
 * 既存のデザインを保ちつつ、AIEstimateGenerator を全幅で配置するだけの薄いコンテナ。
 */
const AIEstimatePage: React.FC<Props> = ({ lead, onGenerated }) => {
  // 親からリードが渡されない場合でも動作するように最低限のダミーを渡す
  const fallbackLead: Lead = lead || {
    id: 'ai-temp-lead',
    name: 'AI見積もり',
    company: '未選択',
    status: 'new',
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-[0.2em]">AI Estimate</p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
            AI見積もり作成
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            「新規見積もりを追加」から起動したAI見積もりワークフローです。顧客・カテゴリを選び、ファイルを添付して生成してください。
          </p>
        </div>
        <AIEstimateGenerator
          lead={fallbackLead}
          onEstimateGenerated={() => onGenerated?.()}
        />
      </div>
    </div>
  );
};

export default AIEstimatePage;
