import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

const resolveSupabaseKey = (): string | undefined => {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_SERVICE_KEY
        || process.env.SUPABASE_KEY;
};

export const getServerSupabase = (): SupabaseClient | null => {
    if (cachedSupabase) {
        return cachedSupabase;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = resolveSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase configuration: ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
        return null;
    }

    cachedSupabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                'X-Client-Info': 'mqdriven-board-api',
            },
        },
    });

    return cachedSupabase;
};
