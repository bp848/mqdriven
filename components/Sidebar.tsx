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

const ALL_NAV_CATEGORIES: NavCategoryType[] = [
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
      { page: 'approval_form_daily', name: '日報' },
      { page: 'approval_form_weekly', name: '週報' },
    ],
  },
];

export const buildNavCategories = (user: EmployeeUser | null): NavCategoryType[] => {
  const visibleCategories = ALL_NAV_CATEGORIES.filter(
    (category) => !HIDDEN_CATEGORY_IDS.includes(category.id)
  );

  if (user?.role === 'admin') {
    return visibleCategories;
  }

  return visibleCategories.filter((category) => !category.adminOnly);
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentUser, allUsers, onUserChange, supabaseUserEmail, onSignOut }) => {
  const visibleCategories = React.useMemo(() => buildNavCategories(currentUser), [currentUser]);

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800 text-white flex flex-col p-4 min-h-screen">
      <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-700">
        <Package className="w-8 h-8 text-blue-400" />
        <h1 className="text-xl font-bold tracking-tight">業務管理</h1>
      </div>
      <nav className="flex-1 mt-6 space-y-2">
        <ul>
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
                    className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                      currentPage === item.page
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="ml-4 font-medium">{item.name}</span>
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
