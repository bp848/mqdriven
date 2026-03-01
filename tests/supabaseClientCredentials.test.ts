import { resolveSupabaseCredentials } from '../services/supabaseClient';

describe('resolveSupabaseCredentials', () => {
  it('prefers VITE Supabase variables when multiple formats exist', () => {
    const creds = resolveSupabaseCredentials(
      {
        VITE_SUPABASE_URL: 'https://vite.example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'vite-anon-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://next.example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'next-anon-key',
        SUPABASE_URL: 'https://legacy.example.supabase.co',
        SUPABASE_KEY: 'legacy-key',
      },
      () => undefined,
    );

    expect(creds).toEqual({
      url: 'https://vite.example.supabase.co',
      key: 'vite-anon-key',
    });
  });

  it('uses NEXT_PUBLIC values when VITE values are missing', () => {
    const creds = resolveSupabaseCredentials(
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://next.example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'next-anon-key',
        SUPABASE_URL: 'https://legacy.example.supabase.co',
        SUPABASE_KEY: 'legacy-key',
      },
      () => undefined,
    );

    expect(creds).toEqual({
      url: 'https://next.example.supabase.co',
      key: 'next-anon-key',
    });
  });

  it('falls back to legacy SUPABASE variables when VITE and NEXT_PUBLIC values are missing', () => {
    const creds = resolveSupabaseCredentials(
      {
        SUPABASE_URL: 'https://legacy.example.supabase.co',
        SUPABASE_KEY: 'legacy-key',
      },
      () => undefined,
    );

    expect(creds).toEqual({
      url: 'https://legacy.example.supabase.co',
      key: 'legacy-key',
    });
  });

  it('falls back to runtime env reader when build-time env is empty', () => {
    const runtimeValues: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://runtime.example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'runtime-anon-key',
    };

    const creds = resolveSupabaseCredentials({}, (key) => runtimeValues[key]);

    expect(creds).toEqual({
      url: 'https://runtime.example.supabase.co',
      key: 'runtime-anon-key',
    });
  });

  it('returns empty values when no Supabase variables exist', () => {
    const creds = resolveSupabaseCredentials({}, () => undefined);

    expect(creds).toEqual({
      url: '',
      key: '',
    });
  });
});
