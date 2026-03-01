import { getSupabaseFunctionHeaders } from '../services/supabaseClient';

describe('getSupabaseFunctionHeaders', () => {
  it('returns an Authorization Bearer header', async () => {
    const mockClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-access-token' } },
        }),
      },
    } as any;

    const headers = await getSupabaseFunctionHeaders(mockClient);
    expect(headers).toHaveProperty('Authorization');
    expect(headers.Authorization).toBe('Bearer test-access-token');
  });
});
