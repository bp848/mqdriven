/**
 * Dynamic Pricing Service - 過去実績に基づく動的価格計算サービス
 * 
 * 過去の見積もりデータと市場価格を分析して、より正確な価格計算を提供します。
 */

import { getSupabase } from './supabaseClient';
import { PrintSpec, EstimationResult, StrategyOption } from '../types';

export interface HistoricalPricingData {
  customerId?: string;
  category: string;
  size: string;
  paperType: string;
  colors: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  profitMargin: number;
  createdAt: string;
}

export interface MarketPriceAnalysis {
  averageUnitPrice: number;
  medianUnitPrice: number;
  priceRange: { min: number; max: number };
  marketTrend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  sampleSize: number;
}

export interface DynamicPricingParams {
  spec: PrintSpec;
  historicalData: HistoricalPricingData[];
  marketAnalysis: MarketPriceAnalysis;
  targetProfitMargin: number;
  competitiveFactor: number; // 0.8-1.2 競争力の度合い
}

class DynamicPricingService {
  private readonly PRICING_FACTORS = {
    QUANTITY_ECONOMY: {
      thresholds: [100, 500, 1000, 5000, 10000],
      multipliers: [2.0, 1.5, 1.2, 1.0, 0.9, 0.8]
    },
    PAPER_QUALITY: {
      'コート135kg': 1.0,
      'マットコート135kg': 1.1,
      '上質紙135kg': 0.9,
      'アート紙135kg': 1.2
    },
    COLOR_COMPLEXITY: {
      '4/4': 1.0,
      '4/0': 0.8,
      '1/1': 0.6,
      'フルカラー': 1.0,
      'モノクロ': 0.5
    },
    SIZE_COMPLEXITY: {
      'A4': 1.0,
      'A3': 1.8,
      'A5': 0.6,
      'B4': 1.6,
      'B5': 0.7
    }
  };

  /**
   * 過去の価格データを取得
   */
  async fetchHistoricalPricingData(spec: PrintSpec): Promise<HistoricalPricingData[]> {
    const supabase = getSupabase();
    
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          customer_id,
          specification,
          copies,
          unit_price,
          total,
          subtotal,
          created_at
        `)
        .like('specification', `%${spec.category}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(row => {
        // 仕様文字列から詳細を解析（簡易版）
        const specParts = (row.specification || '').split(' / ');
        
        return {
          customerId: row.customer_id || undefined,
          category: specParts[0] || spec.category,
          size: specParts[1] || spec.size,
          paperType: specParts[2] || spec.paperType,
          colors: specParts[3] || spec.colors,
          quantity: row.copies || spec.quantity,
          unitPrice: row.unit_price || 0,
          totalPrice: row.total || 0,
          profitMargin: row.subtotal ? (row.total - row.subtotal) / row.total : 0.3,
          createdAt: row.created_at || new Date().toISOString()
        };
      });
    } catch (error) {
      console.error('過去価格データ取得エラー:', error);
      return [];
    }
  }

  /**
   * 市場価格を分析
   */
  analyzeMarketPricing(
    historicalData: HistoricalPricingData[],
    targetSpec: PrintSpec
  ): MarketPriceAnalysis {
    // 類似条件のデータをフィルタリング
    const similarData = historicalData.filter(data => {
      const quantityDiff = Math.abs(data.quantity - targetSpec.quantity) / targetSpec.quantity;
      const categoryMatch = data.category === targetSpec.category;
      const sizeMatch = data.size === targetSpec.size;
      
      return categoryMatch && (sizeMatch || quantityDiff < 0.5);
    });

    if (similarData.length === 0) {
      return {
        averageUnitPrice: 0,
        medianUnitPrice: 0,
        priceRange: { min: 0, max: 0 },
        marketTrend: 'stable',
        confidence: 0,
        sampleSize: 0
      };
    }

    const unitPrices = similarData.map(d => d.unitPrice).sort((a, b) => a - b);
    const averageUnitPrice = unitPrices.reduce((sum, price) => sum + price, 0) / unitPrices.length;
    const medianUnitPrice = unitPrices[Math.floor(unitPrices.length / 2)];

    // 価格トレンド分析
    const recentData = similarData.slice(0, 10);
    const olderData = similarData.slice(10, 20);
    
    let marketTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentData.length > 0 && olderData.length > 0) {
      const recentAvg = recentData.reduce((sum, d) => sum + d.unitPrice, 0) / recentData.length;
      const olderAvg = olderData.reduce((sum, d) => sum + d.unitPrice, 0) / olderData.length;
      
      if (recentAvg > olderAvg * 1.05) marketTrend = 'increasing';
      else if (recentAvg < olderAvg * 0.95) marketTrend = 'decreasing';
    }

    return {
      averageUnitPrice,
      medianUnitPrice,
      priceRange: { min: unitPrices[0], max: unitPrices[unitPrices.length - 1] },
      marketTrend,
      confidence: Math.min(similarData.length / 20, 1),
      sampleSize: similarData.length
    };
  }

  /**
   * 基準原価を計算
   */
  calculateBaseCost(spec: PrintSpec): number {
    const { quantity, size, paperType, colors, pages } = spec;
    
    // 基本単価（数量経済性を考慮）
    let baseUnitCost = 100; // 基本単価100円/部
    
    const quantityTier = this.PRICING_FACTORS.QUANTITY_ECONOMY.thresholds.findIndex(
      threshold => quantity <= threshold
    );
    const quantityMultiplier = this.PRICING_FACTORS.QUANTITY_ECONOMY.multipliers[
      Math.max(0, quantityTier)
    ];
    baseUnitCost *= quantityMultiplier;

    // 用紙による調整
    const paperMultiplier = this.PRICING_FACTORS.PAPER_QUALITY[paperType as keyof typeof this.PRICING_FACTORS.PAPER_QUALITY] || 1.0;
    baseUnitCost *= paperMultiplier;

    // 色数による調整
    const colorMultiplier = this.PRICING_FACTORS.COLOR_COMPLEXITY[colors as keyof typeof this.PRICING_FACTORS.COLOR_COMPLEXITY] || 1.0;
    baseUnitCost *= colorMultiplier;

    // サイズによる調整
    const sizeMultiplier = this.PRICING_FACTORS.SIZE_COMPLEXITY[size as keyof typeof this.PRICING_FACTORS.SIZE_COMPLEXITY] || 1.0;
    baseUnitCost *= sizeMultiplier;

    // ページ数による調整
    const pageMultiplier = Math.max(1, pages / 32);
    baseUnitCost *= pageMultiplier;

    return baseUnitCost * quantity;
  }

  /**
   * 動的価格計算を実行
   */
  async calculateDynamicPricing(
    spec: PrintSpec,
    targetProfitMargin: number = 0.35,
    competitiveFactor: number = 1.0
  ): Promise<EstimationResult> {
    // 過去データを取得
    const historicalData = await this.fetchHistoricalPricingData(spec);
    
    // 市場分析
    const marketAnalysis = this.analyzeMarketPricing(historicalData, spec);
    
    // 基準原価を計算
    const baseCost = this.calculateBaseCost(spec);
    
    // 市場価格を考慮した目標単価を設定
    let targetUnitPrice = baseCost / spec.quantity;
    
    if (marketAnalysis.confidence > 0.3) {
      // 信頼性がある場合、市場価格を考慮
      const marketWeight = Math.min(marketAnalysis.confidence, 0.7);
      targetUnitPrice = targetUnitPrice * (1 - marketWeight) + 
                       marketAnalysis.averageUnitPrice * marketWeight;
    }

    // 競争力ファクターを適用
    targetUnitPrice *= competitiveFactor;

    // トレンド調整
    if (marketAnalysis.marketTrend === 'increasing') {
      targetUnitPrice *= 1.02;
    } else if (marketAnalysis.marketTrend === 'decreasing') {
      targetUnitPrice *= 0.98;
    }

    const targetTotalPrice = targetUnitPrice * spec.quantity;
    const targetProfit = targetTotalPrice - baseCost;
    const actualProfitMargin = targetProfit / targetTotalPrice;

    // 3つの戦略オプションを生成
    const options: StrategyOption[] = [
      {
        id: 'must_win',
        label: '必勝価格',
        pq: Math.round(baseCost * 1.15),
        vq: baseCost,
        mq: Math.round(baseCost * 0.15),
        f: 5000,
        g: Math.round(baseCost * 0.15 - 5000),
        mRatio: 0.13,
        estimatedLeadTime: '7営業日',
        probability: 85,
        description: '競合に勝つための最低限の利益を確保した価格'
      },
      {
        id: 'average',
        label: '標準価格',
        pq: Math.round(targetTotalPrice),
        vq: baseCost,
        mq: Math.round(targetProfit),
        f: 5000,
        g: Math.round(targetProfit - 5000),
        mRatio: actualProfitMargin,
        estimatedLeadTime: '5営業日',
        probability: 65,
        description: `市場分析に基づく標準価格（信頼度: ${Math.round(marketAnalysis.confidence * 100)}%）`
      },
      {
        id: 'profit_max',
        label: '利益最大化',
        pq: Math.round(targetTotalPrice * 1.2),
        vq: baseCost,
        mq: Math.round(targetProfit * 1.2),
        f: 5000,
        g: Math.round(targetProfit * 1.2 - 5000),
        mRatio: Math.min(actualProfitMargin * 1.2, 0.5),
        estimatedLeadTime: '3営業日',
        probability: 40,
        description: '高付加価値サービスを含む最大利益価格'
      }
    ];

    return {
      options,
      aiReasoning: `${spec.category}の${spec.quantity}部印刷について、過去${marketAnalysis.sampleSize}件のデータを分析。市場平均単価¥${Math.round(marketAnalysis.averageUnitPrice)}を基準に、${marketAnalysis.marketTrend === 'increasing' ? '上昇' : marketAnalysis.marketTrend === 'decreasing' ? '下降' : '安定'}傾向を考慮して算出しました。`,
      co2Reduction: Math.round(spec.quantity * spec.pages * 0.5),
      comparisonWithPast: {
        averagePrice: marketAnalysis.averageUnitPrice,
        differencePercentage: marketAnalysis.averageUnitPrice > 0 ? 
          Math.round(((targetUnitPrice - marketAnalysis.averageUnitPrice) / marketAnalysis.averageUnitPrice) * 100) : 0
      }
    };
  }

  /**
   * 価格感度分析を実行
   */
  async performPriceSensitivityAnalysis(spec: PrintSpec): Promise<{
    optimalPrice: number;
    priceElasticity: number;
    recommendedRange: { min: number; max: number };
  }> {
    const historicalData = await this.fetchHistoricalPricingData(spec);
    const marketAnalysis = this.analyzeMarketPricing(historicalData, spec);
    
    if (marketAnalysis.sampleSize < 5) {
      return {
        optimalPrice: this.calculateBaseCost(spec) / spec.quantity * 1.3,
        priceElasticity: -1.5,
        recommendedRange: { min: 0.8, max: 1.5 }
      };
    }

    // 簡易的な価格弾力性分析
    const priceRange = marketAnalysis.priceRange;
    const optimalPrice = marketAnalysis.medianUnitPrice;
    const elasticity = -1.2; // デフォルト弾力性値

    return {
      optimalPrice,
      priceElasticity: elasticity,
      recommendedRange: {
        min: priceRange.min / optimalPrice,
        max: priceRange.max / optimalPrice
      }
    };
  }
}

// シングルトンインスタンス
const dynamicPricingService = new DynamicPricingService();

export default dynamicPricingService;
