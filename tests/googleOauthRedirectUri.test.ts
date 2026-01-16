import { afterEach, describe, expect, it } from 'vitest';

import { isSupabaseFunctionsRedirectUri, resolveRedirectUri } from '../api/google/oauth/callback';

const makeReq = (host: string) => ({ headers: { host } });

describe('Google OAuth redirect URI handling', () => {
  const originalEnv = process.env.GOOGLE_REDIRECT_URI;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GOOGLE_REDIRECT_URI;
    } else {
      process.env.GOOGLE_REDIRECT_URI = originalEnv;
    }
  });

  it('detects Supabase Functions redirect URIs', () => {
    expect(isSupabaseFunctionsRedirectUri('https://abc.functions.supabase.co/google-oauth-start')).toBe(true);
    expect(isSupabaseFunctionsRedirectUri('https://abc.supabase.co/functions/v1/google-oauth-start')).toBe(true);
    expect(isSupabaseFunctionsRedirectUri('https://erp.b-p.co.jp/api/google/oauth/callback')).toBe(false);
  });

  it('falls back when GOOGLE_REDIRECT_URI points to Supabase Functions', () => {
    process.env.GOOGLE_REDIRECT_URI = 'https://abc.supabase.co/functions/v1/google-oauth-callback';
    expect(resolveRedirectUri(makeReq('example.com') as any)).toBe('https://example.com/api/google/oauth/callback');
  });

  it('uses GOOGLE_REDIRECT_URI when it is an app callback', () => {
    process.env.GOOGLE_REDIRECT_URI = 'https://erp.b-p.co.jp/api/google/oauth/callback';
    expect(resolveRedirectUri(makeReq('example.com') as any)).toBe('https://erp.b-p.co.jp/api/google/oauth/callback');
  });
});

