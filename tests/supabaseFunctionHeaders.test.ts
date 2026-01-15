import { getSupabaseFunctionHeaders } from '../services/supabaseClient';

describe('getSupabaseFunctionHeaders', () => {
  it('returns an Authorization Bearer header', async () => {
    const headers = await getSupabaseFunctionHeaders();
    expect(headers).toHaveProperty('Authorization');
    expect(headers.Authorization).toMatch(/^Bearer\s+\S+/);
  });
});
