import * as React from 'react';
import { Page, EmployeeUser } from '../types';
import { Calendar, ClipboardList, Settings, Briefcase, DollarSign, Inbox, PieChart, BookOpen, CheckCircle, ChevronLeft, ChevronRight } from './Icons';

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
    id: 'home',
    name: 'ホーム',
    icon: PieChart,
    items: [
      { page: 'analysis_dashboard', name: 'ダッシュボード', icon: PieChart },
      { page: 'my_schedule', name: '日報タスクカレンダー', icon: Calendar },
      { page: 'bulletin_board', name: '議事録/掲示板', icon: Inbox },
      { page: 'meeting_minutes', name: '議事録支援', icon: ClipboardList },
      { page: 'fax_ocr_intake', name: '何でも取り込み', icon: Inbox },
    ],
  },
  {
    id: 'sales',
    name: '営業・販売',
    icon: Briefcase,
    items: [
      { page: 'sales_dashboard', name: '販売状況' },
      { page: 'sales_leads', name: 'リード管理' },
      { page: 'sales_customers', name: '取引先 / お客様カルテ' },
      { page: 'sales_pipeline', name: '進捗管理' },
      { page: 'sales_estimates', name: '見積管理' },
      { page: 'sales_orders', name: '予算管理' },
      { page: 'sales_billing', name: '売上請求（AR）' },
    ],
  },
  {
    id: 'approvals',
    name: '経費・社内申請',
    icon: CheckCircle,
    items: [
      { page: 'approval_list', name: '承認一覧' },
      { page: 'approval_form_expense', name: '経費精算' },
      { page: 'approval_form_transport', name: '交通費精算' },
      { page: 'approval_form_leave', name: '休暇申請' },
      { page: 'approval_form_approval', name: '稟議申請' },
      { page: 'accounting_approved_applications', name: '承認済み申請' },
    ],
  },
  {
    id: 'document_creation',
    name: '制作・原稿 / DTP生成',
    icon: BookOpen,
    items: [
      { page: 'document_creation_tools', name: '資料作成' },
      { page: 'proposal_ai', name: '提案書作成AI' },
      { page: 'pdf_editing_tools', name: 'PDF編集AI' },
      { page: 'dtp_tools', name: 'DTP自動組版AI' },
    ],
  },
  {
    id: 'accounting',
    name: '会計',
    icon: DollarSign,
    items: [
        { page: 'accounting_dashboard', name: '会計ダッシュボード' },
        { page: 'accounting_journal_review', name: '仕訳レビュー' },
        { page: 'accounting_journal', name: '仕訳帳' },
        { page: 'accounting_general_ledger', name: '総勘定元帳' },
        { page: 'accounting_payables', name: '支払管理' },
        { page: 'accounting_receivables', name: '売掛金管理' },
        { page: 'accounting_cash_schedule', name: '資金繰り表' },
        { page: 'accounting_trial_balance', name: '試算表' },
        { page: 'accounting_tax_summary', name: '消費税集計' },
        { page: 'accounting_period_closing', name: '締処理' },
        { page: 'accounting_business_plan', name: '経営計画' },
    ],
  },
  {
    id: 'admin_tools',
    name: '管理',
    icon: Settings,
    adminOnly: true,
    items: [
      { page: 'admin_user_management', name: 'ユーザー管理' },
      { page: 'admin_route_management', name: '承認ルート管理' },
      { page: 'admin_master_management', name: 'マスタ管理' },
      { page: 'admin_action_console', name: 'アクションコンソール' },
      { page: 'settings', name: '通知メール設定' },
    ],
  },
];

const decorateCategories = (
  categories: NavCategoryType[],
  pendingApprovalCount?: number
): NavCategoryType[] =>
  categories.map(category => {
    if (category.id !== 'approvals') return category;
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

  if (user?.role === 'admin') {
    return baseCategories;
  }

  return baseCategories.filter((category) => !category.adminOnly);
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

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };
  const visibleCategories = React.useMemo(
    () => buildNavCategories(currentUser, approvalsCount),
    [currentUser, approvalsCount]
  );

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-64';
  const sidebarTransition = 'transition-all duration-300 ease-in-out';

  return (
    <aside className={`${sidebarWidth} ${sidebarTransition} flex-shrink-0 bg-slate-800 text-white flex flex-col p-4 h-full min-h-0 relative`}>
      <div className={`px-3 py-4 border-b border-slate-700 overflow-hidden ${isCollapsed ? 'text-center' : ''}`}>
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
      <nav className={`flex-1 mt-6 space-y-2 overflow-y-auto min-h-0 ${isCollapsed ? 'px-1' : 'px-2'}`}>
        <ul>
          {visibleCategories.map(category => (
            <React.Fragment key={category.id}>
              <li className={`mt-4 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${isCollapsed ? 'sr-only' : ''}`}>
                {category.name}
              </li>
              {category.items.map(item => {
                const ItemIcon = item.icon ?? category.icon;
                const isActive = currentPage === item.page;
                return (
                  <li key={item.page}>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); onNavigate(item.page); }}
                      className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                        isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
                    >
                      {ItemIcon && <ItemIcon className="w-5 h-5 flex-shrink-0" />}
                      <span className={`font-medium ${isCollapsed ? 'sr-only' : ''}`}>{item.name}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.badgeColor === 'green'
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
                  </li>
                );
              })}
            </React.Fragment>
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
                {allUsers.map(user => (
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
