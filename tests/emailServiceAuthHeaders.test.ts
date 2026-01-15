import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail auth headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it(
    'prefers Supabase auth for Supabase Functions endpoints even when EMAIL_API_KEY is set',
    async () => {
    process.env.APPLICATION_EMAIL_ENDPOINT = 'https://example.supabase.co/functions/v1/resend';
    process.env.APPLICATION_EMAIL_API_KEY = 'NOT_A_JWT';

    const { SUPABASE_KEY } = await import('../supabaseCredentials');

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'id', sentAt: new Date().toISOString() }),
      } as any;
    });
    // @ts-expect-error - assign mock fetch for test
    globalThis.fetch = fetchMock;

    const { sendEmail } = await import('../services/emailService');

    await sendEmail({ to: ['test@example.com'], subject: 'subj', body: 'body' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = (requestInit?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SUPABASE_KEY}`);
    expect(headers.apikey).toBe(SUPABASE_KEY);
    expect(headers.Authorization).not.toBe('Bearer NOT_A_JWT');
    },
    20000,
  );
});
