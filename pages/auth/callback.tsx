import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '../../services/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('ログイン処理中...');
  const [isError, setIsError] = useState(false);
  const hasProcessed = useRef(false);
  const isProcessing = useRef(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // 重複実行防止（より強化）
      if (hasProcessed.current || isProcessing.current) {
        console.log('コールバック処理は既に実行済みまたは実行中');
        return;
      }
      hasProcessed.current = true;
      isProcessing.current = true;
      
      try {
        const supabaseClient = getSupabase();
        const currentUrl = window.location.href;
        
        console.log('コールバック処理開始:', currentUrl);
        
        const urlObj = new URL(currentUrl);
        const searchParams = urlObj.searchParams;
        const hashParamsString = currentUrl.includes('#') ? currentUrl.split('#')[1] : '';
        const hashParams = new URLSearchParams(hashParamsString);
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const hasCode = searchParams.has('code');

        if (!accessToken && !refreshToken && !hasCode) {
          setIsError(true);
          setMessage('無効なコールバックURLです。\n\nログインページから再度お試しください。');
          isProcessing.current = false;
          return;
        }
        
        // 既に使用済みのコードかチェック（ローカルストレージで管理）
        
        let exchangeError: Error | null = null;
        if (accessToken && refreshToken) {
          const { error } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          exchangeError = error ?? null;
        } else {
          const { data, error } = await supabaseClient.auth.exchangeCodeForSession(currentUrl);
          exchangeError = error ?? null;
          if (!exchangeError) {
            console.log('セッション交換成功:', data);
          }
        }
        
        if (exchangeError) {
          console.error('セッション交換エラー:', exchangeError);
          setIsError(true);
          isProcessing.current = false;
          
          if (exchangeError.message?.includes('expired') || exchangeError.message?.includes('invalid') || exchangeError.message?.includes('not found')) {
            setMessage('ログインリンクが無効または期限切れです。\n\n最新のメールから再度お試しください。\n\nヒント: メールクライアントのプレビュー機能でリンクが先に開かれた可能性があります。');
          } else if (exchangeError.message?.includes('both auth code and code verifier should be non-empty')) {
            setMessage('コード交換エラーです。\n\nこのリンクは既に使用済みか、無効です。\n\n新しいログインリンクを取得してください。');
          } else {
            setMessage(`ログイン処理に失敗しました。\n\nエラー: ${exchangeError.message}`);
          }
          return;
        }
        
        // マジックリンクかどうかを判定
        const isMagicLink = currentUrl.includes('type=magiclink') || 
                           !currentUrl.includes('provider=google') && 
                           (currentUrl.includes('code=') || currentUrl.includes('access_token='));
        
        if (isMagicLink) {
          setMessage('🚀 マジックリンクログイン成功！\n\nダッシュボードに移動中...');
          console.log('マジックリンクログイン成功');
        } else {
          setMessage('ログイン成功！リダイレクト中...');
        }
        
        // iPhone/Safari対応: ループ防止と確実なリダイレクト
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isiPhone = /iPhone|iPod/i.test(navigator.userAgent);
        
        // マジックリンクの場合はより長い待機時間でユーザー情報の取得を待つ
        const redirectDelay = isMagicLink ? (isMobile ? 2000 : 1500) : (isMobile ? 300 : 1000);
        
        // ループ防止のためのマーカーを設定
        const redirectMarker = 'auth_redirect_' + Date.now();
        sessionStorage.setItem(redirectMarker, 'true');
        sessionStorage.setItem('last_auth_callback', Date.now().toString());
        
        if (isMobile) {
          console.log(`モバイル: ${isMagicLink ? 'マジックリンク' : 'OAuth'}リダイレクト準備完了`);
          
          // iPhoneの場合は特別な処理
          if (isiPhone) {
            // iPhone専用ページが使用されていた場合は記録を残す
            const wasUsingiPhonePage = localStorage.getItem('mq_iphone_login_used');
            if (wasUsingiPhonePage) {
              sessionStorage.setItem('return_to_iphone_page', 'true');
            }
          }
          
          setTimeout(() => {
            // 複数のリダイレクト方法を試す
            try {
              window.location.replace('/');
            } catch (e) {
              console.warn('replace failed, trying href:', e);
              window.location.href = '/';
            }
          }, redirectDelay);
          
          // フォールバック
          setTimeout(() => {
            if (window.location.pathname === '/auth/callback') {
              console.warn('モバイル: フォールバックリダイレクト実行');
              try {
                window.location.replace('/');
              } catch (e) {
                window.location.href = '/';
              }
            }
          }, redirectDelay + 3000);
        } else {
          // デスクトップは通常の処理
          setTimeout(() => {
            router.replace('/');
          }, redirectDelay);
          
          setTimeout(() => {
            if (window.location.pathname === '/auth/callback') {
              console.warn('リダイレクトが失敗、強制リロード実行');
              window.location.href = '/';
            }
          }, redirectDelay + 2000);
        }
        
      } catch (error: any) {
        console.error('予期しないエラー:', error);
        setIsError(true);
        isProcessing.current = false;
        setMessage(`予期しないエラーが発生しました。\n\n${error.message || 'Unknown error'}`);
      }
    };

    // ルーターの準備ができてから実行
    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-4">
            {isError ? 'ログインエラー' : 'ログイン処理中'}
          </h2>
          
          {!isError && (
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
          )}
          
          <p className={`text-sm sm:text-base whitespace-pre-line leading-relaxed ${
            isError ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
          }`}>
            {message}
          </p>
          
          {!isError && (
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              iPhoneでは数秒かかる場合があります。しばらくお待ちください...
            </div>
          )}
          
          {isError && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
              >
                ログインページに戻る
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                問題が続く場合は、ブラウザを再起動してください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
