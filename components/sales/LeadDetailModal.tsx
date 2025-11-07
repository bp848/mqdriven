import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser, CustomProposalContent, LeadProposalPackage, EstimateStatus, EstimateItem, CompanyInvestigation } from '../../types.ts';
import { X, Save, Loader, Pencil, Trash2, Mail, CheckCircle, Lightbulb, Search, FileText, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw, Sparkles, Eye } from '../Icons.tsx';
import LeadStatusBadge from './LeadStatusBadge.tsx';
import { INQUIRY_TYPES } from '../../constants.ts';
import LeadScoreBadge from '../ui/LeadScoreBadge.tsx';
import { createLeadProposalPackage, investigateLeadCompany, generateLeadReplyEmail } from '../../services/geminiService.ts';
import ProposalPdfContent from './ProposalPdfContent.tsx';
import { generateMultipagePdf, formatDate, formatJPY, formatDateTime, createSignature } from '../../utils.ts';
import InvestigationReportPdfContent from '../reports/InvestigationReportPdfContent.tsx';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    allLeads: Lead[];
    currentLeadIndex: number;
    onNavigateLead: (index: number) => void;
    onSave: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
    onDelete: (leadId: string) => Promise<void>;
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
    onAddEstimate: (estimate: any) => Promise<void>;
}

const Field: React.FC<{
    label: string;
    name: keyof Lead;
    value: string | string[] | number | null | undefined;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<any>) => void;
    type?: 'text' | 'email' | 'select' | 'textarea' | 'date' | 'number';
    options?: any[];
    className?: string;
    colSpan?: string;
}> = ({ label, name, value, isEditing, onChange, type = 'text', options = [], className = '', colSpan = 'col-span-1' }) => {
    const fieldInputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-white rounded-lg p-1.5 focus:ring-blue-500 focus:border-blue-500 leading-tight";
    
    let displayValue: React.ReactNode = Array.isArray(value) ? value.join(', ') : (value !== null && value !== undefined ? String(value) : '-');

    if (!isEditing && type === 'date' && value) {
        displayValue = formatDate(value as string);
    }
    if (!isEditing && name === 'score' && typeof value === 'number') {
        displayValue = <LeadScoreBadge score={value} />;
    }

    return (
        <div className={`${className} ${colSpan}`}>
            <label htmlFor={String(name)} className="text-base font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</label>
            <div className="mt-1">
                {isEditing ? (
                    <>
                        {type === 'textarea' && <textarea id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass} rows={5} />}
                        {type === 'select' && <select id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass}>{options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}</select>}
                        {type === 'number' && <input type="number" id={String(name)} name={String(name)} value={(value as number) || 0} onChange={onChange} className={fieldInputClass} />}
                        {type !== 'textarea' && type !== 'select' && type !== 'number' && <input type={type} id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass} />}
                    </>
                ) : (
                    <div className="text-base text-slate-900 dark:text-white min-h-[32px] flex items-center whitespace-pre-wrap break-words leading-tight" style={{ overflow: 'visible' }}>
                        {displayValue}
                    </div>
                )}
            </div>
        </div>
    );
};

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ 
    isOpen, onClose, lead, allLeads, currentLeadIndex, onNavigateLead, 
    onSave, onDelete, addToast, requestConfirmation, currentUser,
    isAIOff, onAddEstimate 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isInvestigating, setIsInvestigating] = useState(false);
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
    const [lastProposalPackage, setLastProposalPackage] = useState<LeadProposalPackage | null>(null);
    const [showProposalPreview, setShowProposalPreview] = useState(false);
    const [showInvestigationPreview, setShowInvestigationPreview] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingEstimate, setIsSavingEstimate] = useState(false);
    const [activeTab, setActiveTab] = useState<'companyInfo' | 'estimateDraft' | 'proposalDraft' | 'emailReplyDraft'>('companyInfo');
    const [aiReplyEmail, setAiReplyEmail] = useState<{ subject: string; bodyText: string } | null>(null);
    const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
    const [companyInvestigation, setCompanyInvestigation] = useState<CompanyInvestigation | null>(null);

    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    
    useEffect(() => {
        if (lead) {
            setFormData({ ...lead });
            setIsEditing(false);
            setLastProposalPackage(null);
            setShowProposalPreview(false);
            setAiReplyEmail(null);
            setCompanyInvestigation(lead.aiInvestigation || null);
            setActiveTab('companyInfo');
            try {
                if (lead.aiDraftProposal) {
                    const parsedPackage = JSON.parse(lead.aiDraftProposal);
                    setLastProposalPackage(parsedPackage);
                    if (parsedPackage.proposal || parsedPackage.estimate) {
                        setShowProposalPreview(true);
                    }
                }
            } catch (e) {
                console.error('Failed to parse aiDraftProposal:', e);
            }
        }
    }, [lead]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && currentLeadIndex > 0) onNavigateLead(currentLeadIndex - 1);
            if (e.key === 'ArrowRight' && currentLeadIndex < allLeads.length - 1) onNavigateLead(currentLeadIndex + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, currentLeadIndex, allLeads.length, onNavigateLead]);

    if (!isOpen || !lead) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { id, createdAt, updatedAt, ...submissionData } = formData;
        await onSave(lead.id, { ...submissionData, updatedAt: new Date().toISOString() });
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleInvestigateCompany = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        setIsInvestigating(true);
        try {
            const result = await investigateLeadCompany(lead.company);
            await onSave(lead.id, { aiInvestigation: result, updatedAt: new Date().toISOString() });
            if (mounted.current) {
                setCompanyInvestigation(result);
                addToast('企業調査が完了しました。', 'success');
            }
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? `企業調査エラー: ${e.message}`: '不明なエラーが発生しました。', 'error');
        } finally {
            if (mounted.current) setIsInvestigating(false);
        }
    };
    
    const handleCreateProposalPackage = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        setIsGeneratingPackage(true);
        try {
            const result = await createLeadProposalPackage(lead);
            await onSave(lead.id, { aiDraftProposal: JSON.stringify(result), updatedAt: new Date().toISOString() });
            if (mounted.current) {
                setLastProposalPackage(result);
                setShowProposalPreview(true);
                addToast('AI提案パッケージが生成されました。', 'success');
            }
        } catch (e: any) {
            if (mounted.current) addToast(e instanceof Error ? `提案パッケージ生成エラー: ${e.message}`: '不明なエラーが発生しました。', 'error');
        } finally {
            if (mounted.current) setIsGeneratingPackage(false);
        }
    };

    const handleDownloadProposalPdf = async () => {
        if (!lead || !lastProposalPackage?.proposal) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
            await generateMultipagePdf(
                'proposal-pdf-content',
                `提案書_${lead.company}_${lead.name}.pdf`
            );
            addToast('提案書PDFが正常に生成されました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : 'PDFの生成に失敗しました。', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleDownloadInvestigationPdf = async () => {
        if (!lead || !companyInvestigation) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
            await generateMultipagePdf(
                'investigation-report-pdf-content',
                `企業調査レポート_${lead.company}.pdf`
            );
            addToast('企業調査レポートPDFが正常に生成されました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : 'PDFの生成に失敗しました。', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSaveEstimate = async () => {
        if (!lastProposalPackage?.estimate || isSavingEstimate) return;
        setIsSavingEstimate(true);
        try {
            const estimateBase = {
                customerName: lead.company,
                title: lastProposalPackage.proposal?.coverTitle || `${lead.company}様向けご提案見積`,
                items: lastProposalPackage.estimate,
                deliveryDate: '',
                paymentTerms: '別途相談',
                deliveryMethod: 'メール送付',
                notes: 'AI提案パッケージより生成',
                status: EstimateStatus.Draft,
                version: 1,
                userId: currentUser?.id || 'unknown',
            };
            await onAddEstimate(estimateBase);
            addToast('見積を下書きとして保存しました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : '見積の保存に失敗しました。', 'error');
        } finally {
            setIsSavingEstimate(false);
        }
    };

    const handleGenerateReplyEmail = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        if (!lead.email) { addToast('返信先のメールアドレスが登録されていません。', 'error'); return; }
        setIsGeneratingEmail(true);
        try {
            const { subject, bodyText } = await generateLeadReplyEmail(lead);
            if (mounted.current) {
                setAiReplyEmail({ subject, bodyText });
                addToast('AIが返信メール文案を生成しました。', 'success');
            }
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'AIによるメール作成に失敗しました。', 'error');
        } finally {
            if (mounted.current) setIsGeneratingEmail(false);
        }
    };

    const handleOpenGmail = async () => {
        if (!currentUser || !aiReplyEmail) return;
        try {
            const signature = createSignature();
            const finalBody = `${aiReplyEmail.bodyText}\n\n${signature}`.trim();
            const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}&su=${encodeURIComponent(aiReplyEmail.subject)}&body=${encodeURIComponent(finalBody)}`;
            window.open(mailto, '_blank');

            const timestamp = formatDateTime(new Date().toISOString());
            const logMessage = `[${timestamp}] AI返信メールをGmailで作成し、ステータスを「${LeadStatus.Contacted}」に更新しました。`;
            const updatedInfo = `${logMessage}\n${lead.infoSalesActivity || ''}`.trim();
            await onSave(lead.id, {
                status: LeadStatus.Contacted,
                infoSalesActivity: updatedInfo,
                updatedAt: new Date().toISOString(),
            });
            addToast('Gmailの下書きを作成しました。', 'success');
            setAiReplyEmail(null);
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'メール作成に失敗しました', 'error');
        }
    };
    
    const isNextDisabled = currentLeadIndex >= allLeads.length - 1;
    const isPrevDisabled = currentLeadIndex <= 0;
    const currentLeadTitle = lead.company + (lead.name ? ` / ${lead.name}` : '');

    const handleDelete = () => {
        if (!lead) return;
        requestConfirmation({
            title: 'リードの削除',
            message: `本当にリード「${lead.company} / ${lead.name}」を削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                await onDelete(lead.id);
                onClose();
            }
        });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 animate-fade-in-up">
                <div className="bg-slate-800 text-white flex flex-col overflow-hidden w-full h-full rounded-2xl border border-slate-700">
                    {/* Header */}
                    <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => onNavigateLead(currentLeadIndex - 1)} disabled={isPrevDisabled} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="前のリードへ">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="font-semibold text-lg max-w-lg truncate" title={currentLeadTitle}>
                                {currentLeadTitle}
                            </div>
                            <button onClick={() => onNavigateLead(currentLeadIndex + 1)} disabled={isNextDisabled} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="次のリードへ">
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <LeadStatusBadge status={lead.status} />
                            <button className="p-1 rounded-full hover:bg-slate-700" onClick={onClose} aria-label="閉じる">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 flex-1 overflow-hidden">
                        {/* Left Column */}
                        <div className="h-full bg-slate-900 rounded-lg p-4 grid grid-cols-3 gap-x-4 gap-y-2 overflow-y-auto auto-rows-min">
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 mb-2 border-b border-slate-700 pb-2">基本情報</h3>
                            <Field label="会社名" name="company" value={formData.company} isEditing={isEditing} onChange={handleChange} colSpan="col-span-3" />
                            <Field label="担当者名" name="name" value={formData.name} isEditing={isEditing} onChange={handleChange} colSpan="col-span-3" />
                            <Field label="受信日時" name="createdAt" value={lead.createdAt} isEditing={false} onChange={handleChange} />
                            <Field label="最終更新" name="updatedAt" value={lead.updatedAt || lead.createdAt} isEditing={false} onChange={handleChange} />
                            <Field label="流入経路" name="source" value={formData.source} isEditing={isEditing} onChange={handleChange} />
                            <Field label="メール" name="email" value={formData.email} isEditing={isEditing} onChange={handleChange} type="email" />
                            <Field label="電話" name="phone" value={formData.phone} isEditing={isEditing} onChange={handleChange} type="text" />
                            <Field label="スコア" name="score" value={lead.score} isEditing={false} onChange={handleChange} type="number" />
                            <Field label="問い合わせ種別" name="inquiryTypes" value={formData.inquiryTypes} isEditing={isEditing} onChange={handleChange} type="select" options={INQUIRY_TYPES} colSpan="col-span-3" />
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 my-2 border-b border-slate-700 pb-2">問い合わせ内容</h3>
                            <Field label="" name="message" value={formData.message} isEditing={isEditing} onChange={handleChange} type="textarea" colSpan="col-span-3" />
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 my-2 border-b border-slate-700 pb-2">活動履歴</h3>
                            <Field label="" name="infoSalesActivity" value={formData.infoSalesActivity} isEditing={isEditing} onChange={handleChange} type="textarea" colSpan="col-span-3" />
                        </div>
                        {/* Right Column */}
                        <div className="h-full bg-slate-900 rounded-lg p-4 flex flex-col overflow-hidden">
                            {/* Tab Navigation */}
                            <div className="flex border-b border-slate-700 mb-4 flex-shrink-0">
                                <button onClick={() => setActiveTab('companyInfo')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'companyInfo' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>企業情報</button>
                                <button onClick={() => setActiveTab('estimateDraft')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'estimateDraft' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>見積もり案</button>
                                <button onClick={() => setActiveTab('proposalDraft')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'proposalDraft' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>提案書案</button>
                                <button onClick={() => setActiveTab('emailReplyDraft')} className={`px-4 py-2 text-sm font-semibold ${activeTab === 'emailReplyDraft' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>返信メール案</button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto">
                                {activeTab === 'companyInfo' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-300">企業調査</h4>
                                            <button onClick={handleInvestigateCompany} disabled={isInvestigating || isAIOff} className="text-xs font-semibold text-blue-400 flex items-center gap-1 disabled:opacity-50 hover:text-blue-300">
                                                {isInvestigating ? <Loader className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                {companyInvestigation ? '再調査' : 'AIで企業調査'}
                                            </button>
                                        </div>
                                        {isInvestigating ? (
                                            <div className="text-sm text-slate-400">Web検索を用いて調査中...</div>
                                        ) : companyInvestigation ? (
                                            <div className="space-y-3">
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">概要</h5>
                                                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{companyInvestigation.summary}</p>
                                                </div>
                                                {companyInvestigation.businessOverview && (
                                                    <div className="bg-slate-800 p-3 rounded-lg">
                                                        <h5 className="text-xs font-semibold text-slate-300 mb-2">事業概要</h5>
                                                        <p className="text-sm text-slate-400 whitespace-pre-wrap">{companyInvestigation.businessOverview}</p>
                                                    </div>
                                                )}
                                                {companyInvestigation.recentNews && companyInvestigation.recentNews.length > 0 && (
                                                    <div className="bg-slate-800 p-3 rounded-lg">
                                                        <h5 className="text-xs font-semibold text-slate-300 mb-2">最近のニュース</h5>
                                                        <ul className="space-y-2">
                                                            {companyInvestigation.recentNews.map((news: string, idx: number) => (
                                                                <li key={idx} className="text-sm text-slate-400">• {news}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={() => setShowInvestigationPreview(v => !v)} className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg text-sm">
                                                        <Eye className="w-4 h-4" />
                                                        {showInvestigationPreview ? 'プレビューを隠す' : 'プレビュー表示'}
                                                    </button>
                                                    <button onClick={handleDownloadInvestigationPdf} disabled={isGeneratingPdf} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                                                        {isGeneratingPdf ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                                        調査レポートPDF
                                                    </button>
                                                </div>
                                                {showInvestigationPreview && (
                                                    <div className="mt-3 bg-white rounded-md overflow-hidden">
                                                        <InvestigationReportPdfContent report={{ title: `企業調査レポート: ${lead.company}` , sections: companyInvestigation }} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">企業の基本情報や最新ニュースを調査します。</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'estimateDraft' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-300">AI見積もり</h4>
                                            <button onClick={handleCreateProposalPackage} disabled={isGeneratingPackage || isAIOff} className="text-xs font-semibold text-blue-400 flex items-center gap-1 disabled:opacity-50 hover:text-blue-300">
                                                {isGeneratingPackage ? <Loader className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                                                AI提案パッケージ作成
                                            </button>
                                        </div>
                                        {isGeneratingPackage ? (
                                            <div className="text-sm text-slate-400">AIが提案書と見積を作成中です...</div>
                                        ) : lastProposalPackage?.estimate && lastProposalPackage.estimate.length > 0 ? (
                                            <div className="space-y-3">
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-slate-700">
                                                                <th className="text-left text-xs text-slate-400 pb-2">項目</th>
                                                                <th className="text-right text-xs text-slate-400 pb-2">金額</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {lastProposalPackage.estimate.map((item: EstimateItem, idx: number) => (
                                                                <tr key={idx} className="border-b border-slate-700/50">
                                                                    <td className="py-2 text-slate-300">{item.content}</td>
                                                                    <td className="py-2 text-right text-slate-300">{formatJPY(item.unitPrice * item.quantity)}</td>
                                                                </tr>
                                                            ))}
                                                            <tr className="font-semibold">
                                                                <td className="pt-2 text-slate-200">合計</td>
                                                                <td className="pt-2 text-right text-slate-200">
                                                                    {formatJPY(lastProposalPackage.estimate.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button onClick={handleSaveEstimate} disabled={isSavingEstimate} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                                                    {isSavingEstimate ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    見積を保存
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">AI提案パッケージを作成すると、見積もり案が表示されます。</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'proposalDraft' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-300">AI提案書</h4>
                                            <button onClick={handleCreateProposalPackage} disabled={isGeneratingPackage || isAIOff} className="text-xs font-semibold text-blue-400 flex items-center gap-1 disabled:opacity-50 hover:text-blue-300">
                                                {isGeneratingPackage ? <Loader className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                                                AI提案パッケージ作成
                                            </button>
                                        </div>
                                        {isGeneratingPackage ? (
                                            <div className="text-sm text-slate-400">AIが提案書と見積を作成中です...</div>
                                        ) : lastProposalPackage?.proposal ? (
                                            <div className="space-y-3">
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">タイトル</h5>
                                                    <p className="text-sm text-slate-200">{lastProposalPackage.proposal.coverTitle}</p>
                                                </div>
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">提案内容</h5>
                                                    <div className="text-sm text-slate-400 whitespace-pre-wrap max-h-64 overflow-y-auto space-y-3">
                                                        <div>
                                                            <h6 className="font-semibold text-slate-300 mb-1">事業理解</h6>
                                                            <p>{lastProposalPackage.proposal.businessUnderstanding}</p>
                                                        </div>
                                                        <div>
                                                            <h6 className="font-semibold text-slate-300 mb-1">課題</h6>
                                                            <p>{lastProposalPackage.proposal.challenges}</p>
                                                        </div>
                                                        <div>
                                                            <h6 className="font-semibold text-slate-300 mb-1">提案</h6>
                                                            <p>{lastProposalPackage.proposal.proposal}</p>
                                                        </div>
                                                        <div>
                                                            <h6 className="font-semibold text-slate-300 mb-1">まとめ</h6>
                                                            <p>{lastProposalPackage.proposal.conclusion}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={() => setShowProposalPreview(v => !v)} className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg text-sm">
                                                        <Eye className="w-4 h-4" />
                                                        {showProposalPreview ? 'プレビューを隠す' : 'プレビュー表示'}
                                                    </button>
                                                    <button onClick={handleDownloadProposalPdf} disabled={isGeneratingPdf} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm disabled:opacity-50">
                                                        {isGeneratingPdf ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                                        提案書PDF
                                                    </button>
                                                </div>
                                                {showProposalPreview && (
                                                    <div className="mt-3 bg-white rounded-md overflow-hidden">
                                                        <ProposalPdfContent content={lastProposalPackage.proposal} lead={lead} />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">AI提案パッケージを作成すると、提案書案が表示されます。</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'emailReplyDraft' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-300">AI返信メール</h4>
                                            <button onClick={handleGenerateReplyEmail} disabled={isGeneratingEmail || isAIOff} className="text-xs font-semibold text-blue-400 flex items-center gap-1 disabled:opacity-50 hover:text-blue-300">
                                                {isGeneratingEmail ? <Loader className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                                AIで返信作成
                                            </button>
                                        </div>
                                        {isGeneratingEmail ? (
                                            <div className="text-sm text-slate-400">AIが返信メールを作成中です...</div>
                                        ) : aiReplyEmail ? (
                                            <div className="space-y-3">
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">件名</h5>
                                                    <p className="text-sm text-slate-200">{aiReplyEmail.subject}</p>
                                                </div>
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <h5 className="text-xs font-semibold text-slate-300 mb-2">本文</h5>
                                                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{aiReplyEmail.bodyText}</p>
                                                </div>
                                                <button onClick={() => {
                                                    navigator.clipboard.writeText(`件名: ${aiReplyEmail.subject}\n\n${aiReplyEmail.bodyText}`);
                                                    addToast('メール内容をクリップボードにコピーしました', 'success');
                                                }} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm">
                                                    <Mail className="w-4 h-4" />
                                                    クリップボードにコピー
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500">AIで返信メールを作成します。</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="h-16 flex items-center justify-between px-4 border-t border-slate-700 flex-shrink-0">
                         <div>{/* Placeholder for left footer items */}</div>
                        <div className="flex items-center gap-4">
                            {!isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm text-white"><Pencil className="w-4 h-4" /> 編集</button>
                            ) : (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm text-white">キャンセル</button>
                                    <button onClick={() => handleDelete()} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg text-sm text-white"><Trash2 className="w-4 h-4" /> 削除</button>
                                    <button onClick={handleSave} disabled={isSaving} className="w-32 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-400 text-sm">
                                        {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" />保存</>}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {lastProposalPackage?.proposal && <div style={{ position: 'absolute', left: '-9999px', top: 0 }}><ProposalPdfContent content={lastProposalPackage.proposal} lead={lead} /></div>}
            {isGeneratingPdf && companyInvestigation && <div style={{ position: 'absolute', left: '-9999px', top: 0 }}><InvestigationReportPdfContent report={{ title: `企業調査レポート: ${lead.company}`, sections: companyInvestigation }} /></div>}
        </>
    );
};