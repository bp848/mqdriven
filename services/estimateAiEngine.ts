import { Type } from "@google/genai";
import { requireGeminiClient } from "./Gemini";
import { PrintSpecs, CostItem, GroundingSource } from "../types";

/**
 * PDF/画像から仕様を極めて精密に抽出する
 */
export const extractSpecsFromContent = async (text: string, imageData?: { data: string, mimeType: string }): Promise<{ specs: PrintSpecs, sources: GroundingSource[] }> => {
    const ai = requireGeminiClient() as any;
    const parts: any[] = [{
        text: `
    あなたは文唱堂印刷の「DTP検版・積算部長」です。
    提供されたPDF/画像は「印刷用完全データ」または「仕様書」です。
    曖昧な推測は一切禁止。画像内のピクセル情報を基に、以下の情報を確定させてください。

    【解析ミッション】
    1. 判型（サイズ）の確定:
       - トンボ（トリムマーク）の四隅を確認。仕上がり枠の縦横比を計算。
       - A4(210x297)、B5(182x257)等を特定。
    2. 色数（色分解）の確定:
       - カラーバー（CMYKパッチ）の有無をスキャン。
    3. 用紙・頁数の確定:
       - スラグ（印刷可能範囲外）に書かれた指示テキストを読み取る。
    4. 数量の確定:
       - 「x1000」「1,000部」等の数値を特定。

    【最重要】
    PDFの内容と結果が異なることは許されません。
    もし情報が画像内に見当たらない場合は、「不明」としてください。

    対象テキスト: ${text}
  ` }];

    if (imageData) {
        parts.push({
            inlineData: imageData
        });
    }

    const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: 'user', parts }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    size: { type: Type.STRING },
                    paperType: { type: Type.STRING },
                    colors: { type: Type.STRING },
                    finishing: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    destination: { type: Type.STRING },
                    managerName: { type: Type.STRING },
                    analysisEvidence: {
                        type: Type.OBJECT,
                        properties: {
                            sizeReasoning: { type: Type.STRING },
                            paperReasoning: { type: Type.STRING },
                            colorReasoning: { type: Type.STRING },
                            pageReasoning: { type: Type.STRING }
                        },
                        required: ["sizeReasoning", "paperReasoning", "colorReasoning"]
                    }
                },
                required: ["title", "quantity", "size", "paperType", "analysisEvidence"]
            },
        },
    });

    return {
        specs: JSON.parse(response.text) as PrintSpecs,
        sources: []
    };
};

/**
 * 印刷実務に基づいた「省略なし」の原価積算
 */
export const suggestCostBreakdown = async (specs: PrintSpecs): Promise<{ costs: CostItem[], sources: GroundingSource[] }> => {
    const ai = requireGeminiClient() as any;

    const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
            role: 'user',
            parts: [{
                text: `
          文唱堂（町屋工場）のフルコスト積算を行ってください。
          項目を統合（一式）せず、用紙、CTP、印刷、製本、配送、管理費を全て個別に算出すること。

          【重要指示】
          各原価項目（CostItem）に対して、「pdfReference」フィールドに、PDFのどのページやどの視覚的要素（例：「1ページ目左上のスラグ指示」「カラーバーの構成」「トンボの比率」）からその項目や数量が必要であると判断したかを具体的に明記してください。

          仕様: ${JSON.stringify(specs)}
        `
            }]
        }],
        config: {
            tools: [{ googleSearch: {} } as any],
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        unitPrice: { type: Type.NUMBER },
                        quantity: { type: Type.NUMBER },
                        formula: { type: Type.STRING },
                        pdfReference: { type: Type.STRING },
                        category: { type: Type.STRING, enum: ['direct', 'processing', 'outsource', 'overhead'] },
                        aiRecommendation: { type: Type.NUMBER }
                    },
                    required: ["id", "name", "unitPrice", "quantity", "formula", "category"]
                },
            },
        }
    });

    const response = result;
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web)
        .map((c: any) => ({ title: c.web.title, uri: c.web.uri })) || [];

    return {
        costs: JSON.parse(response.text) as CostItem[],
        sources
    };
};

/**
 * 物流コスト根拠
 */
export const calculateDeliveryImpact = async (destination: string): Promise<GroundingSource[]> => {
    const ai = requireGeminiClient() as any;

    const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
            role: 'user',
            parts: [{ text: `「文唱堂印刷 町屋工場」から「${destination}」までの配送ルートを確認してください。` }]
        }],
        config: {
            tools: [{ googleSearch: {} } as any]
        }
    });

    return result.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((c: any) => c.web)
        .map((c: any) => ({ title: c.web.title || '物流ルート', uri: c.web.uri })) || [];
};

/**
 * チャット
 */
export const getChatResponse = async (message: string, history: any[]) => {
    const ai = requireGeminiClient() as any;

    const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
            ...history.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ],
        config: {
            systemInstruction: "あなたは文唱堂印刷のAI積算部長です。PDF解析根拠、最新用紙相場に基づき、詳細な回答を行います。"
        }
    });

    return result.text;
};
