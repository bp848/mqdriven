import React from 'react';
import { LogoIcon } from './icons/LogoIcon';

const ProposalHeader: React.FC = () => {
  return (
    <header className="flex flex-col gap-3 text-center xl:text-left">
      <div className="flex items-center justify-center xl:justify-start gap-3">
        <LogoIcon className="w-10 h-10 text-cyan-400" />
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Business Support</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            AIプレゼン提案ジェネレーター
          </h1>
        </div>
      </div>
      <p className="text-base text-slate-600 dark:text-slate-300 max-w-3xl mx-auto xl:mx-0">
        サイドメニューの「提案書作成」から、AIとCRMデータを活用した高品質なプレゼン資料を生成できます。
        Deep ResearchモードではGoogle検索結果に基づく最新トレンドも反映し、出典を自動で付与します。
      </p>
    </header>
  );
};

export default ProposalHeader;
