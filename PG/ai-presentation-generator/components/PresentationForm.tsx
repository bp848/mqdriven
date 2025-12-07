
import React, { useState } from 'react';
import { FormData } from '../types';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Toggle } from './ui/Toggle';
import { Button } from './ui/Button';
import { WandIcon } from './icons/WandIcon';

interface PresentationFormProps {
  onSubmit: (formData: FormData) => void;
}

const PresentationForm: React.FC<PresentationFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    purpose: '法人向け「無料サステナビリティレポート作成支援サービス」の導入提案',
    referenceInfo: '参考URL: https://report.b-p.co.jp\n\n企業が対応を迫られているESG・SDGs・非財務情報の開示義務に対し、専門知識がなくても即座に対応可能なレポート自動生成支援ソリューションを提案し、貴社のサステナビリティ戦略強化とレピュテーション向上に資することを目的としています。\n\n補足構成として含めるべきキーワード:\n- ESG対応の重要性\n- 非財務情報開示(TCFD・GRI)\n- 中小企業向けの低負荷対応\n- 自動生成されたPDFレポートの品質と訴求力\n- ガイドライン準拠 (GRIスタンダード、環境省フォーマット等)',
    targetIndustry: '中小企業',
    customerName: '',
    salesRepName: '',
    pageCount: 10,
    graphCount: 3,
    imageCount: 2,
    deepResearch: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setFormData(prev => ({ ...prev, [name]: isNumber ? Number(value) : value }));
  };

  const handleToggleChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, deepResearch: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full bg-slate-800/50 border border-slate-700/50 p-6 sm:p-8 rounded-xl shadow-2xl space-y-8">
      <div className="text-center border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-semibold text-slate-100">提案内容の入力</h2>
        <p className="text-slate-400 mt-1">AIにプレゼンテーションの目的と要件を伝えてください。</p>
      </div>

      <Input
        label="目的(例:営業資料,背景說明,提案)"
        name="purpose"
        value={formData.purpose}
        onChange={handleChange}
        required
      />

      <Textarea
        label="参考情報 (URL, 議事録、資料の要約など)"
        name="referenceInfo"
        value={formData.referenceInfo}
        onChange={handleChange}
        rows={8}
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input
          label="対象業種(任意)"
          name="targetIndustry"
          value={formData.targetIndustry}
          onChange={handleChange}
        />
        <Input
          label="顧客名(任意)"
          name="customerName"
          value={formData.customerName}
          onChange={handleChange}
          placeholder="例:(株)Example"
        />
        <Input
          label="営業担当者名(任意)"
          name="salesRepName"
          value={formData.salesRepName}
          onChange={handleChange}
          placeholder="例:山田 太郎"
        />
        <Input
          label="ページ数"
          name="pageCount"
          type="number"
          value={formData.pageCount.toString()}
          onChange={handleChange}
          min="3"
          max="50"
        />
        <Input
          label="グラフ数"
          name="graphCount"
          type="number"
          value={formData.graphCount.toString()}
          onChange={handleChange}
          min="0"
          max="10"
        />
        <Input
          label="写真・図版数"
          name="imageCount"
          type="number"
          value={formData.imageCount.toString()}
          onChange={handleChange}
          min="0"
          max="10"
        />
      </div>

      <div className="bg-slate-900/50 p-4 rounded-lg flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">Deep Research</h3>
          <p className="text-sm text-slate-400">Google検索で最新情報を反映し、出典を明記します。</p>
        </div>
        <Toggle
          checked={formData.deepResearch}
          onChange={handleToggleChange}
        />
      </div>

      <Button type="submit" className="w-full">
        <WandIcon className="w-5 h-5 mr-2" />
        プレゼンテーションを生成
      </Button>
    </form>
  );
};

export default PresentationForm;
