import React, { useState, useEffect, useRef } from 'react';
import { Job, JobStatus, AISuggestions, InvoiceStatus, ManufacturingStatus } from '../types';
import { PAPER_TYPES, FINISHING_OPTIONS } from '../constants';
import { suggestJobParameters } from '../services/geminiService';
import { Sparkles, Loader, X } from './Icons';
import { formatJPY } from '../utils';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddJob: (job: Omit<Job, 'id' | 'createdAt' | 'jobNumber'>) => Promise<void>;
}

const initialFormState = {
  clientName: '',
  title: '',
  quantity: 1000,
  paperType: PAPER_TYPES[0],
  finishing: FINISHING_OPTIONS[0],
  details: '',
  dueDate: '',
  price: 0,
  variableCost: 0,
};

const CreateJobModal: React.FC<CreateJobModalProps> = ({ isOpen, onClose, onAddJob }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setAiPrompt('');
      setError('');
      setIsAiLoading(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['quantity', 'price', 'variableCost'].includes(name) ? parseInt(value) || 0 : value }));
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) {
        setError("AIへの依頼内容を入力してください。");
        return;
    }
    setIsAiLoading(true);
    setError('');
    try {
        const suggestions = await suggestJobParameters(aiPrompt, PAPER_TYPES, FINISHING_OPTIONS);
        if (mounted.current) {
            setFormData(prev => ({
                ...prev,
                title: suggestions.title,
                quantity: suggestions.quantity,
                paperType: suggestions.paperType,
                finishing: suggestions.finishing,
                details: suggestions.details,
                price: suggestions.price,
                variableCost: suggestions.variableCost,
            }));
        }
    } catch (e) {
        if (mounted.current) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError("AIによる提案の生成中に不明なエラーが発生しました。");
            }
        }
    } finally {
        if (mounted.current) {
            setIsAiLoading(false);
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.title || !formData.dueDate || formData.price <= 0) {
      setError("クライアント名、案件タイトル、納期、売上高は必須項目です。");
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
        const newJob: Omit<Job, 'id' | 'createdAt' | 'jobNumber'> = {
          status: JobStatus.Pending,
          invoiceStatus: InvoiceStatus.Uninvoiced,
          manufacturingStatus: ManufacturingStatus.OrderReceived,
          ...formData,
        };
        await onAddJob(newJob);
        if (mounted.current) {
            onClose();
        }
    } catch (err) {
        console.error(err);
        if (mounted.current) {
            setError('案件の追加に失敗しました。データベースの接続を確認し、もう一度お試しください。');
        }
    } finally {
        if (mounted.current) {
            setIsSubmitting(false);
        }
    }
  };
  
  const formRowClass = "flex flex-col gap-2";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
  const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">新規案件作成</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
            {error && <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
            
            <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-lg border border-blue-200 dark:border-slate-700 mb-6">
                <label htmlFor="ai-prompt" className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                AIアシスタント
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="例: カフェオープンのA4チラシ1000枚、おしゃれな感じで"
                        className={`${inputClass} flex-grow`}
                        disabled={isAiLoading || isSubmitting}
                        autoComplete="on"
                    />
                    <button onClick={handleAiGenerate} disabled={isAiLoading || isSubmitting} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2 transition-colors">
                        {isAiLoading ? <Loader className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5" />}
                        <span>{isAiLoading ? '生成中...' : 'AIで生成'}</span>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={formRowClass}>
                        <label htmlFor="clientName" className={labelClass}>クライアント名</label>
                        <input type="text" id="clientName" name="clientName" value={formData.clientName} onChange={handleChange} className={inputClass} required disabled={isSubmitting} autoComplete="organization" />
                    </div>
                     <div className={formRowClass}>
                        <label htmlFor="title" className={labelClass}>案件タイトル</label>
                        <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} className={inputClass} required disabled={isSubmitting} autoComplete="off" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className={formRowClass}>
                        <label htmlFor="price" className={labelClass}>売上高 (P)</label>
                        <input type="number" id="price" name="price" placeholder="例: 85000" value={formData.price} onChange={handleChange} className={inputClass} required disabled={isSubmitting}/>
                    </div>
                    <div className={formRowClass}>
                        <label htmlFor="variableCost" className={labelClass}>変動費 (V)</label>
                        <input type="number" id="variableCost" name="variableCost" placeholder="例: 35000" value={formData.variableCost} onChange={handleChange} className={inputClass} disabled={isSubmitting}/>
                    </div>
                    <div className={`${formRowClass} justify-center`}>
                        <label className={labelClass}>限界利益 (M)</label>
                        <p className="text-xl font-bold p-2.5 text-slate-900 dark:text-white">{formatJPY(formData.price - formData.variableCost)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className={formRowClass}>
                        <label htmlFor="quantity" className={labelClass}>数量</label>
                        <input type="number" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} className={inputClass} disabled={isSubmitting}/>
                    </div>
                    <div className={formRowClass}>
                        <label htmlFor="dueDate" className={labelClass}>納期</label>
                        <input type="date" id="dueDate" name="dueDate" value={formData.dueDate} onChange={handleChange} className={inputClass} required disabled={isSubmitting} autoComplete="off" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className={formRowClass}>
                        <label htmlFor="paperType" className={labelClass}>用紙</label>
                        <select id="paperType" name="paperType" value={formData.paperType} onChange={handleChange} className={inputClass} disabled={isSubmitting}>
                            {PAPER_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className={formRowClass}>
                        <label htmlFor="finishing" className={labelClass}>加工</label>
                        <select id="finishing" name="finishing" value={formData.finishing} onChange={handleChange} className={inputClass} disabled={isSubmitting}>
                            {FINISHING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>

                <div className={`${formRowClass} mt-6`}>
                    <label htmlFor="details" className={labelClass}>詳細</label>
                    <textarea id="details" name="details" rows={3} value={formData.details} onChange={handleChange} className={inputClass} disabled={isSubmitting} autoComplete="on"></textarea>
                </div>
            </form>
        </div>

        <div className="flex justify-end gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} disabled={isSubmitting} className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">キャンセル</button>
          <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.clientName || !formData.title || !formData.dueDate}
              className="w-32 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
              {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : '案件を追加'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateJobModal;