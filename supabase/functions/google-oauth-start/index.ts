const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

console.info("google-oauth-start ready");

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return new Response(JSON.stringify({ error: "missing user_id" }), {
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
});
