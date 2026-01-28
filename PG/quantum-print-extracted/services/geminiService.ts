
import { GoogleGenAI, Type } from "@google/genai";
import type { QuoteFormData, QuoteResultData } from '../types';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pq: { type: Type.NUMBER },
    vq: { type: Type.NUMBER },
    mq: { type: Type.NUMBER },
    profitMargin: { type: Type.NUMBER },
    costBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { item: { type: Type.STRING }, cost: { type: Type.NUMBER } },
        required: ["item", "cost"]
      }
    },
    formalItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          qty: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          amount: { type: Type.NUMBER }
        },
        required: ["name", "qty", "unit", "unitPrice", "amount"]
      }
    },
    internalNotes: { type: Type.STRING },
    estimatedProductionDays: { type: Type.NUMBER },
    logisticsInfo: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
  },
  required: ["pq", "vq", "mq", "profitMargin", "costBreakdown", "formalItems", "internalNotes", "estimatedProductionDays", "logisticsInfo", "confidence"]
};

export const processAIQuote = async (formData: QuoteFormData): Promise<QuoteResultData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-pro-preview";

  let parts: any[] = [];
  if (formData.imageInput) {
    parts.push({ inlineData: { data: formData.imageInput.split(',')[1], mimeType: "image/jpeg" } });
    parts.push({ text: `この画像から仕様を解析し、請求性質「${formData.mainCategory}」として積算してください。目標利益率は${formData.markup}%。` });
  } else if (formData.rawInput) {
    parts.push({ text: `以下の依頼テキストから積算してください。性質:${formData.mainCategory}, 目標利益率:${formData.markup}%\n\n${formData.rawInput}` });
  } else {
    parts.push({ text: `以下の詳細仕様で積算してください。性質:${formData.mainCategory}, 目標利益率:${formData.markup}%\n\n${JSON.stringify(formData)}` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      systemInstruction: "あなたは総合印刷会社の熟練積算部長です。PQ(売価)=VQ(原価)+MQ(粗利)の整合性を保ち、日本の商慣習に即した精密な見積をJSONで返してください。第三種郵便や発送費などの特殊な原価項目も考慮してください。",
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    }
  });

  return JSON.parse(response.text.trim()) as QuoteResultData;
};

export const updateQuoteWithFeedback = async (instruction: string, currentData: QuoteResultData): Promise<QuoteResultData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ parts: [{ text: `現在の積算データ: ${JSON.stringify(currentData)}\n\n修正指示: ${instruction}\n\nこの指示に基づきデータを再計算し、JSONで返してください。` }] }],
    config: {
      systemInstruction: "あなたは積算修正のプロです。整合性を保ちながら指定の修正を行い、新しい積算結果をJSONで返してください。",
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    }
  });
  return JSON.parse(response.text.trim()) as QuoteResultData;
};
