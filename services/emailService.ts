import { v4 as uuidv4 } from 'uuid';
import { SUPABASE_KEY as CREDENTIAL_SUPABASE_KEY, SUPABASE_URL as CREDENTIAL_SUPABASE_URL } from '../supabaseCredentials';
import { getEnvValue } from '../utils.ts';
import { GEMINI_DEFAULT_MODEL, isGeminiAIDisabled, requireGeminiClient } from './Gemini';
import { getSupabase, getSupabaseFunctionHeaders } from './supabaseClient';

export interface EmailPayload {
  to: string[];
  subject: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
  html?: string;
  mode?: 'test' | 'bulk' | 'scheduled';
}

export interface EmailDispatchResult {
  id: string;
  sentAt: string;
}

export type EmailAIDraftRequest = {
  topic: string;
  recipient?: string;
  context?: string;
  tone?: string;
  language?: 'ja' | 'en' | string;
  senderName?: string;
};

export type EmailAIDraft = {
  subject: string;
  body: string;
};

const resolveEndpoint = (): string | undefined => {
  const directKeys = [
    'APPLICATION_EMAIL_ENDPOINT',
    'EMAIL_DISPATCH_ENDPOINT',
    'VITE_APPLICATION_EMAIL_ENDPOINT',
    'VITE_EMAIL_DISPATCH_ENDPOINT',
    'NEXT_PUBLIC_EMAIL_DISPATCH_ENDPOINT',
  ];
  for (const key of directKeys) {
    const value = getEnvValue(key);
    if (value && value.trim()) return value.trim();
  }

  const supabaseUrlCandidates = [
    getEnvValue('SUPABASE_URL'),
    getEnvValue('SUPABASE_PROJECT_URL'),
    getEnvValue('VITE_SUPABASE_URL'),
    getEnvValue('VITE_SUPABASE_PROJECT_URL'),
    getEnvValue('NEXT_PUBLIC_SUPABASE_URL'),
    CREDENTIAL_SUPABASE_URL,
  ];
  for (const url of supabaseUrlCandidates) {
    if (url && url.trim()) {
      const normalized = url.replace(/\/$/, '');
      return `${normalized}/functions/v1/send-application-email`;
    }
  }

  const supabaseRef =
    getEnvValue('SUPABASE_PROJECT_REFERENCE') ||
    getEnvValue('SUPABASE_REF') ||
    getEnvValue('VITE_SUPABASE_PROJECT_REFERENCE');
  if (supabaseRef && supabaseRef.trim()) {
    return `https://${supabaseRef.trim()}.supabase.co/functions/v1/send-application-email`;
  }

  return undefined;
};

const EMAIL_ENDPOINT = resolveEndpoint();
const EMAIL_TEST_ENDPOINT =
  getEnvValue('APPLICATION_EMAIL_TEST_ENDPOINT') ??
  getEnvValue('EMAIL_DISPATCH_TEST_ENDPOINT') ??
  getEnvValue('VITE_APPLICATION_EMAIL_TEST_ENDPOINT') ??
  getEnvValue('VITE_EMAIL_DISPATCH_TEST_ENDPOINT');
const EMAIL_API_KEY =
  getEnvValue('APPLICATION_EMAIL_API_KEY') ??
  getEnvValue('EMAIL_DISPATCH_API_KEY') ??
  getEnvValue('VITE_APPLICATION_EMAIL_API_KEY') ??
  getEnvValue('VITE_EMAIL_DISPATCH_API_KEY');
const EMAIL_TEST_MODE =
  getEnvValue('EMAIL_TEST_MODE') ??
  getEnvValue('VITE_EMAIL_TEST_MODE');

const isSupabaseFunctionsEndpoint = (value: string): boolean => {
  try {
    const url = new URL(value, 'http://localhost');
    return url.pathname.includes('/functions/v1/');
  } catch {
    return value.includes('/functions/v1/');
  }
};

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

const loadSMTPConfig = (): any => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    const rawNotification = window.localStorage.getItem('emailNotificationSettings');
    const notificationSettings = rawNotification ? JSON.parse(rawNotification) : null;
    const smtpFromNotification = notificationSettings?.smtp || null;

    // Back-compat: SettingsPage stores SMTP settings under `smtpSettings`
    const rawSmtp = window.localStorage.getItem('smtpSettings');
    const smtpFromSettingsPage = rawSmtp ? JSON.parse(rawSmtp) : null;

    if (smtpFromNotification && typeof smtpFromNotification === 'object') return smtpFromNotification;
    if (smtpFromSettingsPage && typeof smtpFromSettingsPage === 'object') return smtpFromSettingsPage;
    return null;
  } catch (error) {
    console.warn('[email] Failed to parse SMTP config', error);
    return null;
  }
};

const sanitizeAiOutput = (text: string): string => {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const withoutFence = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, '');
  return withoutFence.endsWith('```') ? withoutFence.slice(0, -3).trim() : withoutFence.trim();
};

export const generateEmailDraftWithAI = async (input: EmailAIDraftRequest): Promise<EmailAIDraft> => {
  if (isGeminiAIDisabled) {
    throw new EmailDispatchError('AI機能が無効化されています。VITE_AI_OFF=0 で再度お試しください。');
  }
  if (!input.topic || !input.topic.trim()) {
    throw new EmailDispatchError('AIで生成するにはテーマ（topic）が必要です。');
  }

  const ai = requireGeminiClient();
  const lang = input.language || 'ja';
  const audience = input.recipient ? `宛先: ${input.recipient}` : '宛先: 不明';
  const tone = input.tone ? `トーン: ${input.tone}` : 'トーン: 丁寧で簡潔';
  const sender = input.senderName ? `送信者: ${input.senderName}` : '';
  const extra = input.context ? `補足: ${input.context}` : '';

  const prompt = [
    '以下の条件でメール本文と件名を作成してください。',
    `言語: ${lang}`,
    audience,
    tone,
    sender,
    extra,
    `テーマ: ${input.topic}`,
    '',
    '出力フォーマット:',
    '件名: <件名>',
    '本文:',
    '<本文>',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: prompt,
  });

  const raw = sanitizeAiOutput(response.text ?? '');
  const subjectMatch = raw.match(/件名[:：]\s*(.+)/);
  const bodyMatch = raw.match(/本文[:：]\s*([\s\S]*)/);

  const subject = subjectMatch ? subjectMatch[1].trim() : 'ご連絡の件';
  const body = bodyMatch ? bodyMatch[1].trim() : raw;

  if (!body) {
    throw new EmailDispatchError('AIから本文を取得できませんでした。');
  }

  return {
    subject,
    body,
  };
};

export const sendEmail = async (payload: EmailPayload): Promise<EmailDispatchResult> => {
  const to = (payload.to ?? []).filter(isValidAddress);
  const cc = (payload.cc ?? []).filter(isValidAddress);
  const bcc = (payload.bcc ?? []).filter(isValidAddress);
  const isTestMode = payload.mode === 'test';
  const testModeBehavior = (EMAIL_TEST_MODE || '').toLowerCase(); // '', 'log', 'send'

  // 本番送信の安全対策
  const isProductionMode = !isTestMode;
  const PRODUCTION_SAFE_MODE = getEnvValue('EMAIL_PRODUCTION_SAFE_MODE') === 'true';
  
  if (isProductionMode && PRODUCTION_SAFE_MODE) {
    throw new EmailDispatchError('本番送信は安全モードにより無効化されています。EMAIL_PRODUCTION_SAFE_MODE=false で無効化できます。');
  }

  // 本番送信時の確認（開発環境のみ）
  if (isProductionMode && !PRODUCTION_SAFE_MODE) {
    const isDevelopment = getEnvValue('NODE_ENV') === 'development' || getEnvValue('VITE_NODE_ENV') === 'development';
    if (isDevelopment) {
      console.warn('[email][PRODUCTION WARNING] 本番送信を実行します。送信先:', { to, cc, bcc, subject: payload.subject });
    }
  }

  if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
    throw new EmailDispatchError('送信先のメールアドレスが設定されていません。');
  }

  // Check for custom SMTP configuration first
  const smtpConfig = loadSMTPConfig();
  
  if (smtpConfig && smtpConfig.host && smtpConfig.username && smtpConfig.password && smtpConfig.fromEmail) {
    // Use custom SMTP configuration
    console.log('[email] Using custom SMTP configuration');
    
    if (!payload.subject || !payload.subject.trim()) {
      throw new EmailDispatchError('件名を入力してください。');
    }

    const hasHtml = payload.html && payload.html.trim();
    const hasText = payload.body && payload.body.trim();

    if (!hasHtml && !hasText) {
      throw new EmailDispatchError('本文またはHTML本文を入力してください。');
    }

    // Create email payload for custom SMTP
    const emailPayload = {
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password
      },
      from: `${smtpConfig.fromName || 'システム'} <${smtpConfig.fromEmail}>`,
      to: to.join(', '),
      cc: cc.length > 0 ? cc.join(', ') : undefined,
      bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
      subject: payload.subject,
      text: hasText ? payload.body : htmlToText(payload.html || ''),
      html: hasHtml ? payload.html : undefined
    };

    // Send via custom SMTP endpoint (you'll need to create this endpoint)
    const customEndpoint = getEnvValue('CUSTOM_SMTP_ENDPOINT') || '/api/send-email';
    
    const response = await fetch(customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmailDispatchError('カスタムSMTPでのメール送信に失敗しました。', response.status, errorText);
    }

    const result = await response.json();
    return {
      id: result.id || uuidv4(),
      sentAt: result.sentAt || new Date().toISOString(),
    };
  }

  // Fallback to Edge Function (Resendラッパー)
  const endpoint = isTestMode
    ? (EMAIL_TEST_ENDPOINT || EMAIL_ENDPOINT)
    : EMAIL_ENDPOINT;

  // 「テスト送信のみログで確認」モード or エンドポイント未設定時は実送信を避ける
  if (isTestMode && (!endpoint || EMAIL_TEST_MODE === 'log')) {
    console.info('[email][test-mode] Skipping real send. Payload preview:', {
      to,
      subject: payload.subject,
      hasHtml: !!payload.html,
      hasBody: !!payload.body,
    });
    return {
      id: uuidv4(),
      sentAt: new Date().toISOString(),
    };
  }

  if (!endpoint) {
    throw new EmailDispatchError('メール送信エンドポイントが構成されていません。APPLICATION_EMAIL_ENDPOINT または SUPABASE_URL を設定してください。');
  }

  // Supabase Edge Functions の場合、Authorization ヘッダーが無いと 401 になる。
  // EMAIL_API_KEY が未設定なら、ログイン中の access_token（なければ anon key）を使う。
  let resolvedAuthorization: string | undefined;
  if (EMAIL_API_KEY) {
    resolvedAuthorization = `Bearer ${EMAIL_API_KEY}`;
  } else if (isSupabaseFunctionsEndpoint(endpoint)) {
    try {
      const headers = await getSupabaseFunctionHeaders(getSupabase());
      resolvedAuthorization = headers.Authorization;
    } catch (_err) {
      if (CREDENTIAL_SUPABASE_KEY && CREDENTIAL_SUPABASE_KEY.trim()) {
        resolvedAuthorization = `Bearer ${CREDENTIAL_SUPABASE_KEY.trim()}`;
      }
    }
  }

  if (!payload.subject || !payload.subject.trim()) {
    throw new EmailDispatchError('件名を入力してください。');
  }

  const hasHtml = payload.html && payload.html.trim();
  const hasText = payload.body && payload.body.trim();

  if (!hasHtml && !hasText) {
    throw new EmailDispatchError('本文またはHTML本文を入力してください。');
  }

  // In test mode, always send unless explicitly set to 'log' mode
  if (isTestMode && testModeBehavior === 'log') {
    console.info('[email][test-mode] Not sending. Payload preview:', {
      to,
      subject: payload.subject,
      hasHtml: !!payload.html,
      hasBody: !!payload.body,
    });
    return {
      id: uuidv4(),
      sentAt: new Date().toISOString(),
    };
  }

  // Prepare email payload
  const emailPayload: any = {
    to,
    cc,
    bcc,
    subject: isTestMode ? `[テスト送信] ${payload.subject}` : payload.subject,
  };

  if (hasHtml) {
    emailPayload.html = payload.html;
    // Generate text fallback from HTML if no text provided
    emailPayload.body = hasText ? payload.body : htmlToText(payload.html);
  } else {
    emailPayload.body = payload.body;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolvedAuthorization ? { Authorization: resolvedAuthorization } : {}),
      ...(isTestMode ? { 'X-MQ-Test-Email': 'true' } : {}),
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
