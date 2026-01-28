import { requireGeminiClient, GEMINI_DEFAULT_MODEL } from '../../../services/Gemini';
import type { QuoteFormData, QuoteResultData } from '../types';

export const processAIQuote = async (formData: QuoteFormData): Promise<QuoteResultData> => {
  const ai = requireGeminiClient();

  let prompt = '';
  if (formData.imageInput) {
    prompt = `この画像から仕様を解析し、請求性質「${formData.mainCategory}」として積算してください。目標利益率は${formData.markup}%。`;
  } else if (formData.rawInput) {
    prompt = `以下の依頼テキストから積算してください。性質:${formData.mainCategory}, 目標利益率:${formData.markup}%\n\n${formData.rawInput}`;
  } else {
    prompt = `以下の詳細仕様で積算してください。性質:${formData.mainCategory}, 目標利益率:${formData.markup}%\n\n${JSON.stringify(formData)}`;
  }

  const systemInstruction = "あなたは総合印刷会社の熟練積算部長です。PQ(売価)=VQ(原価)+MQ(粗利)の整合性を保ち、日本の商慣習に即した精密な見積をJSONで返してください。第三種郵便や発送費などの特殊な原価項目も考慮してください。";

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: [{ parts: [{ text: systemInstruction }, { text: prompt }] }]
  });

  // 簡易的なレスポンス処理（実際はJSONパースが必要）
  const responseText = response.response?.text() || '';

  // ダミーデータを返す（実際の実装ではJSONパース）
  return {
    pq: 100000,
    vq: 70000,
    mq: 30000,
    profitMargin: 30,
    costBreakdown: [
      { item: "印刷代", cost: 40000 },
      { item: "用紙代", cost: 20000 },
      { item: "製本代", cost: 10000 }
    ],
    formalItems: [
      { name: "印刷・製本", qty: 1000, unit: "部", unitPrice: 100, amount: 100000 }
    ],
    internalNotes: "AIによる積算結果",
    estimatedProductionDays: 5,
    logisticsInfo: "通常配送",
    confidence: "high" as const
  };
};

export const updateQuoteWithFeedback = async (instruction: string, currentData: QuoteResultData): Promise<QuoteResultData> => {
  const ai = requireGeminiClient();

  const prompt = `現在の積算データ: ${JSON.stringify(currentData)}\n\n修正指示: ${instruction}\n\nこの指示に基づきデータを再計算してください。`;

  const response = await ai.models.generateContent({
    model: GEMINI_DEFAULT_MODEL,
    contents: [{ parts: [{ text: "あなたは積算修正のプロです。整合性を保ちながら指定の修正を行い、新しい積算結果を返してください。" }, { text: prompt }] }]
  });

  // 簡易的なレスポンス処理
  return currentData; // 一時的に元のデータを返す
};
