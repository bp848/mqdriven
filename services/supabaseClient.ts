import { createClient, SupabaseClient } from '@supabase/supabase-js';

type SupabaseEnv = {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
};

const readRuntimeEnvValue = (key: string): string | undefined => {
    if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.__ENV && win.__ENV[key] !== undefined) return win.__ENV[key];
        if (win[key] !== undefined) return win[key];
        if (win.process?.env && win.process.env[key] !== undefined) return win.process.env[key];
    }

    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        return process.env[key];
    }

    return undefined;
};

const pickValue = (
    env: SupabaseEnv,
    keys: Array<keyof SupabaseEnv>,
    runtimeReader?: (key: string) => string | undefined,
): string => {
    for (const key of keys) {
        const envValue = env[key];
        if (envValue) return envValue;
    }

    if (runtimeReader) {
        for (const key of keys) {
            const runtimeValue = runtimeReader(String(key));
            if (runtimeValue) return runtimeValue;
        }
    }

    return '';
};

export const resolveSupabaseCredentials = (
    env: SupabaseEnv,
    runtimeReader?: (key: string) => string | undefined,
): { url: string; key: string } => {
    const url = pickValue(
        env,
        ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
        runtimeReader,
    );
    const key = pickValue(
        env,
        ['VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_KEY'],
        runtimeReader,
    );
    return { url, key };
};

const resolvedCredentials = resolveSupabaseCredentials(import.meta.env as SupabaseEnv, readRuntimeEnvValue);
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
