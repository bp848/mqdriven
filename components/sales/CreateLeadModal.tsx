

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { INQUIRY_TYPES } from '../../constants';
import { Lead, LeadStatus } from '../../types';
import { Loader, X, Save } from '../Icons';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLead: (lead: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
}

const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ isOpen, onClose, onAddLead }) => {
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
    status: LeadStatus.Untouched as LeadStatus,
    source: '',
    message: '',
    inquiryTypes: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  
  const resetForm = useCallback(() => {
    setFormData({
      company: '',
      name: '',
      email: '',
      phone: '',
      status: LeadStatus.Untouched,
      source: '',
      message: '',
      inquiryTypes: [],
    });
    setIsSaving(false);
    setError('');
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleInquiryToggle = useCallback((type: string) => {
    setFormData(prev => {
      const exists = prev.inquiryTypes.includes(type);
      return {
        ...prev,
        inquiryTypes: exists
          ? prev.inquiryTypes.filter(t => t !== type)
          : [...prev.inquiryTypes, type],
      };
    });
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.company.trim() || !formData.name.trim()) {
      setError('会社名と担当者名は必須です。');
      return;
    }

    setIsSaving(true);
    try {
      await onAddLead({
        company: formData.company.trim(),
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        status: formData.status,
        source: formData.source.trim() || undefined,
        message: formData.message.trim() || undefined,
        inquiryTypes: formData.inquiryTypes,
      });
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : '保存に失敗しました。');
      }
    } finally {
      if (mounted.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">新規リード</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                会社名 *
              </label>
              <input
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="株式会社サンプル"
                autoComplete="organization"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                担当者名 *
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="山田 太郎"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                メール
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="taro@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                電話
              </label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="03-1234-5678"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ステータス
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                流入経路
              </label>
              <input
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Web, 口コミ, 展示会 など"
                autoComplete="on"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              お問い合わせ種別
            </label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {INQUIRY_TYPES.map(t => (
                <label
                  key={t}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={formData.inquiryTypes.includes(t)}
                    onChange={() => handleInquiryToggle(t)}
                    className="h-4 w-4"
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              メモ / 要望
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="案件の背景や希望納期など"
              autoComplete="on"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSaving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLeadModal;