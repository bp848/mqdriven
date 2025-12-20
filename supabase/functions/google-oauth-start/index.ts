const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://erp.b-p.co.jp";
const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-requested-with",
];
const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || ALLOWED_ORIGIN;
  const requestedHeaders = req.headers.get("access-control-request-headers");
  const requestedList = requestedHeaders
    ? requestedHeaders.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];
  const allowHeaders = Array.from(
    new Set([...DEFAULT_ALLOWED_HEADERS, ...requestedList]),
  ).join(", ");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

console.info("google-oauth-start ready");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
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
        headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
      });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "server not configured: missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI" }),
        { status: 500, headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) } },
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
        ...buildCorsHeaders(req),
      },
    });
  } catch (error) {
    console.error("google-oauth-start failed", error);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
    });
  }
});
