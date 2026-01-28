import { GoogleGenAI, Type } from "@google/genai";
import type { QuoteFormData, QuoteResultData } from '../types/quote';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        suggestedRetailPrice: {
            type: Type.NUMBER,
            description: "顧客への提示価格（円）。内部原価に指定された利益率を上乗せした最終金額。"
        },
        internalTotalCost: {
            type: Type.NUMBER,
            description: "印刷、用紙、製本など、すべてのコストを含む内部原価の合計（円）。"
        },
        profitMargin: {
            type: Type.NUMBER,
            description: "計算に使用した利益率（%）。"
        },
        costBreakdown: {
            type: Type.ARRAY,
            description: "内部原価の内訳。",
            items: {
                type: Type.OBJECT,
                properties: {
                    item: {
                        type: Type.STRING,
                        description: "費用項目名 (例: '印刷代', '製本代', '用紙代', '人件費')。"
                    },
                    cost: {
                        type: Type.NUMBER,
                        description: "その項目の内部原価（円）。"
                    }
                },
                required: ["item", "cost"]
            }
        },
        internalNotes: {
            type: Type.STRING,
            description: "社内担当者向けのメモ。製造上の注意点、代替案、コスト削減のヒント、推奨されるサプライヤー情報など。"
        },
        estimatedProductionDays: {
            type: Type.NUMBER,
            description: "おおよその製造日数（営業日）。"
        }
    },
    required: ["suggestedRetailPrice", "internalTotalCost", "profitMargin", "costBreakdown", "internalNotes", "estimatedProductionDays"]
};

export const generateQuote = async (formData: QuoteFormData): Promise<QuoteResultData> => {
    const prompt = `
以下の仕様と利益率に基づいて、印刷の内部原価と顧客への提示価格を見積もってください。

### 印刷仕様
- 書籍タイトル: ${formData.title || '（指定なし）'}
- ページ数: ${formData.pages}ページ
- サイズ: ${formData.size}
- 表紙用紙: ${formData.coverPaper}
- 本文用紙: ${formData.innerPaper}
- 色: ${formData.color}
- 製本方法: ${formData.binding}
- 部数: ${formData.quantity}部
- 特殊加工: ${formData.specialProcessing}

### 価格設定
- 要求利益率: ${formData.markup}%
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "あなたは日本の近代的な印刷会社のベテラン見積もり担当者です。あなたの仕事は、提供された仕様から内部原価を正確に計算し、指定された利益率（マークアップ）を上乗せして、最終的な顧客への提示価格を算出することです。コストは日本の現実的な業界レート（円）に基づいて計算してください。出力は指定されたJSONスキーマに厳密に従ってください。JSON以外のテキストは絶対に含めないでください。",
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText) as QuoteResultData;

        if (typeof parsedData.suggestedRetailPrice !== 'number' || typeof parsedData.internalTotalCost !== 'number' || !Array.isArray(parsedData.costBreakdown)) {
            throw new Error("AIからのレスポンス形式が正しくありません。");
        }

        return parsedData;

    } catch (error) {
        console.error("Gemini API Error:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
            throw new Error("AIからの見積もりデータの解析に失敗しました。時間をおいて再度お試しください。");
        }
        throw new Error("AIとの通信中にエラーが発生しました。入力内容を確認するか、時間をおいて再度お試しください。");
    }
};
