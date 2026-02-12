import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusinessCardContact, Customer, EmployeeUser, Toast } from '../types';
import { extractBusinessCardDetails } from '../services/geminiService';
import { Upload, X, Loader, CheckCircle, AlertTriangle, Trash2, FileText } from './Icons';
import { buildActionActorInfo, logActionEvent } from '../services/actionConsoleService';

interface BusinessCardImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomerForm: (initialValues: Partial<Customer>) => void;
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
  currentUser?: EmployeeUser | null;
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
  manualOverride?: boolean;
  error?: string;
  processingStartTime?: number;
  processingProgress?: number;
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
    contact.personNameKana ? `カナ: ${contact.personNameKana}` : '',
    contact.mobileNumber ? `携帯: ${contact.mobileNumber}` : '',
    contact.notes || '',
  ].filter(Boolean);

  return {
    customerName: contact.companyName || contact.personName || fallbackName,
    representative: contact.personName,
    representativeTitle: contact.title,
    phoneNumber: contact.phoneNumber || contact.mobileNumber,
    fax: contact.faxNumber,
    address1: contact.address,
    zipCode: contact.postalCode,
    websiteUrl: contact.websiteUrl,
    customerContactInfo: contact.email,
    note: contact.notes,
  };
};

const describeRepresentative = (name?: string | null, title?: string | null) => {
  const safeName = name?.trim();
  const safeTitle = title?.trim();
  if (safeTitle) {
    return `${safeName || '不明'}（${safeTitle}）`;
  }
  return safeName || '不明';
};

const STATUS_STYLES: Record<CardDraftStatus, { label: string; className: string }> = {
  processing: { label: '解析中', className: 'bg-blue-100 text-blue-700' },
  ready: { label: '確認待ち', className: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'エラー', className: 'bg-red-100 text-red-700' },
};

const BusinessCardImportModal: React.FC<BusinessCardImportModalProps> = ({
  isOpen,
  onClose,
  onOpenCustomerForm,
  addToast,
  isAIOff,
  currentUser,
}) => {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const actorInfo = useMemo(() => buildActionActorInfo(currentUser ?? null), [currentUser]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draftsRef = useRef<CardDraft[]>(drafts);
  const mounted = useRef(true);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      draftsRef.current.forEach(draft => URL.revokeObjectURL(draft.fileUrl));
    };
  }, []);

  const generateId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const runOcr = useCallback(async (draftId: string, file: File) => {
    const startTime = Date.now();

    // Set initial processing state
    setDrafts(prev =>
      prev.map(draft =>
        draft.id === draftId ? {
          ...draft,
          status: 'processing',
          error: undefined,
          processingStartTime: startTime,
          processingProgress: 0
        } : draft
      )
    );

    // 大量処理用の進捗更新（間隔を短く）
    const progressInterval = setInterval(() => {
      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? {
            ...draft,
            processingProgress: Math.min((draft.processingProgress || 0) + 25, 85)
          } : draft
        )
      );
    }, 500); // 500ms間隔に短縮

    try {
      const base64 = await readFileAsBase64(file);
      const parsed = await extractBusinessCardDetails(base64, file.type || 'application/octet-stream');
      const contact = normalizeContact(parsed);

      clearInterval(progressInterval);

      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? {
            ...draft,
            status: 'ready',
            contact,
            error: undefined,
            processingProgress: 100
          } : draft
        )
      );

      logActionEvent({
        module: '名刺OCR',
        severity: 'info',
        status: 'success',
        summary: `名刺OCR: ${file.name} の解析が完了しました`,
        detail: `会社: ${contact.companyName || '不明'} / 担当: ${describeRepresentative(contact.personName, contact.title)}`,
        ...actorInfo,
      });
    } catch (error) {
      clearInterval(progressInterval);

      const message = error instanceof Error ? error.message : '名刺の解析に失敗しました。';
      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? {
            ...draft,
            status: 'error',
            error: message,
            processingProgress: 0
          } : draft
        )
      );

      logActionEvent({
        module: '名刺OCR',
        severity: 'critical',
        status: 'failure',
        summary: `名刺OCR: ${file.name} でエラーが発生しました`,
        detail: message,
        ...actorInfo,
      });
    }
  }, [actorInfo]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (isAIOff) {
        addToast('AI機能が無効のため、名刺OCRを利用できません。', 'error');
        logActionEvent({
          module: '名刺OCR',
          severity: 'warning',
          status: 'failure',
          summary: '名刺OCR機能が無効化されています',
          detail: 'AI機能OFFのため、アップロードされた名刺を解析できませんでした。',
          ...actorInfo,
        });
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        return;
      }

      // 大量一括処理用のバッチ処理
      const fileArray = Array.from(files);
      const batchSize = 5; // 一度に処理する数
      let currentIndex = 0;

      const processBatch = async () => {
        const batch = fileArray.slice(currentIndex, currentIndex + batchSize);
        const batchDrafts = batch.map(file => {
          const id = generateId();
          const previewUrl = URL.createObjectURL(file);
          return {
            id,
            file,
            draft: {
              id,
              file,
              fileName: file.name,
              fileUrl: previewUrl,
              mimeType: file.type || 'application/octet-stream',
              status: 'processing' as const,
              contact: {},
              processingStartTime: Date.now(),
              processingProgress: 0,
            },
          };
        });

        setDrafts(prev => [...prev, ...batchDrafts.map(item => item.draft)]);

        // バッチ内のファイルを並列処理
        const batchPromises = batchDrafts.map(({ id, file }) => runOcr(id, file));

        await Promise.all(batchPromises);

        currentIndex += batchSize;

        // 次のバッチがあれば処理
        if (currentIndex < fileArray.length) {
          setTimeout(processBatch, 1000); // 1秒待機して次のバッチ
        }
      };

      // 最初のバッチを開始
      processBatch();

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [addToast, isAIOff, runOcr, actorInfo]
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

  const markManualReady = (draftId: string) => {
    setDrafts(prev =>
      prev.map(draft => {
        if (draft.id !== draftId) return draft;
        const updatedContact = {
          ...draft.contact,
          companyName: draft.contact.companyName || draft.contact.personName || draft.fileName,
        };
        return {
          ...draft,
          status: 'ready',
          manualOverride: true,
          contact: updatedContact,
          error: undefined,
        };
      })
    );
    const target = draftsRef.current.find(d => d.id === draftId);
    if (target) {
      logActionEvent({
        module: '名刺OCR',
        severity: 'warning',
        status: 'pending',
        summary: `名刺OCR: ${target.fileName} を手動入力に切替`,
        detail: 'AI解析をスキップし、手入力で承認対象に設定しました。',
        ...actorInfo,
      });
    }
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
    clearAllDrafts();
    onClose();
  };

  const handleSendToCustomerForm = (draft: CardDraft) => {
    const payload = contactToCustomer(draft.contact, draft.fileName);
    onOpenCustomerForm(payload);
    addToast('顧客フォームに自動入力しました。内容を確認して登録してください。', 'success');
    logActionEvent({
      module: '名刺OCR',
      severity: 'info',
      status: 'pending',
      summary: `名刺OCR: ${draft.fileName} を顧客フォームに読み込み`,
      detail: `会社: ${payload.customerName || '不明'} / 担当: ${describeRepresentative(payload.representative, payload.representativeTitle)}`,
      ...actorInfo,
    });
    handleRemoveDraft(draft.id);
  };

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
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold ${isAIOff ? 'opacity-60 cursor-not-allowed' : ''
                }`}
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
              {/* Overall Progress Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Loader className="w-6 h-6 animate-spin text-blue-600" />
                      <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        処理中: {drafts.filter(d => d.status === 'processing').length} / {drafts.length}件
                        {drafts.length > 10 && (
                          <span className="text-sm font-normal text-blue-700 dark:text-blue-300">
                            （バッチ処理中）
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        AIが名刺情報を解析しています...
                        {drafts.length > 20 && (
                          <span className="block text-xs mt-1">
                            大量処理の場合、時間がかかることがあります
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round((drafts.filter(d => d.status === 'ready').length / drafts.length) * 100)}%
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">完了</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-blue-100 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(drafts.filter(d => d.status === 'ready').length / drafts.length) * 100}%` }}
                  />
                </div>

                {/* 大量処理時のメッセージ */}
                {drafts.length > 50 && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                    ⚡ 大量一括処理モード: 5件ずつ並列処理中
                  </div>
                )}
              </div>

              {drafts.map((draft, index) => {
                const status = STATUS_STYLES[draft.status];
                const isPdf = draft.mimeType.includes('pdf');
                const overallProgress = ((index + 1) / drafts.length) * 100;

                return (
                  <div
                    key={draft.id}
                    className={`rounded-2xl border p-4 flex flex-col gap-4 transition-all duration-300 ${draft.status === 'processing'
                      ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20'
                      : draft.status === 'ready'
                        ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/20'
                        : 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-900/20'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {isPdf ? (
                            <FileText className="w-10 h-10 text-slate-500" />
                          ) : (
                            <img
                              src={draft.fileUrl}
                              alt={draft.fileName}
                              className="w-20 h-12 object-cover rounded border border-slate-200"
                            />
                          )}
                          {draft.status === 'processing' && (
                            <div className="absolute -top-1 -right-1">
                              <Loader className="w-4 h-4 animate-spin text-blue-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {draft.fileName}
                            </p>
                            {draft.manualOverride && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                手動入力
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                            <span className="text-xs text-slate-500">
                              #{index + 1} / {drafts.length}
                            </span>
                          </div>
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

                    {/* Individual Progress Bar for Processing Items */}
                    {draft.status === 'processing' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            AI解析中...
                          </span>
                          <span className="text-blue-600 dark:text-blue-400">
                            {draft.processingProgress || 0}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-100 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${draft.processingProgress || 0}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                          <Loader className="w-3 h-3 animate-spin" />
                          <span>AIが文字情報を抽出しています...</span>
                        </div>
                      </div>
                    )}

                    {draft.status === 'error' && draft.error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-4 h-4" />
                        {draft.error}
                      </div>
                    )}
                    {draft.status !== 'error' && (
                      <>
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
                        <div className="md:col-span-2 flex justify-end">
                          {draft.status === 'ready' && (
                            <button
                              type="button"
                              onClick={() => handleSendToCustomerForm(draft)}
                              className="inline-flex items-center gap-2 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                              フォームで登録
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            {drafts.some(d => d.status === 'processing') && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="relative">
                  <Loader className="w-5 h-5 animate-spin text-blue-600" />
                  <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping" />
                </div>
                <div>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    処理中: {drafts.filter(d => d.status === 'processing').length}件
                  </span>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    残り {drafts.filter(d => d.status !== 'ready').length}件
                  </div>
                </div>
              </div>
            )}

            {drafts.some(d => d.status === 'ready') && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <span className="font-semibold text-green-900 dark:text-green-100">
                    完了: {drafts.filter(d => d.status === 'ready').length}件
                  </span>
                  <div className="text-xs text-green-700 dark:text-green-300">
                    登録可能です
                  </div>
                </div>
              </div>
            )}

            {drafts.some(d => d.status === 'error') && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <span className="font-semibold text-red-900 dark:text-red-100">
                    エラー: {drafts.filter(d => d.status === 'error').length}件
                  </span>
                  <div className="text-xs text-red-700 dark:text-red-300">
                    再解析または手動入力を推奨
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
              <p>「フォームで登録」ボタンから</p>
              <p>顧客登録フォームに遷移します</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCardImportModal;
