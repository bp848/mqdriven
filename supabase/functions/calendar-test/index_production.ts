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

// JWTからユーザーIDを取得
const getUserIdFromToken = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null; // sub = user_id
  } catch {
    return null;
  }
};

const handler = async (req: Request): Promise<Response> => {
  // CORSプリフライト
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  // 認証チェック
  const authHeader = req.headers.get("authorization");
  const userId = getUserIdFromToken(authHeader);
  
  if (!userId) {
    return errorResponse(req, "Missing or invalid authorization header", 401);
  }

  // サービスロールクライアント（RLSバイパス用）
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return errorResponse(req, "Server not configured", 503);
  }

  const supabase = createClient(supabaseUrl, serviceRole, { 
    auth: { autoRefreshToken: false, persistSession: false } 
  });

  // GET: カレンダーイベント一覧
  if (req.method === "GET") {
    const url = new URL(req.url);
    const queryUserId = url.searchParams.get("user_id");
    
    // JWTのuser_idと一致するか確認
    if (queryUserId && queryUserId !== userId) {
      return errorResponse(req, "user_id does not match authenticated user", 403);
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

    return jsonResponse(req, { events: data ?? [] });
  }

  return errorResponse(req, "Method not allowed", 405);
};

console.info("calendar-events production ready");
serve(handler);
