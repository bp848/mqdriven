import { GoogleGenAI } from '@google/genai';

const summarizeValue = (value: unknown) => {
  if (!value) return 'missing';
  if (typeof value === 'string') return `present (${value.length} chars)`;
  return 'present (non-string)';
};

const readWindowEnvValue = (key: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const win = window as any;
  if (win.__ENV && win.__ENV[key] !== undefined) return win.__ENV[key];
  if (win[key] !== undefined) return win[key];
  if (win.process?.env && win.process.env[key] !== undefined) return win.process.env[key];
  return undefined;
};

const resolveEnvValue = (key: string): string | undefined => {
  const fromWindow = readWindowEnvValue(key);
  if (fromWindow !== undefined) return fromWindow;

  // Check Vite environment variables first (development / Vite build-time)
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const envValue = (import.meta.env as Record<string, string | undefined>)[key];
    if (envValue !== undefined) return envValue;
  }
  // Check process.env (fallback for server / Node usage)
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

const logGeminiEnvDebug = () => {
  const hasWindow = typeof window !== 'undefined';
  const windowEnv = hasWindow ? (window as any).__ENV ?? {} : {};
  const importEnv = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' ? import.meta.env : {};
  const processEnv = typeof process !== 'undefined' ? process.env ?? {} : {};

  console.log('[Gemini] Env debug', {
    hasWindow,
    windowEnvKeys: Object.keys(windowEnv),
    importMetaEnvKeys: typeof importEnv === 'object' ? Object.keys(importEnv as any) : [],
    processEnvKeys: Object.keys(processEnv),
    keyPresence: {
      windowViteGemini: summarizeValue(readWindowEnvValue('VITE_GEMINI_API_KEY')),
      windowGemini: summarizeValue(readWindowEnvValue('GEMINI_API_KEY')),
      importViteGemini: summarizeValue((importEnv as any)?.VITE_GEMINI_API_KEY),
      importGemini: summarizeValue((importEnv as any)?.GEMINI_API_KEY),
      importApi: summarizeValue((importEnv as any)?.API_KEY),
      processGemini: summarizeValue((processEnv as any)?.GEMINI_API_KEY),
    },
    aiFlags: {
      VITE_AI_OFF: resolveEnvValue('VITE_AI_OFF') ?? null,
      VITE_IS_AI_DISABLED: resolveEnvValue('VITE_IS_AI_DISABLED') ?? null,
      NEXT_PUBLIC_AI_OFF: resolveEnvValue('NEXT_PUBLIC_AI_OFF') ?? null,
    },
  });
};

logGeminiEnvDebug();

const aiOffRaw =
  resolveEnvValue('VITE_AI_OFF') ??
  resolveEnvValue('NEXT_PUBLIC_AI_OFF') ??
  resolveEnvValue('AI_OFF') ??
  '0';

export const isGeminiAIDisabled = aiOffRaw === '1' || aiOffRaw.toLowerCase?.() === 'true';

const GEMINI_API_KEY =
  resolveEnvValue('VITE_GEMINI_API_KEY') ??
  resolveEnvValue('NEXT_PUBLIC_GEMINI_API_KEY') ??
  resolveEnvValue('GEMINI_API_KEY') ??
  resolveEnvValue('API_KEY') ??
  '';

if (!GEMINI_API_KEY && !isGeminiAIDisabled) {
  console.error('Gemini APIキーが設定されていません。AI機能を利用するにはAPIキーが必要です。');
  console.error('チェックした環境変数:');
  console.error('- VITE_GEMINI_API_KEY:', resolveEnvValue('VITE_GEMINI_API_KEY') ? '***SET***' : 'NOT SET');
  console.error('- NEXT_PUBLIC_GEMINI_API_KEY:', resolveEnvValue('NEXT_PUBLIC_GEMINI_API_KEY') ? '***SET***' : 'NOT SET');
  console.error('- GEMINI_API_KEY:', resolveEnvValue('GEMINI_API_KEY') ? '***SET***' : 'NOT SET');
  console.error('- API_KEY:', resolveEnvValue('API_KEY') ? '***SET***' : 'NOT SET');
  console.error('- AI_OFF:', aiOffRaw);
}

export const GEMINI_DEFAULT_MODEL =
  resolveEnvValue('VITE_GEMINI_MODEL') ??
  resolveEnvValue('NEXT_PUBLIC_GEMINI_MODEL') ??
  'gemini-2.5-flash';

export const GEMINI_OCR_MODEL =
  resolveEnvValue('VITE_GEMINI_OCR_MODEL') ??
  resolveEnvValue('NEXT_PUBLIC_GEMINI_OCR_MODEL') ??
  resolveEnvValue('GEMINI_OCR_MODEL') ??
  GEMINI_DEFAULT_MODEL;

// Vertex AI endpoints reject API keys, so we default to the standard Google AI endpoint here.
export const geminiClient = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export const requireGeminiClient = (): GoogleGenAI => {
  if (!geminiClient) {
    throw new Error('Gemini APIキーが設定されていません。');
  }
  return geminiClient;
};

export { resolveEnvValue };
