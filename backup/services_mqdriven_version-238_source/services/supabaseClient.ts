import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 認証情報をこのファイルに直接定義して、読み込み問題を解消します。
const SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

let supabase: SupabaseClient | null = null;

// 新しい接続情報でSupabaseクライアントを初期化する関数
export const initializeSupabase = (url: string, key: string): SupabaseClient | null => {
    try {
        if (!url || !key || url.includes('ここにURLを貼り付け') || key.includes('ここにキーを貼り付け')) {
            console.warn("Supabase URL or Key is missing or is a placeholder in credentials file.");
            supabase = null;
            return null;
        }
        supabase = createClient(url, key);
        return supabase;
    } catch (e) {
        console.error("Error initializing Supabase", e);
        supabase = null;
        return null;
    }
};

// 現在のSupabaseクライアントインスタンスを取得する関数
export const getSupabase = (): SupabaseClient => {
    // Initialize if not already done.
    if (!supabase) {
        initializeSupabase(SUPABASE_URL, SUPABASE_KEY);
    }
    if (!supabase) {
        // エラーメッセージを更新
        throw new Error("Supabase client is not initialized. Please configure credentials in services/supabaseClient.ts");
    }
    return supabase;
};

// 接続情報が設定されているか確認する関数
export const hasSupabaseCredentials = (): boolean => {
    const isUrlPlaceholder = SUPABASE_URL.includes('ここにURLを貼り付け');
    const isKeyPlaceholder = SUPABASE_KEY.includes('ここにキーを貼り付け');
    return !!(SUPABASE_URL && SUPABASE_KEY && !isUrlPlaceholder && !isKeyPlaceholder);
};
