import { GoogleGenAI, SchemaType, Type } from "@google/genai";
import { MODEL_TRANSCRIPTION, MODEL_ANALYSIS, THINKING_BUDGET, ANALYSIS_SYSTEM_INSTRUCTION } from "../constants";
import { AnalysisResult } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY環境変数が設定されていません");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Transcribes audio using Gemini Flash 2.5
 * Accepts base64 audio string (without data URI prefix) and mimeType
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TRANSCRIPTION,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "この会議の音声を日本語で正確に文字起こししてください。話者が明確な場合は話者ラベルを付けて、文字起こしテキストのみを提供してください。"
          }
        ]
      }
    });

    return response.text || "文字起こしが生成されませんでした。";
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("音声の文字起こしに失敗しました。");
  }
};

/**
 * Analyzes transcript to generate summary and action items using Gemini 3 Pro
 * Uses Thinking Config for complex reasoning
 */
export const analyzeTranscript = async (transcript: string): Promise<AnalysisResult> => {
  const ai = getAiClient();

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { 
        type: Type.STRING,
        description: "会議の内容に基づく、専門的で短いタイトル（日本語）。"
      },
      summary: { 
        type: Type.STRING,
        description: "会議の包括的な要約（日本語、Markdown形式）。"
      },
      actionItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            task: { type: Type.STRING, description: "タスク内容（日本語）" },
            owner: { type: Type.STRING, description: "担当者名（日本語）" },
            priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            deadline: { type: Type.STRING, description: "期限がある場合は日付、なければ空欄" }
          },
          required: ["task", "owner", "priority"]
        }
      }
    },
    required: ["title", "summary", "actionItems"]
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ANALYSIS,
      contents: transcript,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        thinkingConfig: {
          thinkingBudget: THINKING_BUDGET
        },
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (!response.text) {
      throw new Error("AIからの応答が空でした");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error("Analysis error:", error);
    throw new Error("文字起こしの分析に失敗しました。");
  }
};