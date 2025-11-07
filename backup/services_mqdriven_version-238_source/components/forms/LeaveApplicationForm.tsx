import React, { useState, useEffect, useMemo } from 'react';
import { submitApplication } from '../../services/dataService';
import { Loader, Sparkles, AlertTriangle } from '../Icons';
import { User } from '../../types';
import ChatApplicationModal from '../ChatApplicationModal';
import ApprovalRouteSelector from './ApprovalRouteSelector';

interface LeaveApplicationFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
}

const LeaveApplicationForm: React.FC<LeaveApplicationFormProps> = ({ onSuccess, applicationCodeId, currentUser, isAIOff, isLoading, error: formLoadError }) => {
    const [formData, setFormData] = useState({
        leaveType: '有給休暇',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: '',
    });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    
    const isDisabled = isSubmitting || isLoading || !!formLoadError;

     const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!approvalRouteId) {
            setError('承認ルートを選択してください。');
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。再度ログインしてください。');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication({
                applicationCodeId: applicationCodeId,
                formData,
                approvalRouteId: approvalRouteId
            }, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('申請の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <>
            <div className="relative">
                {(isLoading || formLoadError) && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8">
                        {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" />}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">休暇申請フォーム</h2>
                        <button 
                            type="button" 
                            onClick={() => setIsChatModalOpen(true)} 
                            className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isAIOff || isDisabled}
                        >
                            <Sparkles className="w-5 h-5" />
                            <span>AIチャットで申請</span>
                        </button>
                    </div>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、AIチャットは利用できません。</p>}
                    
                    {formLoadError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">フォーム読み込みエラー</p>
                            <p>{formLoadError}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="leaveType" className={labelClass}>休暇の種類 *</label>
                        <select id="leaveType" name="leaveType" value={formData.leaveType} onChange={handleChange} className={inputClass} required disabled={isDisabled}>
                            <option>有給休暇</option>
                            <option>午前半休</option>
                            <option>午後半休</option>
                            <option>欠勤</option>
                            <option>その他</option>
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="startDate" className={labelClass}>開始日 *</label>
                            <input type="date" id="startDate" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass} required disabled={isDisabled} autoComplete="on" />
                        </div>
                        <div>
                            <label htmlFor="endDate" className={labelClass}>終了日 *</label>
                            <input type="date" id="endDate" name="endDate" value={formData.endDate} onChange={handleChange} className={inputClass} required disabled={isDisabled} autoComplete="on" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="reason" className={labelClass}>理由 *</label>
                        <textarea id="reason" name="reason" rows={4} value={formData.reason} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="例: 私用のため" autoComplete="on" />
                    </div>
                    
                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                    {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
                    
                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled}>下書き保存</button>
                        <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled}>
                            {isSubmitting ? <Loader className="w-5 h-5 animate-spin"/> : '申請を送信する'}
                        </button>
                    </div>
                </form>
            </div>
            {isChatModalOpen && (
                <ChatApplicationModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    onSuccess={() => {
                        setIsChatModalOpen(false);
                        onSuccess();
                    }}
                    currentUser={currentUser}
                    initialMessage="休暇を申請したいです。"
                    isAIOff={isAIOff}
                />
            )}
        </>
    );
};

export default LeaveApplicationForm;