const TABLE_NAME = 'assistant_conversations';

const normalizeUserId = (userId) => {
  if (typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed ? trimmed : null;
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => {
      const role = message?.role;
      const text = message?.text;
      const ts = message?.ts;
      if (role !== 'user' && role !== 'assistant') return null;
      if (typeof text !== 'string' || !text.trim()) return null;
      if (!Number.isFinite(ts)) return null;
      return { role, content: text, timestamp: Math.trunc(ts) };
    })
    .filter(Boolean);
};

const ensureSupabaseClient = (supabase) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  return supabase;
};

const saveConversation = async (supabase, userId, messages) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('user_id is required');
  }
  const rows = normalizeMessages(messages).map((row) => ({
    user_id: normalizedUserId,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
  }));
  if (rows.length === 0) {
    return { saved: 0 };
  }
  const client = ensureSupabaseClient(supabase);
  const { error } = await client.from(TABLE_NAME).insert(rows);
  if (error) {
    throw error;
  }
  return { saved: rows.length };
};

const loadConversation = async (supabase, userId, limit = 50) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('user_id is required');
  }
  const client = ensureSupabaseClient(supabase);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 200) : 50;
  const { data, error } = await client
    .from(TABLE_NAME)
    .select('role, content, timestamp')
    .eq('user_id', normalizedUserId)
    .order('timestamp', { ascending: false })
    .limit(safeLimit);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    role: row.role,
    text: row.content,
    ts: row.timestamp,
  }));
};

const clearConversation = async (supabase, userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    throw new Error('user_id is required');
  }
  const client = ensureSupabaseClient(supabase);
  const { error } = await client.from(TABLE_NAME).delete().eq('user_id', normalizedUserId);
  if (error) {
    throw error;
  }
  return { cleared: true };
};

const maybeSaveConversation = async (supabase, userId, messages) => {
  if (!supabase) return { saved: 0, skipped: true };
  if (!normalizeUserId(userId)) return { saved: 0, skipped: true };
  try {
    return await saveConversation(supabase, userId, messages);
  } catch (error) {
    console.error('[assistant] failed to persist conversation', error);
    return { saved: 0, skipped: true };
  }
};

module.exports = {
  clearConversation,
  loadConversation,
  maybeSaveConversation,
  saveConversation,
};
