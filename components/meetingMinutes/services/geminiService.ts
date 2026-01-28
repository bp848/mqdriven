import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptEntry, SummaryData } from "../types";

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
  onProgress("音声をテキストに変換中 (Gemini 3 Flash)...");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: "この音声をビジネス会議の記録として正確に書き起こしてください。フィラー（えー、あのー等）を除去し、各発言に適切なタイムスタンプ（MM:SS形式）を付与して、JSON形式で出力してください。"
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["timestamp", "text"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("書き起こしデータが空です。");
  return { transcript: JSON.parse(text) };
};

export const generateSummary = async (
  transcript: TranscriptEntry[],
  onProgress: (msg: string) => void
): Promise<SummaryData> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  onProgress("文脈を分析し、議事録を構成中 (Gemini 3 Pro)...");

  const fullText = transcript.map(t => `[${t.timestamp}] ${t.text}`).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        parts: [
          {
            text: `以下の会議の書き起こしから、プロフェッショナルな議事録を作成してください。
            特に「決定された事項」と「今後のタスク」を明確に抽出することが重要です。
            
            文字起こしデータ:\n${fullText}`
          }
        ]
      }
    ],
    config: {
      thinkingConfig: { thinkingBudget: 8000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "会議の主題を反映したタイトル" },
          overview: { type: Type.STRING, description: "会議の全体像を要約した文章" },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "この会議で決定された具体的な項目" },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "議論された主要な議題や流れ" },
          nextActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "期限や担当者が含まれる具体的なネクストアクション" }
        },
        required: ["title", "overview", "decisions", "keyPoints", "nextActions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("議事録生成に失敗しました。");
  return JSON.parse(text);
};
