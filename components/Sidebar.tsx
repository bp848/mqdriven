import * as React from 'react';
import { Page, EmployeeUser } from '../types';
import { Calendar, ClipboardList, Users, Settings, Package, Briefcase, ChevronDown, DollarSign, Inbox, PieChart, ShoppingCart, BookOpen, CheckCircle, Archive } from './Icons';

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
};

type NavCategoryType = {
  id: string;
  name: string;
  icon: React.ElementType;
  items: NavItemType[];
  adminOnly?: boolean;
};

const HIDDEN_CATEGORY_IDS: string[] = [
  'sales',
  'purchasing',
  'analysis',
  'project_management',
  'inventory',
  'hr',
  'accounting',
  'admin',
  'management',
];

const BASE_NAV_CATEGORIES: NavCategoryType[] = [
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
    ],
  },
  {
    id: 'reports',
    name: '報告',
    icon: ClipboardList,
    items: [
      { page: 'approval_form_weekly', name: '週報' },
    ],
  },
  {
    id: 'admin_tools',
    name: '管理メニュー',
    icon: Settings,
    adminOnly: true,
    items: [
      { page: 'admin_user_management', name: 'ユーザー管理' },
      { page: 'admin_route_management', name: '承認ルート管理' },
      { page: 'admin_master_management', name: 'マスタ管理' },
      { page: 'admin_audit_log', name: '監査ログ' },
      { page: 'admin_journal_queue', name: 'ジャーナル・キュー' },
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
  const visibleCategories = baseCategories.filter(
    (category) => !HIDDEN_CATEGORY_IDS.includes(category.id)
  );

  if (user?.role === 'admin') {
    return visibleCategories;
  }

  return visibleCategories.filter((category) => !category.adminOnly);
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
  const visibleCategories = React.useMemo(
    () => buildNavCategories(currentUser, approvalsCount),
    [currentUser, approvalsCount]
  );

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800 text-white flex flex-col p-4 min-h-screen">
      <div className="px-3 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Package className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">業務管理</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-300/80">
          <a href="https://erp.co.jp" target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors">業務</a>
          <a href="https://kaikeico.jp" target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors">会計</a>
          <a href="https://erp.co.jp" target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors">MQ</a>
          <a href="https://dtp.b-p.co.jp" target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors">DTP</a>
          <a href="https://co3.b-p.co.jp" target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors">エコ</a>
        </div>
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
                    <PieChart className="w-5 h-5" />
                    <span className="ml-4 font-medium">ダッシュボードトップ</span>
                </a>
            </li>
            <li>
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onNavigate('bulletin_board'); }}
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                        currentPage === 'bulletin_board'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <Inbox className="w-5 h-5" />
                    <span className="ml-4 font-medium">社内掲示板</span>
                </a>
            </li>
            <li>
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onNavigate('fax_ocr_intake'); }}
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                        currentPage === 'fax_ocr_intake'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <Archive className="w-5 h-5" />
                    <span className="ml-4 font-medium">FAXや郵便でもデータ自動入力</span>
                </a>
            </li>
            <li>
                <a
                    href="#"
                    onClick={e => { e.preventDefault(); onNavigate('meeting_minutes'); }}
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                        currentPage === 'meeting_minutes'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <ClipboardList className="w-5 h-5" />
                    <span className="ml-4 font-medium">議事録支援</span>
                </a>
            </li>
            <li>
                <a
                    href="#"
                    onClick={e => { e.preventDefault(); onNavigate('my_schedule'); }}
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                        currentPage === 'my_schedule'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <Calendar className="w-5 h-5" />
                    <span className="ml-4 font-medium">マイスケジュール</span>
                </a>
            </li>
          {visibleCategories.map(category => (
            <React.Fragment key={category.id}>
              <li className="mt-4 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {category.name}
              </li>
              {category.items.map(item => (
                <li key={item.page}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onNavigate(item.page); }}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${
                      currentPage === item.page
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="ml-4 font-medium">{item.name}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`ml-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.badgeColor === 'green'
                            ? 'bg-emerald-500 text-white'
                            : item.badgeColor === 'red'
                              ? 'bg-rose-500 text-white'
                              : 'bg-blue-500 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </a>
                </li>
              ))}
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
