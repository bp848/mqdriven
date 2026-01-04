import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

// Accept any canonical UUID (including nil); DB will still enforce uuid type.
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DEFAULT_HEADERS = ["authorization", "x-client-info", "apikey", "content-type", "x-requested-with"];

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  const requestedHeaders = req.headers.get("access-control-request-headers");
  const requestedList = requestedHeaders
    ? requestedHeaders.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];
  const allowHeaders = Array.from(new Set([...DEFAULT_HEADERS, ...requestedList])).join(", ");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

const listEvents = async (supabase: ReturnType<typeof createClient>, userId: string) => {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

const upsertEvent = async (supabase: ReturnType<typeof createClient>, userId: string, payload: Record<string, unknown>) => {
  const startAt = (payload.start_at || payload.startAt) as string | undefined;
  const endAt = (payload.end_at || payload.endAt || startAt) as string | undefined;
  if (!startAt) {
    throw new Error("start_at is required");
  }

  const record = {
    id: payload.id as string | undefined,
    user_id: userId,
    title: (payload.title as string) || "予定",
    description: (payload.description as string | null | undefined) ?? null,
    start_at: startAt,
    end_at: endAt ?? startAt,
    all_day: Boolean(payload.all_day ?? payload.allDay),
    source: (payload.source as string | undefined) || "system",
    google_event_id: (payload.google_event_id as string | undefined) ?? (payload.googleEventId as string | undefined) ?? null,
    updated_by_source: (payload.updated_by_source as string | undefined)
      ?? (payload.updatedBySource as string | undefined)
      ?? "system",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("calendar_events")
    .upsert(record, { onConflict: "id" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

const deleteEvent = async (supabase: ReturnType<typeof createClient>, userId: string, id: string) => {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

console.info("calendar-events function ready");

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return errorResponse(req, "server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 503);
  }

  const url = new URL(req.url);
  const queryUserId = url.searchParams.get("user_id");
  const authHeader = req.headers.get("authorization");
  const authUserId = getUserIdFromToken(authHeader);

  let rawBody = "";
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    rawBody = await req.text();
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error("[calendar-events] invalid JSON", { requestId, parseErr, rawBody });
      return errorResponse(req, "invalid json body", 400);
    }
  }

  const action = (body?.action as string | undefined)?.toLowerCase() || null;
  const envDefaultUserId = Deno.env.get("DEFAULT_CALENDAR_USER_ID");
  const NIL_UUID = "00000000-0000-0000-0000-000000000000";
  const targetUserIdRaw = (body?.user_id || body?.userId || queryUserId || authUserId || envDefaultUserId || NIL_UUID) as string;
  const targetUserId = UUID_REGEX.test(targetUserIdRaw) ? targetUserIdRaw : NIL_UUID;

  try {
    if (req.method === "GET" || action === "list") {
      console.info("[calendar-events] list", { requestId, targetUserId, authUserId });
      const events = await listEvents(supabase, targetUserId);
      return jsonResponse(req, { events });
    }

    if (req.method === "DELETE" || action === "delete") {
      const idFromPath = url.pathname.split("/").pop();
      const id = (body?.id || body?.event_id || idFromPath) as string | undefined;
      if (!id) {
        return errorResponse(req, "id is required", 400);
      }
      await deleteEvent(supabase, targetUserId, id);
      return jsonResponse(req, { success: true });
    }

    if (req.method === "POST") {
      console.info("[calendar-events] upsert", { requestId, targetUserId, authUserId, hasId: !!body?.id });
      const event = await upsertEvent(supabase, targetUserId, body);
      return jsonResponse(req, { event });
    }
  } catch (err) {
    console.error("[calendar-events] error", { requestId, err });
    const message = err instanceof Error ? err.message : "Unexpected error";
    return errorResponse(req, message, 500);
  }

  return errorResponse(req, "Method not allowed", 405);
});
