import React, { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser } from '../../types';
import { X, Pencil, Mail, CheckCircle, Lightbulb, Search } from '../Icons';

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
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
    isOpen,
    onClose,
    lead,
    onSave,
    onDelete,
    addToast,
    requestConfirmation,
    currentUser,
    onGenerateReply,
    isAIOff
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [activeAiTab, setActiveAiTab] = useState<'email' | 'proposal' | 'investigation'>('email');

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !lead) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
                    {/* Header with Actions */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">リード詳細</h2>
                            {/* Status Badges */}
                            <div className="flex gap-2">
                                {lead.status === LeadStatus.Untouched && (
                                    <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">新規</span>
                                )}
                                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">企業調査完了</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Action Buttons */}
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-3 rounded-lg hover:bg-slate-200"
                            >
                                <Pencil className="w-4 h-4" />編集
                            </button>
                            {lead.email && (
                                <button
                                    type="button"
                                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-3 rounded-lg hover:bg-slate-200"
                                >
                                    <Mail className="w-4 h-4" />メール確認
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 font-semibold py-2 px-3 rounded-lg hover:bg-slate-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content - Two Column Layout */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Column - Customer Content */}
                        <div className="w-1/2 p-6 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">顧客からの内容</h3>

                            {/* Company Information */}
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                                <div className="font-bold text-slate-900 dark:text-white mb-2">{lead.company}</div>
                                <div className="text-slate-700 dark:text-slate-300 mb-1">{lead.name}</div>
                                <div className="text-slate-600 dark:text-slate-400 text-sm">
                                    {lead.email} / {lead.phone}
                                </div>
                            </div>

                            {/* Inquiry Content */}
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">お問い合わせ内容</h4>
                                <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {lead.message}
                                </div>
                            </div>

                            {/* Activity History */}
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">活動履歴</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-4 h-4 text-slate-500" />
                                        <span className="text-slate-700 dark:text-slate-300">メール受信</span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {lead.createdAt ? new Date(lead.createdAt).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).replace(/\//g, '/') : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Search className="w-4 h-4 text-slate-500" />
                                        <span className="text-slate-700 dark:text-slate-300">企業調査完了</span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {new Date().toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).replace(/\//g, '/')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - AI Proposal Check */}
                        <div className="w-1/2 p-6 overflow-y-auto">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">AI提案をチェック</h3>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                                <button
                                    onClick={() => setActiveAiTab('email')}
                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeAiTab === 'email'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    返信案
                                </button>
                                <button
                                    onClick={() => setActiveAiTab('proposal')}
                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeAiTab === 'proposal'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    見積もり案
                                </button>
                                <button
                                    onClick={() => setActiveAiTab('investigation')}
                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeAiTab === 'investigation'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    提案
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                                {activeAiTab === 'email' && (
                                    <div>
                                        <div className="mb-4">
                                            <div className="font-semibold text-slate-900 dark:text-white mb-2">
                                                {lead.company} {lead.name}様
                                            </div>
                                            <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                                文唱堂印刷の石嶋洋平です。

                                                お問い合わせありがとうございます。
                                                経営計画書の印刷ご相談、承知いたしました。

                                                ご提示いただいた仕様について、
                                                ・レイアウトデザイン～現物納品までの一貫対応
                                                ・サンプル納品と完成品会場配送
                                                いずれも可能でございます。

                                                詳細なお見積もりを提出させていただきますので、
                                                ご都合のよろしい日程でオンライン面談のご調整をお願いいたします。
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3">
                                            <button className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">
                                                <CheckCircle className="w-4 h-4" />
                                                この内容を確認
                                            </button>
                                            <button className="flex items-center gap-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                                                次へ進む
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeAiTab === 'proposal' && (
                                    <div className="text-center py-8">
                                        <Lightbulb className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <p className="text-slate-500 dark:text-slate-400">見積もり案の準備中...</p>
                                    </div>
                                )}

                                {activeAiTab === 'investigation' && (
                                    <div className="text-center py-8">
                                        <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <p className="text-slate-500 dark:text-slate-400">企業調査の準備中...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LeadDetailModal;
