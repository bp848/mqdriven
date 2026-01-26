import React, { useState, useEffect } from 'react';
import { Loader, FileText, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Lead, EstimationResult, PrintSpec } from '../../types';
import {
  fetchAiCustomers,
  fetchAiCategories,
  createAiEstimate,
  AiCustomer,
  AiCategory,
} from '../../services/integrationService';

interface AIEstimateGeneratorProps {
  lead: Lead;
  onEstimateGenerated?: (estimate: EstimationResult) => void;
  onError?: (error: string) => void;
}

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export const AIEstimateGenerator: React.FC<AIEstimateGeneratorProps> = ({
  lead,
  onEstimateGenerated,
  onError,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEstimate, setGeneratedEstimate] = useState<EstimationResult | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<AiCustomer[]>([]);
  const [categories, setCategories] = useState<AiCategory[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(lead.estimated_value ? Number(lead.estimated_value) : 100);

  useEffect(() => {
    let active = true;
    setIsMetadataLoading(true);
    setMetadataError(null);
    Promise.all([fetchAiCustomers(), fetchAiCategories()])
      .then(([customerRows, categoryRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setCategories(categoryRows);
        setSelectedCustomerId(customerRows[0]?.id || null);
        setSelectedCategoryId(categoryRows[0]?.id || null);
      })
      .catch((loadError) => {
        if (!active) return;
        setMetadataError(
          loadError instanceof Error
            ? loadError.message
            : '顧客・カテゴリマスタの取得に失敗しました。'
        );
      })
      .finally(() => {
        if (active) setIsMetadataLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCustomer =
    customers.find((c) => c.id === selectedCustomerId) ||
    customers.find((c) => lead.company && c.name.includes(lead.company || '')) ||
    customers[0];
  const selectedCategory =
    categories.find((cat) => cat.id === selectedCategoryId) || categories[0];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (value: number) => {
    setQuantity(Math.max(1, value));
  };

  const buildSpec = (): PrintSpec => ({
    clientName: selectedCustomer?.name || lead.company || '顧客名未設定',
    projectName: lead.message?.slice(0, 70) || 'AI見積',
    category: selectedCategory?.name || '商業印刷（チラシ・パンフレット・ポスター）',
    quantity,
    size: 'A4',
    paperType: 'コート135kg',
    pages: 32,
    colors: '4/4',
    finishing: [],
    requestedDelivery: '30日以内',
  });

  const generateEstimate = async () => {
    if (!lead.message?.trim()) {
      const message = '蝠上＞蜷医ｏ縺帛・螳ｹ縺悟ｿ・ｦ√〒縺・';
      setError(message);
      onError?.(message);
      return;
    }

    if (!selectedCustomer?.id) {
      const message = '顧客マスタが登録されていません。';
      setError(message);
      onError?.(message);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const spec = buildSpec();
      const estimateResult = await createAiEstimate({
        spec,
        customerId: selectedCustomer.id,
        categoryId: selectedCategory?.id || '',
      });
      setGeneratedEstimate(estimateResult);
      onEstimateGenerated?.(estimateResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'AI見積生成中に予期せぬエラーが発生しました。';
      setError(message);
      onError?.(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <FileText className="w-5 h-5 mr-2 text-blue-600" />
        <h3 className="text-lg font-semibold">AI見積もり自動生成</h3>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          過去資料・指示書添付 (任意)
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <div>
              <p className="text-sm text-gray-600">仕様書や過去見積などを添付します。</p>
              <p className="text-xs text-gray-500">PDF, Word, Excel, 画像 (10MBまで)</p>
            </div>
          </label>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 p-2 rounded"
              >
                <span className="text-sm text-gray-700">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {metadataError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          {metadataError}
        </div>
      )}

      {isMetadataLoading ? (
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader className="w-4 h-4 animate-spin" />
          顧客・カテゴリマスタを読み込み中…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">対象顧客</label>
            <select
              value={selectedCustomerId || ''}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">印刷カテゴリ</label>
            <select
              value={selectedCategoryId || ''}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">数量 / 部数</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => handleQuantityChange(Number(event.target.value))}
              className="w-full border border-gray-300 rounded p-2 text-sm"
            />
          </div>
        </>
      )}

      {(error || (!isMetadataLoading && !selectedCustomer)) && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          {error || '顧客情報が準備できていません。'}
        </div>
      )}

      <button
        onClick={generateEstimate}
        disabled={isGenerating || isMetadataLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isGenerating ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            AI見積を生成中…
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            AI見積を生成
          </>
        )}
      </button>

      {generatedEstimate && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 space-y-3 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-semibold">AI見積が生成されました</span>
          </div>
          <p className="text-xs text-slate-600">{generatedEstimate.aiReasoning}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {generatedEstimate.options.map((option) => (
              <div key={option.id} className="bg-white border border-green-100 rounded p-3 text-xs space-y-1">
                <div className="font-semibold text-green-600">{option.label}</div>
                <div>御見積総額: {formatCurrency(option.pq)}</div>
                <div>限界利益: {formatCurrency(option.mq)}</div>
                <div>成約率: {option.probability}%</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600">
            <div>CO2削減効果見込み: {generatedEstimate.co2Reduction.toLocaleString()}g</div>
            <div>
              過去平均: {formatCurrency(generatedEstimate.comparisonWithPast.averagePrice)} (
              {generatedEstimate.comparisonWithPast.differencePercentage}%)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
