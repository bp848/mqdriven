import { createClient, SupabaseClient } from '@supabase/supabase-js';

type SupabaseEnv = {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
};

export const resolveSupabaseCredentials = (env: SupabaseEnv): { url: string; key: string } => {
    const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
    const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY || '';
    return { url, key };
};

const resolvedCredentials = resolveSupabaseCredentials(import.meta.env as SupabaseEnv);
export const SUPABASE_URL = resolvedCredentials.url;
export const SUPABASE_KEY = resolvedCredentials.key;

let supabase: SupabaseClient | null = null;

// 新しい接続情報でSupabaseクライアントを初期化する関数
export const initializeSupabase = (url: string, key: string): SupabaseClient | null => {
    try {
        if (!url || !key || url.includes('ここにURLを貼り付け') || key.includes('ここにキーを貼り付け')) {
            console.warn("Supabase URL or Key is missing or is a placeholder in credentials file.");
            supabase = null;
            return null;
        }
        supabase = createClient(url, key, {
            global: {
                headers: {
                    'apikey': key,
                },
            },
        });
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

// Supabase Functions を呼び出すための Authorization ヘッダーを生成する。
// - 可能なら Supabase Auth の access_token を優先（ユーザーコンテキストで実行）
// - それ以外は anon key を Bearer として付与（Functions Gateway の 401 を回避）
export const getSupabaseFunctionHeaders = async (
    client?: SupabaseClient,
): Promise<Record<string, string>> => {
    const supabaseClient = client ?? getSupabase();
    try {
        const { data } = await supabaseClient.auth.getSession();
        const accessToken = data?.session?.access_token;
        if (accessToken) {
            return { Authorization: `Bearer ${accessToken}` };
        }
    } catch {
        // Ignore and fall back to anon key below.
    }
    return { Authorization: `Bearer ${SUPABASE_KEY}` };
};
