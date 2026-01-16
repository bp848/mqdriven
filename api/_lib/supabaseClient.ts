import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

const resolveSupabaseKey = (): string | undefined => {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_SERVICE_KEY
        || process.env.SUPABASE_KEY
        || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};

const resolveSupabaseUrl = (): string | undefined => {
    return process.env.SUPABASE_URL
        || process.env.NEXT_PUBLIC_SUPABASE_URL;
};

export const getServerSupabase = (): SupabaseClient | null => {
    if (cachedSupabase) {
        return cachedSupabase;
    }

    const supabaseUrl = resolveSupabaseUrl();
    const supabaseKey = resolveSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase configuration: ensure SUPABASE_URL/SUPABASE_KEY (or NEXT_PUBLIC equivalents) are set.');
        return null;
    }

    cachedSupabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                'X-Client-Info': 'mqdriven-board-api',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
        },
    });

    return cachedSupabase;
};
