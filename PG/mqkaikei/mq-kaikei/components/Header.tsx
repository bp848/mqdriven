import React from 'react';
import { Bell, Search, Menu } from 'lucide-react';

interface HeaderProps {
  toggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10 sticky top-0">
      <div className="flex items-center space-x-4">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input 
            type="text" 
            placeholder="案件番号、顧客名で検索..." 
            className="pl-10 pr-4 py-2 w-64 lg:w-96 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-slate-700">山田 太郎</p>
            <p className="text-xs text-slate-500">生産管理部 / 部長</p>
          </div>
          <img 
            src="https://picsum.photos/100/100" 
            alt="User Avatar" 
            className="w-9 h-9 rounded-full border border-slate-200 object-cover"
          />
        </div>
      </div>
    </header>
  );
};