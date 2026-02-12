import * as React from 'react';
import { Page, EmployeeUser } from '../types';
import {
  Calendar,
  ClipboardList,
  Settings,
  Briefcase,
  DollarSign,
  Inbox,
  PieChart,
  BookOpen,
  CheckCircle,
  Mail,
  Menu,
  X,
} from './Icons';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  currentUser: EmployeeUser | null;
  allUsers: EmployeeUser[];
  onUserChange: (user: EmployeeUser | null) => void;
  supabaseUserEmail?: string | null;
  onSignOut?: () => void;
  approvalsCount?: number;
}

type NavItemType = {
  page: Page;
  name: string;
  icon?: React.ElementType;
  badge?: number;
  adminOnly?: boolean;
};

const NAV_ITEMS: { id: string; title: string; items: NavItemType[] }[] = [
  {
    id: 'sales',
    title: '営業',
    items: [
      { page: 'sales_leads', name: 'リード', icon: Briefcase },
      { page: 'sales_customers', name: '顧客カルテ', icon: Inbox },
      { page: 'sales_estimates', name: '見積', icon: PieChart },
      { page: 'sales_orders', name: '受注予算', icon: DollarSign },
      { page: 'newsletter', name: 'メルマガ', icon: Mail },
    ],
  },
  {
    id: 'calendar',
    title: 'カレンダー',
    items: [{ page: 'my_schedule', name: '日報カレンダー', icon: Calendar }],
  },
  {
    id: 'approvals',
    title: '承認',
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
    title: '会計',
    items: [
      { page: 'accounting_approved_applications', name: '承認済一覧', icon: DollarSign },
      { page: 'accounting_journal_review', name: '仕訳レビュー' },
      { page: 'accounting_journal', name: '仕訳帳' },
      { page: 'accounting_general_ledger', name: '総勘定元帳' },
      { page: 'accounting_payables', name: '支払管理' },
      { page: 'accounting_receivables', name: '売掛管理' },
      { page: 'accounting_cash_schedule', name: '資金繰り表' },
      { page: 'accounting_trial_balance', name: '試算表' },
      { page: 'accounting_tax_summary', name: '消費税集計' },
      { page: 'accounting_expense_analysis', name: '経費分析' },
      { page: 'accounting_period_closing', name: '締処理' },
    ],
  },
  {
    id: 'management',
    title: '管理',
    items: [
      { page: 'inventory_management', name: '在庫管理', icon: ClipboardList },
      { page: 'manufacturing_orders', name: '製造管理' },
      { page: 'purchasing_orders', name: '購買管理' },
      { page: 'hr_attendance', name: '勤怠管理' },
      { page: 'hr_labor_cost', name: '人件費' },
    ],
  },
  {
    id: 'tools',
    title: 'ツール',
    items: [
      { page: 'admin_user_management', name: 'ユーザー管理', adminOnly: true, icon: Settings },
      { page: 'admin_route_management', name: '承認ルート', adminOnly: true },
      { page: 'admin_master_management', name: 'マスタ管理', adminOnly: true },
      { page: 'admin_action_console', name: 'アクション', adminOnly: true },
      { page: 'settings', name: '通知設定', adminOnly: true },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  currentUser,
  allUsers,
  onUserChange,
  supabaseUserEmail,
  onSignOut,
  approvalsCount,
}) => {
  const [open, setOpen] = React.useState(false);
  const isAdmin = currentUser?.role === 'admin';

  const selectableUsers = React.useMemo(() => {
    const activeUsers = allUsers.filter(u => u.is_active !== false);
    console.log('Sidebar selectableUsers debug:', {
      currentUser,
      allUsersCount: allUsers.length,
      activeUsersCount: activeUsers.length,
      currentUserInActive: currentUser ? activeUsers.some(u => u.id === currentUser.id) : false
    });
    if (currentUser && !activeUsers.some(u => u.id === currentUser.id)) {
      const result = [currentUser, ...activeUsers];
      console.log('Sidebar: adding current user to selectableUsers', result.map(u => ({ id: u.id, name: u.name })));
      return result;
    }
    console.log('Sidebar: using active users only', activeUsers.map(u => ({ id: u.id, name: u.name })));
    return activeUsers;
  }, [allUsers, currentUser]);

  const itemsFlat = React.useMemo(
    () =>
      NAV_ITEMS.flatMap(section =>
        section.items
          .filter(item => {
            // デバッグ用：権限チェックをログ出力
            console.log('Sidebar item check:', {
              page: item.page,
              adminOnly: item.adminOnly,
              isAdmin,
              currentUserRole: currentUser?.role,
              show: isAdmin || !item.adminOnly
            });
            return isAdmin || !item.adminOnly;
          })
          .map(item => ({ ...item, section: section.title }))
      ),
    [isAdmin, currentUser?.role]
  );

  const renderItem = (item: ReturnType<typeof itemsFlat>[number]) => {
    const Icon = item.icon;
    const isActive = currentPage === item.page;
    const badge = item.page === 'approval_list' ? approvalsCount : item.badge;
    return (
      <button
        key={item.page}
        onClick={() => {
          onNavigate(item.page);
          setOpen(false);
        }}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-white/80 hover:bg-slate-900/80'
          }`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        <span>{item.name}</span>
        {badge ? (
          <span className="ml-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-rose-500 text-white text-xs px-2 py-0.5">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-slate-800 text-white shadow-lg">
      <div className="max-w-screen-xl mx-auto flex items-center gap-3 px-4 sm:px-6 h-14">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex sm:hidden items-center justify-center rounded-lg bg-slate-900/70 hover:bg-slate-900 px-3 py-2"
          aria-label="メニュー"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="font-bold tracking-tight text-base sm:text-lg">業務ハブ</div>
        <nav className="hidden sm:flex items-center gap-2 overflow-x-auto whitespace-nowrap flex-1">
          {itemsFlat.map(renderItem)}
        </nav>
        {supabaseUserEmail && (
          <div className="hidden sm:block text-xs text-white/70">{supabaseUserEmail}</div>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="hidden sm:inline-flex items-center rounded-lg bg-slate-900/70 px-3 py-2 text-sm font-semibold"
          >
            ログアウト
          </button>
        )}
      </div>
      {open && (
        <div className="sm:hidden border-t border-white/10 bg-slate-800/98 px-4 pb-4 space-y-4">
          <div className="pt-2 grid grid-cols-2 gap-2">{itemsFlat.map(renderItem)}</div>
          {currentUser?.role === 'admin' && (
            <div className="space-y-1 text-xs text-white/80">
              <label htmlFor="user-select" className="block text-[11px] opacity-80">
                ユーザー切替
              </label>
              <select
                id="user-select"
                className="w-full mt-1 bg-white text-slate-900 border border-slate-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                style={{ color: '#0f172a', backgroundColor: '#ffffff', colorScheme: 'light' }}
                value={currentUser?.id || ''}
                onChange={(e) => {
                  const u = allUsers.find(x => x.id === e.target.value);
                  onUserChange(u || null);
                }}
              >
                {selectableUsers.map(u => (
                  <option key={u.id} value={u.id} className="bg-white text-slate-900">
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold"
            >
              ログアウト
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default Sidebar;
