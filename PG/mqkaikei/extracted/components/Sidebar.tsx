
import React from 'react';
import { ViewState } from '../App';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  CreditCard, 
  CalendarClock,
  ScanLine,
  Landmark,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  FileSpreadsheet,
  Target,
  Factory,
  Truck,
  FileCheck
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, toggleSidebar }) => {
  
  // Group 1: Daily Operations (Input & Check)
  const dailyMenu = [
    { id: 'dashboard', label: 'ホーム / 業務フロー', icon: LayoutDashboard },
    { id: 'ocr', label: '1. データ取込(OCR)', icon: ScanLine },
    { id: 'journal', label: '2. AI仕訳の承認', icon: BookOpen },
    { id: 'approved_applications', label: '承認済申請一覧', icon: FileCheck },
  ];

  // Group 2: Management (Money & Factory)
  const managementMenu = [
    { id: 'receivables', label: '売掛管理 (入金)', icon: CreditCard },
    { id: 'payables', label: '買掛管理 (支払)', icon: Truck },
    { id: 'cash_schedule', label: '資金繰りカレンダー', icon: CalendarClock },
    { id: 'manufacturing', label: '工場・製造原価', icon: Factory },
  ];

  // Group 3: Closing & Strategy
  const closingMenu = [
    { id: 'strategy', label: '経営戦略・分析', icon: BrainCircuit },
    { id: 'variance', label: '予実管理 (計画vs実績)', icon: Target },
    { id: 'ledger', label: '総勘定元帳', icon: FileText },
    { id: 'tax', label: '決算・税務', icon: Landmark },
    { id: 'import_data', label: '設定・データ管理', icon: FileSpreadsheet },
  ];

  const renderMenuItem = (item: {id: string, label: string, icon: any}) => {
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setCurrentView(item.id as ViewState)}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-all duration-200 group ${
            isActive 
            ? 'bg-indigo-900/50 text-white border-l-4 border-indigo-500' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white border-l-4 border-transparent'
        } ${!isOpen && 'justify-center px-0'}`}
        title={!isOpen ? item.label : undefined}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
        {isOpen && <span className="font-medium text-sm truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside 
      className={`${
        isOpen ? 'w-64' : 'w-20'
      } bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out flex flex-col h-full z-10 shadow-xl border-r border-slate-800`}
    >
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        {isOpen ? (
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white">
              <span className="font-bold text-lg leading-none">MQ</span>
            </div>
            <div>
                <span className="font-bold text-lg text-white tracking-tight block leading-none">MQ会計</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider">戦略会計システム</span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="bg-indigo-600 p-1.5 rounded text-white">
               <span className="font-bold text-sm">MQ</span>
            </div>
          </div>
        )}
        
        {isOpen && (
            <button onClick={toggleSidebar} className="text-slate-500 hover:text-white transition">
                <ChevronLeft size={18} />
            </button>
        )}
      </div>
      {!isOpen && (
          <div className="flex justify-center py-4 border-b border-slate-800">
              <button onClick={toggleSidebar} className="text-slate-500 hover:text-white transition">
                <ChevronRight size={18} />
              </button>
          </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-8 overflow-y-auto">
        <div>
            <div className="mb-2 px-3">
                {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">日次業務 (Daily)</p>}
            </div>
            <div className="space-y-1">
                {dailyMenu.map(renderMenuItem)}
            </div>
        </div>

        <div>
            <div className="mb-2 px-3">
                {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">資金・工場管理 (Manage)</p>}
            </div>
            <div className="space-y-1">
                {managementMenu.map(renderMenuItem)}
            </div>
        </div>

        <div>
            <div className="mb-2 px-3">
                {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">戦略・決算 (Strategy)</p>}
            </div>
            <div className="space-y-1">
                {closingMenu.map(renderMenuItem)}
            </div>
        </div>
      </nav>

      {/* AI Status */}
      <div className={`p-4 border-t border-slate-800 bg-slate-950 ${!isOpen && 'hidden'}`}>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-3 border border-slate-700 shadow-inner">
          <div className="flex items-center space-x-2 mb-2">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">AI監視システム</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            異常値のチェックを行っています。<br/>システムは正常に稼働中。
          </p>
          <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] text-slate-500">正常 (Online)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
