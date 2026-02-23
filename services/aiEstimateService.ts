// AI見積もり生成サービス
// Gemini APIを使用して過去の見積もりデータを参照しながら見積もりを生成

import { requireGeminiClient, GEMINI_DEFAULT_MODEL, isGeminiAIDisabled } from './Gemini';
import { getSupabase } from './supabaseClient';
import { PrintSpec, EstimationResult, StrategyOption } from '../types';
import dynamicPricingService from './dynamicPricingService';

// 過去の見積もりデータを取得
export const fetchPastEstimates = async (params: {
  customerId?: string;
  category?: string;
  limit?: number;
}): Promise<Array<{
  id: string;
  customer_name: string;
  title: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  specification: string;
  copies: number;
  unit_price: number;
  created_at: string;
}>> => {
  const supabase = getSupabase();
  let query = supabase
    .from('estimates')
    .select(`
      id,
      customer_name,
      title,
      total,
      subtotal,
      tax_amount,
      specification,
      copies,
      unit_price,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(params.limit || 50);

  if (params.customerId) {
    query = query.eq('customer_id', params.customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('fetchPastEstimates error:', error);
    return [];
  }

  return data || [];
};

// 類似案件を検索
export const findSimilarEstimates = async (spec: PrintSpec): Promise<Array<{
  id: string;
  customer_name: string;
  title: string;
  total: number;
  copies: number;
  unit_price: number;
  specification: string;
  similarity_score: number;
}>> => {
  const supabase = getSupabase();

  // 仕様に基づいて類似案件を検索
  const { data, error } = await supabase
    .from('estimates')
    .select(`
      id,
      customer_name,
      title,
      total,
      copies,
      unit_price,
      specification
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('findSimilarEstimates error:', error);
    return [];
  }

  // 類似度スコアを計算（簡易版）
  const scored = (data || []).map(est => {
    let score = 0;

    // 数量の近さ
    const qtyDiff = Math.abs((est.copies || 0) - spec.quantity);
    if (qtyDiff < 100) score += 30;
    else if (qtyDiff < 500) score += 20;
    else if (qtyDiff < 1000) score += 10;

    // 仕様の類似性（キーワードマッチ）
    const specText = (est.specification || '').toLowerCase();
    if (specText.includes(spec.size.toLowerCase())) score += 20;
    if (specText.includes(spec.paperType.toLowerCase())) score += 20;
    if (specText.includes(spec.category.toLowerCase())) score += 15;

    return {
      ...est,
      similarity_score: score
    };
  });

  // スコア順にソート
  return scored.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 10);
};

// AI見積もり生成のプロンプトを構築
const buildEstimatePrompt = (
  spec: PrintSpec,
  pastEstimates: Array<{ customer_name: string; title: string; total: number; copies: number; unit_price: number; specification: string }>
): string => {
  const pastDataSummary = pastEstimates.length > 0
    ? pastEstimates.map((est, i) =>
      `${i + 1}. ${est.customer_name} - ${est.title}: ${est.copies}部 × ¥${est.unit_price?.toLocaleString() || 0} = ¥${est.total?.toLocaleString() || 0}`
    ).join('\n')
    : '過去データなし';

  return `あなたは印刷会社の見積もり専門AIです。以下の仕様に基づいて、3つの価格戦略オプションを提案してください。

## 依頼仕様
- 顧客名: ${spec.clientName}
- 案件名: ${spec.projectName}
- カテゴリ: ${spec.category}
- 数量: ${spec.quantity}部
- サイズ: ${spec.size}
- 用紙: ${spec.paperType}
- ページ数: ${spec.pages}ページ
- 色数: ${spec.colors}
- 加工: ${spec.finishing.length > 0 ? spec.finishing.join(', ') : 'なし'}
- 納期: ${spec.requestedDelivery}

## 過去の類似案件データ
${pastDataSummary}

## 出力形式
以下のJSON形式で回答してください。必ず有効なJSONのみを出力し、説明文は含めないでください。

{
  "options": [
    {
      "id": "must_win",
      "label": "必勝価格",
      "pq": 売上金額（数値）,
      "vq": 変動費合計（数値）,
      "mq": 限界利益（数値）,
      "f": 固定費配分（数値）,
      "g": 経常利益（数値）,
      "mRatio": 限界利益率（0-1の小数）,
      "estimatedLeadTime": "納期目安",
      "probability": 成約確率（0-100の数値）,
      "description": "この価格の説明"
    },
    {
      "id": "average",
      "label": "標準価格",
      ...同様の形式
    },
    {
      "id": "profit_max",
      "label": "利益最大化",
      ...同様の形式
    }
  ],
  "aiReasoning": "価格設定の根拠説明（200文字程度）",
  "co2Reduction": CO2削減量の見込み（グラム単位の数値）,
  "comparisonWithPast": {
    "averagePrice": 過去の平均単価（数値）,
    "differencePercentage": 今回との差異（パーセント、数値）
  }
}`;
};

// デフォルトの見積もり結果を生成（動的価格計算を使用）
const generateDefaultEstimate = async (spec: PrintSpec): Promise<EstimationResult> => {
  try {
    // 動的価格計算サービスを使用
    const dynamicResult = await dynamicPricingService.calculateDynamicPricing(spec);
    return dynamicResult;
  } catch (error) {
    console.warn('動的価格計算失敗、フォールバック使用:', error);
    
    // フォールバック: 従来の計算式
    const basePrice = spec.quantity * 50; // 基本単価50円/部
    const paperCost = spec.pages * spec.quantity * 2; // 用紙コスト
    const printCost = spec.pages * spec.quantity * (spec.colors === '4/4' ? 8 : spec.colors === '4/0' ? 5 : 3);
    const finishingCost = spec.finishing.length * spec.quantity * 10;

    const totalVQ = paperCost + printCost + finishingCost;
    const fixedCost = 5000; // 固定費

    const options: StrategyOption[] = [
      {
        id: 'must_win',
        label: '必勝価格',
        pq: Math.round(totalVQ * 1.15),
        vq: totalVQ,
        mq: Math.round(totalVQ * 0.15),
        f: fixedCost,
        g: Math.round(totalVQ * 0.15 - fixedCost),
        mRatio: 0.13,
        estimatedLeadTime: '7営業日',
        probability: 85,
        description: '競合に勝つための最低限の利益を確保した価格'
      },
      {
        id: 'average',
        label: '標準価格',
        pq: Math.round(totalVQ * 1.35),
        vq: totalVQ,
        mq: Math.round(totalVQ * 0.35),
        f: fixedCost,
        g: Math.round(totalVQ * 0.35 - fixedCost),
        mRatio: 0.26,
        estimatedLeadTime: '5営業日',
        probability: 65,
        description: '業界標準の利益率を確保した価格'
      },
      {
        id: 'profit_max',
        label: '利益最大化',
        pq: Math.round(totalVQ * 1.55),
        vq: totalVQ,
        mq: Math.round(totalVQ * 0.55),
        f: fixedCost,
        g: Math.round(totalVQ * 0.55 - fixedCost),
        mRatio: 0.35,
        estimatedLeadTime: '3営業日',
        probability: 40,
        description: '高付加価値サービスを含む最大利益価格'
      }
    ];

    return {
      options,
      aiReasoning: `${spec.category}の${spec.quantity}部印刷について、用紙(${spec.paperType})、色数(${spec.colors})、ページ数(${spec.pages}P)を考慮して算出しました。`,
      co2Reduction: Math.round(spec.quantity * spec.pages * 0.5),
      comparisonWithPast: {
        averagePrice: Math.round(totalVQ * 1.3 / spec.quantity),
        differencePercentage: 0
      }
    };
  }
};

// AI見積もりを生成
export const generateAiEstimate = async (params: {
  spec: PrintSpec;
  customerId?: string;
  categoryId?: string;
}): Promise<EstimationResult> => {
  const { spec, customerId } = params;

  // 過去の類似案件を取得
  const similarEstimates = await findSimilarEstimates(spec);

  // AIが無効の場合は動的価格計算を使用
  if (isGeminiAIDisabled) {
    console.log('[AI Estimate] AI is disabled, using dynamic pricing calculation');
    return await generateDefaultEstimate(spec);
  }

  try {
    const client = requireGeminiClient();
    const prompt = buildEstimatePrompt(spec, similarEstimates);

    // シンプルなテキスト生成（response_mime_typeを使用しない）
    const response = await client.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text || '';

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[AI Estimate] Failed to extract JSON from response, using dynamic pricing');
      return await generateDefaultEstimate(spec);
    }

    const parsed = JSON.parse(jsonMatch[0]) as EstimationResult;

    // バリデーション
    if (!parsed.options || parsed.options.length < 3) {
      console.warn('[AI Estimate] Invalid response structure, using dynamic pricing');
      return await generateDefaultEstimate(spec);
    }

    return parsed;
  } catch (error) {
    console.error('[AI Estimate] Generation failed:', error);
    return await generateDefaultEstimate(spec);
  }
};

// 見積もりをデータベースに保存
export const saveAiEstimate = async (params: {
  spec: PrintSpec;
  result: EstimationResult;
  selectedOptionId: 'must_win' | 'average' | 'profit_max';
  customerId?: string;
  createdBy?: string;
}): Promise<string> => {
  const { spec, result, selectedOptionId, customerId, createdBy } = params;
  const selectedOption = result.options.find(o => o.id === selectedOptionId);

  if (!selectedOption) {
    throw new Error('Invalid option selected');
  }

  const supabase = getSupabase();

  const estimateData = {
    customer_id: customerId || null,
    customer_name: spec.clientName,
    title: spec.projectName,
    specification: `${spec.category} / ${spec.size} / ${spec.paperType} / ${spec.pages}P / ${spec.colors}`,
    copies: spec.quantity,
    unit_price: Math.round(selectedOption.pq / spec.quantity),
    subtotal: selectedOption.pq,
    tax_rate: 10,
    tax_amount: Math.round(selectedOption.pq * 0.1),
    total: Math.round(selectedOption.pq * 1.1),
    status: 'draft',
    delivery_date: spec.requestedDelivery,
    note: `AI生成見積もり (${selectedOption.label})\n${result.aiReasoning}`,
    created_by: createdBy || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('estimates')
    .insert(estimateData)
    .select('id')
    .single();

  if (error) {
    console.error('saveAiEstimate error:', error);
    throw new Error('見積もりの保存に失敗しました');
  }

  return data.id;
};
