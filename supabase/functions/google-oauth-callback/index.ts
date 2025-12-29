const DEFAULT_ALLOWED_ORIGINS = [
  'https://erp.b-p.co.jp',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  '*',
];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const deriveProjectRef = (supabaseUrl: string | null, requestHost?: string | null): string | null => {
  try {
    if (supabaseUrl) {
      const host = new URL(supabaseUrl).hostname; // e.g. rwjhpfghhgstvplmggks.supabase.co
      const projectRef = host.split('.')[0];
      if (projectRef) return projectRef;
    }
  } catch {
    // ignore
  }
  if (requestHost && requestHost.includes('.functions.supabase.co')) {
    return requestHost.split('.')[0];
  }
  return null;
};

const buildFunctionsRedirectUri = (requestHost?: string | null): string | null => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const projectRef = deriveProjectRef(supabaseUrl ?? null, requestHost);
  if (!projectRef) return null;
  return `https://${projectRef}.functions.supabase.co/google-oauth-callback`;
};

const resolveRedirectUri = (requestHost?: string | null): { uri: string | null; source: 'env' | 'fallback' } => {
  const envUri = Deno.env.get('GOOGLE_REDIRECT_URI');
  const fallback = buildFunctionsRedirectUri(requestHost);
  if (envUri) {
    if (/functions\.supabase\.co/.test(envUri)) {
      return { uri: envUri, source: 'env' };
    }
    if (fallback) {
      console.warn(
        'GOOGLE_REDIRECT_URI is not a Supabase Functions URL. Falling back to functions callback.',
        { envUri, fallback },
      );
      return { uri: fallback, source: 'fallback' };
    }
    return { uri: envUri, source: 'env' };
  }
  return { uri: fallback, source: 'fallback' };
};

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

const normalizeOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const isSupabaseFunctionsHost = (origin: string | null) => {
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host.endsWith('.functions.supabase.co');
  } catch {
    return false;
  }
};

const parseStatePayload = (state: string | null): { userId: string | null; returnTo: string | null } => {
  if (!state) return { userId: null, returnTo: null };
  if (UUID_REGEX.test(state)) return { userId: state, returnTo: null };
  try {
    const decoded = JSON.parse(atob(state));
    const userId =
      typeof decoded?.user_id === 'string' && UUID_REGEX.test(decoded.user_id)
        ? decoded.user_id
        : (typeof decoded?.userId === 'string' && UUID_REGEX.test(decoded.userId) ? decoded.userId : null);
    const returnTo = normalizeOrigin(decoded?.return_to ?? decoded?.returnTo ?? null);
    return { userId, returnTo };
  } catch {
    return { userId: null, returnTo: null };
  }
};

const pickRedirectBase = (preferred: string | null, requestOrigin: string | null): string => {
  const wildcard = ALLOWED_ORIGINS.includes('*');
  const allowed = ALLOWED_ORIGINS.filter((o) => o !== '*');
  const isAllowed = (origin: string | null) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized || isSupabaseFunctionsHost(normalized)) return false;
    if (allowed.includes(normalized)) return true;
    if (wildcard) return true;
    if (normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:')) return true;
    return false;
  };

  if (isAllowed(preferred)) return normalizeOrigin(preferred)!;
  if (isAllowed(requestOrigin)) return normalizeOrigin(requestOrigin)!;
  const fallback = allowed.find((o) => !!o);
  return fallback ?? 'https://erp.b-p.co.jp';
};

const corsHeaders = (origin: string | null) => {
  const wildcard = ALLOWED_ORIGINS.includes('*');
  const allowedOrigin = wildcard
    ? '*'
    : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
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

const triggerInitialSync = async (userId: string) => {
  const syncUrl = Deno.env.get('GOOGLE_INITIAL_SYNC_URL');
  if (!syncUrl) return;
  try {
    const resp = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('google-oauth-callback initial sync failed', resp.status, text);
    }
  } catch (err) {
    console.warn('google-oauth-callback initial sync error', err);
  }
};

const fetchExistingRefreshToken = async (
  supabaseUrl: string,
  serviceRole: string,
  userId: string,
): Promise<string | null> => {
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/user_google_tokens?user_id=eq.${userId}&select=refresh_token&limit=1`,
      {
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
      },
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("google-oauth-callback failed to load existing refresh_token", resp.status, text);
      return null;
    }
    const data = await resp.json();
    const record = Array.isArray(data) ? data[0] : null;
    return record?.refresh_token ?? null;
  } catch (err) {
    console.error("google-oauth-callback unexpected fetch error", err);
    return null;
  }
};

console.info('google-oauth-callback ready');

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const requestHost = (() => {
    try {
      return new URL(req.url).host;
    } catch {
      return null;
    }
  })();

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
    const parsedState = parseStatePayload(state);
    const redirectBase = pickRedirectBase(parsedState.returnTo, url.origin);

    if (!code || !parsedState.userId) {
      return jsonResponse({ error: 'missing or invalid code/state' }, 400, origin);
    }

    // TODO: Add signed/DB-backed state verification if needed

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const { uri: redirectUri, source: redirectSource } = resolveRedirectUri(requestHost);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const redirectOk =
      Deno.env.get('GOOGLE_CALLBACK_REDIRECT_OK') ??
      `${redirectBase}/settings?google_calendar=ok`;
    const redirectNg =
      Deno.env.get('GOOGLE_CALLBACK_REDIRECT_NG') ??
      `${redirectBase}/settings?google_calendar=error`;

    if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceRole) {
      console.error('google-oauth-callback missing config', {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        redirectUri,
        supabaseUrl: !!supabaseUrl,
        serviceRole: !!serviceRole,
        origin,
        requestHost,
      });
      const location = `${redirectNg}&reason=server_not_configured`;
      return redirectResponse(location, origin);
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
      console.error('google-oauth-callback token exchange failed', {
        status: tokenRes.status,
        token,
        origin,
        requestHost,
      });
      const location = `${redirectNg}&reason=token_exchange_failed`;
      return redirectResponse(location, origin);
    }

    if (redirectSource === 'fallback') {
      console.warn('Using fallback functions redirect URI for token exchange:', redirectUri);
    }

    const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const refreshToken = token.refresh_token ?? await fetchExistingRefreshToken(supabaseUrl, serviceRole, parsedState.userId);

    if (!refreshToken) {
      console.error('google-oauth-callback missing refresh_token after consent', { userId: parsedState.userId });
      const location = `${redirectNg}&reason=missing_refresh_token`;
      return redirectResponse(location, origin);
    }

    const payload = {
      user_id: parsedState.userId,
      provider: 'google',
      access_token: token.access_token,
      refresh_token: refreshToken,
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
      console.error('google-oauth-callback upsert failed', { status: upsertRes.status, detail, origin, requestHost });
      const location = `${redirectNg}&reason=store_failed`;
      return redirectResponse(location, origin);
    }

    console.info('google-oauth-callback success', {
      userId: parsedState.userId,
      redirectSource,
      redirectUri,
      origin,
      requestHost,
      expiresAt,
    });
    // Kick off first sync if configured
    await triggerInitialSync(parsedState.userId);

    return redirectResponse(redirectOk, origin);
  } catch (e) {
    console.error('google-oauth-callback unexpected error', e);
    return jsonResponse({ error: 'unexpected_error', message: String(e) }, 500, origin);
  }
});
