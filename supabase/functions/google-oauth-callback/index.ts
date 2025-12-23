const DEFAULT_ALLOWED_ORIGINS = [
  'https://erp.b-p.co.jp',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const parseAllowedOrigins = (): string[] => {
  const fromEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (!fromEnv) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = fromEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const corsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const jsonResponse = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

const redirectResponse = (location: string, origin: string | null) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, ...corsHeaders(origin) },
  });

console.info('google-oauth-callback ready');

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'method not allowed' }, 405, origin);
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state || !UUID_REGEX.test(state)) {
      return jsonResponse({ error: 'missing or invalid code/state' }, 400, origin);
    }

    // TODO: Add signed/DB-backed state verification if needed

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const redirectOk =
      Deno.env.get('GOOGLE_CALLBACK_REDIRECT_OK') ??
      `${allowedOrigin}/settings?google_calendar=ok`;
    const redirectNg =
      Deno.env.get('GOOGLE_CALLBACK_REDIRECT_NG') ??
      `${allowedOrigin}/settings?google_calendar=error`;

    if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceRole) {
      return jsonResponse({ error: 'server not configured: missing env vars' }, 500, origin);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const token = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('google-oauth-callback token exchange failed', token);
      return jsonResponse(token, 400, origin);
    }

    const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const payload = {
      user_id: state,
      provider: 'google',
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      scope: token.scope ?? null,
      token_type: token.token_type ?? 'Bearer',
      id_token: token.id_token ?? null,
      updated_at: new Date().toISOString(),
    };

    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/user_google_tokens`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const detail = await upsertRes.text();
      console.error('google-oauth-callback upsert failed', detail);
      const location = `${redirectNg}&reason=store_failed`;
      return redirectResponse(location, origin);
    }

    return redirectResponse(redirectOk, origin);
  } catch (e) {
    console.error('google-oauth-callback unexpected error', e);
    return jsonResponse({ error: 'unexpected_error', message: String(e) }, 500, origin);
  }
});
