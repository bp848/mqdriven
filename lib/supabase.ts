import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
    '';

const SUPABASE_KEY = 
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
    '';

let browserClient: SupabaseClient | null = null;

// Factory for browser-side Supabase client (session/cookie is handled by the SDK)
export const createSupabaseBrowser = (): SupabaseClient => {
    if (browserClient) return browserClient;

    const url =
        SUPABASE_URL ||
        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined) ||
        (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);
    const key =
        SUPABASE_KEY ||
        (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
        (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined);

    if (!url || !key) {
        throw new Error('Supabase credentials are missing. Please configure SUPABASE_URL and SUPABASE_KEY.');
    }

    browserClient = createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
    return browserClient;
};
