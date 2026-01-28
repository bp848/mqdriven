import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env as any).NEXT_PUBLIC_SUPABASE_URL || (process.env as any).SUPABASE_URL;
const supabaseAnonKey = (process.env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (process.env as any).SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("Supabaseの環境変数が設定されていないため、ローカルストレージにフォールバックします。");
}