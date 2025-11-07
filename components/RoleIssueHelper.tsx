import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Shield, X } from './Icons';

interface RoleIssueHelperProps {
  currentUser: any;
  onRefresh: () => void;
}

/**
 * 「メニューが少ない」問題を解決するヘルパー
 * クッキーを消せとは絶対に言わない
 */
const RoleIssueHelper: React.FC<RoleIssueHelperProps> = ({ currentUser, onRefresh }) => {
  const [showHelper, setShowHelper] = useState(false);

  // 管理者なのに管理メニューが見えない可能性がある場合に表示
  const shouldShowHelper = currentUser && currentUser.role !== 'admin';

  if (!shouldShowHelper) return null;

  return (
    <>
      {/* 常に表示される小さなヘルプボタン */}
      <button
        onClick={() => setShowHelper(true)}
        className="fixed top-20 right-4 bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-full shadow-lg transition-transform transform hover:scale-110 z-40"
        title="メニューが少ない？"
      >
        <AlertTriangle className="w-5 h-5" />
      </button>

      {/* ヘルプモーダル */}
      {showHelper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">メニューが少ないですか？</h2>
                    <p className="text-sm text-yellow-100 mt-1">
                      一緒に解決しましょう！
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelper(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="p-6 space-y-6">
              {/* 現在の状況 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5">
                <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  現在の状況
                </h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <p><strong>ログイン中のユーザー：</strong>{currentUser.name || currentUser.email}</p>
                  <p><strong>現在の権限：</strong>
                    {currentUser.role === 'admin' ? (
                      <span className="text-green-600 font-bold">👑 管理者</span>
                    ) : (
                      <span className="text-orange-600 font-bold">👤 一般ユーザー</span>
                    )}
                  </p>
                </div>
              </div>

              {/* 解決方法 */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg">以下の方法をお試しください：</h3>

                {/* 方法1: ページを更新 */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      1
                    </div>
                    <h4 className="font-bold text-green-900 dark:text-green-100 text-lg">
                      ページを更新する
                    </h4>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200 mb-4 ml-11">
                    権限が変更された直後は、ページを更新する必要があります。
                  </p>
                  <button
                    onClick={() => {
                      onRefresh();
                      setShowHelper(false);
                    }}
                    className="ml-11 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    今すぐページを更新する
                  </button>
                </div>

                {/* 方法2: 管理者に権限をリクエスト */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      2
                    </div>
                    <h4 className="font-bold text-purple-900 dark:text-purple-100 text-lg">
                      管理者権限をリクエストする
                    </h4>
                  </div>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mb-4 ml-11">
                    まだ管理者権限が付与されていない場合は、右下の「管理者権限をリクエスト」ボタンから申請できます。
                  </p>
                  <div className="ml-11 flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                    <Shield className="w-5 h-5" />
                    <span>画面右下のボタンをご確認ください</span>
                  </div>
                </div>

                {/* 方法3: ログアウトして再ログイン */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      3
                    </div>
                    <h4 className="font-bold text-orange-900 dark:text-orange-100 text-lg">
                      ログアウトして再ログインする
                    </h4>
                  </div>
                  <p className="text-sm text-orange-800 dark:text-orange-200 ml-11">
                    ページの更新でも解決しない場合は、一度ログアウトして、もう一度ログインしてみてください。
                  </p>
                </div>
              </div>

              {/* 重要な注意 */}
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-5">
                <h4 className="font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  重要なお知らせ
                </h4>
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>ブラウザのキャッシュやクッキーを削除する必要はありません。</strong>
                  <br />
                  上記の方法で解決しない場合は、右下のチャットでお問い合わせください。
                  <br />
                  私も文章堂の一員として、全力でサポートいたします！
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-2xl">
              <button
                onClick={() => setShowHelper(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg"
              >
                わかりました
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoleIssueHelper;
