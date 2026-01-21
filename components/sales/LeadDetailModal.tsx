import React, { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser, LeadScore, CompanyInvestigation, CustomProposalContent, LeadProposalPackage, EstimateStatus } from '../../types';
import { X, Save, Loader, Pencil, Trash2, Mail, CheckCircle, Lightbulb, Search, FileText } from '../Icons';
import LeadStatusBadge from './LeadStatusBadge';
import { INQUIRY_TYPES } from '../../constants';
import LeadScoreBadge from '../ui/LeadScoreBadge';
import { createLeadProposalPackage, investigateLeadCompany } from '../../services/geminiService';
import ProposalPdfContent from './ProposalPdfContent';
import { formatDateTime, formatJPY, generateMultipagePdf } from '../../utils';
import InvestigationReportPdfContent from '../reports/InvestigationReportPdfContent';
import { sendEmail } from '../../services/emailService';

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

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ isOpen, onClose, lead, onSave, onDelete, addToast, requestConfirmation, currentUser, onGenerateReply, isAIOff, onAddEstimate, initialAiTab }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isInvestigating, setIsInvestigating] = useState(false);
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
    const [proposalPackage, setProposalPackage] = useState<LeadProposalPackage | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingEstimate, setIsSavingEstimate] = useState(false);
    const [isSendingEstimateEmail, setIsSendingEstimateEmail] = useState(false);
    const [activeAiTab, setActiveAiTab] = useState<'investigation' | 'proposal' | 'email'>(initialAiTab ?? 'investigation');
    
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    
    useEffect(() => {
        if (lead) {
            setFormData({ ...lead });
            setIsEditing(false);
            if (lead.aiDraftProposal) {
                try {
                    setProposalPackage(JSON.parse(lead.aiDraftProposal));
                } catch (error) {
                    console.warn('Failed to parse saved proposal package', error);
                    setProposalPackage(null);
                }
            } else {
                setProposalPackage(null);
            }
        }
    }, [lead]);

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
            await onAddEstimate({
                customerName: lead.company,
                title: proposalPackage.proposal?.coverTitle || `【提案】${lead.company}`,
                items: proposalPackage.estimate,
                status: EstimateStatus.Draft,
                userId: currentUser.id,
                deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
                paymentTerms: '月末締め翌月末払い',
                deliveryMethod: '指定場所納品',
                notes: 'AIによる自動生成見積です。内容は担当者にご確認ください。',
                version: 1,
            });

            const serializedPackage = JSON.stringify(proposalPackage);
            await onSave(lead.id, { aiDraftProposal: serializedPackage });
            setFormData(prev => ({ ...prev, aiDraftProposal: serializedPackage }));
            addToast('提案書と見積もりを保存しました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? `見積保存エラー: ${e.message}`: '見積の保存に失敗しました。', 'error');
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

        const rows = estimate
            .map(item => {
                const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
                const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
                const line = item.subtotal ?? item.price ?? Math.round(qty * unitPrice);
                return `
                  <tr>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.division || '')}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.content || '')}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(qty))}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.unit || '')}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatJPY(unitPrice))}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatJPY(line))}</td>
                  </tr>
                `;
            })
            .join('');

        const html = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; color: #111827;">
            <p>${escapeHtml(lead.company)} ${escapeHtml(recipientName)}</p>
            <p>お世話になっております。${escapeHtml(senderName)}です。</p>
            <p>概算のお見積りをお送りします。内容のご確認をお願いいたします。</p>
            <table style="width:100%; border-collapse: collapse; margin: 12px 0; font-size: 14px;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111827;">区分</th>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111827;">内容</th>
                  <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">数量</th>
                  <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #111827;">単位</th>
                  <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">単価</th>
                  <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #111827;">金額</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" style="padding:8px;border-top:2px solid #111827;text-align:right;font-weight:700;">合計</td>
                  <td style="padding:8px;border-top:2px solid #111827;text-align:right;font-weight:700;">${escapeHtml(formatJPY(total))}</td>
                </tr>
              </tfoot>
            </table>
            <p style="color:#6b7280;font-size:12px;">※本メールはシステムから送信されています。</p>
          </div>
        `.trim();

        const body =
            `${lead.company} ${recipientName}\n\n` +
            `お世話になっております。${senderName}です。\n` +
            `概算のお見積りをお送りします。内容のご確認をお願いいたします。\n\n` +
            `合計: ${formatJPY(total)}\n\n` +
            `※本メールはシステムから送信されています。`;

        return { subject, html, body };
    };

    const handleSendEstimateEmail = async () => {
        if (!lead.email) {
            addToast('送信先メールアドレスが登録されていません。', 'error');
            return;
        }
        if (!proposalPackage?.estimate || proposalPackage.estimate.length === 0) {
            addToast('送信する見積がありません。先に「AI提案パッケージ作成」してください。', 'error');
            return;
        }
        setIsSendingEstimateEmail(true);
        try {
            const { subject, html, body } = buildEstimateEmail();
            const result = await sendEmail({ to: [lead.email], subject, html, body, mode: 'scheduled' });
            const sentAt = result?.sentAt || new Date().toISOString();

            const timestamp = new Date(sentAt).toLocaleString('ja-JP');
            const logMessage = `[${timestamp}] 見積メールを送信しました。`;
            const updatedInfo = `${logMessage}\n${formData.infoSalesActivity || ''}`.trim();

            try {
                await onSave(lead.id, {
                    estimateSentAt: sentAt,
                    estimateSentBy: currentUser?.name || null,
                    infoSalesActivity: updatedInfo,
                });
            } catch (saveError) {
                // Fallback: at least persist the activity log even if the dedicated columns don't exist.
                await onSave(lead.id, { infoSalesActivity: updatedInfo });
                throw saveError;
            }

            setFormData(prev => ({
                ...prev,
                estimateSentAt: sentAt,
                estimateSentBy: currentUser?.name || null,
                infoSalesActivity: updatedInfo,
            }));
            addToast('見積メールを送信しました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? `見積送信エラー: ${e.message}` : '見積メールの送信に失敗しました。', 'error');
        } finally {
            if (mounted.current) setIsSendingEstimateEmail(false);
        }
    };

    const getNextAction = (): { label: string; disabled?: boolean; onClick?: () => void } => {
        const hasEstimateSent = Boolean(formData.estimateSentAt) || /\[[^\]]+\]\s*見積メールを送信しました。?/.test(formData.infoSalesActivity || '');
        const hasEstimateDraft = Boolean(formData.aiDraftProposal && String(formData.aiDraftProposal).trim());
        const hasReply = formData.status !== LeadStatus.Untouched || /\[[^\]]+\]\s*AI返信メールを作成しました。?/.test(formData.infoSalesActivity || '');

        if (hasEstimateSent) {
            return { label: '完了', disabled: true };
        }
        if (hasEstimateDraft || proposalPackage?.estimate?.length) {
            return {
                label: '見積をメール送信',
                onClick: () => {
                    setActiveAiTab('proposal');
                    handleSendEstimateEmail();
                },
            };
        }
        if (hasReply) {
            return {
                label: '見積を作成',
                disabled: Boolean(isAIOff),
                onClick: () => {
                    setActiveAiTab('proposal');
                    handleCreateProposalPackage();
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">リード詳細</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="会社名" name="company" value={formData.company} isEditing={isEditing} onChange={handleChange} />
                                <Field label="担当者名" name="name" value={formData.name} isEditing={isEditing} onChange={handleChange} />
                                <Field label="メールアドレス" name="email" type="email" value={formData.email} isEditing={isEditing} onChange={handleChange} />
                                <Field label="電話番号" name="phone" value={formData.phone} isEditing={isEditing} onChange={handleChange} />
                                <Field label="ステータス" name="status" value={formData.status} isEditing={isEditing} onChange={handleChange} type="select" options={Object.values(LeadStatus)} />
                                <Field label="ソース" name="source" value={formData.source} isEditing={isEditing} onChange={handleChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">対応者</div>
                                    <div className="mt-1 text-base text-slate-900 dark:text-white min-h-[44px] flex items-center">
                                        {formData.assignedTo || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">対応日時</div>
                                    <div className="mt-1 text-base text-slate-900 dark:text-white min-h-[44px] flex items-center">
                                        {formData.statusUpdatedAt ? formatDateTime(formData.statusUpdatedAt) : '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">見積送信者</div>
                                    <div className="mt-1 text-base text-slate-900 dark:text-white min-h-[44px] flex items-center">
                                        {formData.estimateSentBy || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">見積送信日時</div>
                                    <div className="mt-1 text-base text-slate-900 dark:text-white min-h-[44px] flex items-center">
                                        {(() => {
                                            if (formData.estimateSentAt) return formatDateTime(formData.estimateSentAt);
                                            const raw = formData.infoSalesActivity || '';
                                            const match = raw.match(/\[([^\]]+)\]\s*見積メールを送信しました。?/);
                                            return match?.[1] ?? '-';
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <Field label="問い合わせ内容" name="message" value={formData.message} isEditing={isEditing} onChange={handleChange} type="textarea" />
                            <Field label="活動履歴" name="infoSalesActivity" value={formData.infoSalesActivity} isEditing={isEditing} onChange={handleChange} type="textarea" />
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <DetailSection title="次のアクション" className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                                {(() => {
                                    const action = getNextAction();
                                    return (
                                        <button
                                            type="button"
                                            onClick={action.onClick}
                                            disabled={Boolean(action.disabled) || isSendingEstimateEmail || isGeneratingPackage}
                                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                                        >
                                            {(isSendingEstimateEmail || isGeneratingPackage) ? <Loader className="w-5 h-5 animate-spin" /> : null}
                                            {action.label}
                                        </button>
                                    );
                                })()}
                                {isAIOff && (
                                    <p className="text-xs text-slate-500 mt-2">※AIが無効の場合、返信/見積作成は利用できません（見積のメール送信は利用可能です）。</p>
                                )}
                            </DetailSection>
                            <DetailSection title="AIアシスタント" className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                                {/* AIタブ切り替え */}
                                <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('investigation')}
                                        className={`px-3 py-1 text-sm font-semibold rounded-md ${activeAiTab === 'investigation' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        企業調査
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('proposal')}
                                        className={`px-3 py-1 text-sm font-semibold rounded-md ${activeAiTab === 'proposal' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        提案パッケージ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAiTab('email')}
                                        className={`px-3 py-1 text-sm font-semibold rounded-md ${activeAiTab === 'email' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                    >
                                        メール返信
                                    </button>
                                </div>

                                {/* 企業調査タブ */}
                                {activeAiTab === 'investigation' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-slate-800 dark:text-slate-100">企業調査</h4>
                                            <button onClick={handleInvestigateCompany} disabled={isInvestigating || isAIOff} className="text-sm font-semibold text-blue-600 flex items-center gap-2 disabled:opacity-50">
                                                {isInvestigating ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                {formData.aiInvestigation ? '再調査' : 'AIで企業調査'}
                                            </button>
                                        </div>
                                        {isInvestigating ? (
                                            <div className="text-sm text-slate-500">Web検索を用いて調査中...</div>
                                        ) : formData.aiInvestigation ? (
                                            renderInvestigationSummary(formData.aiInvestigation.summary)
                                        ) : (
                                            <p className="text-sm text-slate-500">企業の基本情報や最新ニュースを調査します。</p>
                                        )}
                                    </div>
                                )}

                                {/* 提案パッケージタブ */}
                                {activeAiTab === 'proposal' && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">提案パッケージ</h4>
                                        <button onClick={handleCreateProposalPackage} disabled={isGeneratingPackage || isAIOff} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                                            {isGeneratingPackage ? <Loader className="w-5 h-5 animate-spin"/> : <Lightbulb className="w-5 h-5" />}
                                            AI提案パッケージ作成
                                        </button>
                                        {isGeneratingPackage && <p className="text-sm text-slate-500 text-center mt-2">AIが提案書と見積を作成中です...</p>}
                                        {proposalPackage && (
                                            <div className="mt-4 space-y-4">
                                                {!proposalPackage.isSalesLead ? (
                                                    <p className="p-3 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
                                                        AI分析結果: 営業メールの可能性が高いです (理由: {proposalPackage.reason})
                                                    </p>
                                                ) : (
                                                    <>
                                                        {proposalPackage.proposal && (
                                                            <div className="p-3 bg-green-50 dark:bg-green-900/50 rounded-md text-sm">
                                                                提案書: 「{proposalPackage.proposal.coverTitle}」が生成されました。
                                                            </div>
                                                        )}
                                                        {proposalPackage.estimate && (
                                                            <div className="p-3 bg-green-50 dark:bg-green-900/50 rounded-md text-sm">
                                                                見積: {proposalPackage.estimate.length}項目が生成されました。
                                                            </div>
                                                        )}
                                                        
                                                        {/* 見積内容プレビュー */}
                                                        {proposalPackage.estimate && (
                                                            <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                                                                <h5 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">見積内容プレビュー</h5>
                                                                <div className="space-y-2 text-sm">
                                                                    <div className="grid grid-cols-3 gap-2 font-semibold text-slate-600 dark:text-slate-400 border-b pb-2">
                                                                        <div>品名</div>
                                                                        <div className="text-right">数量</div>
                                                                        <div className="text-right">金額</div>
                                                                    </div>
                                                                    {proposalPackage.estimate.map((item, idx) => (
                                                                        <div key={idx} className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100 dark:border-slate-700">
                                                                            <div className="text-slate-700 dark:text-slate-300">{item.name || item.description}</div>
                                                                            <div className="text-right text-slate-700 dark:text-slate-300">{item.quantity || 1}</div>
                                                                            <div className="text-right text-slate-700 dark:text-slate-300">
                                                                                ¥{Math.round((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    <div className="grid grid-cols-3 gap-2 pt-2 font-semibold">
                                                                        <div colSpan={2} className="text-right">合計:</div>
                                                                        <div className="text-right text-blue-600">
                                                                            ¥{proposalPackage.estimate.reduce((sum, item) => 
                                                                                sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
                                                                            ).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* メール内容プレビュー */}
                                                        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                                                            <h5 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">メール内容プレビュー</h5>
                                                            <div className="space-y-3 text-sm">
                                                                <div>
                                                                    <span className="font-semibold text-slate-600 dark:text-slate-400">件名:</span>
                                                                    <div className="mt-1 text-slate-700 dark:text-slate-300">
                                                                        【見積】{lead.company}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-slate-600 dark:text-slate-400">本文:</span>
                                                                    <div className="mt-1 text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                                        {(() => {
                                                                            const recipientName = lead.name ? `${lead.name} 様` : 'ご担当者様';
                                                                            const senderName = currentUser?.name ? `${currentUser.name}` : '担当者';
                                                                            const total = proposalPackage.estimate.reduce((sum, item) => 
                                                                                sum + Math.round((item.quantity || 1) * (item.unitPrice || 0)), 0
                                                                            );
                                                                            
                                                                            return `${recipientName}

お世話になっております。
文唱堂印刷の${senderName}です。

ご依頼いただきました見積書を作成いたしましたので、
お送りいたします。

【見積内容】
${proposalPackage.estimate.map(item => 
    `・${item.name || item.description}: ${item.quantity || 1}個 × ¥${(item.unitPrice || 0).toLocaleString()} = ¥${Math.round((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}`
).join('\n')}

【合計金額】
¥${total.toLocaleString()}

納期: 2週間
お支払条件: 月末締め翌月末払い

ご不明な点がございましたら、お気軽にお問い合わせください。
よろしくお願いいたします。

------------------------------------
文唱堂印刷株式会社
${senderName}
〒101-0025 東京都千代田区神田佐久間町3-37
TEL：03-3851-0111　FAX：03-3861-1979
Mail: ${currentUser?.email || ''}
Web: http://b-p.co.jp`;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 mt-4">
                                                            <button 
                                                                onClick={handleSaveEstimate} 
                                                                disabled={isSavingEstimate}
                                                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                                                            >
                                                                {isSavingEstimate ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                                見積を保存
                                                            </button>
                                                            <button 
                                                                onClick={handleSendEstimateEmail} 
                                                                disabled={isSendingEstimateEmail || !lead.email}
                                                                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                                                            >
                                                                {isSendingEstimateEmail ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                                                メール送信
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* メール返信タブ */}
                                {activeAiTab === 'email' && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">メール返信</h4>
                                        {/* FIX: Wrap onGenerateReply in an arrow function to match onClick's expected signature. */}
                                        <button onClick={() => onGenerateReply(lead)} disabled={isAIOff} className="w-full flex items-center justify-center gap-2 bg-purple-100 text-purple-700 font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                                            <Mail className="w-4 h-4"/> AIで返信作成
                                        </button>
                                    </div>
                                )}
                            </DetailSection>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    {/* FIX: Call the newly defined handleDelete function. */}
                    <div>{isEditing && <button type="button" onClick={handleDelete} className="flex items-center gap-2 text-red-600 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50"><Trash2 className="w-4 h-4"/>削除</button>}</div>
                    <div className="flex gap-4">
                        {!isEditing ? (
                            <>
                                <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200"><Pencil className="w-4 h-4"/>編集</button>
                                <button type="button" onClick={onClose} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">閉じる</button>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={() => setIsEditing(false)} className="bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                                <button type="button" onClick={handleSave} disabled={isSaving} className="w-32 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-400">
                                    {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" />保存</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Hidden divs for PDF generation */}
        { (isGeneratingPdf || proposalPackage?.proposal) &&
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                {proposalPackage?.proposal && <ProposalPdfContent content={proposalPackage.proposal} lead={lead} />}
            </div>
        }
      </>
    );
};
