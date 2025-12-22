import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusinessCardContact, Customer, EmployeeUser, Toast } from '../types';
import { extractBusinessCardDetails } from '../services/geminiService';
import { Upload, Loader, CheckCircle, AlertTriangle, Trash2, FileText, RefreshCw } from './Icons';
import { buildActionActorInfo, logActionEvent } from '../services/actionConsoleService';

interface BusinessCardUploadSectionProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
  currentUser?: EmployeeUser | null;
  allUsers?: EmployeeUser[];
  onApplyToForm: (data: Partial<Customer>) => void;
  onAutoCreateCustomer?: (data: Partial<Customer>) => Promise<Customer>;
}

type OcrStatus = 'processing' | 'ready' | 'error';
type InsertStatus = 'idle' | 'saving' | 'success' | 'error';

type CardDraft = {
  id: string;
  file: File;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  ocrStatus: OcrStatus;
  insertStatus: InsertStatus;
  contact: BusinessCardContact;
  customerPayload?: Partial<Customer>;
  createdCustomer?: Customer | null;
  ocrError?: string;
  insertError?: string;
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

const buildContactNote = (contact: BusinessCardContact): string | undefined => {
  const lines = [
    contact.department ? `部署: ${contact.department}` : null,
    contact.personNameKana ? `カナ: ${contact.personNameKana}` : null,
    contact.phoneNumber ? `直通: ${contact.phoneNumber}` : null,
    contact.mobileNumber ? `携帯: ${contact.mobileNumber}` : null,
    contact.email ? `メール: ${contact.email}` : null,
  ].filter(Boolean);
  if (!lines.length) return undefined;
  return `【担当者情報】\n${lines.join('\n')}`;
};

const contactToCustomer = (contact: BusinessCardContact, fallbackName: string): Partial<Customer> => ({
  customerName: contact.companyName || contact.personName || fallbackName,
  representative: contact.personName || undefined,
  representativeTitle: contact.title || undefined,
  phoneNumber: contact.phoneNumber || contact.mobileNumber,
  fax: contact.faxNumber,
  address1: contact.address,
  zipCode: contact.postalCode,
  websiteUrl: contact.websiteUrl,
  customerContactInfo: contact.email,
  receivedByEmployeeCode: contact.recipientEmployeeCode || undefined,
  note: [buildContactNote(contact), contact.notes].filter(Boolean).join('\n\n') || undefined,
});

const describeRepresentative = (name?: string | null, title?: string | null | undefined) => {
  const safeName = name?.trim();
  const safeTitle = title?.trim();
  if (safeTitle) {
    return `${safeName || '不明'}（${safeTitle}）`;
  }
  return safeName || '不明';
};

const OCR_STATUS_STYLES: Record<OcrStatus, { label: string; className: string }> = {
  processing: { label: 'OCR解析中', className: 'bg-blue-100 text-blue-700' },
  ready: { label: '解析済', className: 'bg-emerald-100 text-emerald-700' },
  error: { label: '解析失敗', className: 'bg-red-100 text-red-700' },
};

const INSERT_STATUS_STYLES: Record<InsertStatus, { label: string; className: string }> = {
  idle: { label: '登録待ち', className: 'bg-slate-100 text-slate-600' },
  saving: { label: '登録中', className: 'bg-blue-100 text-blue-700' },
  success: { label: '登録済', className: 'bg-green-100 text-green-700' },
  error: { label: '登録失敗', className: 'bg-red-100 text-red-700' },
};

const BusinessCardUploadSection: React.FC<BusinessCardUploadSectionProps> = ({
  addToast,
  isAIOff,
  currentUser,
  allUsers = [],
  onApplyToForm,
  onAutoCreateCustomer,
}) => {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [eventName, setEventName] = useState('');
  const [recipientCode, setRecipientCode] = useState('');
  const actorInfo = useMemo(() => buildActionActorInfo(currentUser ?? null), [currentUser]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draftsRef = useRef<CardDraft[]>(drafts);
  const mounted = useRef(true);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    mounted.current = true;
    if (currentUser?.id) {
      setRecipientCode(prev => prev || currentUser.id);
    }
    return () => {
      mounted.current = false;
      draftsRef.current.forEach(draft => URL.revokeObjectURL(draft.fileUrl));
    };
  }, [currentUser?.id]);

  const recipientOptions = useMemo(() => {
    const sorted = [...allUsers].sort((a, b) => {
      const na = a.name?.toLowerCase() || '';
      const nb = b.name?.toLowerCase() || '';
      return na.localeCompare(nb);
    });
    return sorted.map(user => ({
      value: user.id,
      label: user.name || user.email || user.id,
      department: user.department || '',
    }));
  }, [allUsers]);

  const generateId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const autoCreateCustomer = useCallback(
    async (draftId: string, payload: Partial<Customer>) => {
      if (!onAutoCreateCustomer) {
        onApplyToForm(payload);
        addToast('名刺の内容をフォームに反映しました。保存して登録してください。', 'success');
        logActionEvent({
          module: '名刺OCR',
          severity: 'info',
          status: 'pending',
          summary: `名刺OCR: ${payload.customerName || '不明'} をフォームに転記`,
          detail: `担当: ${describeRepresentative(payload.representative, payload.representativeTitle)}`,
          ...actorInfo,
        });
        handleRemoveDraft(draftId);
        return;
      }

      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId ? { ...draft, insertStatus: 'saving', insertError: undefined } : draft
        )
      );

      try {
        const created = await onAutoCreateCustomer(payload);
        setDrafts(prev =>
          prev.map(draft =>
            draft.id === draftId
              ? {
                  ...draft,
                  insertStatus: 'success',
                  createdCustomer: created,
                  customerPayload: { ...payload, id: created.id },
                }
              : draft
          )
        );
        addToast(`「${created.customerName || payload.customerName || '名刺'}」を自動登録しました。`, 'success');
        onApplyToForm(created);
        logActionEvent({
          module: '名刺OCR',
          severity: 'info',
          status: 'success',
          summary: `名刺OCR: ${created.customerName || payload.customerName || '不明'} を顧客登録`,
          detail: `担当: ${describeRepresentative(
            created.representative ?? payload.representative,
            created.representativeTitle ?? payload.representativeTitle
          )}`,
          ...actorInfo,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '顧客登録に失敗しました。';
        setDrafts(prev =>
          prev.map(draft =>
            draft.id === draftId ? { ...draft, insertStatus: 'error', insertError: message } : draft
          )
        );
        addToast(message, 'error');
        logActionEvent({
          module: '名刺OCR',
          severity: 'critical',
          status: 'failure',
          summary: `名刺OCR: ${payload.customerName || '不明'} の自動登録でエラー`,
          detail: message,
          ...actorInfo,
        });
      }
    },
    [onAutoCreateCustomer, onApplyToForm, addToast, actorInfo]
  );

  const runOcr = useCallback(
    async (draftId: string, file: File) => {
      setDrafts(prev =>
        prev.map(draft =>
          draft.id === draftId
            ? { ...draft, ocrStatus: 'processing', ocrError: undefined }
            : draft
        )
      );
      try {
        const base64 = await readFileAsBase64(file);
        const parsed = await extractBusinessCardDetails(base64, file.type || 'application/octet-stream');
        const contact = normalizeContact(parsed);
        const payload = contactToCustomer(contact, file.name);
        const payloadWithMeta: Partial<Customer> = {
          ...payload,
          businessEvent: eventName || undefined,
          receivedByEmployeeCode: recipientCode || undefined,
        };
        setDrafts(prev =>
          prev.map(draft =>
            draft.id === draftId
              ? { ...draft, ocrStatus: 'ready', contact, customerPayload: payloadWithMeta, ocrError: undefined }
              : draft
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
        await autoCreateCustomer(draftId, payloadWithMeta);
      } catch (error) {
        const message = error instanceof Error ? error.message : '名刺の解析に失敗しました。';
        setDrafts(prev =>
          prev.map(draft =>
            draft.id === draftId ? { ...draft, ocrStatus: 'error', ocrError: message } : draft
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
    },
    [actorInfo, autoCreateCustomer]
  );

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
          ocrStatus: 'processing',
          insertStatus: 'idle',
          contact: {},
        };
        setDrafts(prev => [...prev, draft]);
        runOcr(id, file);
      });
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

  const handleLoadToForm = (draft: CardDraft) => {
    if (draft.createdCustomer) {
      onApplyToForm(draft.createdCustomer);
      addToast('登録済みの顧客をフォームに読み込みました。必要な項目を編集して保存してください。', 'success');
    } else if (draft.customerPayload) {
      onApplyToForm(draft.customerPayload);
      addToast('名刺の内容をフォームに読み込みました。保存して登録してください。', 'success');
    }
  };

  const handleRetryInsert = (draft: CardDraft) => {
    if (draft.customerPayload) {
      void autoCreateCustomer(draft.id, draft.customerPayload);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-5 flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">名刺で自動入力</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              名刺をまとめてアップロードするだけで、AIが解析して顧客マスタ登録とフォーム反映まで自動で行います。
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isAIOff}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            ファイルを選択
          </button>
        </div>
        {isAIOff && (
          <p className="text-sm text-red-500 font-semibold">
            AI機能が無効のため、OCRは利用できません。
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 gap-2 text-sm">
            <label className="font-semibold text-slate-700 dark:text-slate-200">取得イベント</label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="展示会・商談会・社内イベントなど"
              className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white shadow-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <label className="font-semibold text-slate-700 dark:text-slate-200">受領者（担当者）</label>
            {recipientOptions.length > 0 ? (
              <select
                value={recipientCode}
                onChange={e => setRecipientCode(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white shadow-sm"
              >
                <option value="">選択してください</option>
                {recipientOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.department ? ` / ${opt.department}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={recipientCode}
                onChange={e => setRecipientCode(e.target.value)}
                placeholder="名刺を受け取った担当者（IDまたは氏名）"
                className="w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-white shadow-sm"
              />
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              名刺を受け取った担当者を選択します。表示名は氏名（部門）で、保存される値は社員IDです。
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="sr-only"
          onChange={e => handleFiles(e.target.files)}
          disabled={isAIOff}
        />
      </div>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="px-6 py-5 border-b border-dashed border-slate-200 dark:border-slate-700/80 text-center hover:border-blue-400 transition-colors"
      >
        <Upload className="w-10 h-10 mx-auto text-slate-400" />
        <p className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
          ドラッグ＆ドロップでもアップロードできます（JPEG / PNG / PDF）
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          解析結果は下部に表示され、フォームへワンクリックで取り込めます。
        </p>
      </div>
      <div className="px-6 py-5 space-y-4 max-h-[360px] overflow-y-auto">
        {drafts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300 text-left">
            <p>・名刺をアップロードするとAIが解析→顧客登録→右フォームへの反映まで自動で実施します。</p>
            <p>・複数枚アップロードした場合はステータスを見ながら順番に編集・保存できます。</p>
            <p>・ステータスに応じて登録状況が表示されます。</p>
          </div>
        ) : (
          drafts.map(draft => {
            const isPdf = draft.mimeType.includes('pdf');
            const ocrStatus = OCR_STATUS_STYLES[draft.ocrStatus];
            const insertStatus = INSERT_STATUS_STYLES[draft.insertStatus];
            return (
              <div
                key={draft.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {isPdf ? (
                      <FileText className="w-10 h-10 text-slate-500" />
                    ) : (
                      <img
                        src={draft.fileUrl}
                        alt={draft.fileName}
                        className="w-20 h-14 object-cover rounded border border-slate-200"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {draft.fileName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${ocrStatus.className}`}
                        >
                          {ocrStatus.label}
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${insertStatus.className}`}
                        >
                          {insertStatus.label}
                        </span>
                      </div>
                      {draft.ocrStatus === 'error' && draft.ocrError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                          <AlertTriangle className="w-4 h-4" />
                          {draft.ocrError}
                        </div>
                      )}
                      {draft.insertStatus === 'error' && draft.insertError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                          <AlertTriangle className="w-4 h-4" />
                          {draft.insertError}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {draft.ocrStatus === 'error' && (
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

                <div className="rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-900/30 p-4">
                  <dl className="grid grid-cols-1 gap-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">会社名</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">
                        {draft.customerPayload?.customerName || '―'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">担当者</dt>
                      <dd className="flex flex-wrap items-center gap-1">
                        {draft.customerPayload?.representative || '―'}
                        {draft.customerPayload?.representative &&
                          draft.customerPayload?.representativeTitle && (
                            <span className="text-xs text-slate-500">
                              （{draft.customerPayload.representativeTitle}）
                            </span>
                          )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">電話 / メール</dt>
                      <dd className="space-y-0.5">
                        <p>{draft.customerPayload?.phoneNumber || '―'}</p>
                        <p>{draft.customerPayload?.customerContactInfo || '―'}</p>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">住所</dt>
                      <dd>{draft.customerPayload?.address1 || '―'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">取得イベント</dt>
                      <dd>{draft.customerPayload?.businessEvent || '―'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">受領者（社員番号/氏名）</dt>
                      <dd>{draft.customerPayload?.receivedByEmployeeCode || '―'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {draft.insertStatus === 'error' && draft.customerPayload && (
                    <button
                      type="button"
                      onClick={() => handleRetryInsert(draft)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      再登録
                    </button>
                  )}
                  {(draft.insertStatus === 'success' || (!onAutoCreateCustomer && draft.customerPayload)) && (
                    <button
                      type="button"
                      onClick={() => handleLoadToForm(draft)}
                      className="inline-flex items-center gap-2 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      フォームで編集
                    </button>
                  )}
                  {draft.insertStatus === 'saving' && (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-500">
                      <Loader className="w-4 h-4 animate-spin" />
                      自動登録中...
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {drafts.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            <span>解析中: {drafts.filter(d => d.ocrStatus === 'processing').length}件 / 登録中: {drafts.filter(d => d.insertStatus === 'saving').length}件</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            右側フォームで修正したい登録済みレコードは「フォームで編集」から読み込めます。
          </p>
        </div>
      )}
    </section>
  );
};

export default BusinessCardUploadSection;
