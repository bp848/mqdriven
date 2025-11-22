import { Meeting, SupabaseConfig } from "../types";

/**
 * Saves a meeting object to a Supabase table using standard fetch
 * This avoids needing the full @supabase/supabase-js client for simple inserts
 */
export const saveMeetingToSupabase = async (meeting: Meeting, config: SupabaseConfig): Promise<void> => {
  if (!config.url || !config.key || !config.tableName) {
    throw new Error("Supabaseの設定が不完全です。設定画面を確認してください。");
  }

  // Normalize URL: ensure https:// and remove trailing slash
  let baseUrl = config.url.trim().replace(/\/$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }

  const endpoint = `${baseUrl}/rest/v1/${config.tableName}`;

  // Prepare payload (convert objects/arrays to JSON-friendly format if needed, 
  // though Supabase handles JSONB well)
  const payload = {
    title: meeting.title,
    date: meeting.date,
    duration_seconds: meeting.durationSeconds,
    transcript: meeting.transcript,
    summary: meeting.summary,
    action_items: meeting.actionItems, // Assumes the table has a JSONB column named action_items
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.hint || response.statusText;
      console.error("Supabase Error Detail:", errorData);
      throw new Error(`Supabase API Error (${response.status}): ${errorMessage}`);
    }
  } catch (error: any) {
    console.error("Supabase Fetch Error:", error);
    // Rethrow with user-friendly message if possible, or original
    throw new Error(error.message || "ネットワーク接続エラーが発生しました。");
  }
};