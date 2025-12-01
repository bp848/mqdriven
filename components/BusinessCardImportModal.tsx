import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusinessCardContact, Customer, Toast } from '../types';
import { extractBusinessCardDetails } from '../services/geminiService';
import { Upload, X, Loader, CheckCircle, AlertTriangle, Trash2, FileText } from './Icons';

interface BusinessCardImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (customers: Partial<Customer>[]) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

type CardDraftStatus = 'processing' | 'ready' | 'error';

type CardDraft = {
  id: string;
  file: File;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  status: CardDraftStatus;
  contact: BusinessCardContact;
  error?: string;
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('ファイルの読み込みに失敗しました。'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });

const normalizeContact = (contact: BusinessCardContact | null | undefined): BusinessCardContact => {
  const normalized: BusinessCardContact = {};
  if (!contact) return normalized;
  Object.entries(contact).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        (normalized as any)[key] = trimmed;
      }
    } else if (value) {
      (normalized as any)[key] = value;
    }
  });
  return normalized;
};

const contactToCustomer = (contact: BusinessCardContact, fallbackName: string): Partial<Customer> => {
  const memoLines = [
    contact.department || '',
    contact.title || '',
    contact.personNameKana ? `カナ: ${contact.personNameKana}` : '',
    contact.mobileNumber ? `携帯: ${contact.mobileNumber}` : '',
    contact.notes || '',
  ].filter(Boolean);

  return {
    customerName: contact.companyName || contact.personName || fallbackName,
    representative: contact.personName,
    phoneNumber: contact.phoneNumber || contact.mobileNumber,
    fax: contact.faxNumber,
    address1: contact.address,
    zipCode: contact.postalCode,
    websiteUrl: contact.websiteUrl,
    customerContactInfo: contact.email,
    infoSalesActivity: memoLines.length ? memoLines.join('\n') : undefined,
    note: contact.notes,
  };
};

const STATUS_STYLES: Record<CardDraftStatus, { label: string; className: string }> = {
  processing: { label: '解析中', className: 'bg-blue-100 text-blue-700' },
  ready: { label: '確認待ち', className: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'エラー', className: 'bg-red-100 text-red-700' },
};

const BusinessCardImportModal: React.FC<BusinessCardImportModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  addToast,
  isAIOff,
}) => {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draftsRef = useRef<CardDraft[]>(drafts);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    return () => {
      draftsRef.current.forEach(draft => URL.revokeObjectURL(draft.fileUrl));
    };
  }, []);

  const generateId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const runOcr = useCallback(async (draftId: string, file: File) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.id === draftId ? { ...draft, status: 'processing', error: undefined } : draft
      )
    );
    try {
      const base64 = await readFileAsBase64(file);
      const parsed = await extractBusinessCardDetails(base64, file.type || 'application/octet-stream');
      const contact = normalizeContact(parsed);
      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? { ...draft, status: 'ready', contact, error: undefined } : draft
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '名刺の解析に失敗しました。';
      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? { ...draft, status: 'error', error: message } : draft
        )
      );
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (isAIOff) {
        addToast('AI機能が無効のため、名刺OCRを利用できません。', 'error');
        return;
      }
      Array.from(files).forEach(file => {
        const id = generateId();
        const previewUrl = URL.createObjectURL(file);
        const draft: CardDraft = {
          id,
          file,
          fileName: file.name,
          fileUrl: previewUrl,
          mimeType: file.type || 'application/octet-stream',
          status: 'processing',
          contact: {},
        };
        setDrafts(prev => [...prev, draft]);
        runOcr(id, file);
      });
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [addToast, isAIOff, runOcr]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const handleRemoveDraft = (draftId: string) => {
    setDrafts(prev => {
      const target = prev.find(d => d.id === draftId);
      if (target) {
        URL.revokeObjectURL(target.fileUrl);
      }
      return prev.filter(d => d.id !== draftId);
    });
  };

  const handleContactChange = (
    draftId: string,
    field: keyof BusinessCardContact,
    value: string
  ) => {
    setDrafts(prev =>
      prev.map(draft =>
        draft.id === draftId ? { ...draft, contact: { ...draft.contact, [field]: value } } : draft
      )
    );
  };

  const clearAllDrafts = () => {
    draftsRef.current.forEach(draft => URL.revokeObjectURL(draft.fileUrl));
    draftsRef.current = [];
    setDrafts([]);
  };

  const handleClose = () => {
    setIsRegistering(false);
    clearAllDrafts();
    onClose();
  };

  const readyDrafts = useMemo(() => drafts.filter(d => d.status === 'ready'), [drafts]);

  const handleConfirm = async () => {
    if (!readyDrafts.length) {
      addToast('確認済みの名刺がありません。', 'error');
      return;
    }
    const payload = readyDrafts.map(draft => contactToCustomer(draft.contact, draft.fileName));
    setIsRegistering(true);
    try {
      await onRegister(payload);
      addToast(`${payload.length}件の顧客を登録しました。`, 'success');
      setIsRegistering(false);
      handleClose();
    } catch (error) {
      console.error(error);
      addToast('顧客の登録に失敗しました。', 'error');
      setIsRegistering(false);
    }
  };

  const disabled = isRegistering || drafts.every(d => d.status !== 'ready');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">名刺で顧客登録</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              名刺画像またはPDFをまとめてアップロードすると、AIが顧客情報を抽出します。
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-blue-400 transition-colors"
          >
            <Upload className="w-10 h-10 mx-auto text-slate-400" />
            <p className="mt-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              ファイルをドラッグ＆ドロップするか、クリックして選択
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">JPEG / PNG / PDF に対応</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="sr-only"
              onChange={e => handleFiles(e.target.files)}
              disabled={isAIOff}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isAIOff}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              ファイルを選択
            </button>
            {isAIOff && (
              <p className="mt-2 text-sm text-red-500 font-semibold">
                AI機能が無効のため、OCRは利用できません。
              </p>
            )}
          </div>

          {drafts.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-300">
              <p>名刺をまとめてアップロードすると、会社名・担当者・連絡先を自動で読み取ります。</p>
              <p className="mt-1">内容を確認し、承認すると顧客マスタに登録されます。</p>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-4">
              {drafts.map(draft => {
                const status = STATUS_STYLES[draft.status];
                const isPdf = draft.mimeType.includes('pdf');
                return (
                  <div
                    key={draft.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isPdf ? (
                          <FileText className="w-10 h-10 text-slate-500" />
                        ) : (
                          <img
                            src={draft.fileUrl}
                            alt={draft.fileName}
                            className="w-20 h-12 object-cover rounded border border-slate-200"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {draft.fileName}
                          </p>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {draft.status === 'error' && (
                          <button
                            type="button"
                            onClick={() => runOcr(draft.id, draft.file)}
                            className="px-3 py-1 text-sm font-semibold text-blue-600 hover:underline"
                          >
                            再解析
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveDraft(draft.id)}
                          className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {draft.status === 'error' && draft.error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-4 h-4" />
                        {draft.error}
                      </div>
                    )}
                    {draft.status !== 'error' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(
                          [
                            ['companyName', '会社名'],
                            ['personName', '担当者名'],
                            ['department', '部署名'],
                            ['title', '役職'],
                            ['phoneNumber', '電話番号'],
                            ['mobileNumber', '携帯番号'],
                            ['email', 'メール'],
                            ['address', '住所'],
                            ['websiteUrl', 'Webサイト'],
                            ['notes', 'メモ'],
                          ] as Array<[keyof BusinessCardContact, string]>
                        ).map(([field, label]) => (
                          <div key={field}>
                            <label className="text-xs font-semibold text-slate-500 block mb-1">
                              {label}
                            </label>
                            {field === 'notes' ? (
                              <textarea
                                value={draft.contact[field] || ''}
                                onChange={e => handleContactChange(draft.id, field, e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm p-2"
                                rows={2}
                              />
                            ) : (
                              <input
                                type="text"
                                value={draft.contact[field] || ''}
                                onChange={e => handleContactChange(draft.id, field, e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm p-2"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>確認済み: {readyDrafts.length}件</span>
            </div>
            <div className="flex items-center gap-1">
              <Loader className="w-4 h-4 animate-spin text-blue-500" />
              <span>
                解析中: {drafts.filter(d => d.status === 'processing').length}件
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-200"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={disabled}
              className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isRegistering ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  承認して登録
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCardImportModal;
