import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  clearConversation,
  loadConversation,
  saveConversation,
} = require('../server/assistant/conversationStore.js');

const makeSupabaseMock = (options: { selectData?: any[] } = {}) => {
  const inserts: any[] = [];
  const deletes: any[] = [];
  const { selectData = [] } = options;
  const chain = {
    eq: () => chain,
    order: () => chain,
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
      select: () => chain,
      delete: () => ({
        eq: async (column: string, value: string) => {
          deletes.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  };
};

describe('assistant conversation store', () => {
  it('saves valid conversation messages', async () => {
    const supabase = makeSupabaseMock();
    const result = await saveConversation(supabase, 'user-1', [
      { role: 'user', text: 'こんにちは', ts: 1000 },
      { role: 'assistant', text: 'はい', ts: 1001 },
      { role: 'system', text: 'ignored', ts: 1002 },
      { role: 'user', text: '', ts: 1003 },
    ]);

    expect(result.saved).toBe(2);
    expect(supabase.inserts).toHaveLength(1);
    expect(supabase.inserts[0].rows).toEqual([
      { user_id: 'user-1', role: 'user', content: 'こんにちは', timestamp: 1000 },
      { user_id: 'user-1', role: 'assistant', content: 'はい', timestamp: 1001 },
    ]);
  });

  it('loads and maps conversation history', async () => {
    const supabase = makeSupabaseMock({
      selectData: [
        { role: 'assistant', content: '回答', timestamp: 2000 },
        { role: 'user', content: '質問', timestamp: 1990 },
      ],
    });

    const messages = await loadConversation(supabase, 'user-2', 20);

    expect(messages).toEqual([
      { role: 'assistant', text: '回答', ts: 2000 },
      { role: 'user', text: '質問', ts: 1990 },
    ]);
  });

  it('clears conversation history', async () => {
    const supabase = makeSupabaseMock();

    const result = await clearConversation(supabase, 'user-3');

    expect(result.cleared).toBe(true);
    expect(supabase.deletes).toEqual([
      { table: 'assistant_conversations', column: 'user_id', value: 'user-3' },
    ]);
  });
});
