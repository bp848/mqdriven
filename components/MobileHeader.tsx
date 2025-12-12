import React, { useState } from 'react';
import { Package, X } from './Icons';
import { Page, EmployeeUser } from '../types';
import { buildNavCategories } from './Sidebar';

interface MobileHeaderProps {
  title: string;
  currentUser: EmployeeUser | null;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  approvalsCount?: number;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  currentUser,
  currentPage,
  onNavigate,
  onSignOut,
  approvalsCount,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navCategories = React.useMemo(
    () => buildNavCategories(currentUser, approvalsCount),
    [currentUser, approvalsCount]
  );

  const handleMenuClick = (page: Page) => {
    onNavigate(page);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex items-center justify-between sticky top-0 z-30">
        {/* ハンバーガーメニューボタン */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="w-6 h-6 flex flex-col justify-center space-y-1">
            <div className="w-full h-0.5 bg-slate-600 dark:bg-slate-300"></div>
            <div className="w-full h-0.5 bg-slate-600 dark:bg-slate-300"></div>
            <div className="w-full h-0.5 bg-slate-600 dark:bg-slate-300"></div>
          </div>
        </button>

        {/* タイトル */}
        <h1 className="text-lg font-semibold text-slate-800 dark:text-white truncate">
          {title}
        </h1>

        {/* ユーザーアバター */}
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {currentUser?.name?.charAt(0) || 'U'}
        </div>
      </div>

      {/* オーバーレイ */}
      {isMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* サイドメニュー */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-800 transform transition-transform duration-300 ease-in-out z-50 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-slate-800 dark:text-white">
              MQ会計ERP
            </span>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* ユーザー情報 */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white">
                {currentUser?.name || 'ユーザー'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentUser?.email}
              </p>
            </div>
          </div>
        </div>

        {/* メニューアイテム（Sidebarと同一ロジック） */}
        <div className="flex-1 overflow-y-auto py-4">
          {navCategories.map((cat) => (
            <div key={cat.id} className="mt-2">
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {cat.name}
              </div>
              {cat.items.map((it) => {
                const ItemIcon = it.icon ?? cat.icon;
                const isActive = currentPage === it.page;
                return (
                  <button
                    key={it.page}
                    onClick={() => handleMenuClick(it.page)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {ItemIcon && <ItemIcon className="w-4 h-4 flex-shrink-0" />}
                    <span className="font-medium flex-1">{it.name}</span>
                    {it.badge !== undefined && it.badge > 0 && (
                      <span
                        className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          it.badgeColor === 'green'
                            ? 'bg-emerald-500 text-white'
                            : it.badgeColor === 'red'
                              ? 'bg-rose-500 text-white'
                              : 'bg-blue-500 text-white'
                        }`}
                      >
                        {it.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <button
            onClick={() => {
              onSignOut();
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">ログアウト</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileHeader;
