// components/estimate/AIEstimateGenerator.tsx
import React, { useState } from 'react';
import { Loader, FileText, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { generateLeadProposalPackage } from '../../services/geminiService';
import { saveEstimateToManagement } from '../../services/estimateManagementService';
import { Lead, Estimate } from '../../types';

interface AIEstimateGeneratorProps {
  lead: Lead;
  onEstimateGenerated?: (estimate: Estimate) => void;
  onError?: (error: string) => void;
}

export const AIEstimateGenerator: React.FC<AIEstimateGeneratorProps> = ({
  lead,
  onEstimateGenerated,
  onError
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEstimate, setGeneratedEstimate] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateEstimate = async () => {
    if (!lead.message?.trim()) {
      setError('問い合わせ内容が必要です');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // AIで見積もりを生成
      const proposalPackage = await generateLeadProposalPackage(lead);
      
      if (!proposalPackage.estimate || proposalPackage.estimate.length === 0) {
        throw new Error('見積データの生成に失敗しました');
      }

      // 見積もり管理に保存
      const totalAmount = proposalPackage.estimate.reduce((sum, item) => 
        sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
      );

      const estimateData = {
        title: proposalPackage.proposal?.coverTitle || `【見積】${lead.company}`,
        items: proposalPackage.estimate.map(item => ({
          name: item.content || item.name || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          unit: item.unit || '個',
          unitPrice: item.unitPrice || 0,
          subtotal: Math.round((item.quantity || 1) * (item.unitPrice || 0))
        })),
        subtotal: totalAmount,
        taxRate: 0.10,
        taxAmount: Math.round(totalAmount * 0.10),
        totalAmount: Math.round(totalAmount * 1.10),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `AIによる自動生成見積です。\n\n${proposalPackage.proposal?.summary || ''}`,
      };

      const savedEstimate = await saveEstimateToManagement({
        leadId: lead.id,
        estimateData,
        customerInfo: {
          name: lead.company,
          email: lead.email || '',
          phone: lead.phone || '',
          address: lead.address || '',
        }
      });

      setGeneratedEstimate(savedEstimate);
      onEstimateGenerated?.(savedEstimate);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '見積の生成に失敗しました';
      setError(errorMessage);
      onError?.(errorMessage);
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

      {/* ファイルアップロード */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          仕様書・資料のアップロード（任意）
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
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center"
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <div>
              <p className="text-sm text-gray-600">
                クリックしてファイルをアップロード
              </p>
              <p className="text-xs text-gray-500">
                PDF, Word, Excel, 画像 (最大10MB)
              </p>
            </div>
          </label>
        </div>

        {/* アップロードされたファイル一覧 */}
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
                  className="text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 問い合わせ内容 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          問い合わせ内容
        </label>
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
          {lead.message || '問い合わせ内容がありません'}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <button
        onClick={generateEstimate}
        disabled={isGenerating}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isGenerating ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            AI見積もりを生成中...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            AI見積もりを生成
          </>
        )}
      </button>

      {/* 生成結果 */}
      {generatedEstimate && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-semibold text-green-800">見積もりが生成されました</h4>
          </div>
          <div className="text-sm text-green-700">
            <p>見積番号: {generatedEstimate.documentNumber}</p>
            <p>合計金額: ¥{generatedEstimate.totalAmount?.toLocaleString()}</p>
            <p>見積管理一覧に保存されました</p>
          </div>
        </div>
      )}
    </div>
  );
};
