
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptEntry, SummaryData } from "../types";

// ガイドラインに従い、実行の直前にインスタンスを生成する関数
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

interface MeetingContext {
  topic: string;
  attendees: string;
  location: string;
  category: string;
}

export const transcribeMedia = async (
  base64Data: string, 
  mimeType: string,
  context: MeetingContext,
  onProgress: (msg: string) => void
): Promise<{ transcript: TranscriptEntry[] }> => {
  const ai = getAI();
  onProgress("AI文字起こしエンジン（Pro）を起動中...");

  const cleanMimeType = mimeType.split(';')[0];
  const contextInfo = `議題: ${context.topic}\n参加者: ${context.attendees}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: cleanMimeType } },
          {
            text: `あなたはプロの議事録作成者です。以下の会議コンテキストに基づき、提供された音声を精査して文字起こしを生成してください。
            
            【会議コンテキスト】
            ${contextInfo}

            【出力ルール】
            - フィラー（えー、あのー等）は完全に除去する。
            - タイムスタンプ（MM:SS）を必ず含める。
            - 応答は必ず純粋な JSON 形式 [ { "timestamp": "MM:SS", "text": "..." } ] で出力してください。`
          }
        ]
      },
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

    const rawText = response.text;
    if (!rawText) throw new Error("AIからの応答が空です。");
    
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

    return { transcript: JSON.parse(jsonStr.trim()) };
  } catch (error: any) {
    const errorMsg = error.message || "";
    if (errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("leaked")) {
      throw new Error("AUTH_REQUIRED: APIキーが無効です。セキュリティ保護のため、新しいキーを選択してください。");
    }
    throw new Error(`文字起こし失敗: ${error.message}`);
  }
};

export const generateSummary = async (
  transcript: TranscriptEntry[],
  context: MeetingContext,
  onProgress: (msg: string) => void
): Promise<SummaryData> => {
  const ai = getAI();
  onProgress("会議内容の構造化要約を生成中...");
  const fullText = transcript.map(t => `[${t.timestamp}] ${t.text}`).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{
          text: `以下の文字起こしから、決定事項とネクストアクションを抽出したビジネス議事録を作成してください。
          議題: ${context.topic}
          内容:\n${fullText}`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            atmosphere: { type: Type.STRING }
          },
          required: ["title", "overview", "decisions", "keyPoints", "nextActions", "atmosphere"]
        }
      }
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response.text);
  } catch (error: any) {
    throw new Error(`要約エラー: ${error.message}`);
  }
};
