import { SaleRecord } from '../types';
import { GoogleGenAI } from '@google/genai';
import { requireGeminiClient } from './Gemini';

export interface SupabaseConfig {
  url: string;
  key: string;
  tableName: string;
}

export const fetchSupabaseData = async (config: SupabaseConfig): Promise<SaleRecord[]> => {
  const { url, key, tableName } = config;
  
  const baseUrl = url.replace(/\/$/, "");
  // orders_v2 のような公開テーブルからデータを取得
  const endpoint = `${baseUrl}/rest/v1/${tableName}?select=*`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase Error: ${response.status} - ${errorBody}`);
  }

  const rawData = await response.json();

  return rawData.map((row: any, i: number) => {
    // orders_v2 のスキーマ（total_amount, order_code等）と既存の SaleRecord 型をマッピング
    const pq = Number(row.total_amount || row.finalPQ || row.pq || row.sales || 0);
    const vq = Number(row.finalVQ || row.vq || row.cost || 0);
    const material = Number(row.materialCost || row.material || 0);
    const outsourcing = Number(row.outsourcingCost || row.outsourcing || 0);
    
    // 日付の処理
    const rawDate = row.created_at || row.deadline || new Date().toISOString();
    const formattedDate = new Date(rawDate).toLocaleDateString('ja-JP');

    return {
      id: row.id?.toString() || `sb-${Date.now()}-${i}`,
      // 顧客名が不明な場合は tenant_id や user_id をヒントにするか、固定値
      customerName: row.customer_name || row.customerName || row.customer || (row.tenant_id ? `Client (${row.tenant_id.slice(0,8)})` : "外部クライアント"),
      // 商品名として order_code を使用
      productName: row.productName || row.product || row.order_code || "不明な注文",
      salesRep: row.salesRep || row.staff || "システム",
      estPQ: pq,
      estVQ: vq,
      estMQ: pq - vq,
      finalPQ: pq,
      finalVQ: vq,
      finalMQ: pq - vq,
      materialCost: material,
      outsourcingCost: outsourcing,
      deadline: formattedDate,
      lastUpdated: new Date().toLocaleDateString('ja-JP'),
      status: row.status || "連携済み",
      industry: row.industry || row.category || "未分類"
    };
  });
};

export const analyzeDataWithGemini = async (data: SaleRecord[], userQuery: string, fixedCost?: number) => {
  const ai = requireGeminiClient();
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
    あなたは「西順一郎氏のMQ会計（STRAC）」を完璧にマスターした経営戦略顧問です。
    全ての分析は MQ = F + G という公式に基づいて行ってください。

    【MQ会計のアドバイス原則】
    1. 「単価P」のアップ: 安易な値引きを戒め、単価を上げることによるMQ増大効果を最優先に検討してください。
    2. 「数量Q」のアップ: Pを維持したまま数量を増やす戦略。
    3. 「変動費V」のダウン: Vを削ることによる利益感度を計算してください。
    4. 「固定費F」の最適化: Fは削るだけでなく「未来のMQを生むための投資」として捉え、BEP（損益分岐点）比率 80%以下を目指す助言をしてください。
    5. 感度分析: Pを1%上げた時と、Qを1%増やした時の利益増額の差を指摘してください。

    専門用語（PQ, VQ, MQ, F, G）を使いこなしつつ、具体的で情熱的な日本語で回答してください。
  `;

  const totalSales = data.reduce((s, i) => s + i.finalPQ, 0);
  const totalMQ = data.reduce((s, i) => s + i.finalMQ, 0);
  const mRatio = totalSales > 0 ? (totalMQ / totalSales) : 0;

  const prompt = `
    【現在のSTRAC指標】
    売上高(PQ): ${totalSales}円
    変動費(VQ): ${data.reduce((s, i) => s + i.finalVQ, 0)}円
    限界利益(MQ): ${totalMQ}円
    限界利益率: ${(mRatio * 100).toFixed(1)}%
    固定費(F): ${fixedCost || 0}円
    経常利益(G): ${totalMQ - (fixedCost || 0)}円
    損益分岐点売上: ${Math.round((fixedCost || 0) / (mRatio || 1))}円
    
    【質問】
    ${userQuery}
    
    【データ内訳】
    ${JSON.stringify(data.slice(0, 10).map(d => ({ 
      顧客: d.customerName, 
      PQ: d.finalPQ, 
      VQ: d.finalVQ, 
      MQ: d.finalMQ, 
      率: ((d.finalMQ/d.finalPQ)*100).toFixed(1)+'%' 
    })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction, temperature: 0.7 },
    });
    return response.text;
  } catch (error) {
    return "MQ会計エンジンが一時的に停止しています。Fの設定等を確認してください。";
  }
};
