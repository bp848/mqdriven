// カレンダーAPIクライアント実装例
// ブラウザ/Node.jsで使用

class CalendarAPI {
  constructor(supabase) {
    this.supabase = supabase;
    this.baseUrl = "https://rwjhpfghhgstvplmggks.functions.supabase.co/calendar-events";
  }

  // JWTトークン取得
  async getAuthToken() {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.access_token;
  }

  // 共通ヘッダー
  getHeaders(token) {
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  // GET: カレンダーイベント一覧
  async getEvents(userId) {
    const token = await this.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(`${this.baseUrl}?user_id=${userId}`, {
      headers: this.getHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.events;
  }

  // POST: カレンダーイベント作成/更新
  async upsertEvent(eventData) {
    const token = await this.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.event;
  }

  // DELETE: カレンダーイベント削除
  async deleteEvent(eventId, userId) {
    const token = await this.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    const url = `${this.baseUrl}/${eventId}${userId ? `?user_id=${userId}` : ""}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(token)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.success;
  }
}

// 使用例
/*
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwjhpfghhgstvplmggks.supabase.co',
  'your-anon-key'
);

const calendarAPI = new CalendarAPI(supabase);

// イベント一覧取得
const events = await calendarAPI.getEvents('user-uuid-here');

// イベント作成
const newEvent = await calendarAPI.upsertEvent({
  user_id: 'user-uuid-here',
  title: '新しい予定',
  start_at: '2026-01-05T10:00:00Z',
  end_at: '2026-01-05T11:00:00Z'
});

// イベント削除
await calendarAPI.deleteEvent('event-uuid-here', 'user-uuid-here');
*/

export default CalendarAPI;
