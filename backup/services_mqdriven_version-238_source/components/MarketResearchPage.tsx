import React, { useState } from 'react';
import { Toast, MarketResearchReport } from '../types';
import { generateMarketResearchReport } from '../services/geminiService';
import { Loader, Search, FileText, AlertTriangle } from './Icons';
import { generateMultipagePdf } from '../utils';
import MarketResearchReportPdfContent from './reports/MarketResearchReportPdfContent';

interface MarketResearchPageProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

const MarketResearchPage: React.FC<MarketResearchPageProps> = ({ addToast, isAIOff }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<MarketResearchReport | null>(null);
  const [error, setError] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const handleResearch = async () => {
    if (isAIOff) {
        addToast('AI機能は現在無効です。', 'error');
        return;
    }
    if (!topic.trim()) {
        addToast('調査トピックを入力してください。', 'info');
        return;
    }
    setIsLoading(true);
    setError('');
    setReport(null);
    try {
        const result = await generateMarketResearchReport(topic);
        setReport(result);
    } catch (e) {
        setError(e instanceof Error ? e.message : '調査中にエラーが発生しました。');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!report) return;
    setIsPdfLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
      await generateMultipagePdf(
        'market-research-report-pdf-content',
        `市場調査レポート_${report.title}.pdf`
      );
      addToast('PDFが正常に生成されました。', 'success');
    } catch(e) {
        addToast(e instanceof Error ? e.message : 'PDFの生成に失敗しました。', 'error');
    } finally {
        setIsPdfLoading(false);
    }
  };

  const ResearchInput = () => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-white">AI市場調査</h2>
      <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
        調査したい市場、競合、技術トレンドなどを入力してください。AIがWebをリサーチし、レポートを作成します。
      </p>
      <div className="flex gap-2 mt-4">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: 日本のデジタル印刷市場の最新トレンドと競合分析"
          className="w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-3 focus:ring-blue-500"
          disabled={isLoading || isAIOff}
          onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
        />
        <button onClick={handleResearch} disabled={isLoading || isAIOff || !topic.trim()} className="w-48 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400">
          {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          調査開始
        </button>
      </div>
       {isAIOff && <p className="text-sm text-red-500 mt-2">AI機能は現在無効です。</p>}
    </div>
  );

  const ReportDisplay = () => {
    if (!report) return null;
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm mt-6">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                 <h2 className="text-xl font-semibold text-slate-800 dark:text-white">{report.title}</h2>
                 <button onClick={handleGeneratePdf} disabled={isPdfLoading} className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-400">
                    {isPdfLoading ? <Loader className="w-5 h-5 animate-spin"/> : <FileText className="w-5 h-5"/>}
                    PDFでダウンロード
                 </button>
            </div>
            <div className="p-6 prose prose-slate dark:prose-invert max-w-none">
                <h3>要約</h3>
                <p>{report.summary}</p>
                <h3>主要トレンド</h3>
                <ul>{report.trends.map((item, i) => <li key={i}>{item}</li>)}</ul>
                <h3>競合分析</h3>
                <p>{report.competitorAnalysis}</p>
                <h3>ビジネスチャンス</h3>
                <ul>{report.opportunities.map((item, i) => <li key={i}>{item}</li>)}</ul>
                <h3>脅威とリスク</h3>
                <ul>{report.threats.map((item, i) => <li key={i}>{item}</li>)}</ul>
                {report.sources && report.sources.length > 0 && (
                    <>
                    <h3>情報源</h3>
                    <ul className="text-sm">{report.sources.map((source, i) => <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer">{source.title || source.uri}</a></li>)}</ul>
                    </>
                )}
            </div>
        </div>
    );
  };

  return (
    <>
        <div className="space-y-6">
            <ResearchInput />
            {isLoading && <div className="text-center p-8"><Loader className="w-8 h-8 animate-spin mx-auto"/></div>}
            {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2"><AlertTriangle/>{error}</div>}
            <ReportDisplay />
        </div>
        { (isPdfLoading && report) && 
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <MarketResearchReportPdfContent report={report} />
            </div>
        }
    </>
  );
};

export default MarketResearchPage;