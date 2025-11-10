import * as React from 'react';
import { Page, EmployeeUser } from '../types.ts';
import { LayoutDashboard, Users, Settings, Package, FileText, Briefcase, ChevronDown, DollarSign, TrendingUp, Inbox, PieChart, ShoppingCart, BookOpen, CreditCard, HardHat, CheckCircle, Archive, Bug, Lightbulb, KanbanSquare, LogOut } from './Icons.tsx';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  currentUser: EmployeeUser | null;
  onSignOut: () => void;
}

type NavItemType = {
  page: Page;
  name: string;
};

type NavCategoryType = {
  id: string;
  name: string;
  icon: React.ElementType;
  items: NavItemType[];
  adminOnly?: boolean;
};

export const ALL_NAV_CATEGORIES: NavCategoryType[] = [
    {
        id: 'sales',
        name: '販売管理',
        icon: Briefcase,
        adminOnly: true,
        items: [
            { page: 'sales_leads', name: '問い合わせ管理' },
            { page: 'sales_customers', name: '取引先' },
            { page: 'sales_pipeline', name: '進捗管理' },
            { page: 'sales_estimates', name: '見積管理' },
            { page: 'sales_orders', name: '受注管理' },
            { page: 'sales_billing', name: '売上・請求管理' },
            { page: 'sales_delivery', name: '納品管理' },
        ]
    },
    {
        id: 'analysis',
        name: '分析・支援',
        icon: PieChart,
        adminOnly: true,
        items: [
            { page: 'analysis_ranking', name: '売上ランキング' },
            { page: 'business_support_proposal', name: '提案書作成' },
        ]
    },
    {
        id: 'projects',
        name: '案件管理',
        icon: KanbanSquare,
        adminOnly: true,
        items: [
            { page: 'project_list', name: '案件一覧' },
            { page: 'project_creation', name: '新規案件作成' },
        ]
    },
    {
        id: 'purchasing',
        name: '購買管理',
        icon: ShoppingCart,
        adminOnly: true,
        items: [
            { page: 'purchasing_orders', name: '発注 (PO)' },
            { page: 'purchasing_invoices', name: '仕入計上 (AP)' },
            { page: 'purchasing_payments', name: '支払管理' },
            { page: 'purchasing_suppliers', name: '発注先一覧' },
        ]
    },
    {
        id: 'manufacturing',
        name: '製造管理',
        icon: HardHat,
        adminOnly: true,
        items: [
            { page: 'inventory_management', name: '在庫管理' },
            { page: 'manufacturing_orders', name: '製造指示' },
            { page: 'manufacturing_progress', name: '製造パイプライン' },
            { page: 'manufacturing_cost', name: '製造原価' },
        ]
    },
    {
        id: 'hr',
        name: '人事労務',
        icon: Users,
        adminOnly: true,
        items: [
            { page: 'hr_attendance', name: '勤怠' },
            { page: 'hr_man_hours', name: '工数' },
            { page: 'hr_labor_cost', name: '人件費配賦' },
            { page: 'hr_org_chart', name: '組織図' },
        ]
    },
    {
        id: 'approvals',
        name: '申請・承認',
        icon: CheckCircle,
        items: [
            { page: 'approval_list', name: '承認一覧' },
            { page: 'approval_form_expense', name: '経費精算' },
            { page: 'approval_form_transport', name: '交通費申請' },
            { page: 'approval_form_leave', name: '休暇申請' },
            { page: 'approval_form_approval', name: '経費なし稟議申請' },
        ]
    },
    {
        id: 'reports',
        name: '業務報告',
        icon: FileText,
        items: [
            { page: 'approval_form_daily', name: '日報' },
            { page: 'approval_form_weekly', name: '週報' },
            { page: 'report_other', name: '営業・セミナー・その他報告' },
        ]
    },
    {
        id: 'knowledge',
        name: 'ナレッジ',
        icon: BookOpen,
        items: [
            { page: 'knowledge_base', name: 'ナレッジベース' },
        ]
    },
    {
        id: 'accounting',
        name: '会計',
        icon: BookOpen,
        adminOnly: true,
        items: [
            { page: 'accounting_journal', name: '仕訳帳' },
            { page: 'accounting_general_ledger', name: '総勘定元帳' },
            { page: 'accounting_trial_balance', name: '試算表' },
            { page: 'accounting_tax_summary', name: '消費税集計' },
            { page: 'accounting_period_closing', name: '締処理' },
            { page: 'accounting_business_plan', name: '経営計画' },
            { page: 'accounting_bulk_upload', name: '一括アップロード' },
        ]
    },
    {
        id: 'ai_consultant',
        name: 'AI業務支援',
        icon: Lightbulb,
        items: [
            { page: 'ai_anything_analysis', name: 'なんでも分析' },
            { page: 'ai_business_consultant', name: 'AI業務支援' },
            { page: 'ai_market_research', name: 'AI市場調査' },
            { page: 'ai_live_chat', name: 'AIライブチャット' },
        ]
    },
    {
        id: 'admin',
        name: 'ログ／監査',
        icon: Archive,
        adminOnly: true,
        items: [
            { page: 'admin_audit_log', name: '監査ログ' },
            { page: 'admin_journal_queue', name: 'ジャーナル・キュー' },
        ]
    },
    {
        id: 'management',
        name: '管理',
        icon: Settings,
        adminOnly: true,
        items: [
            { page: 'admin_user_management', name: 'ユーザー管理' },
            { page: 'admin_route_management', name: '承認ルート管理' },
            { page: 'admin_master_management', name: 'マスタ管理' },
            { page: 'admin_bug_reports', name: '改善要望一覧' },
        ]
    }
];

const CollapsibleNavItem: React.FC<{
  category: NavCategoryType;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ category, currentPage, onNavigate, isOpen, onToggle }) => {
  const isCategoryActive = category.items.some(item => currentPage === item.page);

  return (
    <li>
      <button
        onClick={onToggle}
        className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${
          isCategoryActive
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <category.icon className="w-5 h-5" />
        <span className="ml-4 font-medium">{category.name}</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-1">
          {category.items.map(item => (
            <li key={item.page}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(item.page); }}
                className={`flex items-center p-3 rounded-lg transition-colors duration-200 pl-11 ${
                  currentPage === item.page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <span>{item.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};


export const buildNavCategories = (currentUser: EmployeeUser | null): NavCategoryType[] => {
  return ALL_NAV_CATEGORIES.map(category => {
      let items = category.items;
      if (category.id === 'ai_consultant') {
          items = category.items.filter(item => {
              if (item.page === 'ai_anything_analysis') {
                  return !!currentUser?.canUseAnythingAnalysis;
              }
              return true;
          });
      }
      return { ...category, items };
  })
  .filter(category => {
      if (category.items.length === 0) return false;
      const isAdmin = currentUser?.role === 'admin';
      if (isAdmin) return true;
      if (category.id === 'hr' || category.id === 'accounting') {
          return false;
      }
      return true;
  });
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentUser, onSignOut }) => {
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>({});

  const navCategories = React.useMemo(() => buildNavCategories(currentUser), [currentUser]);


  React.useEffect(() => {
    const activeCategory = navCategories.find(cat => cat.items.some(item => item.page === currentPage));
    if (activeCategory) {
      setOpenCategories(prev => ({ ...prev, [activeCategory.id]: true }));
    }
  }, [currentPage, navCategories]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800 text-white flex flex-col p-4">
      <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-700">
        <Package className="w-8 h-8 text-blue-400" />
        <h1 className="text-xl font-bold tracking-tight">MQ会計ドリブン</h1>
      </div>
      <nav className="flex-1 mt-6 space-y-2 overflow-y-auto">
        <ul>
            <li>
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onNavigate('analysis_dashboard'); }}
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    currentPage === 'analysis_dashboard'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="ml-4 font-medium">ホーム</span>
                </a>
            </li>
          {navCategories.map(category => (
            <CollapsibleNavItem
              key={category.id}
              category={category}
              currentPage={currentPage}
              onNavigate={onNavigate}
              isOpen={!!openCategories[category.id]}
              onToggle={() => toggleCategory(category.id)}
            />
          ))}
        </ul>
      </nav>
      <div className="mt-auto pt-4 border-t border-slate-700 space-y-4">
        <div className="px-3 py-2 flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-blue-300">
                {currentUser?.name?.charAt(0)}
           </div>
           <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate" title={currentUser?.name}>{currentUser?.name}</p>
                <p className="text-xs text-slate-400 truncate" title={currentUser?.email}>{currentUser?.email}</p>
           </div>
           <button onClick={onSignOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md" title="ログアウト">
                <LogOut className="w-5 h-5"/>
           </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;