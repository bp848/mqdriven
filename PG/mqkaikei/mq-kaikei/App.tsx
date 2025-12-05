
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Strategy } from './components/Strategy';
import { ExcelImport } from './components/ExcelImport';
import { GeneralLedger } from './components/GeneralLedger';
import { MonthlyVariance } from './components/MonthlyVariance';
import { JournalEntry } from './components/JournalEntry';
import { BankOCR } from './components/BankOCR';
import { Receivables } from './components/Receivables';
import { Payables } from './components/Payables';
import { CashSchedule } from './components/CashSchedule';
import { TaxFiling } from './components/TaxFiling';
import { ManufacturingCost } from './components/ManufacturingCost';
import { ApprovedApplications } from './components/ApprovedApplications';
import { CheckCircle2, Info, X } from 'lucide-react';

// Mock types for navigation
export type ViewState = 'dashboard' | 'strategy' | 'variance' | 'journal' | 'ledger' | 'ocr' | 'receivables' | 'payables' | 'cash_schedule' | 'tax' | 'import_data' | 'manufacturing' | 'approved_applications';

// Notification Type
type NotificationType = 'success' | 'info';
interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

// Shared Draft Entry Type
export interface DraftEntry {
  id: string;
  source: 'OCR' | 'Excel' | 'API' | 'Recurring';
  date: string;
  description: string;
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
  confidence: number; // AI確度
  status: 'pending' | 'approved' | 'rejected';
  alert?: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Global State for Journal Drafts (Shared between OCR, Import, and Journal Entry)
  const [journalDrafts, setJournalDrafts] = useState<DraftEntry[]>([
    { 
      id: 'D-240521-01', source: 'OCR', date: '2024/05/21', 
      description: 'ＡＢＣ出版　入金', 
      debitAccount: '普通預金 (メイン)', debitAmount: 850000, 
      creditAccount: '売掛金', creditAmount: 850000, 
      confidence: 0.99, status: 'pending' 
    },
    { 
      id: 'D-240521-02', source: 'API', date: '2024/05/21', 
      description: 'アスクル事務用品', 
      debitAccount: '事務用品費', debitAmount: 12500, 
      creditAccount: '未払金', creditAmount: 12500, 
      confidence: 0.95, status: 'pending' 
    },
    { 
      id: 'D-240521-03', source: 'Excel', date: '2024/05/21', 
      description: '5月分 給与支給', 
      debitAccount: '給料手当', debitAmount: 4200000, 
      creditAccount: '未払費用', creditAmount: 4200000, 
      confidence: 0.88, status: 'pending', alert: '前月比 +5% 変動あり'
    },
    { 
      id: 'D-240521-04', source: 'OCR', date: '2024/05/21', 
      description: '不明入金 カ）ヤマダ', 
      debitAccount: '普通預金', debitAmount: 50000, 
      creditAccount: '仮受金', creditAmount: 50000, 
      confidence: 0.45, status: 'pending', alert: '科目特定不可 (仮受処理)'
    },
  ]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Notification Logic
  const notify = (message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto dismiss
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  // Add new drafts (from OCR or Excel)
  const handleAddDrafts = (newDrafts: DraftEntry[]) => {
    setJournalDrafts(prev => [...prev, ...newDrafts]);
  };

  // Update drafts (Approve/Reject from Journal Screen)
  const handleUpdateDrafts = (updatedDrafts: DraftEntry[]) => {
    setJournalDrafts(updatedDrafts);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-800 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 scroll-smooth">
          {currentView === 'dashboard' && (
            <Dashboard setCurrentView={setCurrentView} pendingDraftsCount={journalDrafts.filter(d => d.status === 'pending').length} />
          )}

          {currentView === 'strategy' && <Strategy notify={notify} />}
          
          {currentView === 'variance' && <MonthlyVariance />}
          {currentView === 'journal' && (
            <JournalEntry 
              drafts={journalDrafts} 
              setDrafts={handleUpdateDrafts} 
              notify={notify} 
            />
          )}
          {currentView === 'ledger' && <GeneralLedger />}
          {currentView === 'ocr' && (
            <BankOCR 
              onAddDrafts={handleAddDrafts} 
              onNavigate={setCurrentView} 
              notify={notify} 
            />
          )}
          {currentView === 'manufacturing' && <ManufacturingCost notify={notify} />}
          {currentView === 'receivables' && <Receivables notify={notify} />}
          {currentView === 'payables' && <Payables notify={notify} />}
          {currentView === 'cash_schedule' && <CashSchedule notify={notify} />}
          {currentView === 'tax' && <TaxFiling notify={notify} />}
          {currentView === 'approved_applications' && <ApprovedApplications notify={notify} />}
          {currentView === 'import_data' && (
            <ExcelImport 
              onAddDrafts={handleAddDrafts} 
              onNavigate={setCurrentView}
              notify={notify}
            />
          )}
        </main>

        {/* Global Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {notifications.map(n => (
                <div 
                    key={n.id} 
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slide-in-right ${
                        n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                >
                    {n.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Info className="w-5 h-5 text-blue-400" />}
                    <span className="text-sm font-medium">{n.message}</span>
                    <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}>
                        <X className="w-4 h-4 opacity-50 hover:opacity-100" />
                    </button>
                </div>
            ))}
        </div>
      </div>
      
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
