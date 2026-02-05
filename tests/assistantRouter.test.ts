import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAssistantRouter } = require('../server/assistant/router.js');

const makeSupabaseMock = (options: { selectData?: any[] } = {}) => {
  const inserts: any[] = [];
  const deletes: any[] = [];
  const { selectData = [] } = options;
  const selectChain = {
    eq: () => selectChain,
    order: () => selectChain,
    limit: () => Promise.resolve({ data: selectData, error: null }),
  };
  return {
    inserts,
    deletes,
    from: (table: string) => ({
      insert: async (rows: any[]) => {
        inserts.push({ table, rows });
        return { data: rows, error: null };
      },
      select: () => selectChain,
      delete: () => ({
        eq: async (column: string, value: string) => {
          deletes.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  };
};

const getRouteHandler = (router: any, method: string, path: string) => {
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
};

const createRes = () => {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
};

describe('assistant router', () => {
  it('rejects history requests without user header', async () => {
    const supabase = makeSupabaseMock();
    const router = createAssistantRouter(supabase);
    const handler = getRouteHandler(router, 'get', '/history');
    const req: any = { headers: {}, query: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toContain('x-user-id');
  });

  it('returns history for a user', async () => {
    const supabase = makeSupabaseMock({
      selectData: [{ role: 'user', content: 'hi', timestamp: 10 }],
    });
    const router = createAssistantRouter(supabase);
    const handler = getRouteHandler(router, 'get', '/history');
    const req: any = { headers: { 'x-user-id': 'u-1' }, query: { limit: '5' } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.messages).toEqual([{ role: 'user', text: 'hi', ts: 10 }]);
  });

  it('saves conversation batches', async () => {
    const supabase = makeSupabaseMock();
    const router = createAssistantRouter(supabase);
    const handler = getRouteHandler(router, 'post', '/save');
    const req: any = {
      headers: { 'x-user-id': 'u-2' },
      body: { messages: [{ role: 'user', text: 'ok', ts: 1 }] },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.saved).toBe(1);
    expect(supabase.inserts).toHaveLength(1);
  });

  it('clears conversation history', async () => {
    const supabase = makeSupabaseMock();
    const router = createAssistantRouter(supabase);
    const handler = getRouteHandler(router, 'delete', '/history');
    const req: any = { headers: { 'x-user-id': 'u-3' } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.cleared).toBe(true);
    expect(supabase.deletes).toEqual([
      { table: 'assistant_conversations', column: 'user_id', value: 'u-3' },
    ]);
  });
});
