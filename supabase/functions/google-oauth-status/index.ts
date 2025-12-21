const DEFAULT_ALLOWED_ORIGINS = [
  "https://erp.b-p.co.jp",
  "http://localhost:3000",
  "http://localhost:5174",
  "*",
];

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-requested-with",
];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const parseAllowedOrigins = () => {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("ALLOWED_ORIGIN");
  if (!fromEnv) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = fromEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin");
  const wildcard = ALLOWED_ORIGINS.includes("*");
  const allowedOrigin = wildcard ? "*" : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  const requestedHeaders = req.headers.get("access-control-request-headers");
  const requestedList = requestedHeaders
    ? requestedHeaders.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
    : [];
  const allowHeaders = wildcard
    ? "*"
    : Array.from(new Set([...DEFAULT_ALLOWED_HEADERS, ...requestedList])).join(", ");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin, Access-Control-Request-Headers",
  };
};

const jsonResponse = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(req) },
  });

console.info("google-oauth-status ready");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const isJson = (req.headers.get("content-type") || "").includes("application/json");
    let userId = url.searchParams.get("user_id");

    if (!userId && req.method === "POST" && isJson) {
      const body = await req.json().catch(() => null) as { user_id?: string; userId?: string } | null;
      userId = body?.user_id || body?.userId || null;
    }

    if (!userId || !UUID_REGEX.test(userId)) {
      return jsonResponse(req, { error: "missing or invalid user_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return jsonResponse(req, { error: "server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/user_google_tokens?user_id=eq.${userId}&select=user_id,expires_at,scope&limit=1`,
      {
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
      },
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("google-oauth-status fetch failed", resp.status, text);
      return jsonResponse(req, { error: "failed to fetch status" }, 500);
    }
    const data = await resp.json();
    const record = Array.isArray(data) ? data[0] : null;

    return jsonResponse(req, {
      connected: !!record,
      expires_at: record?.expires_at ?? null,
      scope: record?.scope ?? null,
    });
  } catch (err) {
    console.error("google-oauth-status unexpected error", err);
    return jsonResponse(req, { error: "unexpected_error" }, 500);
  }
});
