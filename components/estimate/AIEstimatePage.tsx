import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
export interface QuoteFormData {
  title: string;
  pages: number;
  size: string;
  coverPaper: string;
  innerPaper: string;
  color: string;
  binding: string;
  quantity: number;
  specialProcessing: string;
  markup: number;
}

export interface CostBreakdownItem {
  item: string;
  cost: number;
}

export interface QuoteResultData {
  suggestedRetailPrice: number;
  internalTotalCost: number;
  profitMargin: number;
  costBreakdown: CostBreakdownItem[];
  internalNotes: string;
  estimatedProductionDays: number;
}

// --- Constants ---
const BOOK_SIZES = ['A5', 'B5', '四六判', '文庫', '新書', 'カスタム'];
const PAPER_TYPES = [
    'コート 90kg', 
    'コート 110kg', 
    'コート 135kg', 
    'マットコート 90kg', 
    'マットコート 110kg', 
    'マットコート 135kg',
    '上質 90kg',
    '上質 110kg',
    '上質 135kg'
];

const BINDING_TYPES = [
    '無線綴じ',
    '中綴じ',
    '平綴じ',
    '糸綴じ',
    'あじろ綴じ',
    'リング綴じ'
];

const COLOR_TYPES = ['フルカラー', 'モノクロ', '2色', '4+1色', '特別色'];

// --- Component ---
const AIEstimatePage: React.FC = () => {
    const [formData, setFormData] = useState<QuoteFormData>({
        title: '',
        pages: 0,
        size: 'A5',
        coverPaper: 'コート 135kg',
        innerPaper: 'コート 90kg',
        color: 'フルカラー',
        binding: '無線綴じ',
        quantity: 100,
        specialProcessing: '',
        markup: 1.5
    });

    const [result, setResult] = useState<QuoteResultData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInputChange = useCallback((field: keyof QuoteFormData, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const generateEstimate = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || '';
            if (!apiKey) {
                throw new Error('APIキーが設定されていません');
            }

            const ai = new GoogleGenAI({ apiKey });
            
            const prompt = `以下の仕様書から印刷コストを詳細に見積もってください：

タイトル: ${formData.title}
ページ数: ${formData.pages}
サイズ: ${formData.size}
表紙: ${formData.coverPaper}
本文: ${formData.innerPaper}
印刷: ${formData.color}
製本: ${formData.binding}
部数: ${formData.quantity}
特殊加工: ${formData.specialProcessing || 'なし'}

以下のJSON形式で回答してください：
{
  "suggestedRetailPrice": 数値,
  "internalTotalCost": 数値,
  "profitMargin": 数値,
  "costBreakdown": [
    {"item": "項目名", "cost": 数値}
  ],
  "internalNotes": "内部メモ",
  "estimatedProductionDays": 数値
}`;

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            suggestedRetailPrice: { type: Type.NUMBER },
                            internalTotalCost: { type: Type.NUMBER },
                            profitMargin: { type: Type.NUMBER },
                            costBreakdown: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        item: { type: Type.STRING },
                                        cost: { type: Type.NUMBER }
                                    },
                                    required: ["item", "cost"]
                                }
                            },
                            internalNotes: { type: Type.STRING },
                            estimatedProductionDays: { type: Type.NUMBER }
                        },
                        required: ["suggestedRetailPrice", "internalTotalCost", "profitMargin", "costBreakdown", "internalNotes", "estimatedProductionDays"]
                    }
                }
            });

            const text = response.text;
            if (!text) {
                throw new Error('AIからの応答がありません');
            }

            const estimateData: QuoteResultData = JSON.parse(text);
            setResult(estimateData);
            
        } catch (err) {
            console.error('見積もり生成エラー:', err);
            setError(err instanceof Error ? err.message : '見積もり生成に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [formData]);

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-6">AI見積もり生成</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium mb-2">タイトル</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        className="w-full p-2 border rounded"
                        placeholder="例：会社案内パンフレット"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">ページ数</label>
                    <input
                        type="number"
                        value={formData.pages}
                        onChange={(e) => handleInputChange('pages', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded"
                        min="1"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">サイズ</label>
                    <select
                        value={formData.size}
                        onChange={(e) => handleInputChange('size', e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        {BOOK_SIZES.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">部数</label>
                    <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded"
                        min="1"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">表紙用紙</label>
                    <select
                        value={formData.coverPaper}
                        onChange={(e) => handleInputChange('coverPaper', e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        {PAPER_TYPES.map(paper => (
                            <option key={paper} value={paper}>{paper}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">本文用紙</label>
                    <select
                        value={formData.innerPaper}
                        onChange={(e) => handleInputChange('innerPaper', e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        {PAPER_TYPES.map(paper => (
                            <option key={paper} value={paper}>{paper}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">印刷色</label>
                    <select
                        value={formData.color}
                        onChange={(e) => handleInputChange('color', e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        {COLOR_TYPES.map(color => (
                            <option key={color} value={color}>{color}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">製本方法</label>
                    <select
                        value={formData.binding}
                        onChange={(e) => handleInputChange('binding', e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        {BINDING_TYPES.map(binding => (
                            <option key={binding} value={binding}>{binding}</option>
                        ))}
                    </select>
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">特殊加工</label>
                    <input
                        type="text"
                        value={formData.specialProcessing}
                        onChange={(e) => handleInputChange('specialProcessing', e.target.value)}
                        className="w-full p-2 border rounded"
                        placeholder="例：箔押し、エンボス、UVコーティングなど"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">利益率 (%)</label>
                    <input
                        type="number"
                        value={(formData.markup - 1) * 100}
                        onChange={(e) => handleInputChange('markup', 1 + (parseFloat(e.target.value) || 0) / 100)}
                        className="w-full p-2 border rounded"
                        step="0.1"
                        min="0"
                    />
                </div>
            </div>
            
            <button
                onClick={generateEstimate}
                disabled={loading || !formData.title || formData.pages <= 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-400"
            >
                {loading ? '生成中...' : '見積もりを生成'}
            </button>
            
            {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}
            
            {result && (
                <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">見積もり結果</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded border">
                            <div className="text-sm text-gray-600">販売価格</div>
                            <div className="text-2xl font-bold text-blue-600">
                                ¥{result.suggestedRetailPrice.toLocaleString()}
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded border">
                            <div className="text-sm text-gray-600">内部コスト</div>
                            <div className="text-2xl font-bold text-gray-600">
                                ¥{result.internalTotalCost.toLocaleString()}
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded border">
                            <div className="text-sm text-gray-600">利益率</div>
                            <div className="text-2xl font-bold text-green-600">
                                {(result.profitMargin * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <h3 className="font-bold mb-3">コスト内訳</h3>
                        <div className="bg-white rounded border">
                            {result.costBreakdown.map((item, index) => (
                                <div key={index} className="flex justify-between p-3 border-b last:border-b-0">
                                    <span>{item.item}</span>
                                    <span className="font-medium">¥{item.cost.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-bold mb-2">内部メモ</h3>
                            <div className="bg-white p-3 rounded border text-sm">
                                {result.internalNotes}
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="font-bold mb-2">納期</h3>
                            <div className="bg-white p-3 rounded border text-sm">
                                約 {result.estimatedProductionDays} 日
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIEstimatePage;
