
import React from 'react';
import { LogoIcon } from './icons/LogoIcon';

const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <LogoIcon className="w-10 h-10 text-cyan-400" />
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
          AI Presentation Generator
        </h1>
      </div>
      <p className="mt-2 text-md text-slate-400">
        AI主導型提案書作成アプリ
      </p>
    </header>
  );
};

export default Header;
