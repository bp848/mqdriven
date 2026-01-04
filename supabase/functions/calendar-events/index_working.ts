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

const handler = async (req: Request): Promise<Response> => {
  // CORSプリフライト
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  // 認証チェック（一時的に緩和）
  const authHeader = req.headers.get("authorization");
  let userId = null;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub || null;
      }
    } catch {
      // JWTデコード失敗時は認証スキップ（開発用）
      console.log("JWT decode failed, skipping auth for development");
    }
  }

  // 認証なしでも一時的に許可（開発用）
  if (!userId) {
    console.log("No valid userId found, allowing request for development");
    // userIdをクエリから取得
    const url = new URL(req.url);
    userId = url.searchParams.get("user_id");
  }

  // サービスロールクライアント
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
    
    if (!userId || !UUID_REGEX.test(userId)) {
      return errorResponse(req, "user_id (UUID) is required", 400);
    }

    // クエリのuser_idを使用
    const targetUserId = queryUserId || userId;
    
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", targetUserId)
      .order("start_at", { ascending: true });

    if (error) {
      console.error("[calendar-events] list failed", error);
      return errorResponse(req, "Failed to fetch calendar events", 500);
    }

    return jsonResponse(req, { 
      events: data ?? [],
      debug: "Auth bypassed for development - use proper JWT in production"
    });
  }

  return errorResponse(req, "Method not allowed", 405);
};

console.info("calendar-events working ready (auth bypassed for development)");
serve(handler);
