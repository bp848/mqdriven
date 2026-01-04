import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const DEFAULT_HEADERS = ["authorization", "x-client-info", "apikey", "content-type", "x-requested-with"];

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": DEFAULT_HEADERS.join(", "),
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

const getAdminClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return errorResponse(req, "server not configured: missing SUPABASE_URL or SERVICE_ROLE_KEY", 503);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (!userId || !UUID_REGEX.test(userId)) {
      return errorResponse(req, "user_id (UUID) is required", 400);
    }
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .order("start_at", { ascending: true });
    if (error) {
      console.error("[calendar-events] list failed", error);
      return errorResponse(req, "Failed to fetch calendar events", 500);
    }
    return jsonResponse(req, { events: data ?? [] }, 200);
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const userId = body?.user_id as string | undefined;
    if (!userId || !UUID_REGEX.test(userId)) {
      return errorResponse(req, "user_id (UUID) is required", 400);
    }
    if (!body?.start_at) {
      return errorResponse(req, "start_at is required", 400);
    }
    const record = {
      id: body?.id ?? crypto.randomUUID(),
      user_id: userId,
      title: body?.title || "予定",
      description: body?.description ?? null,
      start_at: body?.start_at,
      end_at: body?.end_at ?? body?.start_at,
      all_day: Boolean(body?.all_day),
      source: body?.source || "system",
      google_event_id: body?.google_event_id ?? null,
      updated_by_source: body?.updated_by_source || "system",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("calendar_events").upsert(record, { onConflict: "id" }).select().maybeSingle();
    if (error) {
      console.error("[calendar-events] upsert failed", error);
      return errorResponse(req, "Failed to save calendar event", 500);
    }
    return jsonResponse(req, { event: data }, 200);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    const userId = url.searchParams.get("user_id");
    if (!id) return errorResponse(req, "id is required", 400);
    const query = supabase.from("calendar_events").delete().eq("id", id);
    if (userId && UUID_REGEX.test(userId)) {
      query.eq("user_id", userId);
    }
    const { error } = await query;
    if (error) {
      console.error("[calendar-events] delete failed", error);
      return errorResponse(req, "Failed to delete calendar event", 500);
    }
    return jsonResponse(req, { success: true }, 200);
  }

  return errorResponse(req, "method not allowed", 405);
};

console.info("calendar-events function ready");
serve(handler);
