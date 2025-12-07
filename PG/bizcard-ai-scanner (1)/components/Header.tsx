import React from 'react';
import { Scan, Database, PlusCircle } from 'lucide-react';
import { ViewState } from '../types';

interface HeaderProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('upload')}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">BizCard AI</span>
          </div>
          
          <nav className="flex gap-4">
            <button
              onClick={() => setView('upload')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'upload' || currentView === 'form' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              New Scan
            </button>
            <button
              onClick={() => setView('database')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'database' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Database className="w-4 h-4" />
              Customers DB
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};