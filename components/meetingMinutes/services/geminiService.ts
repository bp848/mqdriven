import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptEntry, OptimizationEntry, SummaryData } from "../types";

const getApiKey = (): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.VITE_GEMINI_API_KEY || "";
  }
  return "";
};

export const transcribeMedia = async (
  base64Data: string,
  mimeType: string,
  onProgress: (msg: string) => void
): Promise<{ transcript: TranscriptEntry[] }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  onProgress("音声解析エンジンを初期化中...");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "この音声・動画の内容を正確に書き起こしてください。ビジネス会議の記録として、読みやすく、時間軸（timestamp）に沿ったJSON形式で出力してください。フィラーは削除してください。" }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { timestamp: { type: Type.STRING }, text: { type: Type.STRING } },
          required: ["timestamp", "text"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("書き起こしに失敗しました。");
  return { transcript: JSON.parse(text) };
};

export const generateSummary = async (
  transcript: TranscriptEntry[],
  onProgress: (msg: string) => void
): Promise<SummaryData> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  onProgress("プロフェッショナル議事録を作成中...");

  const fullText = transcript.map(t => `[${t.timestamp}] ${t.text}`).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        parts: [
          {
            text: `以下の会議記録をもとに、プロフェッショナルな「議事録」を作成してください。
特に「何が決まったのか（決定事項）」と「次に誰が何をすべきか（ネクストアクション）」を最優先で抽出してください。

文字起こしデータ:
${fullText}`
          }
        ]
      }
    ],
    config: {
      thinkingConfig: { thinkingBudget: 4000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          overview: { type: Type.STRING },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          nextActions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "overview", "decisions", "keyPoints", "nextActions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("要約に失敗しました。");
  return JSON.parse(text);
};

export const optimizeTranscript = async (
  transcript: TranscriptEntry[],
  onProgress: (msg: string) => void
): Promise<OptimizationEntry[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const fullText = transcript.slice(0, 100).map(t => t.text).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ text: `以下の文章をビジネス文書として読みやすく校正してください。\n\n${fullText}` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { id: { type: Type.STRING }, original: { type: Type.STRING }, optimized: { type: Type.STRING } },
          required: ["id", "original", "optimized"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
