const DEFAULT_ALLOWED_ORIGINS = [
  "https://erp.b-p.co.jp",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "*",
];

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-requested-with",
];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  // Always allow the specific domain and localhost for development
  const allowedOrigin = origin && (
    origin === "https://erp.b-p.co.jp" || 
    origin === "http://localhost:5173" ||
    origin === "http://localhost:5174" ||
    origin === "http://localhost:3000" ||
    origin === "*"
  ) ? origin : "https://erp.b-p.co.jp";
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin, Access-Control-Request-Headers",
  };
};

const jsonResponse = (req: Request, body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...buildCorsHeaders(req), ...headers },
  });

const normalizeEmails = (values: unknown): string[] => {
  const list = Array.isArray(values)
    ? values
    : typeof values === "string"
    ? values.split(/[,;\n]/)
    : [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const email = raw.trim();
    if (!EMAIL_REGEX.test(email)) continue;
    const lowered = email.toLowerCase();
    if (seen.has(lowered)) continue;
    seen.add(lowered);
  }
  return Array.from(seen);
};

const toHtml = (text: string) => {
  // Minimal escaping to avoid breaking HTML when newlines are converted.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
};

console.info("send-application-email ready");

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") || Deno.env.get("RESEND_FROM_ADDRESS");
  const replyTo = Deno.env.get("RESEND_REPLY_TO") || from;

  console.log("Email function environment check:", {
    hasApiKey: !!apiKey,
    hasFrom: !!from,
    hasReplyTo: !!replyTo,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : null,
  });

  if (!apiKey || !from) {
    return jsonResponse(
      req,
      { 
        error: "server not configured: missing RESEND_API_KEY or RESEND_FROM",
        details: {
          hasApiKey: !!apiKey,
          hasFrom: !!from,
        }
      },
      500,
    );
  }

  let payload: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    html?: string;
  } = {};

  try {
    payload = await req.json();
  } catch (_err) {
    return jsonResponse(req, { error: "invalid json body" }, 400);
  }

  const to = normalizeEmails(payload.to);
  const cc = normalizeEmails(payload.cc);
  const bcc = normalizeEmails(payload.bcc);
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body : "";
  const html = typeof payload.html === "string" && payload.html.trim()
    ? payload.html
    : toHtml(body || "");

  if (!subject) {
    return jsonResponse(req, { error: "subject is required" }, 400);
  }

  if (!body && !payload.html) {
    return jsonResponse(req, { error: "body is required" }, 400);
  }

  if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
    return jsonResponse(req, { error: "at least one recipient is required" }, 400);
  }

  const sendPayload: Record<string, unknown> = {
    from,
    to: to.length ? to : [from],
    subject,
    html,
    text: body || undefined,
  };

  if (cc.length) sendPayload.cc = cc;
  if (bcc.length) sendPayload.bcc = bcc;
  if (replyTo) sendPayload.reply_to = replyTo;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendPayload),
    });

    const responseText = await resp.text();
    let parsed: any = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch (_err) {
      parsed = null;
    }

    if (!resp.ok) {
      const message = parsed?.message || parsed?.error || "failed to send email via Resend";
      console.error("send-application-email failed", resp.status, responseText);
      return jsonResponse(req, { error: message, status: resp.status }, resp.status || 500);
    }

    const messageId =
      (parsed?.id && typeof parsed.id === "string" ? parsed.id : null) ||
      crypto.randomUUID();
    const sentAt = new Date().toISOString();

    return jsonResponse(req, { id: messageId, sentAt }, 200);
  } catch (err) {
    console.error("send-application-email unexpected error", err);
    return jsonResponse(req, { error: "unexpected_error" }, 500);
  }
});
