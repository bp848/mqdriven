import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://erp.b-p.co.jp",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "*",
];

const deriveProjectRef = (supabaseUrl: string | null, requestHost?: string | null): string | null => {
  try {
    if (supabaseUrl) {
      const host = new URL(supabaseUrl).hostname; // e.g. rwjhpfghhgstvplmggks.supabase.co
      const projectRef = host.split(".")[0];
      if (projectRef) return projectRef;
    }
  } catch {
    // ignore
  }
  if (requestHost && requestHost.includes(".functions.supabase.co")) {
    return requestHost.split(".")[0]; // host is <projectRef>.functions.supabase.co
  }
  return null;
};

const buildFunctionsRedirectUri = (requestHost?: string | null): string | null => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const projectRef = deriveProjectRef(supabaseUrl ?? null, requestHost);
  if (!projectRef) return null;
  return `https://${projectRef}.functions.supabase.co/google-oauth-callback`;
};

const resolveRedirectUri = (requestHost?: string | null): { uri: string | null; source: "env" | "fallback" } => {
  const envUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  const fallback = buildFunctionsRedirectUri(requestHost);
  // Prefer a functions.* redirect. If env is set but not functions.*, fall back to computed one.
  if (envUri) {
    if (/functions\.supabase\.co/.test(envUri)) {
      return { uri: envUri, source: "env" };
    }
    if (fallback) {
      console.warn(
        "GOOGLE_REDIRECT_URI does not point to Supabase Functions. Falling back to functions callback.",
        { envUri, fallback },
      );
      return { uri: fallback, source: "fallback" };
    }
    return { uri: envUri, source: "env" };
  }
  return { uri: fallback, source: "fallback" };
};

const parseAllowedOrigins = (): string[] => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN");
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const corsHeaders = (origin: string | null) => {
  const wildcard = ALLOWED_ORIGINS.includes("*");
  const pickOrigin = () => {
    if (wildcard) return "*";
    if (!origin) return ALLOWED_ORIGINS[0];
    const normalized = origin.trim();
    if (ALLOWED_ORIGINS.includes(normalized)) return normalized;
    if (normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:")) {
      return normalized;
    }
    return ALLOWED_ORIGINS[0];
  };
  const allowedOrigin = pickOrigin();
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": wildcard ? "*" : "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
};

const jsonResponse = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

console.info("google-oauth-start ready");

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const requestHost = (() => {
    try {
      return new URL(req.url).host;
    } catch {
      return null;
    }
  })();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse({ error: "method not allowed" }, 405, origin);
    }

    const url = new URL(req.url);
    const isJson = (req.headers.get("content-type") || "").includes("application/json");
    let userId = url.searchParams.get("user_id");

    if (!userId && req.method === "POST" && isJson) {
      const body = await req.json().catch(() => null) as { user_id?: string; userId?: string } | null;
      userId = body?.user_id || body?.userId || null;
    }

    if (!userId || !UUID_REGEX.test(userId)) {
      console.warn("google-oauth-start invalid user_id", { userId });
      return jsonResponse({ error: "missing or invalid user_id" }, 400, origin);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const { uri: redirectUri, source: redirectSource } = resolveRedirectUri(requestHost);
    if (!clientId || !redirectUri) {
      console.error("google-oauth-start missing config", { clientId: !!clientId, redirectUri });
      return jsonResponse(
        { error: "server not configured: missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI" },
        500,
        origin,
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
    if (redirectSource === "fallback") {
      console.warn("Using fallback functions redirect URI for Google OAuth:", redirectUri);
    }
    console.info("google-oauth-start generated url", {
      userId,
      redirectUri,
      redirectSource,
      origin,
      requestHost,
    });
    return new Response(JSON.stringify({ authUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        ...corsHeaders(origin),
      },
    });
  } catch (error) {
    console.error("google-oauth-start failed", error);
    return jsonResponse({ error: "internal error" }, 500, origin);
  }
});
