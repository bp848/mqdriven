import { v4 as uuidv4 } from 'uuid';
import { getEnvValue } from '../utils.ts';

export interface EmailPayload {
  to: string[];
  subject: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
  html?: string;
}

export interface EmailDispatchResult {
  id: string;
  sentAt: string;
}

const resolveEndpoint = (): string | undefined => {
  const direct = getEnvValue('APPLICATION_EMAIL_ENDPOINT') ?? getEnvValue('EMAIL_DISPATCH_ENDPOINT');
  if (direct && direct.trim()) {
    return direct.trim();
  }
  const supabaseUrl = getEnvValue('SUPABASE_URL') ?? getEnvValue('SUPABASE_PROJECT_URL');
  if (!supabaseUrl) {
    return undefined;
  }
  const normalized = supabaseUrl.replace(/\/$/, '');
  // Try Resend endpoint first, fallback to send-application-email
  return `${normalized}/functions/v1/resend`;
};

const EMAIL_ENDPOINT = resolveEndpoint();
const EMAIL_API_KEY = getEnvValue('APPLICATION_EMAIL_API_KEY') ?? getEnvValue('EMAIL_DISPATCH_API_KEY');

const isValidAddress = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return /.+@.+\..+/.test(value);
};

const htmlToText = (html: string): string => {
  // Simple HTML to text conversion for fallback
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export class EmailDispatchError extends Error {
  constructor(message: string, public readonly status?: number, public readonly responseBody?: string) {
    super(message);
    this.name = 'EmailDispatchError';
  }
}

export const sendEmail = async (payload: EmailPayload): Promise<EmailDispatchResult> => {
  const to = (payload.to ?? []).filter(isValidAddress);
  const cc = (payload.cc ?? []).filter(isValidAddress);
  const bcc = (payload.bcc ?? []).filter(isValidAddress);

  if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
    throw new EmailDispatchError('送信先のメールアドレスが設定されていません。');
  }

  if (!EMAIL_ENDPOINT) {
    throw new EmailDispatchError('メール送信エンドポイントが構成されていません。');
  }

  if (!payload.subject || !payload.subject.trim()) {
    throw new EmailDispatchError('件名を入力してください。');
  }

  const hasHtml = payload.html && payload.html.trim();
  const hasText = payload.body && payload.body.trim();

  if (!hasHtml && !hasText) {
    throw new EmailDispatchError('本文またはHTML本文を入力してください。');
  }

  // Prepare email payload
  const emailPayload: any = {
    to,
    cc,
    bcc,
    subject: payload.subject,
  };

  if (hasHtml) {
    emailPayload.html = payload.html;
    // Generate text fallback from HTML if no text provided
    emailPayload.body = hasText ? payload.body : htmlToText(payload.html);
  } else {
    emailPayload.body = payload.body;
  }

  const response = await fetch(EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(EMAIL_API_KEY ? { Authorization: `Bearer ${EMAIL_API_KEY}` } : {}),
    },
    body: JSON.stringify(emailPayload),
  });

  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (_error) {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new EmailDispatchError('メール送信に失敗しました。', response.status, text || undefined);
  }

  const sentAt: string =
    (parsed?.sentAt && typeof parsed.sentAt === 'string' ? parsed.sentAt : null) ?? new Date().toISOString();
  const messageId: string =
    (parsed?.id && typeof parsed.id === 'string' ? parsed.id : null) ??
    (parsed?.messageId && typeof parsed.messageId === 'string' ? parsed.messageId : null) ??
    uuidv4();

  return {
    id: messageId,
    sentAt,
  };
};
