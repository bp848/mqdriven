import { resolveSupabaseCredentials } from '../services/supabaseClient';

describe('resolveSupabaseCredentials', () => {
  it('prefers VITE Supabase variables when both formats exist', () => {
    const creds = resolveSupabaseCredentials({
      VITE_SUPABASE_URL: 'https://vite.example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'vite-anon-key',
      SUPABASE_URL: 'https://legacy.example.supabase.co',
      SUPABASE_KEY: 'legacy-key',
    });

    expect(creds).toEqual({
      url: 'https://vite.example.supabase.co',
      key: 'vite-anon-key',
    });
  });

  it('falls back to legacy SUPABASE variables when VITE variables are missing', () => {
    const creds = resolveSupabaseCredentials({
      SUPABASE_URL: 'https://legacy.example.supabase.co',
      SUPABASE_KEY: 'legacy-key',
    });

    expect(creds).toEqual({
      url: 'https://legacy.example.supabase.co',
      key: 'legacy-key',
    });
  });

  it('returns empty values when no Supabase variables exist', () => {
    const creds = resolveSupabaseCredentials({});

    expect(creds).toEqual({
      url: '',
      key: '',
    });
  });
});
