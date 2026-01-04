import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.info("calendar-test ready");

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // 環境変数チェック
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  console.log("DEBUG: Environment vars", {
    supabaseUrl: !!supabaseUrl,
    serviceRole: !!serviceRole,
    serviceRoleLength: serviceRole?.length || 0
  });

  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ 
      error: "Server not configured",
      debug: { supabaseUrl: !!supabaseUrl, serviceRole: !!serviceRole }
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 簡単テストレスポンス
  return new Response(JSON.stringify({ 
    ok: true,
    message: "Function is working",
    debug: {
      method: req.method,
      url: req.url,
      envSet: !!(supabaseUrl && serviceRole),
      functionName: "calendar-test"
    }
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
