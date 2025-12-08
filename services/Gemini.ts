import { GoogleGenAI } from '@google/genai';

const resolveEnvValue = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const envValue = (import.meta.env as Record<string, string | undefined>)[key];
    if (envValue !== undefined) return envValue;
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

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
  resolveEnvValue('API_KEY');

if (!GEMINI_API_KEY && !isGeminiAIDisabled) {
  console.error('Gemini APIキーが設定されていません。AI機能を利用するにはAPIキーが必要です。');
}

export const GEMINI_DEFAULT_MODEL =
  resolveEnvValue('VITE_GEMINI_MODEL') ??
  resolveEnvValue('NEXT_PUBLIC_GEMINI_MODEL') ??
  'gemini-2.5-flash';

// Vertex AI endpoints reject API keys, so we default to the standard Google AI endpoint here.
export const geminiClient = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export const requireGeminiClient = (): GoogleGenAI => {
  if (!geminiClient) {
    throw new Error('Gemini APIキーが設定されていません。');
  }
  return geminiClient;
};

export { resolveEnvValue };
