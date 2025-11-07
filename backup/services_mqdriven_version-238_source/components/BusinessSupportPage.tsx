
import React, { useState, useMemo } from 'react';
import { Customer, Job, Estimate, EmployeeUser, Toast } from '../types';
import { generateProposalSection } from '../services/geminiService';
import { Loader, Sparkles, FileText } from './Icons';
import { formatJPY } from '../utils';

declare const jspdf: any;
declare const html2canvas: any;

interface BusinessSupportPageProps {
    customers: Customer[];
    jobs: Job[];
    estimates: Estimate[];
    currentUser: EmployeeUser | null;
    addToast: (message: string, type: Toast['type']) => void;
    isAIOff: boolean;
}

const BusinessSupportPage: React.FC<BusinessSupportPageProps> = ({ customers, jobs, estimates, currentUser, addToast, isAIOff }) => {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    
    const [proposal, setProposal] = useState({
        title: '',
        executiveSummary: '',
        currentSituation: '',
        proposalContent: '',
        expectedBenefits: '',
        schedule: '',
        costEstimate: '',
    });

    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [isPdfLoading, setIsPdfLoading] = useState(false);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
    const relatedJobs = useMemo(() => selectedCustomer ? jobs.filter(j => j.clientName === selectedCustomer.customerName) : [], [jobs, selectedCustomer]);
    const relatedEstimates = useMemo(() => selectedCustomer ? estimates.filter(e => e.customerName === selectedCustomer.customerName) : [], [estimates, selectedCustomer]);
    const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    const selectedEstimate = useMemo(() => estimates.find(e => e.id === selectedEstimateId), [estimates, selectedEstimateId]);
    
    const handleGenerateSection = async (section: keyof typeof proposal, sectionTitle: string) => {
        if (!selectedCustomer) {
            addToast('提案の対象となる顧客を選択してください。', 'info');
            return;
        }
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        setLoadingStates(prev => ({ ...prev, [section]: true }));
        try {
            const content = await generateProposalSection(sectionTitle, selectedCustomer, selectedJob, selectedEstimate);
            setProposal(prev => ({ ...prev, [section]: content }));
        } catch (error: any) {
            console.error(error);
            addToast(`「${sectionTitle}」の生成に失敗しました。${error.message || ''}`, 'error');
        } finally {
            setLoadingStates(prev => ({ ...prev, [section]: false }));
        }
    };
    
    const handleGeneratePdf = async () => {
        setIsPdfLoading(true);
        const input = document.getElementById('proposal-preview');
        if (!input) {
            addToast('プレビュー要素が見つかりません。', 'error');
            setIsPdfLoading(false);
            return;
        }
    
        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            
            const customerName = selectedCustomer?.customerName || 'customer';
            const date = new Date().toISOString().split('T')[0];
            pdf.save(`提案書_${customerName}_${date}.pdf`);
            addToast('提案書PDFが正常に生成されました。', 'success');
        } catch (error) {
            console.error("PDF generation failed", error);
            addToast('PDFの生成に失敗しました。', 'error');
        } finally {
            setIsPdfLoading(false);
        }
    };


    const SectionEditor: React.FC<{
        field: keyof typeof proposal;
        title: string;
    }> = ({ field, title }) => (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="text-base font-semibold">{title}</label>
                <button 
                    onClick={() => handleGenerateSection(field, title)} 
                    disabled={loadingStates[field] || isAIOff} 
                    className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loadingStates[field] ? <Loader className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    AIで下書きを作成
                </button>
            </div>
            <textarea
                value={proposal[field]}
                onChange={e => setProposal(prev => ({ ...prev, [field]: e.target.value }))}
                rows={5}
                className="w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:ring-blue-500"
                disabled={isAIOff && loadingStates[field]}
            />
        </div>
    );
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Controls */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-6 h-fit">
                <h2 className="text-xl font-semibold">提案内容の入力</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select onChange={e => setSelectedCustomerId(e.target.value)} value={selectedCustomerId} className="md:col-span-1 w-full text-base bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                        <option value="">顧客を選択...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                    </select>
                    <select onChange={e => setSelectedJobId(e.target.value)} value={selectedJobId} disabled={!selectedCustomer} className="md:col-span-1 w-full text-base bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                        <option value="">関連案件を選択...</option>
                        {relatedJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                    <select onChange={e => setSelectedEstimateId(e.target.value)} value={selectedEstimateId} disabled={!selectedCustomer} className="md:col-span-1 w-full text-base bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5">
                        <option value="">関連見積を選択...</option>
                        {relatedEstimates.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                </div>

                <div className="space-y-4">
                    <SectionEditor field="title" title="提案タイトル" />
                    <SectionEditor field="executiveSummary" title="エグゼクティブサマリー" />
                    <SectionEditor field="currentSituation" title="現状分析と課題" />
                    <SectionEditor field="proposalContent" title="提案内容" />
                    <SectionEditor field="expectedBenefits" title="期待される効果" />
                    <SectionEditor field="schedule" title="実施スケジュール" />
                    <SectionEditor field="costEstimate" title="費用概算" />
                </div>
            </div>

            {/* Right Column: Preview */}
            <div>
                 <div className="sticky top-8">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">プレビュー</h2>
                         <button onClick={handleGeneratePdf} disabled={isPdfLoading} className="flex items-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-400">
                             {isPdfLoading ? <Loader className="w-5 h-5 animate-spin"/> : <FileText className="w-5 h-5"/>}
                             PDF生成
                         </button>
                     </div>
                    <div id="proposal-preview" className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-10 border dark:border-slate-700 prose prose-slate dark:prose-invert max-w-none">
                        <h1>{proposal.title || '提案書タイトル'}</h1>
                        <p className="lead">対象: {selectedCustomer?.customerName || '〇〇株式会社 御中'}</p>
                        <p className="text-sm">作成日: {new Date().toLocaleDateString('ja-JP')}</p>
                        <p className="text-sm">作成者: {currentUser?.name || '担当者名'}</p>
                        
                        <h2>1. エグゼクティブサマリー</h2>
                        <p>{proposal.executiveSummary || 'ここに概要が入ります。'}</p>

                        <h2>2. 現状分析と課題</h2>
                        <p>{proposal.currentSituation || 'ここに現状分析と課題が入ります。'}</p>

                        <h2>3. 提案内容</h2>
                        <p>{proposal.proposalContent || 'ここに具体的な提案内容が入ります。'}</p>

                        <h2>4. 期待される効果</h2>
                        <p>{proposal.expectedBenefits || 'ここに期待される効果が入ります。'}</p>

                        <h2>5. 実施スケジュール</h2>
                        <p>{proposal.schedule || 'ここに実施スケジュールが入ります。'}</p>

                        <h2>6. 費用概算</h2>
                        <p>{proposal.costEstimate || 'ここに費用概算が入ります。'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessSupportPage;