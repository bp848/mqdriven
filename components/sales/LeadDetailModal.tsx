import React, { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser, LeadScore, CompanyInvestigation, CustomProposalContent, LeadProposalPackage, EstimateStatus } from '../../types';
import { X, Save, Loader, Pencil, Trash2, Mail, CheckCircle, Lightbulb, Search, FileText } from '../Icons';
import LeadStatusBadge from './LeadStatusBadge';
import { INQUIRY_TYPES } from '../../constants';
import LeadScoreBadge from '../ui/LeadScoreBadge';
import { createLeadProposalPackage, generateLeadSummary, investigateLeadCompany } from '../../services/geminiService';
import ProposalPdfContent from './ProposalPdfContent';
import { formatDateTime, formatJPY, generateMultipagePdf } from '../../utils';
import InvestigationReportPdfContent from '../reports/InvestigationReportPdfContent';
import { sendEmail } from '../../services/emailService';
import { EmailStatusIndicator } from './EmailStatusIndicator';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    onSave: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
    onDelete: (leadId: string) => Promise<void>;
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    currentUser: EmployeeUser | null;
    onGenerateReply: (lead: Lead) => void;
    isAIOff: boolean;
    onAddEstimate: (estimate: any) => Promise<void>;
    onEstimateCreated?: () => void; // 見積もり作成後のコールバック
    initialAiTab?: 'investigation' | 'proposal' | 'email';
}

const DetailSection: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`pt-4 ${className || ''}`}>
        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-4">{title}</h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

const Field: React.FC<{
    label: string;
    name: keyof Lead;
    value: string | string[] | null | undefined;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<any>) => void;
    type?: 'text' | 'email' | 'select' | 'textarea';
    options?: any[];
    className?: string;
}> = ({ label, name, value, isEditing, onChange, type = 'text', options = [], className = '' }) => {
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    
    return (
        <div className={className}>
            <label htmlFor={String(name)} className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
            <div className="mt-1">
                {isEditing ? (
                    <>
                        {type === 'textarea' && <textarea id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={inputClass} rows={5} />}
                        {type === 'select' && <select id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={inputClass}>{options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}</select>}
                        {type !== 'textarea' && type !== 'select' && <input type={type} id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={inputClass} />}
                    </>
                ) : (
                    <p className="text-base text-slate-900 dark:text-white min-h-[44px] flex items-center whitespace-pre-wrap break-words">
                        {Array.isArray(value) ? value.join(', ') : (value || '-')}
                    </p>
                )}
            </div>
        </div>
    );
};

const renderInvestigationSummary = (text: string) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) {
                    return <div key={idx} className="h-1" />;
                }
                if (trimmed.startsWith('### ')) {
                    return (
                        <div key={idx} className="text-xs font-semibold text-slate-500 dark:text-slate-300 mt-2">
                            {trimmed.replace(/^###\s+/, '')}
                        </div>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <div key={idx} className="font-semibold text-slate-800 dark:text-slate-100 mt-3">
                            {trimmed.replace(/^##\s+/, '')}
                        </div>
                    );
                }
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    return (
                        <div key={idx} className="flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="whitespace-pre-wrap break-words">
                                {trimmed.replace(/^(\*|-)\s+/, '')}
                            </span>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="whitespace-pre-wrap break-words">
                        {line}
                    </div>
                );
            })}
        </div>
    );
};

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ isOpen, onClose, lead, onSave, onDelete, addToast, requestConfirmation, currentUser, onGenerateReply, isAIOff, onAddEstimate, onEstimateCreated, initialAiTab }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isInvestigating, setIsInvestigating] = useState(false);
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
    const [proposalPackage, setProposalPackage] = useState<LeadProposalPackage | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [leadSummary, setLeadSummary] = useState<string | null>(null);
    const [isSavingEstimate, setIsSavingEstimate] = useState(false);
    const [isSendingEstimateEmail, setIsSendingEstimateEmail] = useState(false);
    const [activeAiTab, setActiveAiTab] = useState<'investigation' | 'proposal' | 'email'>(() => {
        // If both investigation and estimate are completed, start with proposal tab for confirmation
        const hasInvestigation = Boolean(formData.aiInvestigation && String(formData.aiInvestigation).trim());
        const hasEstimateDraft = Boolean(formData.aiDraftProposal && String(formData.aiDraftProposal).trim());
        if (hasInvestigation && hasEstimateDraft) {
            return 'proposal';
        }
        return initialAiTab ?? 'investigation';
    });
    
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    
    useEffect(() => {
        if (lead) {
            setFormData({
                company: lead.company,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                website: lead.website,
                status: lead.status,
                message: lead.message,
                infoSalesActivity: lead.infoSalesActivity,
                assignedTo: lead.assignedTo,
                estimateSentAt: lead.estimateSentAt,
                estimateSentBy: lead.estimateSentBy,
                aiInvestigation: lead.aiInvestigation,
                aiDraftProposal: lead.aiDraftProposal,
            });
            
            // Auto-switch to proposal tab if both investigation and estimate are completed
            const hasInvestigation = Boolean(lead.aiInvestigation && String(lead.aiInvestigation).trim());
            const hasEstimateDraft = Boolean(lead.aiDraftProposal && String(lead.aiDraftProposal).trim());
            if (hasInvestigation && hasEstimateDraft && activeAiTab === 'investigation') {
                setActiveAiTab('proposal');
            }
        }
    }, [lead, activeAiTab]);

    useEffect(() => {
        if (!isOpen) return;
        if (!initialAiTab) return;
        setActiveAiTab(initialAiTab);
    }, [isOpen, initialAiTab]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !lead) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { id, createdAt, updatedAt, ...submissionData } = formData;
        await onSave(lead.id, submissionData);
        setIsSaving(false);
        setIsEditing(false);
    };

    // FIX: Define the handleDelete function to call the onDelete prop via confirmation.
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

    const handleInvestigateCompany = async () => {
        if (!lead || isAIOff) return;
        setIsInvestigating(true);
        try {
            const result = await investigateLeadCompany(lead.company);
            await onSave(lead.id, { aiInvestigation: result });
            if (mounted.current) {
                setFormData(prev => ({...prev, aiInvestigation: result}));
                addToast('企業調査が完了しました。', 'success');
            }
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? `企業調査エラー: ${e.message}`: '不明なエラーが発生しました。', 'error');
        } finally {
            if (mounted.current) setIsInvestigating(false);
        }
    };
    
    const handleGenerateSummary = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        setIsGeneratingSummary(true);
        try {
            const summary = await generateLeadSummary(lead);
            if (mounted.current) setLeadSummary(summary);
        } catch(e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'リード要約の生成に失敗しました。', 'error');
        } finally {
            if(mounted.current) setIsGeneratingSummary(false);
        }
    };

    const handleCreateProposalPackage = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        setIsGeneratingPackage(true);
        setProposalPackage(null);
        try {
            const result = await createLeadProposalPackage(lead);
            if (mounted.current) setProposalPackage(result);
        } catch(e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'AI提案パッケージの作成に失敗しました。', 'error');
        } finally {
            if(mounted.current) setIsGeneratingPackage(false);
        }
    };

    const handleSaveEstimate = async () => {
        if (!proposalPackage?.estimate || !lead || !currentUser) return;
        setIsSavingEstimate(true);
        try {
            // Calculate MQ metrics
            const totalAmount = proposalPackage.estimate.reduce((sum, item) => 
                sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
            );
            
            // Determine MQ classification based on total amount
            let mqClassification = 'A';
            if (totalAmount >= 1000000) {
                mqClassification = 'OK';
            } else if (totalAmount >= 500000) {
                mqClassification = 'A';
            } else if (totalAmount >= 200000) {
                mqClassification = 'B';
            } else {
                mqClassification = 'C';
            }

            // Create estimate with MQ analysis
            const estimateData = {
                customerName: lead.company,
                title: proposalPackage.proposal?.coverTitle || `【提案】${lead.company}`,
                items: proposalPackage.estimate,
                status: EstimateStatus.Draft,
                userId: currentUser.id,
                deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
                paymentTerms: '月末締め翌月末払い',
                deliveryMethod: '指定場所納品',
                notes: `AIによる自動生成見積です。内容は担当者にご確認ください。

MQ会計分析:
- 見積総額: ¥${totalAmount.toLocaleString()}
- MQ分類: ${mqClassification}
- リスク評価: ${mqClassification === 'OK' ? '低リスク' : mqClassification === 'A' ? '中リスク' : '高リスク'}

環境配慮:
当社の工場はクリーンエネルギーで運営されており、CO2排出量を削減することができます。
環境対策費：0円`,
                version: 1,
                // MQ analysis fields
                mqClassification: mqClassification,
                mqRiskLevel: mqClassification === 'OK' ? 'low' : mqClassification === 'A' ? 'medium' : 'high',
                mqAmount: totalAmount,
                mqGeneratedAt: new Date().toISOString(),
            };

            await onAddEstimate(estimateData);

            // 新規：見積もり管理に保存
            try {
                const { saveEstimateToManagement } = await import('../../services/estimateManagementService');
                await saveEstimateToManagement({
                    leadId: lead.id,
                    estimateData: {
                        title: estimateData.title,
                        items: estimateData.items.map(item => ({
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
                        validUntil: estimateData.deliveryDate,
                        notes: estimateData.notes,
                    },
                    customerInfo: {
                        name: lead.company,
                        email: lead.email || '',
                        phone: lead.phone || '',
                        address: lead.address || '',
                    }
                });
                addToast('見積もりを管理一覧に保存しました', 'success');
            } catch (mgmtError) {
                console.error('管理一覧保存エラー:', mgmtError);
                addToast('管理一覧への保存に失敗しました', 'error');
            }

            const serializedPackage = JSON.stringify(proposalPackage);
            await onSave(lead.id, { aiDraftProposal: serializedPackage });
            setFormData(prev => ({ ...prev, aiDraftProposal: serializedPackage }));
            
            // Show MQ analysis toast
            addToast(`見積を保存しました。MQ分類: ${mqClassification} (¥${totalAmount.toLocaleString()})`, 'success');
            
            // 見積もり作成後のコールバックを呼び出し
            if (onEstimateCreated) {
                onEstimateCreated();
            }
        } catch (e) {
            addToast(e instanceof Error ? `提案・見積保存エラー: ${e.message}`: '提案・見積の保存に失敗しました。', 'error');
        } finally {
            if(mounted.current) setIsSavingEstimate(false);
        }
    };

    const escapeHtml = (value: string): string =>
        value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const buildEstimateEmail = () => {
        const estimate = proposalPackage?.estimate ?? [];
        const subject = `【見積】${lead.company}`;
        const recipientName = lead.name ? `${lead.name} 様` : 'ご担当者様';
        const senderName = currentUser?.name ? `${currentUser.name}` : '担当者';
        const total = estimate.reduce((sum, item) => {
            const line = item.subtotal ?? item.price ?? Math.round((item.quantity || 0) * (item.unitPrice || 0));
            return sum + (Number.isFinite(line) ? line : 0);
        }, 0);

        const escapeHtml = (text: string) => text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const estimateRows = estimate
            .map(item => {
                const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
                const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
                const lineTotal = Math.round(qty * unitPrice);
                return `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(item.name || item.description || '')}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${qty.toLocaleString()}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">¥${unitPrice.toLocaleString()}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">¥${lineTotal.toLocaleString()}</td>
                  </tr>
                `;
            })
            .join('');

        // Generate tracking pixel
        const emailId = `estimate_${lead.id}_${Date.now()}`;
        const trackingPixel = `<img src="${window.location.origin}/api/tracking/pixel/${emailId}" width="1" height="1" style="display:none;" alt="" />`;

        const html = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; color: #111827;">
            <p>${escapeHtml(lead.company)} ${escapeHtml(recipientName)}</p>
            <p>お世話になっております。<br>文唱堂印刷の${escapeHtml(senderName)}です。</p>
            <p>ご依頼いただきました見積書を作成いたしましたので、<br>お送りいたします。</p>
            <table style="width:100%; border-collapse: collapse; margin: 12px 0; font-size: 14px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">品名</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">数量</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">単価</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">金額</th>
                </tr>
              </thead>
              <tbody>
                ${estimateRows}
                <tr style="background-color: #f9fafb; font-weight: bold;">
                  <td colspan="3" style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">合計</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #1f2937;">¥${total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin: 16px 0;">
              <strong>納期:</strong> 2週間<br>
              <strong>お支払条件:</strong> 月末締め翌月末払い
            </p>
            <p>ご不明な点がございましたら、お気軽にお問い合わせください。<br>よろしくお願いいたします。</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              文唱堂印刷株式会社<br>
              ${escapeHtml(senderName)}<br>
              〒101-0025 東京都千代田区神田佐久間町3-37<br>
              TEL：03-3851-0111　FAX：03-3861-1979<br>
              Mail: ${escapeHtml(currentUser?.email || '')}<br>
              Web: http://b-p.co.jp
            </p>
          </div>
          ${trackingPixel}
        `.trim();

        const body =
            `${lead.company} ${recipientName}\n\n` +
            `お世話になっております。\n文唱堂印刷の${senderName}です。\n\n` +
            `ご依頼いただきました見積書を作成いたしましたので、\nお送りいたします。\n\n` +
            `【見積内容】\n` +
            `${estimate.map(item => 
                `・${item.name || item.description}: ${item.quantity || 1}個 × ¥${(item.unitPrice || 0).toLocaleString()} = ¥${Math.round((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}`
            ).join('\n')}\n\n` +
            `【合計金額】\n¥${total.toLocaleString()}\n\n` +
            `納期: 2週間\nお支払条件: 月末締め翌月末払い\n\n` +
            `ご不明な点がございましたら、お気軽にお問い合わせください。\nよろしくお願いいたします。\n\n` +
            `------------------------------------\n` +
            `文唱堂印刷株式会社\n${senderName}\n` +
            `〒101-0025 東京都千代田区神田佐久間町3-37\n` +
            `TEL：03-3851-0111　FAX：03-3861-1979\n` +
            `Mail: ${currentUser?.email || ''}\n` +
            `Web: http://b-p.co.jp`;

        return { subject, html, body, emailId };
    };

    const handleSendEstimateEmail = async () => {
        if (!lead.email || !proposalPackage?.estimate || !currentUser) return;
        setIsSendingEstimateEmail(true);
        try {
            // Build email content
            const { subject, html, body, emailId } = buildEstimateEmail();
            
            // Send email through system
            const { sendEmail } = await import('../../services/emailService');
            const result = await sendEmail({
                to: [lead.email],
                subject,
                body,
                html,
            });
            
            // Save email tracking information
            const timestamp = new Date().toLocaleString('ja-JP');
            const logMessage = `[${timestamp}] 見積メールを送信しました (ID: ${result.id})。開封状況を監視中。`;
            const updatedInfo = `${logMessage}\n${formData.infoSalesActivity || ''}`.trim();

            try {
                await onSave(lead.id, {
                    estimateSentAt: new Date().toISOString(),
                    estimateSentBy: currentUser?.name || null,
                    infoSalesActivity: updatedInfo,
                    lastEmailId: emailId,
                });
            } catch (saveError) {
                // Fallback: at least persist the activity log even if the dedicated columns don't exist.
                await onSave(lead.id, { infoSalesActivity: updatedInfo });
                throw saveError;
            }

            setFormData(prev => ({
                ...prev,
                estimateSentAt: new Date().toISOString(),
                estimateSentBy: currentUser?.name || null,
                infoSalesActivity: updatedInfo,
                lastEmailId: emailId,
            }));
            
            addToast('見積メールを送信しました。開封状況を監視します。', 'success');
        } catch (e) {
            // Fallback to Gmail draft if system email fails
            addToast('システム送信に失敗したため、Gmail下書きを作成します。', 'warning');
            
            try {
                const { subject, body } = buildEstimateEmail();
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.open(gmailUrl, '_blank');
                
                const timestamp = new Date().toLocaleString('ja-JP');
                const logMessage = `[${timestamp}] Gmailの見積下書きを作成しました。`;
                const updatedInfo = `${logMessage}\n${formData.infoSalesActivity || ''}`.trim();

                await onSave(lead.id, { infoSalesActivity: updatedInfo });
                setFormData(prev => ({ ...prev, infoSalesActivity: updatedInfo }));
                
                addToast('Gmail下書きを作成しました。', 'success');
            } catch (fallbackError) {
                addToast('メール送信に失敗しました。', 'error');
            }
        } finally {
            if (mounted.current) setIsSendingEstimateEmail(false);
        }
    };
    const getNextAction = (): { label: string; disabled?: boolean; onClick?: () => void } => {
        const hasEstimateSent = Boolean(formData.estimateSentAt) || /\[[^\]]+\]\s*Gmailの見積下書きを作成しました。?/.test(formData.infoSalesActivity || '');
        const hasEstimateDraft = Boolean(formData.aiDraftProposal && String(formData.aiDraftProposal).trim());
        const hasReply = formData.status !== LeadStatus.Untouched || /\[[^\]]+\]\s*AI返信メールを作成しました。?/.test(formData.infoSalesActivity || '');
        const hasInvestigation = Boolean(formData.aiInvestigation && String(formData.aiInvestigation).trim());

        if (hasEstimateSent) {
            return { label: '下書き作成済', disabled: true };
        }
        if (hasEstimateDraft || proposalPackage?.estimate?.length) {
            return {
                label: 'Gmail下書き作成',
                onClick: () => {
                    setActiveAiTab('proposal');
                    handleSendEstimateEmail();
                },
            };
        }
        if (hasInvestigation) {
            return {
                label: '提案・見積作成',
                disabled: Boolean(isAIOff),
                onClick: () => {
                    setActiveAiTab('proposal');
                    handleCreateProposalPackage();
                },
            };
        }
        if (hasReply && !hasInvestigation) {
            return {
                label: '企業調査',
                disabled: Boolean(isAIOff),
                onClick: () => {
                    setActiveAiTab('investigation');
                    handleInvestigateCompany();
                },
            };
        }
        return {
            label: '返信を作成',
            disabled: Boolean(isAIOff),
            onClick: () => {
                setActiveAiTab('email');
                onGenerateReply(lead);
            },
        };
    };

    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
                {/* Header with Actions */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">リード詳細</h2>
                    <div className="flex items-center gap-3">
                        {/* Next Action Button */}
                        {(() => {
                            const action = getNextAction();
                            return (
                                <button
                                    type="button"
                                    onClick={action.onClick}
                                    disabled={Boolean(action.disabled) || isSendingEstimateEmail || isGeneratingPackage}
                                    className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                                >
                                    {(isSendingEstimateEmail || isGeneratingPackage) ? <Loader className="w-4 h-4 animate-spin" /> : null}
                                    {action.label}
                                </button>
                            );
                        })()}
                        
                        {/* Action Buttons */}
                        {isEditing ? (
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={handleDelete} 
                                    className="flex items-center gap-2 text-red-600 font-semibold py-2 px-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50"
                                >
                                    <Trash2 className="w-4 h-4"/>削除
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(false)} 
                                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-3 rounded-lg"
                                >
                                    キャンセル
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleSave} 
                                    disabled={isSaving} 
                                    className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg disabled:bg-slate-400"
                                >
                                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                    保存
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(true)} 
                                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-3 rounded-lg hover:bg-slate-200"
                                >
                                    <Pencil className="w-4 h-4"/>編集
                                </button>
                                {lead.email && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=【お問い合わせ】&body=${encodeURIComponent(`お問い合わせありがとうございます。\n\n${formData.message || ''}`)}`;
                                            window.open(gmailUrl, '_blank');
                                        }}
                                        className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-purple-700"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Gmailで確認
                                    </button>
                                )}
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg"
                                >
                                    閉じる
                                </button>
                            </div>
                        )}
                        
                        {/* Close Button */}
                        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-hidden">
                    <div className="h-full flex flex-col">
                        {/* Summary Section - Compact */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 mb-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">顧客情報</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{formData.company}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{formData.name}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">AI要約</div>
                                    <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                                        {leadSummary ? (
                                            <div>{leadSummary}</div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <button 
                                                    onClick={handleGenerateSummary}
                                                    disabled={isGeneratingSummary || isAIOff}
                                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded disabled:opacity-50"
                                                >
                                                    {isGeneratingSummary ? '生成中...' : 'AI要約'}
                                                </button>
                                                <span className="text-xs text-slate-500">問い合わせ内容は基本情報で確認</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">進捗</div>
                                    <div className="flex items-center gap-2">
                                        <LeadStatusBadge status={formData.status as LeadStatus} />
                                        <span className="text-xs text-slate-500">詳細は右側で確認</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    {/* Content Grid - Flex Layout */}
                        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
                            {/* Left Column - Basic Info */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 overflow-y-auto">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">基本情報</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">メールアドレス</label>
                                        <div className="mt-1 text-sm text-slate-900 dark:text-white">
                                            {isEditing ? (
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email || ''}
                                                    onChange={handleChange}
                                                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                                />
                                            ) : (
                                                <span>{formData.email || '-'}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">電話番号</label>
                                        <div className="mt-1 text-sm text-slate-900 dark:text-white">
                                            {isEditing ? (
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={formData.phone || ''}
                                                    onChange={handleChange}
                                                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                                />
                                            ) : (
                                                <span>{formData.phone || '-'}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">ステータス</label>
                                        <div className="mt-1 text-sm text-slate-900 dark:text-white">
                                            {isEditing ? (
                                                <select
                                                    name="status"
                                                    value={formData.status || ''}
                                                    onChange={handleChange}
                                                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                                >
                                                    {Object.values(LeadStatus).map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <LeadStatusBadge status={formData.status as LeadStatus} />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">対応者</label>
                                        <div className="mt-1 text-sm text-slate-900 dark:text-white">
                                            {formData.assignedTo || '-'}
                                        </div>
                                    </div>
                                    
                                    {/* Inquiry Content in Basic Info */}
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">問い合わせ内容</label>
                                        <div className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                            {isEditing ? (
                                                <textarea
                                                    name="message"
                                                    value={formData.message || ''}
                                                    onChange={handleChange}
                                                    rows={4}
                                                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                                                />
                                            ) : (
                                                <span>{formData.message || '問い合わせ内容はありません'}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Column - AI Assistant */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 overflow-y-auto">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">AIアシスタント</h3>
                                
                                {/* AI Tabs */}
                                <div className="flex gap-2 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('investigation')}
                                        className={`px-2 py-1 text-xs font-semibold rounded-md ${activeAiTab === 'investigation' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        企業調査
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('proposal')}
                                        className={`px-2 py-1 text-xs font-semibold rounded-md ${activeAiTab === 'proposal' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        提案・見積
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('email')}
                                        className={`px-2 py-1 text-xs font-semibold rounded-md ${activeAiTab === 'email' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        メール返信
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="space-y-3">
                                    {activeAiTab === 'investigation' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">企業調査</h4>
                                                <button onClick={handleInvestigateCompany} disabled={isInvestigating || isAIOff} className="text-xs font-semibold text-blue-600 flex items-center gap-1 disabled:opacity-50">
                                                    {isInvestigating ? <Loader className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                    {formData.aiInvestigation ? '再調査' : '調査'}
                                                </button>
                                            </div>
                                            {isInvestigating ? (
                                                <div className="text-xs text-slate-500">調査中...</div>
                                            ) : formData.aiInvestigation ? (
                                                renderInvestigationSummary(formData.aiInvestigation.summary)
                                            ) : (
                                                <p className="text-xs text-slate-500">企業情報を調査します</p>
                                            )}
                                        </div>
                                    )}

                                    {activeAiTab === 'proposal' && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">提案・見積作成</h4>
                                            <button onClick={handleCreateProposalPackage} disabled={isGeneratingPackage || isAIOff} className="w-full flex items-center justify-center gap-1 bg-blue-600 text-white font-semibold py-2 px-2 rounded-lg disabled:opacity-50 text-xs">
                                                {isGeneratingPackage ? <Loader className="w-3 h-3 animate-spin"/> : <Lightbulb className="w-3 h-3" />}
                                                AIで作成
                                            </button>
                                            {isGeneratingPackage && <p className="text-xs text-slate-500 text-center mt-1">作成中...</p>}
                                            {proposalPackage && (
                                                <div className="space-y-2">
                                                    {!proposalPackage.isSalesLead ? (
                                                        <p className="p-2 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                                                            営業メールの可能性が高いです
                                                        </p>
                                                    ) : (
                                                        <>
                                                            {proposalPackage.proposal && (
                                                                <div className="p-2 bg-green-50 dark:bg-green-900/50 rounded text-xs">
                                                                    提案書が生成されました
                                                                </div>
                                                            )}
                                                            {proposalPackage.estimate && (
                                                                <div className="p-2 bg-green-50 dark:bg-green-900/50 rounded text-xs">
                                                                    見積: {proposalPackage.estimate.length}項目
                                                                </div>
                                                            )}
                                                            
                                                            {/* Estimate Preview */}
                                                            {proposalPackage.estimate && (
                                                                <div className="border border-slate-200 dark:border-slate-700 rounded p-2 bg-white dark:bg-slate-800">
                                                                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-2">見積プレビュー</h5>
                                                                    <div className="space-y-1 text-xs">
                                                                        <div className="grid grid-cols-3 gap-1 font-semibold text-slate-600 dark:text-slate-400 border-b pb-1">
                                                                            <div>品名</div>
                                                                            <div className="text-right">数量</div>
                                                                            <div className="text-right">金額</div>
                                                                        </div>
                                                                        {proposalPackage.estimate.slice(0, 5).map((item, idx) => (
                                                                            <div key={idx} className="grid grid-cols-3 gap-1 py-1 border-b border-slate-100 dark:border-slate-700">
                                                                                <div className="text-slate-700 dark:text-slate-300 truncate">{item.name || item.description}</div>
                                                                                <div className="text-right text-slate-700 dark:text-slate-300">{item.quantity || 1}</div>
                                                                                <div className="text-right text-slate-700 dark:text-slate-300">
                                                                                    ¥{Math.round((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        <div className="grid grid-cols-3 gap-1 pt-1 font-semibold">
                                                                            <div colSpan={2} className="text-right">合計:</div>
                                                                            <div className="text-right text-blue-600">
                                                                                ¥{proposalPackage.estimate.reduce((sum, item) => 
                                                                                    sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
                                                                                ).toLocaleString()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* MQ Analysis Preview */}
                                                                    <div className="mt-3 p-2 bg-slate-100 dark:bg-slate-700 rounded">
                                                                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">MQ会計分析</div>
                                                                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                                                            {(() => {
                                                                                const totalAmount = proposalPackage.estimate.reduce((sum, item) => 
                                                                                    sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
                                                                                );
                                                                                let mqClassification = 'A';
                                                                                if (totalAmount >= 1000000) {
                                                                                    mqClassification = 'OK';
                                                                                } else if (totalAmount >= 500000) {
                                                                                    mqClassification = 'A';
                                                                                } else if (totalAmount >= 200000) {
                                                                                    mqClassification = 'B';
                                                                                } else {
                                                                                    mqClassification = 'C';
                                                                                }
                                                                                
                                                                                return (
                                                                                    <>
                                                                                        <div>見積総額: ¥{totalAmount.toLocaleString()}</div>
                                                                                        <div>MQ分類: <span className={`font-semibold ${
                                                                                            mqClassification === 'OK' ? 'text-green-600' : 
                                                                                            mqClassification === 'A' ? 'text-blue-600' : 
                                                                                            mqClassification === 'B' ? 'text-yellow-600' : 
                                                                                            'text-red-600'
                                                                                        }`}>{mqClassification}</span></div>
                                                                                        <div>リスク: {mqClassification === 'OK' ? '低' : mqClassification === 'A' ? '中' : '高'}</div>
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={handleSaveEstimate} 
                                                                    disabled={isSavingEstimate}
                                                                    className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white font-semibold py-1 px-2 rounded disabled:opacity-50 text-xs"
                                                                >
                                                                    {isSavingEstimate ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                                    保存
                                                                </button>
                                                                <button 
                                                                    onClick={handleSendEstimateEmail} 
                                                                    disabled={isSendingEstimateEmail || !lead.email}
                                                                    className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white font-semibold py-1 px-2 rounded disabled:opacity-50 text-xs"
                                                                >
                                                                    {isSendingEstimateEmail ? <Loader className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                                                    Gmail
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeAiTab === 'email' && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">メール返信</h4>
                                            
                                            {/* Email Reply Preview */}
                                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                    {(() => {
                                                        // Check if there's a generated reply in the activity log
                                                        const replyMatch = (formData.infoSalesActivity || '').match(/\[([^\]]+)\]\s*AI返信メールを作成しました。?\s*\n([\s\S]*?)(?=\n\[|\n*$|$)/);
                                                        if (replyMatch && replyMatch[2]) {
                                                            return replyMatch[2].trim();
                                                        }
                                                        
                                                        // Enhanced default template with strategic structure
                                                        const recipientName = lead.name ? `${lead.name} 様` : 'ご担当者様';
                                                        const senderName = currentUser?.name ? `${currentUser.name}` : '担当者';
                                                        
                                                        return `${lead.company} ${recipientName}

お世話になっております。
文唱堂印刷の${senderName}です。

お問い合わせいただきありがとうございます。
ご依頼内容を拝見いたしました。

【ご提案】
貴社のニーズに最適な印刷ソリューションをご提案いたします。
詳細なお見積もりを別途お送りいたします。

【次のステップ】
1. 見積書のご確認
2. 仕様の最終調整
3. ご発注

ご多忙中とは存じますが、ご確認のほどよろしくお願いいたします。

------------------------------------
文唱堂印刷株式会社
${senderName}
〒101-0025 東京都千代田区神田佐久間町3-37
TEL：03-3851-0111　FAX：03-3861-1979
Mail: ${currentUser?.email || ''}
Web: http://b-p.co.jp`;
                                                    })()}
                                                </div>
                                                
                                                {/* Strategic Email Actions */}
                                                <div className="mt-3 space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                onGenerateReply(lead);
                                                            }}
                                                            disabled={isAIOff}
                                                            className="flex items-center justify-center gap-1 bg-purple-100 text-purple-700 font-semibold py-2 px-2 rounded disabled:opacity-50 text-xs"
                                                        >
                                                            <Mail className="w-3 h-3"/> AI返信作成
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=【お問い合わせ】&body=${encodeURIComponent(`お問い合わせありがとうございます。\n\n${formData.message || ''}`)}`;
                                                                window.open(gmailUrl, '_blank');
                                                            }}
                                                            className="flex items-center justify-center gap-1 bg-blue-100 text-blue-700 font-semibold py-2 px-2 rounded text-xs"
                                                        >
                                                            <Mail className="w-3 h-3"/> Gmail作成
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Email Strategy Tips */}
                                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                                                        <div className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">📧 メール戦略</div>
                                                        <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                                                            <div>• 最初は感謝と確認を重視</div>
                                                            <div>• 具体的な仕様をヒアリング</div>
                                                            <div>• 見積提出までのステップを明示</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Details */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 overflow-y-auto">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">詳細情報</h3>
                                <div className="space-y-3">
                                    {/* Email Status */}
                                    {formData.lastEmailId && (
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">メール状況</label>
                                            <div className="bg-white dark:bg-slate-800 rounded p-2">
                                                <EmailStatusIndicator 
                                                    emailId={formData.lastEmailId}
                                                    sentAt={formData.estimateSentAt || ''}
                                                    recipientEmail={formData.email || ''}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">活動履歴</label>
                                        <div className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                            {isEditing ? (
                                                <textarea
                                                    name="infoSalesActivity"
                                                    value={formData.infoSalesActivity || ''}
                                                    onChange={handleChange}
                                                    rows={6}
                                                    className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                                                />
                                            ) : (
                                                <span>{formData.infoSalesActivity || '活動履歴はありません'}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">見積送信者</label>
                                            <div className="mt-1 text-xs text-slate-900 dark:text-white">
                                                {formData.estimateSentBy || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">見積送信日時</label>
                                            <div className="mt-1 text-xs text-slate-900 dark:text-white">
                                                {(() => {
                                                    if (formData.estimateSentAt) return formatDateTime(formData.estimateSentAt);
                                                    const raw = formData.infoSalesActivity || '';
                                                    const match = raw.match(/\[([^\]]+)\]\s*Gmailの見積下書きを作成しました。?/);
                                                    return match?.[1] ?? '-';
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                        </div>
        </div>
        
        {/* Hidden divs for PDF generation */}
        { (proposalPackage?.proposal) &&
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {proposalPackage?.proposal && <ProposalPdfContent content={proposalPackage.proposal} lead={lead} />}
            </div>
        }
      </>
    );
};
