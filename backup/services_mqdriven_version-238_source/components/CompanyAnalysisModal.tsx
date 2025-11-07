import React, { useState } from 'react';
import { CompanyAnalysis, Customer, EmployeeUser } from '../types';
import { X, Loader, AlertTriangle, Lightbulb, Mail, RefreshCw, FileText } from './Icons';
import { generateMultipagePdf } from '../utils';
import InvestigationReportPdfContent from './reports/InvestigationReportPdfContent';

interface CompanyAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysis: CompanyAnalysis | null;
    customer: Customer | null;
    isLoading: boolean;
    error: string;
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
    onReanalyze: (customer: Customer) => void;
}

const AnalysisSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-300 dark:border-slate-600 pb-2">{title}</h3>
        <div className="text-base text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-slate dark:prose-invert max-w-none">{children}</div>
    </div>
);

export const CompanyAnalysisModal: React.FC<CompanyAnalysisModalProps> = ({ isOpen, onClose, analysis, customer, isLoading, error, currentUser, isAIOff, onReanalyze }) => {
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    if (!isOpen) return null;

    const handleCreateEmail = () => {
        if (isAIOff) {
            alert('AI機能が無効です。メール作成はできません。');
            return;
        }
        if (!analysis || !analysis.proposalEmail || !customer || !currentUser) return;
        const { subject, body } = analysis.proposalEmail;
        const finalBody = body.replace(/\[あなたの名前\]/g, currentUser.name);
        const mailto = `mailto:${customer.customerContactInfo || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
        window.open(mailto, '_blank');
    };
    
    const handleReanalyzeClick = () => {
        if (customer) {
            onReanalyze(customer);
        }
    };

    const handleGeneratePdf = async () => {
        if (!customer || !analysis) return;
        setIsPdfLoading(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
          await generateMultipagePdf(
            'investigation-report-pdf-content',
            `企業分析レポート_${customer.customerName}.pdf`
          );
        } catch(e) {
            alert(e instanceof Error ? e.message : 'PDFの生成に失敗しました。');
        } finally {
            setIsPdfLoading(false);
        }
    };

    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <Lightbulb className="w-7 h-7 text-blue-500" />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI企業分析</h2>
                             <p className="text-sm text-slate-500 dark:text-slate-400">{customer?.customerName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-6">
                    {isAIOff ? (
                        <div className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                            <AlertTriangle className="w-12 h-12 text-red-500" />
                            <p className="mt-4 font-semibold text-red-700 dark:text-red-300">AI機能は現在無効です。</p>
                            <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">AIによる企業分析は利用できません。</p>
                        </div>
                    ) : isLoading && (
                        <div className="flex flex-col items-center justify-center h-64">
                            <Loader className="w-12 h-12 text-blue-600 animate-spin" />
                            <p className="mt-4 text-slate-500 dark:text-slate-400">AIが企業情報を分析中...</p>
                        </div>
                    )}
                    {!isAIOff && error && (
                        <div className="flex flex-col items-center justify-center h-64 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                             <AlertTriangle className="w-12 h-12 text-red-500" />
                            <p className="mt-4 font-semibold text-red-700 dark:text-red-300">分析エラー</p>
                            <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                    {analysis && !isLoading && !isAIOff && (
                        <>
                            <AnalysisSection title="SWOT分析">
                                {analysis.swot}
                            </AnalysisSection>
                             <AnalysisSection title="課題と潜在的ニーズ">
                                {analysis.painPointsAndNeeds}
                            </AnalysisSection>
                             <AnalysisSection title="提案アクション">
                                {analysis.suggestedActions}
                            </AnalysisSection>
                             {analysis.sources && analysis.sources.length > 0 && (
                                <AnalysisSection title="情報源">
                                    <ul className="list-disc pl-5 space-y-1">
                                        {analysis.sources.map((source, index) => (
                                            <li key={index}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </AnalysisSection>
                            )}
                            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">AI提案メール</h3>
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{analysis.proposalEmail.subject}</p>
                                    <p className="text-base text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{analysis.proposalEmail.body.replace(/\[あなたの名前\]/g, currentUser?.name || '担当者名')}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-between items-center gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                     <div className="flex gap-2">
                        <button onClick={handleGeneratePdf} disabled={isPdfLoading || !analysis} className="flex items-center gap-2 bg-green-100 text-green-700 font-semibold py-2 px-4 rounded-lg hover:bg-green-200 disabled:opacity-50">
                            {isPdfLoading ? <Loader className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4" />}
                            PDFダウンロード
                        </button>
                        <button
                            onClick={handleReanalyzeClick}
                            disabled={isLoading || isAIOff}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            再分析
                        </button>
                        <button
                            onClick={handleCreateEmail}
                            disabled={!analysis || isLoading || isAIOff}
                            className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold py-2 px-4 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Mail className="w-4 h-4" />
                            メール作成
                        </button>
                    </div>
                    <button onClick={onClose} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">閉じる</button>
                </div>
            </div>
        </div>
        {isPdfLoading && customer && analysis && (
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <InvestigationReportPdfContent report={{ title: `企業分析レポート: ${customer.customerName}`, sections: analysis }} />
            </div>
        )}
        </>
    );
};