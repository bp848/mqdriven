// --- supabaseCredentials.ts ---
// 重要：このファイルにあなたのSupabaseプロジェクトの情報を入力してください。
// Supabaseプロジェクト > Project Settings > API で確認できます。

// 1. SupabaseプロジェクトのURLを貼り付けてください
const FALLBACK_SUPABASE_URL = 'https://rwjhpfghhgstvplmggks.supabase.co';

// 2. Supabaseプロジェクトのanon publicキーを貼り付けてください
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amhwZmdoaGdzdHZwbG1nZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MDgzNDYsImV4cCI6MjA3NDI4NDM0Nn0.RfCRooN6YVTHJ2Mw-xFCWus3wUVMLkJCLSitB8TNiIo';

const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const supabaseUrlFromEnv = viteEnv?.VITE_SUPABASE_URL
    ?? process.env?.NEXT_PUBLIC_SUPABASE_URL
    ?? FALLBACK_SUPABASE_URL;
const supabaseKeyFromEnv = viteEnv?.VITE_SUPABASE_ANON_KEY
    ?? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? FALLBACK_SUPABASE_KEY;

export const SUPABASE_URL = supabaseUrlFromEnv;
export const SUPABASE_KEY = supabaseKeyFromEnv;
