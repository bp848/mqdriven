import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '../../services/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('ログイン処理中...');
  const [isError, setIsError] = useState(false);
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // 重複実行防止
      if (hasProcessed.current) return;
      hasProcessed.current = true;
      
      try {
        const supabaseClient = getSupabase();
        const currentUrl = window.location.href;
        
        console.log('コールバック処理開始:', currentUrl);
        
        // URLにコードが含まれているか確認
        if (!currentUrl.includes('code=') && !currentUrl.includes('#access_token=')) {
          setIsError(true);
          setMessage('無効なコールバックURLです。\n\nログインページから再度お試しください。');
          return;
        }
        
        const { data, error } = await supabaseClient.auth.exchangeCodeForSession(currentUrl);
        
        if (error) {
          console.error('セッション交換エラー:', error);
          setIsError(true);
          
          if (error.message?.includes('expired') || error.message?.includes('invalid') || error.message?.includes('not found')) {
            setMessage('ログインリンクが無効または期限切れです。\n\n最新のメールから再度お試しください。\n\nヒント: メールクライアントのプレビュー機能でリンクが先に開かれた可能性があります。');
          } else {
            setMessage(`ログイン処理に失敗しました。\n\nエラー: ${error.message}`);
          }
          return;
        }
        
        console.log('セッション交換成功:', data);
        setMessage('ログイン成功！リダイレクト中...');
        
        // 成功時はメインページにリダイレクト
        setTimeout(() => {
          router.replace('/');
        }, 1000);
        
      } catch (error: any) {
        console.error('予期しないエラー:', error);
        setIsError(true);
        setMessage(`予期しないエラーが発生しました。\n\n${error.message || 'Unknown error'}`);
      }
    };

    // ルーターの準備ができてから実行
    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
            {isError ? 'ログインエラー' : 'ログイン処理中'}
          </h2>
          
          {!isError && (
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          <p className={`text-sm whitespace-pre-line ${
            isError ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'
          }`}>
            {message}
          </p>
          
          {isError && (
            <div className="mt-6">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ログインページに戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
