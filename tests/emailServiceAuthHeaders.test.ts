import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail auth headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.APPLICATION_EMAIL_ENDPOINT;
    delete process.env.APPLICATION_EMAIL_API_KEY;
  });

  it('invokes Supabase function with Supabase Authorization even when EMAIL_API_KEY is set', async () => {
    const { SUPABASE_KEY, SUPABASE_URL } = await import('../services/supabaseClient');

    const baseUrl = SUPABASE_URL.endsWith('/') ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
    process.env.APPLICATION_EMAIL_ENDPOINT = `${baseUrl}/functions/v1/resend`;
    process.env.APPLICATION_EMAIL_API_KEY = 'NOT_A_JWT';

    const invokeMock = vi.fn(async () => {
      return { data: { id: 'id', sentAt: new Date().toISOString() }, error: null };
    });

    vi.doMock('../services/supabaseClient', async () => {
      const actual = await vi.importActual<any>('../services/supabaseClient');
      return {
        ...actual,
        getSupabase: () => ({ functions: { invoke: invokeMock } }),
        getSupabaseFunctionHeaders: async () => ({ Authorization: `Bearer ${SUPABASE_KEY}` }),
      };
    });

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');

    const { sendEmail } = await import('../services/emailService');

    await sendEmail({ to: ['test@example.com'], subject: 'subj', body: 'body' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      'resend',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${SUPABASE_KEY}` }),
      }),
    );
  }, 20000);
});
