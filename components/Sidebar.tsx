import * as React from 'react';
import { Page, EmployeeUser } from '../types';
import { Calendar, ClipboardList, Settings, Briefcase, DollarSign, Inbox, PieChart, BookOpen, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, Mail } from './Icons';

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
  badge?: number;
  badgeColor?: 'blue' | 'green' | 'red';
  icon?: React.ElementType;
  adminOnly?: boolean;
  children?: NavItemType[];
};

type NavCategoryType = {
  id: string;
  name: string;
  icon?: React.ElementType;
  items: NavItemType[];
  adminOnly?: boolean;
};

const BASE_NAV_CATEGORIES: NavCategoryType[] = [
  {
    id: 'sales',
    name: '営業',
    icon: Briefcase,
    items: [
      { page: 'sales_leads', name: 'リード管理' },
      { page: 'sales_customers', name: '取引先/顧客カルテ' },
      { page: 'sales_estimates', name: '見積管理' },
      { page: 'sales_orders', name: '受注・予算管理' },
      { page: 'newsletter', name: 'メールマガジン', icon: Mail },
    ],
  },
  {
    id: 'calendar',
    name: 'カレンダー',
    icon: Calendar,
    items: [
      { page: 'my_schedule', name: '日報タスクカレンダー', icon: Calendar },
    ],
  },
  {
    id: 'approval',
    name: '承認一覧',
    icon: CheckCircle,
    items: [
      { page: 'approval_list', name: '承認一覧', icon: CheckCircle },
      { page: 'approval_form_expense', name: '経費精算' },
      { page: 'approval_form_transport', name: '交通費精算' },
      { page: 'approval_form_leave', name: '休暇申請' },
      { page: 'approval_form_approval', name: '稟議申請' },
      { page: 'approval_form_weekly', name: '週報申請' },
    ],
  },
  {
    id: 'accounting',
    name: '会計',
    icon: DollarSign,
    items: [
      { page: 'accounting_approved_applications', name: '承認済一覧' },
      { page: 'accounting_journal_review', name: '仕訳レビュー' },
      { page: 'accounting_journal', name: '仕訳帳' },
      { page: 'accounting_general_ledger', name: '総勘定元帳' },
      { page: 'accounting_payables', name: '支払管理' },
      { page: 'accounting_receivables', name: '売掛金管理' },
      { page: 'accounting_cash_schedule', name: '資金繰り表' },
      { page: 'accounting_trial_balance', name: '試算表' },
      { page: 'accounting_tax_summary', name: '消費税集計' },
      { page: 'accounting_expense_analysis', name: '経費分析' },
      { page: 'accounting_period_closing', name: '締処理' },
    ],
  },
  {
    id: 'management',
    name: '管理',
    icon: Settings,
    items: [
      { page: 'inventory_management', name: '在庫管理' },
      { page: 'manufacturing_orders', name: '製造管理' },
      { page: 'purchasing_orders', name: '購買管理' },
      { page: 'hr_attendance', name: '勤怠管理' },
      { page: 'hr_labor_cost', name: '人件費管理' },
    ],
  },
  {
    id: 'tools',
    name: 'ツール',
    icon: BookOpen,
    items: [
      { page: 'admin_user_management', name: 'ユーザー管理', adminOnly: true },
      { page: 'admin_route_management', name: '承認ルート管理', adminOnly: true },
      { page: 'admin_master_management', name: 'マスタ管理', adminOnly: true },
      { page: 'admin_action_console', name: 'アクションコンソール', adminOnly: true },
      { page: 'settings', name: '通知メール設定', adminOnly: true },
    ],
  },
];

const decorateCategories = (
  categories: NavCategoryType[],
  pendingApprovalCount?: number
): NavCategoryType[] =>
  categories.map(category => {
    if (category.id !== 'sales') return category;
    return {
      ...category,
      items: category.items.map(item =>
        item.page === 'approval_list'
          ? { ...item, badge: pendingApprovalCount, badgeColor: 'blue' }
          : item
      ),
    };
  });

export const buildNavCategories = (
  user: EmployeeUser | null,
  pendingApprovalCount?: number
): NavCategoryType[] => {
  const baseCategories = decorateCategories(BASE_NAV_CATEGORIES, pendingApprovalCount);

  const isAdmin = user?.role === 'admin';

  return baseCategories
    .filter((category) => isAdmin || !category.adminOnly)
    .map(category => {
      const items = isAdmin ? category.items : category.items.filter(item => !item.adminOnly);
      return { ...category, items };
    })
    .filter(category => category.items.length > 0);
};

interface SidebarWithCountsProps extends SidebarProps {
  approvalsCount?: number;
}

const Sidebar: React.FC<SidebarWithCountsProps> = ({
  currentPage,
  onNavigate,
  currentUser,
  allUsers,
  onUserChange,
  supabaseUserEmail,
  onSignOut,
  approvalsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !(prev[categoryId] ?? false) }));
  };
  const visibleCategories = React.useMemo(
    () => buildNavCategories(currentUser, approvalsCount),
    [currentUser, approvalsCount]
  );

  const sidebarWidth = isCollapsed ? 'sm:w-20 w-full' : 'sm:w-64 w-full';
  const sidebarTransition = 'transition-all duration-300 ease-in-out';

  return (
    <aside
      className={`${sidebarWidth} ${sidebarTransition} flex-shrink-0 bg-slate-800 text-white flex flex-col p-4 sm:h-full h-[64px] sm:h-screen min-h-0 sm:relative fixed top-0 left-0 z-40`}
    >
      <div className={`px-3 py-4 border-b border-slate-700 overflow-hidden ${isCollapsed ? 'text-center' : ''} hidden sm:block`}>
        <div className="flex items-center gap-2">
          <h1 className={`text-xl font-bold tracking-tight whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>業務</h1>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto h-8 w-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <div className={`mt-2 flex flex-wrap gap-1 text-[10px] text-slate-300/80 ${isCollapsed ? 'justify-center' : ''}`}>
          <a href="https://erp.b-p.co.jp" target="_blank" rel="noopener noreferrer" className={`px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors ${isCollapsed ? 'block w-6 h-6 text-center leading-6' : ''}`} title="業務">業</a>
          <a href="https://mq.b-p.co.jp" target="_blank" rel="noopener noreferrer" className={`px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors ${isCollapsed ? 'block w-6 h-6 text-center leading-6' : ''}`} title="MQ">MQ</a>
          <a href="https://dtp.b-p.co.jp" target="_blank" rel="noopener noreferrer" className={`px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors ${isCollapsed ? 'block w-6 h-6 text-center leading-6' : ''}`} title="DTP">D</a>
          <a href="https://co2.b-p.co.jp/" target="_blank" rel="noopener noreferrer" className={`px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors ${isCollapsed ? 'block w-6 h-6 text-center leading-6' : ''}`} title="エコ">E</a>
        </div>
      </div>
      <nav className={`flex-1 mt-2 sm:mt-6 space-y-2 overflow-y-auto min-h-0 ${isCollapsed ? 'px-1' : 'px-2'}`}>
        <ul>
          {visibleCategories.map(category => {
            const isCategoryExpanded = !isCollapsed && (expandedCategories[category.id] ?? true);

            return (
              <React.Fragment key={category.id}>
                <li className={`mt-4 px-3 text-xs sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${isCollapsed ? 'sr-only' : ''}`}>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="flex items-center w-full hover:text-slate-300 transition-colors"
                      aria-label={isCategoryExpanded ? `${category.name}カテゴリを折りたたむ` : `${category.name}カテゴリを展開する`}
                    >
                      {category.icon && <category.icon className="w-4 h-4 mr-2" />}
                      <span className="flex-1 text-left">{category.name}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </li>
                {isCategoryExpanded && category.items.map(item => {
                  const ItemIcon = item.icon ?? category.icon;
                  const isChildActive = item.children?.some(child => child.page === currentPage) ?? false;
                  const isActive = currentPage === item.page || isChildActive;
                  const isExpanded = !isCollapsed && ((expandedItems[item.page] ?? false) || isChildActive);
                  return (
                    <li key={item.page}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (item.children) {
                            e.stopPropagation();
                            setExpandedItems(prev => ({ ...prev, [item.page]: !(prev[item.page] ?? false) }));
                          } else {
                            onNavigate(item.page);
                          }
                        }}
                        className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          } ${isCollapsed ? 'justify-center' : 'gap-3'} text-sm sm:text-base min-h-[44px]`}
                      >
                        {ItemIcon && <ItemIcon className="w-5 h-5 flex-shrink-0" />}
                        <span className={`font-medium ${isCollapsed ? 'sr-only' : ''}`}>{item.name}</span>
                        {item.children && !isCollapsed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedItems(prev => ({ ...prev, [item.page]: !(prev[item.page] ?? false) }));
                            }}
                            className="ml-auto p-1 rounded hover:bg-slate-600/40"
                            aria-label={isExpanded ? '折りたたむ' : '展開する'}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        {item.badge !== undefined && item.badge > 0 && !item.children && (
                          <span
                            className={`ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.badgeColor === 'green'
                              ? 'bg-emerald-500 text-white'
                              : item.badgeColor === 'red'
                                ? 'bg-rose-500 text-white'
                                : 'bg-blue-500 text-white'
                              } ${isCollapsed ? 'ml-0' : ''}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </a>
                      {item.children && isExpanded && (
                        <ul className="mt-1 space-y-1">
                          {item.children.map(child => {
                            const isChildPageActive = currentPage === child.page;
                            return (
                              <li key={child.page}>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); onNavigate(child.page); }}
                                  className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${isChildPageActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                    } ml-8`}
                                >
                                  <span className="font-medium">{child.name}</span>
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto pt-4 border-t border-slate-700 space-y-4">
        {supabaseUserEmail && (
          <div className="px-3 py-2 rounded-lg bg-slate-700/60">
            <p className="text-xs text-slate-400">ログイン中のユーザー</p>
            <p className="text-sm font-semibold text-white break-all">{supabaseUserEmail}</p>
          </div>
        )}
        {currentUser?.role === 'admin' && (
          <div className="px-3 py-2">
            <label htmlFor="user-select" className="text-xs font-medium text-slate-400">ユーザー切替 (管理者のみ)</label>
            <select
              id="user-select"
              className="w-full mt-1 bg-slate-700 border-slate-600 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              value={currentUser?.id || ''}
              onChange={(e) => {
                const selectedUser = allUsers.find(u => u.id === e.target.value);
                onUserChange(selectedUser || null);
              }}
            >
              {allUsers.filter(user => user.is_active !== false).map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        )}
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
