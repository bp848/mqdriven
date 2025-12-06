import React from 'react';
import { ProposalFormData } from '../../types';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Toggle } from './ui/Toggle';
import { Button } from './ui/Button';
import { WandIcon } from './icons/WandIcon';

interface ProposalFormProps {
  formData: ProposalFormData;
  onChange: (updater: (prev: ProposalFormData) => ProposalFormData) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isAIOff: boolean;
}

const ProposalForm: React.FC<ProposalFormProps> = ({
  formData,
  onChange,
  onSubmit,
  isSubmitting,
  isAIOff,
}) => {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    onChange(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleToggleChange = (checked: boolean) => {
    onChange(prev => ({
      ...prev,
      deepResearch: checked,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isAIOff) return;
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800/80 border border-slate-700/70 p-6 rounded-2xl shadow-2xl space-y-8 text-white"
    >
      <div className="text-center border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-semibold text-white">提案内容の入力</h2>
        <p className="text-slate-300 mt-1">AIにプレゼンテーションの目的と要件を伝えてください。</p>
      </div>

      <Input
        label="目的 (例: 背景説明・提案内容)"
        name="purpose"
        value={formData.purpose}
        onChange={handleInputChange}
        required
        disabled={isSubmitting}
      />

      <Textarea
        label="参考情報 (URL, 議事録、資料の要約など)"
        name="referenceInfo"
        value={formData.referenceInfo}
        onChange={handleInputChange}
        rows={8}
        required
        disabled={isSubmitting}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input
          label="対象業種 (任意)"
          name="targetIndustry"
          value={formData.targetIndustry}
          onChange={handleInputChange}
          disabled={isSubmitting}
        />
        <Input
          label="顧客名 (任意)"
          name="customerName"
          value={formData.customerName}
          onChange={handleInputChange}
          placeholder="例:(株)Example"
          disabled={isSubmitting}
        />
        <Input
          label="営業担当者名 (任意)"
          name="salesRepName"
          value={formData.salesRepName}
          onChange={handleInputChange}
          placeholder="例:山田 太郎"
          disabled={isSubmitting}
        />
        <Input
          label="ページ数"
          name="pageCount"
          type="number"
          value={String(formData.pageCount)}
          onChange={handleInputChange}
          min="3"
          max="50"
          disabled={isSubmitting}
        />
        <Input
          label="グラフ数"
          name="graphCount"
          type="number"
          value={String(formData.graphCount)}
          onChange={handleInputChange}
          min="0"
          max="10"
          disabled={isSubmitting}
        />
        <Input
          label="写真・図版数"
          name="imageCount"
          type="number"
          value={String(formData.imageCount)}
          onChange={handleInputChange}
          min="0"
          max="10"
          disabled={isSubmitting}
        />
      </div>

      <div className="bg-slate-900/60 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Deep Research</h3>
          <p className="text-sm text-slate-300">Google検索で最新情報を反映し、出典を明記します。</p>
        </div>
        <Toggle checked={formData.deepResearch} onChange={handleToggleChange} disabled={isSubmitting} />
      </div>

      <div className="space-y-3">
        <Button type="submit" className="w-full" disabled={isSubmitting || isAIOff}>
          <WandIcon className="w-5 h-5 mr-2" />
          {isSubmitting ? '生成中...' : 'プレゼンテーションを生成'}
        </Button>
        {isAIOff && <p className="text-center text-sm text-red-300">AI機能が無効のため、生成は行えません。</p>}
      </div>
    </form>
  );
};

export default ProposalForm;
