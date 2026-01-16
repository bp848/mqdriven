const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const createRequestId = () => Math.random().toString(36).slice(2, 10);

const normalizeOrigin = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return `${url.protocol}//${url.host}`;
    } catch {
        return null;
    }
};

const decodeState = (state: string | null) => {
    if (!state) return { userId: null as string | null, returnTo: null as string | null };
    if (UUID_REGEX.test(state)) return { userId: state, returnTo: null };
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
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

const resolveRequestOrigin = (req: any): string => {
    const proto = (req.headers?.['x-forwarded-proto'] || 'https').toString().split(',')[0].trim();
    const host = (req.headers?.['x-forwarded-host'] || req.headers?.host || '').toString();
    if (!host) return 'https://erp.b-p.co.jp';
    return `${proto}://${host}`;
};

const resolveRedirectUri = (req: any): string => {
    const envUri = process.env.GOOGLE_REDIRECT_URI;
    if (envUri && !/functions\.supabase\.co/.test(envUri)) {
        return envUri;
    }
    return `${resolveRequestOrigin(req)}/api/google/oauth/callback`;
};

const resolveServiceRoleKey = (): string | null => {
    return (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        null
    );
};

const resolveSupabaseUrl = (): string | null =>
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;

const fetchExistingRefreshToken = async (supabaseUrl: string, serviceRoleKey: string, userId: string) => {
    const url = new URL(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/user_google_tokens`);
    url.searchParams.set('select', 'refresh_token');
    url.searchParams.set('user_id', `eq.${userId}`);
    url.searchParams.set('limit', '1');

    const resp = await fetch(url.toString(), {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
        },
    });
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => null);
    const row = Array.isArray(json) ? json[0] : null;
    const token = typeof row?.refresh_token === 'string' ? row.refresh_token : null;
    return token && token.trim() ? token : null;
};

export default async function handler(req: any, res: any) {
    const requestId = createRequestId();
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed', requestId });
    }

    const code = typeof req.query?.code === 'string' ? req.query.code : null;
    const state = typeof req.query?.state === 'string' ? req.query.state : null;

    const parsed = decodeState(state);
    const userId = parsed.userId;

    const requestOrigin = resolveRequestOrigin(req);
    const allowedReturnTos = new Set<string>([
        'https://erp.b-p.co.jp',
        requestOrigin,
        normalizeOrigin(process.env.PUBLIC_BASE_URL) || '',
    ].filter(Boolean));
    const returnTo = parsed.returnTo && (allowedReturnTos.has(parsed.returnTo) || parsed.returnTo.startsWith('http://localhost:') || parsed.returnTo.startsWith('http://127.0.0.1:'))
        ? parsed.returnTo
        : requestOrigin;

    const redirectOk = `${returnTo}/settings?google_calendar=ok`;
    const redirectNgBase = `${returnTo}/settings?google_calendar=error`;

    if (!code || !userId) {
        return res.redirect(302, `${redirectNgBase}&reason=missing_code_or_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = resolveRedirectUri(req);
    const supabaseUrl = resolveSupabaseUrl();
    const serviceRoleKey = resolveServiceRoleKey();

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
        console.error('[api/google/oauth/callback] missing config', {
            requestId,
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            redirectUri,
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceRoleKey: !!serviceRoleKey,
        });
        return res.redirect(302, `${redirectNgBase}&reason=server_not_configured`);
    }

    try {
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

        const token = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok) {
            console.error('[api/google/oauth/callback] token exchange failed', { requestId, status: tokenRes.status, token });
            return res.redirect(302, `${redirectNgBase}&reason=token_exchange_failed`);
        }

        const expiresIn = typeof token?.expires_in === 'number' ? token.expires_in : 3600;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const refreshToken =
            (typeof token?.refresh_token === 'string' && token.refresh_token.trim() ? token.refresh_token : null) ??
            await fetchExistingRefreshToken(supabaseUrl, serviceRoleKey, userId);

        if (!refreshToken) {
            console.error('[api/google/oauth/callback] missing refresh_token', { requestId, userId });
            return res.redirect(302, `${redirectNgBase}&reason=missing_refresh_token`);
        }

        const upsertPayload = {
            user_id: userId,
            provider: 'google',
            access_token: token?.access_token ?? null,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            scope: token?.scope ?? null,
            token_type: token?.token_type ?? 'Bearer',
            id_token: token?.id_token ?? null,
            updated_at: new Date().toISOString(),
        };

        const upsertRes = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/user_google_tokens`, {
            method: 'POST',
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(upsertPayload),
        });

        if (!upsertRes.ok) {
            const text = await upsertRes.text().catch(() => '');
            console.error('[api/google/oauth/callback] upsert failed', { requestId, status: upsertRes.status, text });
            return res.redirect(302, `${redirectNgBase}&reason=store_failed`);
        }

        return res.redirect(302, redirectOk);
    } catch (err: any) {
        console.error('[api/google/oauth/callback] unexpected error', { requestId, err: err?.message, stack: err?.stack });
        return res.redirect(302, `${redirectNgBase}&reason=unexpected_error`);
    }
}
