import * as React from 'react';
import { Page, EmployeeUser } from '../types';
import { LayoutDashboard, Users, Settings, Package, FileText, Briefcase, ChevronDown, DollarSign, TrendingUp, Inbox, PieChart, ShoppingCart, BookOpen, CreditCard, HardHat, CheckCircle, Archive, Lightbulb } from './Icons';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  currentUser: EmployeeUser | null;
  allUsers: EmployeeUser[];
  onUserChange: (user: EmployeeUser | null) => void;
  supabaseUserEmail?: string | null;
  onSignOut?: () => void;
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

const ALL_NAV_CATEGORIES: NavCategoryType[] = [
    {
        id: 'sales',
        name: '販売',
        icon: Briefcase,
        adminOnly: true,
        items: [
            { page: 'sales_dashboard', name: '販売ダッシュボード' },
            { page: 'sales_leads', name: 'リード' },
            { page: 'sales_customers', name: '取引先' },
            { page: 'sales_pipeline', name: 'パイプライン（進捗）' },
            { page: 'sales_estimates', name: '見積' },
            { page: 'sales_orders', name: '案件・受注管理' },
            { page: 'sales_billing', name: '売上請求 (AR)' },
            { page: 'analysis_ranking', name: '売上ランキング' },
            { page: 'business_support_proposal', name: '提案書作成' },
        ]
    },
    {
        id: 'purchasing',
        name: '購買',
        icon: ShoppingCart,
        adminOnly: true,
        items: [
            { page: 'purchasing_orders', name: '発注 (PO)' },
            { page: 'purchasing_invoices', name: '仕入計上 (AP)' },
            { page: 'purchasing_payments', name: '支払' },
        ]
    },
    {
        id: 'inventory',
        name: '在庫／製造',
        icon: Package,
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
            { page: 'approval_form_approval', name: '稟議' },
            { page: 'approval_form_daily', name: '日報' },
            { page: 'approval_form_weekly', name: '週報' },
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
        ]
    },
    {
        id: 'ai_consultant',
        name: 'AI経営相談',
        icon: Lightbulb,
        adminOnly: true,
        items: [
            { page: 'ai_business_consultant', name: 'AI経営相談' },
            { page: 'ai_market_research', name: 'AI市場調査' },
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


const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentUser, allUsers, onUserChange, supabaseUserEmail, onSignOut }) => {
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>({});

  const visibleCategories = ALL_NAV_CATEGORIES;

  React.useEffect(() => {
    const activeCategory = visibleCategories.find(cat => cat.items.some(item => item.page === currentPage));
    if (activeCategory) {
      setOpenCategories(prev => ({ ...prev, [activeCategory.id]: true }));
    }
  }, [currentPage, visibleCategories]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800 text-white flex flex-col p-4">
      <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-700">
        <Package className="w-8 h-8 text-blue-400" />
        <h1 className="text-xl font-bold tracking-tight">MQ会計ドリブン</h1>
      </div>
      <nav className="flex-1 mt-6 space-y-2">
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
          {visibleCategories.map(category => (
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
        {supabaseUserEmail && (
          <div className="px-3 py-2 rounded-lg bg-slate-700/60">
            <p className="text-xs text-slate-400">ログイン中のユーザー</p>
            <p className="text-sm font-semibold text-white break-all">{supabaseUserEmail}</p>
          </div>
        )}
        <div className="px-3 py-2">
           <label htmlFor="user-select" className="text-xs font-medium text-slate-400">ユーザー切替</label>
           <select 
                id="user-select"
                className="w-full mt-1 bg-slate-700 border-slate-600 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={currentUser?.id || ''}
                onChange={(e) => {
                    const selectedUser = allUsers.find(u => u.id === e.target.value);
                    onUserChange(selectedUser || null);
                }}
           >
                {allUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                ))}
           </select>
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="w-full px-3 py-2 text-sm font-semibold text-center text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
          >
            ログアウト
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
