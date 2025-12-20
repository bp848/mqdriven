const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://erp.b-p.co.jp";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

console.info("google-oauth-start ready");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const url = new URL(req.url);
    const isJson = (req.headers.get("content-type") || "").includes("application/json");
    let userId = url.searchParams.get("user_id");

    if (!userId && req.method === "POST" && isJson) {
      const body = await req.json().catch(() => null) as { user_id?: string; userId?: string } | null;
      userId = body?.user_id || body?.userId || null;
    }

    if (!userId || !UUID_REGEX.test(userId)) {
      return new Response(JSON.stringify({ error: "missing or invalid user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "server not configured: missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        access_type: "offline",
        scope: "https://www.googleapis.com/auth/calendar",
        prompt: "consent",
        state: userId,
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
      }).toString();

    return new Response(JSON.stringify({ authUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("google-oauth-start failed", error);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
