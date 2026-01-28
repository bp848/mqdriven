
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-6">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
          社内向け AI印刷見積もりツール
        </h1>
        <p className="mt-2 text-md text-slate-600">
          迅速な見積もり作成で営業活動をサポート
        </p>
      </div>
    </header>
  );
};

export default Header;
