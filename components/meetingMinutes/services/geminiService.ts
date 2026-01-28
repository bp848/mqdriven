import { Type } from '@google/genai';
import { requireGeminiClient } from '../../../services/Gemini';
import { TranscriptEntry, OptimizationEntry, SummaryData } from '../types';

const TRANSCRIBE_MODEL = 'gemini-3-flash-preview';
const SUMMARY_MODEL = 'gemini-3-pro-preview';

const withRetry = async <T>(fn: () => Promise<T>, retries = 2): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    console.warn('Gemini request failed, retrying...', { error, retries });
    await new Promise((resolve) => setTimeout(resolve, 400 * (3 - retries)));
    return withRetry(fn, retries - 1);
  }
};

export const transcribeMedia = async (
  base64Data: string,
  mimeType: string,
  onProgress: (msg: string) => void
): Promise<{ transcript: TranscriptEntry[] }> => {
  const ai = requireGeminiClient();
  onProgress('音声を書き起こしています...');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: 'この音声・動画をビジネス会議の記録として、タイムスタンプ付きJSON形式で書き起こしてください。フィラーを除去し、発話者名は省略してください。',
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ['timestamp', 'text'],
            properties: {
              timestamp: { type: Type.STRING },
              text: { type: Type.STRING },
            },
          },
        },
      },
    })
  );

  const text = response.text;
  if (!text) {
    throw new Error('書き起こしが空のレスポンスでした。');
  }
  return { transcript: JSON.parse(text) as TranscriptEntry[] };
};

export const generateSummary = async (
  transcript: TranscriptEntry[],
  onProgress: (msg: string) => void
): Promise<SummaryData> => {
  const ai = requireGeminiClient();
  onProgress('議事録を構成しています...');

  const fullText = transcript.map((t) => `[${t.timestamp}] ${t.text}`).join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: SUMMARY_MODEL,
      contents: [
        {
          parts: [
            {
              text: `以下の会議記録から、プロフェッショナルな議事録を作成してください。特に「決定事項」と「次のアクション」に重点を置き、簡潔に日本語で出力してください。\n\n${fullText}`,
            },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['title', 'overview', 'decisions', 'keyPoints', 'nextActions'],
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    })
  );

  const text = response.text;
  if (!text) {
    throw new Error('要約が返ってきませんでした。');
  }
  return JSON.parse(text) as SummaryData;
};

export const optimizeTranscript = async (
  transcript: TranscriptEntry[],
  onProgress: (msg: string) => void
): Promise<OptimizationEntry[]> => {
  const ai = requireGeminiClient();
  onProgress('トランスクリプトを校正しています...');

  const snippet = transcript.slice(0, 100).map((t) => t.text).join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: [
        {
          parts: [
            {
              text: `以下の文章をビジネス文書として読みやすく校正してください。\n\n${snippet}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ['id', 'original', 'optimized'],
            properties: {
              id: { type: Type.STRING },
              original: { type: Type.STRING },
              optimized: { type: Type.STRING },
            },
          },
        },
      },
    })
  );

  const text = response.text;
  if (!text) return [];
  return JSON.parse(text) as OptimizationEntry[];
};
