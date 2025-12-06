import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Customer,
  Job,
  Estimate,
  EmployeeUser,
  Toast,
  ProposalFormData,
} from '../types';
import ProposalHeader from './businessSupport/ProposalHeader';
import ProposalForm from './businessSupport/ProposalForm';
import ProposalPreview from './businessSupport/ProposalPreview';
import ProposalActionConsole from './businessSupport/ProposalActionConsole';
import { Spinner } from './businessSupport/ui/Spinner';
import { Button } from './businessSupport/ui/Button';
import useProposalGenerator from '../hooks/useProposalGenerator';
import { formatJPY } from '../utils';
import { AlertTriangle } from './Icons';

interface BusinessSupportPageProps {
  customers: Customer[];
  jobs: Job[];
  estimates: Estimate[];
  currentUser: EmployeeUser | null;
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

const DEFAULT_FORM_DATA: ProposalFormData = {
  purpose: '法人向け「無料サステナビリティレポート作成支援サービス」の導入提案',
  referenceInfo:
    '参考URL: https://report.b-p.co.jp\n\n企業が対応を迫られているESG・SDGs・非財務情報の開示義務に対し、専門知識がなくても即座に対応可能なレポート自動生成支援ソリューションを提案し、貴社のサステナビリティ戦略強化とレピュテーション向上に資することを目的としています。\n\n補足構成として含めるべきキーワード:\n- ESG対応の重要性\n- 非財務情報開示(TCFD・GRI)\n- 中小企業向けの低負荷対応\n- 自動生成されたPDFレポートの品質と訴求力\n- ガイドライン準拠 (GRIスタンダード、環境省フォーマット等)',
  targetIndustry: '中小企業',
  customerName: '',
  salesRepName: '',
  pageCount: 10,
  graphCount: 3,
  imageCount: 2,
  deepResearch: false,
};

const BusinessSupportPage: React.FC<BusinessSupportPageProps> = ({
  customers,
  jobs,
  estimates,
  currentUser,
  addToast,
  isAIOff,
}) => {
  const [formData, setFormData] = useState<ProposalFormData>(DEFAULT_FORM_DATA);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedEstimateId, setSelectedEstimateId] = useState('');

  const { state, generate, reset } = useProposalGenerator();
  const { status, presentation, sources, error, actions } = state;

  const selectedCustomer = useMemo(
    () => customers.find(customer => customer.id === selectedCustomerId),
    [customers, selectedCustomerId],
  );
  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId), [jobs, selectedJobId]);
  const selectedEstimate = useMemo(
    () => estimates.find(estimate => estimate.id === selectedEstimateId),
    [estimates, selectedEstimateId],
  );

  const relatedJobs = useMemo(() => {
    if (!selectedCustomer) return [];
    return jobs.filter(
      job => job.customerId === selectedCustomer.id || job.clientName === selectedCustomer.customerName,
    );
  }, [jobs, selectedCustomer]);

  const relatedEstimates = useMemo(() => {
    if (!selectedCustomer) return [];
    return estimates.filter(estimate => estimate.customerName === selectedCustomer.customerName);
  }, [estimates, selectedCustomer]);

  useEffect(() => {
    setSelectedJobId('');
    setSelectedEstimateId('');
  }, [selectedCustomerId]);

  const toastStatusRef = useRef<typeof status>('idle');
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (toastStatusRef.current === 'loading' && status === 'success') {
      addToast('AIが提案書を生成しました。', 'success');
    }
    if (status === 'error' && error && error !== lastErrorRef.current) {
      addToast(error, 'error');
      lastErrorRef.current = error;
    }
    toastStatusRef.current = status;
  }, [status, error, addToast]);

  const handleFormChange = useCallback(
    (updater: (prev: ProposalFormData) => ProposalFormData) => {
      setFormData(prev => updater(prev));
    },
    [],
  );

  const buildReferenceBlock = useCallback((): string => {
    const blocks: string[] = [];
    if (selectedCustomer) {
      blocks.push(
        [
          `顧客: ${selectedCustomer.customerName}`,
          selectedCustomer.representative ? `代表者: ${selectedCustomer.representative}` : null,
          selectedCustomer.companyContent ? `事業内容: ${selectedCustomer.companyContent}` : null,
          selectedCustomer.infoRequirements ? `要望: ${selectedCustomer.infoRequirements}` : null,
          selectedCustomer.infoSalesActivity ? `営業履歴: ${selectedCustomer.infoSalesActivity}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    if (selectedJob) {
      blocks.push(
        [
          `案件: ${selectedJob.title}`,
          selectedJob.dueDate ? `納期: ${new Date(selectedJob.dueDate).toLocaleDateString('ja-JP')}` : null,
          selectedJob.quantity ? `数量: ${selectedJob.quantity.toLocaleString()}部` : null,
          selectedJob.price ? `売上見込: ${formatJPY(selectedJob.price)}` : null,
          selectedJob.details ? `仕様: ${selectedJob.details}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    if (selectedEstimate) {
      const topItems = selectedEstimate.items.slice(0, 3).map(item => `- ${item.content} (${formatJPY(item.price)})`);
      blocks.push(
        [
          `見積: ${selectedEstimate.title}`,
          `合計金額: ${formatJPY(selectedEstimate.total)}`,
          selectedEstimate.deliveryDate ? `希望納期: ${selectedEstimate.deliveryDate}` : null,
          selectedEstimate.notes ? `備考: ${selectedEstimate.notes}` : null,
          topItems.length > 0 ? `主要構成:\n${topItems.join('\n')}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    return blocks.join('\n\n');
  }, [selectedCustomer, selectedJob, selectedEstimate]);

  const handleApplyPrefill = useCallback(() => {
    if (!selectedCustomer) {
      addToast('顧客を選択してください。', 'info');
      return;
    }
    const referenceBlock = buildReferenceBlock();
    setFormData(prev => {
      const hasCustomReference = prev.referenceInfo !== DEFAULT_FORM_DATA.referenceInfo;
      const mergedReference = [referenceBlock, hasCustomReference ? prev.referenceInfo : null]
        .filter(Boolean)
        .join('\n\n');
      return {
        ...prev,
        customerName: selectedCustomer.customerName,
        salesRepName: prev.salesRepName || currentUser?.name || '',
        targetIndustry:
          prev.targetIndustry !== DEFAULT_FORM_DATA.targetIndustry
            ? prev.targetIndustry
            : selectedCustomer.customerDivision || selectedCustomer.companyContent || prev.targetIndustry,
        referenceInfo: mergedReference || prev.referenceInfo,
      };
    });
    addToast('顧客・案件情報を入力欄に反映しました。', 'success');
  }, [selectedCustomer, buildReferenceBlock, currentUser, addToast]);

  const handleGenerate = useCallback(() => {
    if (isAIOff) {
      addToast('AI機能は現在無効です。', 'error');
      return;
    }
    generate(formData);
  }, [generate, formData, addToast, isAIOff]);

  const handleReset = useCallback(() => {
    reset();
    setFormData(DEFAULT_FORM_DATA);
    setSelectedCustomerId('');
    setSelectedJobId('');
    setSelectedEstimateId('');
  }, [reset]);

  const renderStatusPanel = () => {
    if (status === 'loading') {
      return (
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col items-center text-center text-white gap-4 shadow-2xl">
          <Spinner />
          <div>
            <p className="text-lg font-semibold">AIが提案書を生成中です...</p>
            <p className="text-sm text-slate-300 mt-2">画像生成と調査には数十秒かかる場合があります。</p>
          </div>
          <Button onClick={handleReset} variant="outline" className="mt-2">
            中断して条件を変更
          </Button>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-8 text-white shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-300" />
            <h3 className="text-xl font-semibold">提案書の生成に失敗しました</h3>
          </div>
          <p className="text-sm text-red-100">{error || '不明なエラーが発生しました。'}</p>
          <Button onClick={handleReset}>条件を見直して再実行</Button>
        </div>
      );
    }

    if (status === 'success' && presentation) {
      return <ProposalPreview presentation={presentation} sources={sources} onReset={handleReset} />;
    }

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-lg space-y-4">
        <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">AI提案書作成の流れ</h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-300">
          <li>左側で顧客・案件を選び、「CRM情報を反映」ボタンでメモへ取り込みます。</li>
          <li>必要に応じてDeep Researchを有効化して最新トレンドを調査します。</li>
          <li>「プレゼンテーションを生成」を押すと、スライド構成・図版・話者ノートをAIが作成します。</li>
          <li>生成結果は右側にプレビューされ、必要に応じて再生成できます。</li>
        </ol>
        <p className="text-sm text-slate-500 dark:text-slate-400">※ Deep ResearchはGoogle検索を利用するため、応答時間が長くなります。</p>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <ProposalHeader />
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="space-y-6 xl:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">CRMデータを活用</h3>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Optional</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <select
                value={selectedCustomerId}
                onChange={event => setSelectedCustomerId(event.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">顧客を選択...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerName}
                  </option>
                ))}
              </select>
              <select
                value={selectedJobId}
                onChange={event => setSelectedJobId(event.target.value)}
                disabled={!selectedCustomer}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              >
                <option value="">{selectedCustomer ? '関連案件を選択...' : '先に顧客を選択してください'}</option>
                {relatedJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} / {job.dueDate ? new Date(job.dueDate).toLocaleDateString('ja-JP') : '納期未定'}
                  </option>
                ))}
              </select>
              <select
                value={selectedEstimateId}
                onChange={event => setSelectedEstimateId(event.target.value)}
                disabled={!selectedCustomer}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              >
                <option value="">{selectedCustomer ? '関連見積を選択...' : '先に顧客を選択してください'}</option>
                {relatedEstimates.map(estimate => (
                  <option key={estimate.id} value={estimate.id}>
                    {estimate.title} / {formatJPY(estimate.total)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleApplyPrefill}
                className="w-full"
                variant="secondary"
                disabled={!selectedCustomer || status !== 'idle'}
              >
                CRM情報を反映
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                顧客・案件・見積の情報を参考情報欄にまとめて入力できます。
              </p>
            </div>
          </div>

          {status === 'idle' ? (
            <ProposalForm
              formData={formData}
              onChange={handleFormChange}
              onSubmit={handleGenerate}
              isSubmitting={status === 'loading'}
              isAIOff={isAIOff}
            />
          ) : (
            <div className="bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-400 dark:border-slate-600 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-300">
              <p className="font-semibold">
                {status === 'success' ? '生成結果を確認中です。' : 'AI生成中のためフォームはロックされています。'}
              </p>
              <p className="text-sm mt-2">「新しい提案書を作成」ボタンでフォームに戻れます。</p>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-3">
          {renderStatusPanel()}
          <ProposalActionConsole actions={actions} />
        </div>
      </div>
    </div>
  );
};

export default BusinessSupportPage;
