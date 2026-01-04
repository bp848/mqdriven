import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

console.info("calendar-events test ready");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 認証バイパス（テスト用）
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  
  if (!userId || !UUID_REGEX.test(userId)) {
    return jsonResponse({ error: "user_id (UUID) is required" }, 400);
  }

  // サービスロールクライアント
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: "Server not configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRole, { 
    auth: { autoRefreshToken: false, persistSession: false } 
  });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .order("start_at", { ascending: true });

    if (error) {
      console.error("list failed", error);
      return jsonResponse({ error: "Failed to fetch calendar events" }, 500);
    }

    return jsonResponse({ events: data ?? [] });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
