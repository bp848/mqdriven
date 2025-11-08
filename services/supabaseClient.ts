import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnvValue } from '../utils.ts';
import { SUPABASE_KEY as FALLBACK_KEY, SUPABASE_URL as FALLBACK_URL } from '../supabaseCredentials.ts';

const resolveCredential = (key: string, fallback: string): string => {
    const envValue =
        getEnvValue(key) ??
        (key === 'SUPABASE_URL' ? getEnvValue('SUPABASE_PROJECT_URL') : undefined) ??
        (key === 'SUPABASE_KEY' ? getEnvValue('SUPABASE_ANON_KEY') : undefined);
    return envValue ?? fallback ?? '';
};

const SUPABASE_URL = resolveCredential('SUPABASE_URL', FALLBACK_URL);
const SUPABASE_KEY = resolveCredential('SUPABASE_KEY', FALLBACK_KEY);
const FORCE_DEMO_MODE = getEnvValue('FORCE_DEMO_MODE');

const isTruthy = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const isForceDemoEnabled = (): boolean => {
    if (typeof window !== 'undefined') {
        try {
            const params = new URLSearchParams(window.location.search);
            if (isTruthy(params.get('demo')) || isTruthy(params.get('forceDemo'))) {
                return true;
            }
            const stored = window.localStorage?.getItem('mq.forceDemoMode');
            if (isTruthy(stored)) {
                return true;
            }
        } catch (error) {
            console.warn('Failed to resolve demo override from location/localStorage:', error);
        }
    }

    if (isTruthy(FORCE_DEMO_MODE)) {
        return true;
    }

    return false;
};

const PLACEHOLDER_PATTERNS = [
    /ここに/i,
    /example\.supabase\.co/i,
    /your[-_ ]?supabase/i,
    /^$/,
];

const isPlaceholder = (value: string | undefined | null): boolean => {
    if (!value) return true;
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
};

const credentialsConfigured = !isForceDemoEnabled() && !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_KEY);

let supabaseInstance: SupabaseClient | null = null;

if (credentialsConfigured) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            // モバイルでのセッション管理を改善
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            storageKey: 'supabase.auth.token',
            debug: false,
        },
    });
} else if (typeof console !== 'undefined' && console.warn) {
    console.warn('Supabase credentials are not configured. Running in demo mode.');
}

export const supabase = supabaseInstance;

export const getSupabase = (): SupabaseClient => {
    if (!supabaseInstance) {
        throw new Error('Supabase client is not initialized. Please configure credentials in supabaseCredentials.ts or environment variables.');
    }
    return supabaseInstance;
};

// Expose a simple predicate for other modules to check configuration state
export const hasSupabaseCredentials = (): boolean => credentialsConfigured;