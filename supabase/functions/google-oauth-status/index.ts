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
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000; // 2 minutes

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

  if (req.method === "GET") {
    return jsonResponse(req, { ok: true, message: "google-oauth-status alive" }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const isJson = (req.headers.get("content-type") || "").includes("application/json");
    let userId = url.searchParams.get("user_id");

    if (!userId && isJson) {
      const body = await req.json().catch(() => null) as { user_id?: string; userId?: string } | null;
      userId = body?.user_id || body?.userId || null;
    }

    if (!userId || !UUID_REGEX.test(userId)) {
      return jsonResponse(req, { error: "missing or invalid user_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("DEBUG: env vars", { supabaseUrl: !!supabaseUrl, serviceRole: !!serviceRole });
    if (!supabaseUrl || !serviceRole) {
      console.log("DEBUG: missing env vars");
      return jsonResponse(req, { error: "server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const fetchToken = async () => {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_google_tokens?user_id=eq.${userId}&select=user_id,expires_at,scope,refresh_token,access_token&limit=1`,
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
        return null;
      }
      const data = await resp.json();
      return Array.isArray(data) ? data[0] : null;
    };

    let record = await fetchToken();

    // If the token is close to expiration and we have a refresh_token, refresh it here so UI always shows fresh expiry.
    if (record?.expires_at) {
      const exp = new Date(record.expires_at).getTime();
      const now = Date.now();
      if (exp && exp - now < TOKEN_REFRESH_MARGIN_MS && record.refresh_token) {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        if (clientId && clientSecret) {
          try {
            const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "refresh_token",
                refresh_token: record.refresh_token,
              }),
            });
            if (tokenResp.ok) {
              const tokens = await tokenResp.json();
              const newExpires = tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                : record.expires_at;
              const patchResp = await fetch(`${supabaseUrl}/rest/v1/user_google_tokens`, {
                method: "PATCH",
                headers: {
                  apikey: serviceRole,
                  Authorization: `Bearer ${serviceRole}`,
                  "Content-Type": "application/json",
                  Prefer: "return=representation",
                },
                body: JSON.stringify({
                  user_id: userId,
                  access_token: tokens.access_token,
                  expires_at: newExpires,
                }),
              });
              if (patchResp.ok) {
                const updated = await patchResp.json();
                record = Array.isArray(updated) ? updated[0] || record : record;
              } else {
                const errText = await patchResp.text().catch(() => "");
                console.error("google-oauth-status failed to update refreshed token", patchResp.status, errText);
              }
            } else {
              const errText = await tokenResp.text().catch(() => "");
              console.error("google-oauth-status failed to refresh token", tokenResp.status, errText);
            }
          } catch (refreshErr) {
            console.error("google-oauth-status unexpected refresh error", refreshErr);
          }
        }
      }
    }

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
