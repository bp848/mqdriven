import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type TokenRecord = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

type CalendarEventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  source: string | null;
  google_event_id: string | null;
  updated_by_source: string | null;
  updated_at: string | null;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  extendedProperties?: { private?: Record<string, string> };
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DEFAULT_ALLOWED_HEADERS = ["authorization", "x-client-info", "apikey", "content-type", "x-requested-with"];
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DEFAULT_TIMEZONE = Deno.env.get("CALENDAR_TZ") || "Asia/Tokyo";
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000; // 2 minutes
const DEFAULT_SYNC_WINDOW_DAYS = 90;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  const requestedHeaders = req.headers.get("access-control-request-headers");
  const requestedList = requestedHeaders
    ? requestedHeaders.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];
  const allowHeaders = Array.from(new Set([...DEFAULT_ALLOWED_HEADERS, ...requestedList])).join(", ");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin, Access-Control-Request-Headers",
  };
};

const jsonResponse = (req: Request, body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
  });

const errorResponse = (req: Request, message: string, status = 400) => jsonResponse(req, { error: message }, status);

const getUserIdFromToken = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
};

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
};

const fetchTokenRecord = async (supabase: ReturnType<typeof createClient>, userId: string) => {
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("user_id,access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as TokenRecord | null) || null;
};

const refreshAccessTokenIfNeeded = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<TokenRecord> => {
  const record = await fetchTokenRecord(supabase, userId);
  if (!record) {
    throw new Error("No Google tokens found. Please connect Google Calendar first.");
  }

  const now = Date.now();
  const expiresAt = record.expires_at ? Date.parse(record.expires_at) : 0;
  if (expiresAt && expiresAt - now > TOKEN_REFRESH_MARGIN_MS) {
    return record;
  }

  if (!record.refresh_token) {
    throw new Error("Missing refresh_token. Please reconnect Google Calendar.");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Server not configured for Google OAuth (GOOGLE_CLIENT_ID/SECRET missing).");
  }

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: record.refresh_token,
    }),
  });
  const tokens = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error(tokens?.error_description || "Failed to refresh Google access token");
  }

  const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : 3600;
  const expiresAtIso = new Date(Date.now() + expiresIn * 1000).toISOString();
  const accessToken = tokens.access_token || record.access_token;

  const { error } = await supabase
    .from("user_google_tokens")
    .update({ access_token: accessToken, expires_at: expiresAtIso })
    .eq("user_id", userId);
  if (error) {
    console.warn("[google-calendar-sync] failed to persist refreshed token", error);
  }

  return {
    ...record,
    access_token: accessToken,
    expires_at: expiresAtIso,
  };
};

const listSystemCalendarEvents = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timeMin?: string | null,
  timeMax?: string | null,
): Promise<CalendarEventRow[]> => {
  let query = supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId);

  if (timeMin) query = query.gte("start_at", timeMin);
  if (timeMax) query = query.lte("start_at", timeMax);

  const { data, error } = await query;
  if (error) throw error;
  return (data as CalendarEventRow[]) || [];
};

const mapSystemEventToGoogle = (ev: CalendarEventRow) => {
  const isAllDay = !!ev.all_day;
  const start = isAllDay
    ? { date: ev.start_at.slice(0, 10) }
    : { dateTime: ev.start_at, timeZone: DEFAULT_TIMEZONE };
  const end = isAllDay
    ? { date: ev.end_at.slice(0, 10) }
    : { dateTime: ev.end_at, timeZone: DEFAULT_TIMEZONE };

  return {
    summary: ev.title || "予定",
    description: ev.description || "",
    start,
    end,
    extendedProperties: {
      private: {
        calendar_event_id: ev.id,
        updated_by_source: ev.updated_by_source || "system",
      },
    },
  };
};

const fetchGoogleEventsWindow = async (
  accessToken: string,
  { timeMin, timeMax }: { timeMin?: string | null; timeMax?: string | null },
): Promise<GoogleEvent[]> => {
  const results: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (timeMin) params.set("timeMin", timeMin);
    if (timeMax) params.set("timeMax", timeMax);
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await resp.json();
    if (!resp.ok) {
      const reason = body?.error?.message || body?.error || "Failed to fetch Google events";
      throw new Error(reason);
    }

    const items = Array.isArray(body.items) ? body.items : [];
    results.push(...items);
    pageToken = body.nextPageToken;
  } while (pageToken);

  return results;
};

const mapGoogleEventToSystem = (ev: GoogleEvent, userId: string): Partial<CalendarEventRow> & { user_id: string } | null => {
  const isAllDay = !!ev.start?.date || !!ev.end?.date;
  const startIso = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00.000Z` : null);
  const endIso = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00.000Z` : null);
  if (!startIso) return null;

  const privateProps = ev.extendedProperties?.private || {};
  const payload: Partial<CalendarEventRow> & { user_id: string } = {
    user_id: userId,
    title: ev.summary || "(無題)",
    description: ev.description || "",
    start_at: startIso,
    end_at: endIso || startIso,
    all_day: isAllDay,
    source: "google",
    google_event_id: ev.id,
    updated_by_source: "google",
    updated_at: ev.updated || new Date().toISOString(),
  };

  if (privateProps.calendar_event_id) {
    payload.id = privateProps.calendar_event_id;
  }

  return payload;
};

const upsertSystemEvents = async (supabase: ReturnType<typeof createClient>, events: Partial<CalendarEventRow>[]) => {
  if (!events.length) return [];
  const { data, error } = await supabase
    .from("calendar_events")
    .upsert(events, { onConflict: "id" })
    .select();
  if (error) throw error;
  return data as CalendarEventRow[];
};

const deleteSystemEvents = async (supabase: ReturnType<typeof createClient>, ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase.from("calendar_events").delete().in("id", ids);
  if (error) throw error;
};

const createGoogleEvent = async (accessToken: string, body: unknown) => {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const reason = data?.error?.message || data?.error || "Failed to create Google event";
    throw new Error(reason);
  }
  return data;
};

const updateGoogleEvent = async (accessToken: string, eventId: string, body: unknown) => {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const reason = data?.error?.message || data?.error || "Failed to update Google event";
    throw new Error(reason);
  }
  return data;
};

const deleteGoogleEvent = async (accessToken: string, eventId: string) => {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok && resp.status !== 410 && resp.status !== 404) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || "Failed to delete Google event");
  }
};

const resolveSyncWindow = (
  events: CalendarEventRow[],
  requestedMin?: string | null,
  requestedMax?: string | null,
) => {
  const now = Date.now();
  const defaultMin = new Date(now - DEFAULT_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const defaultMax = new Date(now + DEFAULT_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const normalizeIso = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  return {
    timeMin: normalizeIso(requestedMin) || normalizeIso(events?.[0]?.start_at) || defaultMin.toISOString(),
    timeMax: normalizeIso(requestedMax) || defaultMax.toISOString(),
  };
};

const syncSystemToGoogle = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accessToken: string,
  timeMin?: string | null,
  timeMax?: string | null,
) => {
  const systemEvents = await listSystemCalendarEvents(supabase, userId, timeMin, timeMax);
  const { timeMin: resolvedMin, timeMax: resolvedMax } = resolveSyncWindow(systemEvents, timeMin, timeMax);
  const googleEvents = await fetchGoogleEventsWindow(accessToken, { timeMin: resolvedMin, timeMax: resolvedMax });
  const googleById = new Map(googleEvents.map((g) => [g.id, g]));

  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    stats: { systemEvents: systemEvents.length, googleEvents: googleEvents.length, window: { timeMin: resolvedMin, timeMax: resolvedMax } },
  };

  for (const ev of systemEvents) {
    const mapped = mapSystemEventToGoogle(ev);
    const googleId = ev.google_event_id;
    if (googleId && googleById.has(googleId)) {
      const googleUpdated = new Date(googleById.get(googleId)?.updated || 0).getTime();
      const sysUpdated = ev.updated_at ? new Date(ev.updated_at).getTime() : 0;
      if (sysUpdated && sysUpdated > googleUpdated + 1000) {
        await updateGoogleEvent(accessToken, googleId, mapped);
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
      continue;
    }
    const created = await createGoogleEvent(accessToken, mapped);
    if (created?.id) {
      await supabase.from("calendar_events").update({ google_event_id: created.id }).eq("id", ev.id);
    }
    summary.created += 1;
  }

  // Delete Google events that reference system events which no longer exist
  for (const g of googleEvents) {
    const calId = g?.extendedProperties?.private?.calendar_event_id;
    if (calId && !systemEvents.find((ev) => ev.id === calId)) {
      try {
        await deleteGoogleEvent(accessToken, g.id);
        summary.deleted += 1;
      } catch (err) {
        console.warn("[google-calendar-sync] failed to delete orphan Google event", g.id, err);
      }
    }
  }

  return summary;
};

const syncGoogleToSystem = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accessToken: string,
  timeMin?: string | null,
  timeMax?: string | null,
) => {
  const existing = await listSystemCalendarEvents(supabase, userId, timeMin, timeMax);
  const { timeMin: resolvedMin, timeMax: resolvedMax } = resolveSyncWindow(existing, timeMin, timeMax);
  const googleEvents = await fetchGoogleEventsWindow(accessToken, { timeMin: resolvedMin, timeMax: resolvedMax });
  const systemByGoogleId = new Map(existing.filter((ev) => ev.google_event_id).map((ev) => [ev.google_event_id as string, ev]));

  const mapped: Partial<CalendarEventRow>[] = [];
  for (const g of googleEvents) {
    const candidate = mapGoogleEventToSystem(g, userId);
    if (!candidate) continue;
    if (!candidate.id && systemByGoogleId.has(g.id)) {
      candidate.id = systemByGoogleId.get(g.id)?.id;
    }
    mapped.push(candidate);
  }

  if (mapped.length) {
    await upsertSystemEvents(supabase, mapped);
  }

  const googleIds = new Set(googleEvents.map((g) => g.id));
  const toDelete = existing.filter((ev) => ev.google_event_id && !googleIds.has(ev.google_event_id)).map((ev) => ev.id);
  if (toDelete.length) {
    await deleteSystemEvents(supabase, toDelete);
  }

  return {
    pulled: mapped.length,
    deleted: toDelete.length,
    stats: {
      googleEvents: googleEvents.length,
      systemExisting: existing.length,
      window: { timeMin: resolvedMin, timeMax: resolvedMax },
    },
  };
};

console.info("google-calendar-sync ready");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method === "GET") {
    return jsonResponse(req, { ok: true }, 200);
  }

  if (req.method !== "POST") {
    return errorResponse(req, "method not allowed", 405);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return errorResponse(req, "server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 503);
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const envDefaultUserId = Deno.env.get("DEFAULT_GOOGLE_SYNC_USER_ID");
  const userIdRaw = (body?.user_id || body?.userId || envDefaultUserId || NIL_UUID) as string;
  const userId = UUID_REGEX.test(userIdRaw) ? userIdRaw : NIL_UUID;
  const actionRaw = (body?.action || body?.mode || body?.direction || "two_way") as string;
  const timeMin = (body?.timeMin || body?.time_min) as string | undefined;
  const timeMax = (body?.timeMax || body?.time_max) as string | undefined;
  const action = (() => {
    const lowered = actionRaw.toLowerCase();
    if (["push", "system_to_google", "sync"].includes(lowered)) return "push";
    if (["pull", "google_to_system"].includes(lowered)) return "pull";
    if (["two_way", "both"].includes(lowered)) return "two_way";
    return "push";
  })();

  // No auth gate: allow anon/service/unauthenticated calls
  try {
    const token = await refreshAccessTokenIfNeeded(supabase, userId);
    const accessToken = token.access_token;

    if (action === "push") {
      const summary = await syncSystemToGoogle(supabase, userId, accessToken, timeMin, timeMax);
      return jsonResponse(req, { action: "push", summary }, 200);
    }

    if (action === "pull") {
      const summary = await syncGoogleToSystem(supabase, userId, accessToken, timeMin, timeMax);
      return jsonResponse(req, { action: "pull", summary }, 200);
    }

    const pushSummary = await syncSystemToGoogle(supabase, userId, accessToken, timeMin, timeMax);
    const pullSummary = await syncGoogleToSystem(supabase, userId, accessToken, timeMin, timeMax);
    return jsonResponse(req, { action: "two_way", summary: { push: pushSummary, pull: pullSummary } }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected error";
    console.error("[google-calendar-sync] failed", { userId, action, err: message });
    // 200で返してUIエラーを抑制しつつ、エラー内容はクライアントで表示できるようにする
    return jsonResponse(req, { action, error: message }, 200);
  }
});
