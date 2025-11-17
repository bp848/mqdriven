import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Customer, EmployeeUser, FaxIntake, InvoiceData, PaymentRecipient } from '../../types';
import * as dataService from '../../services/dataService';
import { formatDateTime, formatJPY } from '../../utils';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Link as LinkIcon,
  Loader,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from '../Icons';
import { findMatchingCustomerId, findMatchingPaymentRecipientId } from '../../utils/matching';

type EditableFaxIntakeStatus = Exclude<FaxIntake['status'], 'deleted'>;

interface FaxOcrIntakePageProps {
  currentUser: EmployeeUser | null;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToOrders: () => void;
  onNavigateToEstimates: () => void;
  customers: Customer[];
  paymentRecipients: PaymentRecipient[];
}

const docTypeLabels: Record<FaxIntake['docType'], string> = {
  order: '受注',
  estimate: '見積',
  vendor_invoice: '外注請求書',
  unknown: '不明',
};

const statusLabels: Record<FaxIntake['status'], string> = {
  draft: '下書き',
  ready: '確認済',
  linked: '反映済',
  deleted: '削除済',
};

const ocrStatusLabels: Record<FaxIntake['ocrStatus'], string> = {
  pending: '未実行',
  processing: '処理中',
  done: '完了',
  failed: '失敗',
};

const intakeStatusOptions: { value: EditableFaxIntakeStatus; label: string }[] = [
  { value: 'draft', label: statusLabels.draft },
  { value: 'ready', label: statusLabels.ready },
  { value: 'linked', label: statusLabels.linked },
];

const docTypeOptions: { value: FaxIntake['docType']; label: string }[] = [
  { value: 'order', label: docTypeLabels.order },
  { value: 'estimate', label: docTypeLabels.estimate },
  { value: 'vendor_invoice', label: docTypeLabels.vendor_invoice },
  { value: 'unknown', label: docTypeLabels.unknown },
];

const businessStatusClass: Record<FaxIntake['status'], string> = {
  draft:
    'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
  ready:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  linked:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  deleted:
    'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
};

const ocrStatusClass: Record<FaxIntake['ocrStatus'], string> = {
  pending:
    'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  done:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  failed:
    'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
};

const formatFileSize = (size: number): string => {
  if (typeof size !== 'number' || Number.isNaN(size)) return '-';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};

const isSupportedFileType = (file: File): boolean => {
  if (!file) return false;
  if (file.type) {
    return file.type === 'application/pdf' || file.type.startsWith('image/');
  }
  return /\.(pdf|png|jpe?g|tif|tiff|bmp|gif|webp)$/i.test(file.name);
};

const getOcrCustomerName = (ocrJson: any): string | null => {
  const invoiceData = parseInvoiceData(ocrJson);
  const lineCustomer = invoiceData?.expenseDraft?.lines?.find(line => line?.customerName)?.customerName;
  if (lineCustomer) return lineCustomer;
  if (invoiceData?.relatedCustomer) return invoiceData.relatedCustomer;
  if (invoiceData?.project) return invoiceData.project;
  if (!ocrJson || typeof ocrJson !== 'object') return null;
  return (
    ocrJson.customerName ||
    ocrJson.clientName ||
    ocrJson.customer ||
    ocrJson.companyName ||
    null
  );
};

const getOcrTotalAmount = (ocrJson: any): number | null => {
  const invoiceData = parseInvoiceData(ocrJson);
  const rawFallback =
    ocrJson && typeof ocrJson === 'object'
      ? ocrJson.grandTotal ?? ocrJson.amount ?? ocrJson.total ?? null
      : null;
  const candidate =
    invoiceData?.expenseDraft?.totalGross ??
    invoiceData?.totalAmount ??
    invoiceData?.subtotalAmount ??
    rawFallback;
  if (candidate === null || candidate === undefined) return null;
  const numeric =
    typeof candidate === 'string'
      ? Number(candidate.replace(/[^\d.-]/g, ''))
      : Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

const deriveReferenceNo = (ocrJson: any): string | null => {
  if (!ocrJson || typeof ocrJson !== 'object') return null;
  return ocrJson.orderNumber || ocrJson.estimateNumber || ocrJson.referenceNo || null;
};

const parseInvoiceData = (ocrJson: any): InvoiceData | null => {
  if (!ocrJson || typeof ocrJson !== 'object') return null;
  return ocrJson as InvoiceData;
};

const getInvoiceLineItems = (invoiceData: InvoiceData | null) =>
  invoiceData?.expenseDraft?.lines || invoiceData?.lineItems || [];

const getBankAccountText = (invoiceData: InvoiceData | null): string | null => {
  if (!invoiceData) return null;
  const bank = invoiceData.expenseDraft?.bankAccount || invoiceData.bankAccount;
  if (!bank) return null;
  const parts = [bank.bankName, bank.branchName, bank.accountType, bank.accountNumber]
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
};

const guessCustomerNameFromInvoice = (invoiceData: InvoiceData | null): string | null => {
  if (!invoiceData) return null;
  const lineWithCustomer = invoiceData.expenseDraft?.lines?.find(line => line?.customerName);
  if (lineWithCustomer?.customerName) {
    return lineWithCustomer.customerName;
  }
  return invoiceData.relatedCustomer || invoiceData.project || null;
};

const guessPaymentRecipientNameFromInvoice = (invoiceData: InvoiceData | null): string | null => {
  if (!invoiceData) return null;
  return (
    invoiceData.expenseDraft?.paymentRecipientName ||
    invoiceData.paymentRecipientName ||
    invoiceData.expenseDraft?.supplierName ||
    invoiceData.vendorName ||
    null
  );
};

const matchPaymentRecipientFromInvoice = (
  invoiceData: InvoiceData | null,
  recipients: PaymentRecipient[],
): PaymentRecipient | null => {
  if (!invoiceData || recipients.length === 0) return null;
  const candidateId =
    invoiceData.matchedPaymentRecipientId ||
    invoiceData.expenseDraft?.paymentRecipientId ||
    findMatchingPaymentRecipientId(
      invoiceData.expenseDraft?.supplierName || invoiceData.vendorName,
      recipients,
    );
  if (!candidateId) return null;
  return recipients.find(rec => rec.id === candidateId) || null;
};

const matchCustomerFromInvoice = (
  invoiceData: InvoiceData | null,
  customers: Customer[],
): Customer | null => {
  if (!invoiceData || customers.length === 0) return null;
  const candidateName = guessCustomerNameFromInvoice(invoiceData) || undefined;
  const candidateId =
    invoiceData.matchedCustomerId ||
    findMatchingCustomerId(candidateName, customers);
  if (!candidateId) return null;
  return customers.find(customer => customer.id === candidateId) || null;
};

interface EditModalState {
  docType: FaxIntake['docType'];
  status: EditableFaxIntakeStatus;
  notes: string;
  linkedProjectId: string;
  linkedOrderId: string;
  linkedEstimateId: string;
}

interface EditFaxIntakeModalProps {
  intake: FaxIntake | null;
  isSaving: boolean;
  isRetryingOcr: boolean;
  onClose: () => void;
  onSave: (id: string, changes: EditModalState) => void;
  onRetryOcr: (intake: FaxIntake) => void;
  onNavigateToOrders: () => void;
  onNavigateToEstimates: () => void;
  customers: Customer[];
  paymentRecipients: PaymentRecipient[];
}

const FaxOcrIntakePage: React.FC<FaxOcrIntakePageProps> = ({
  currentUser,
  addToast,
  onNavigateToOrders,
  onNavigateToEstimates,
  customers,
  paymentRecipients,
}) => {
  const [faxIntakes, setFaxIntakes] = useState<FaxIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<FaxIntake['docType']>('vendor_invoice');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [editingIntake, setEditingIntake] = useState<FaxIntake | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [ocrBusyId, setOcrBusyId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvePaymentRecipient = useCallback(
    (invoiceData: InvoiceData | null) => matchPaymentRecipientFromInvoice(invoiceData, paymentRecipients),
    [paymentRecipients],
  );

  const resolveCustomer = useCallback(
    (invoiceData: InvoiceData | null) => matchCustomerFromInvoice(invoiceData, customers),
    [customers],
  );

  const loadIntakes = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const data = await dataService.getFaxIntakes();
        setFaxIntakes(data);
      } catch (error) {
        console.error(error);
        addToast(
          error instanceof Error
            ? error.message
            : 'FAX取り込みキューの読み込みに失敗しました。',
          'error'
        );
      } finally {
        if (mode === 'initial') {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [addToast]
  );

  useEffect(() => {
    loadIntakes('initial');
  }, [loadIntakes]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setNotes('');
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!isSupportedFileType(file)) {
      setUploadError('PDFまたは画像ファイルのみアップロードできます。');
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!currentUser) {
      addToast('アップロードするにはログインが必要です。', 'error');
      return;
    }
    if (!selectedFile) {
      setUploadError('アップロードするファイルを選択してください。');
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const { path } = await dataService.uploadFile(selectedFile);
      const intake = await dataService.createFaxIntake({
        filePath: path,
        fileName: selectedFile.name,
        fileMimeType: selectedFile.type || 'application/octet-stream',
        fileSize: selectedFile.size,
        docType: selectedDocType,
        notes: notes.trim() || undefined,
        uploadedBy: currentUser.id,
      });
      try {
        await dataService.requestFaxOcr(intake);
      } catch (ocrError) {
        console.warn('[FaxOCR] Failed to trigger OCR automatically', ocrError);
        addToast('アップロードは完了しましたが、OCRの起動に失敗しました。', 'warning');
        await dataService.updateFaxIntake(intake.id, {
          ocrStatus: 'pending',
          ocrErrorMessage: 'OCRの自動起動に失敗しました。手動で再実行してください。',
        });
      }
      addToast('FAX資料をアップロードしました。', 'success');
      resetUploadForm();
      await loadIntakes('refresh');
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : 'FAX資料のアップロードに失敗しました。';
      setUploadError(message);
      addToast(message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (intake: FaxIntake) => {
    const confirmed = window.confirm(
      `ファイル「${intake.fileName}」を削除しますか？削除すると一覧から表示されなくなります。`
    );
    if (!confirmed) return;
    setDeleteBusyId(intake.id);
    try {
      await dataService.deleteFaxIntake(intake.id);
      addToast('FAX取り込みを削除しました。', 'success');
      await loadIntakes('refresh');
    } catch (error) {
      console.error(error);
      addToast(
        error instanceof Error ? error.message : '削除に失敗しました。',
        'error'
      );
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleRetryOcr = async (intake: FaxIntake) => {
    setOcrBusyId(intake.id);
    try {
      await dataService.updateFaxIntake(intake.id, {
        ocrStatus: 'processing',
        ocrErrorMessage: null,
      });
      await dataService.requestFaxOcr(intake);
      addToast('OCR解析を再実行しました。', 'success');
      await loadIntakes('refresh');
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'OCR解析の再実行に失敗しました。';
      addToast(message, 'error');
      try {
        await dataService.updateFaxIntake(intake.id, {
          ocrStatus: 'failed',
          ocrErrorMessage: message,
        });
        await loadIntakes('refresh');
      } catch (updateError) {
        console.error('[FaxOCR] Failed to mark OCR retry error', updateError);
      }
    } finally {
      setOcrBusyId(null);
    }
  };

  const handleSaveEdit = async (id: string, changes: EditModalState) => {
    setIsSavingEdit(true);
    try {
      await dataService.updateFaxIntake(id, {
        docType: changes.docType,
        status: changes.status,
        notes: changes.notes.trim() ? changes.notes.trim() : null,
        linkedProjectId: changes.linkedProjectId.trim() || null,
        linkedOrderId: changes.linkedOrderId.trim() || null,
        linkedEstimateId: changes.linkedEstimateId.trim() || null,
      });
      addToast('FAX取り込みを更新しました。', 'success');
      setEditingIntake(null);
      await loadIntakes('refresh');
    } catch (error) {
      console.error(error);
      addToast(
        error instanceof Error ? error.message : '更新に失敗しました。',
        'error'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const uploadDisabled = !currentUser || !selectedFile || isUploading;

  const dragEvents = {
    onDragOver: (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(true);
    },
    onDragLeave: (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
    },
    onDrop: (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
  };

  const totalPending = useMemo(
    () => faxIntakes.filter(intake => intake.ocrStatus !== 'done').length,
    [faxIntakes]
  );

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">FAXからのデータ自動入力</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            FAXで届いた受注・見積資料をPDF/画像でアップロードし、OCR結果を確認して案件・受注・見積テーブルに反映します。
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            未完了のOCR: {totalPending} 件
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNavigateToOrders}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            案件・受注管理を開く
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNavigateToEstimates}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            見積管理を開く
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => loadIntakes('refresh')}
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-blue-500/10 disabled:opacity-60"
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            最新の状態に更新
          </button>
        </div>
      </header>

      {!currentUser && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p>アップロードにはログインユーザー情報が必要です。サイドバーからユーザーを選択してください。</p>
        </div>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-950/5 dark:bg-slate-900/70 dark:ring-white/10">
        <div className="flex flex-col gap-6 lg:flex-row">
          <label
            htmlFor="fax-ocr-file"
            className={`flex h-48 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition hover:border-blue-400 dark:hover:border-blue-300 ${
              isDragActive
                ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-500/10'
                : 'border-slate-300 dark:border-slate-600 dark:bg-slate-900/40'
            } ${!currentUser ? 'pointer-events-none opacity-60' : ''}`}
            {...dragEvents}
          >
            <Upload className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            <p className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
              ファイルをドラッグ＆ドロップ
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              PDF または 画像ファイル（jpg, png, tiff など）を1件ずつアップロード
            </p>
            <input
              ref={fileInputRef}
              id="fax-ocr-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              className="hidden"
              disabled={!currentUser}
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                選択中: {selectedFile.name}（{formatFileSize(selectedFile.size)}）
              </p>
            )}
          </label>

          <div className="flex-1 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">文書種別</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value as FaxIntake['docType'])}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                disabled={!currentUser}
              >
                {docTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">備考 / メモ</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="FAXで届いた背景や顧客情報をメモできます。"
                disabled={!currentUser}
              />
            </div>
            {uploadError && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{uploadError}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploadDisabled}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-900/40"
              >
                {isUploading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                アップロード &amp; OCR開始
              </button>
              <button
                type="button"
                onClick={resetUploadForm}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={isUploading}
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-950/5 dark:bg-slate-900/70 dark:ring-white/10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">取り込みキュー</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">OCR結果の確認や案件・見積へのリンク付けを行います。</p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {faxIntakes.length} 件
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-300">
            <Loader className="mr-2 h-5 w-5 animate-spin" />
            読み込み中...
          </div>
        ) : faxIntakes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            まだFAX取り込みデータがありません。まずはファイルをアップロードしてください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">ファイル</th>
                  <th className="px-4 py-3">種別 / ステータス</th>
                  <th className="px-4 py-3">OCRサマリー</th>
                  <th className="px-4 py-3">メモ / リンク</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {faxIntakes.map(intake => {
                  const invoiceData = parseInvoiceData(intake.ocrJson);
                  const customerName = getOcrCustomerName(intake.ocrJson);
                  const referenceNo = deriveReferenceNo(intake.ocrJson);
                  const paymentRecipientMatch = resolvePaymentRecipient(invoiceData);
                  const customerMatch = resolveCustomer(invoiceData);
                  const bankAccountText = getBankAccountText(invoiceData);
                  const lineItems = getInvoiceLineItems(invoiceData);
                  const limitedLines = lineItems.slice(0, 3);
                  const remainingLines = lineItems.length - limitedLines.length;
                  const totalGross = invoiceData?.expenseDraft?.totalGross ?? invoiceData?.totalAmount ?? null;
                  const totalNet = invoiceData?.expenseDraft?.totalNet ?? invoiceData?.subtotalAmount ?? null;
                  const taxAmount =
                    invoiceData?.expenseDraft?.taxAmount ??
                    invoiceData?.taxAmount ??
                    (totalGross && totalNet ? totalGross - totalNet : null);
                  const supplierName = invoiceData?.expenseDraft?.supplierName || invoiceData?.vendorName || intake.fileName;
                  const paymentRecipientLabel = paymentRecipientMatch?.companyName || paymentRecipientMatch?.recipientName || null;
                  const fallbackRecipientName = guessPaymentRecipientNameFromInvoice(invoiceData);
                  const fallbackCustomerName = guessCustomerNameFromInvoice(invoiceData);
                  return (
                    <tr key={intake.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{intake.fileName}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(intake.uploadedAt)} / {formatFileSize(intake.fileSize)} / {intake.fileMimeType}
                        </div>
                        {intake.fileUrl && (
                          <a
                            href={intake.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            ファイルを開く
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {docTypeLabels[intake.docType]}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ocrStatusClass[intake.ocrStatus]}`}>
                            {ocrStatusLabels[intake.ocrStatus]}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${businessStatusClass[intake.status]}`}>
                            {statusLabels[intake.status]}
                          </span>
                        </div>
                        {intake.ocrStatus === 'failed' && intake.ocrErrorMessage && (
                          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{intake.ocrErrorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {intake.ocrStatus === 'done' && invoiceData ? (
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">発行元</span>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{supplierName}</div>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              請求日: {invoiceData.invoiceDate || '-'} / 支払期日: {invoiceData.dueDate || invoiceData.expenseDraft?.dueDate || '-'}
                            </div>
                            {(totalGross !== null || totalNet !== null) && (
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  税込 {totalGross !== null ? formatJPY(totalGross) : '-'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  税抜 {totalNet !== null ? formatJPY(totalNet) : '-'} / 税額 {taxAmount !== null ? formatJPY(taxAmount) : '-'}
                                </div>
                              </div>
                            )}
                            {referenceNo && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">参照番号: {referenceNo}</div>
                            )}
                            {bankAccountText && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">振込先: {bankAccountText}</div>
                            )}
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              支払先候補:{' '}
                              {paymentRecipientLabel ? (
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentRecipientLabel}（自動突合）</span>
                              ) : (
                                fallbackRecipientName || '未検出'
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              顧客候補:{' '}
                              {customerMatch ? (
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{customerMatch.customerName}（自動突合）</span>
                              ) : (
                                fallbackCustomerName || customerName || '未記載'
                              )}
                            </div>
                            {limitedLines.length > 0 && (
                              <div className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800/50">
                                <div className="font-semibold text-slate-700 dark:text-slate-200">明細</div>
                                <ul className="mt-1 space-y-1">
                                  {limitedLines.map((line, idx) => (
                                    <li key={`${intake.id}-line-${idx}`} className="flex items-center justify-between gap-3">
                                      <span className="truncate text-slate-600 dark:text-slate-300">{line.description || '内容未検出'}</span>
                                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                                        {line.amountExclTax !== undefined ? formatJPY(Number(line.amountExclTax)) : '-'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {remainingLines > 0 && (
                                  <div className="mt-1 text-right text-[11px] text-slate-500 dark:text-slate-400">+{remainingLines} 行</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {intake.ocrStatus === 'processing' ? 'OCR解析中' : '表示可能なサマリーがまだありません'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {intake.notes ? (
                          <p className="whitespace-pre-line">{intake.notes}</p>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500">メモなし</p>
                        )}
                        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {intake.linkedOrderId && <div>受注ID: {intake.linkedOrderId}</div>}
                          {intake.linkedEstimateId && <div>見積ID: {intake.linkedEstimateId}</div>}
                          {intake.linkedProjectId && <div>案件ID: {intake.linkedProjectId}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingIntake(intake)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(intake)}
                            disabled={deleteBusyId === intake.id}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-400/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            削除
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetryOcr(intake)}
                            disabled={ocrBusyId === intake.id}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-400/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          >
                            {ocrBusyId === intake.id ? (
                              <Loader className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            OCR再実行
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditFaxIntakeModal
        intake={editingIntake}
        isSaving={isSavingEdit}
        isRetryingOcr={!!editingIntake && ocrBusyId === editingIntake.id}
        onClose={() => setEditingIntake(null)}
        onSave={handleSaveEdit}
        onRetryOcr={handleRetryOcr}
        onNavigateToOrders={onNavigateToOrders}
        onNavigateToEstimates={onNavigateToEstimates}
        customers={customers}
        paymentRecipients={paymentRecipients}
      />
    </div>
  );
};

const EditFaxIntakeModal: React.FC<EditFaxIntakeModalProps> = ({
  intake,
  isSaving,
  isRetryingOcr,
  onClose,
  onSave,
  onRetryOcr,
  onNavigateToOrders,
  onNavigateToEstimates,
  customers,
  paymentRecipients,
}) => {
  const [formState, setFormState] = useState<EditModalState>({
    docType: 'order',
    status: 'draft',
    notes: '',
    linkedProjectId: '',
    linkedOrderId: '',
    linkedEstimateId: '',
  });

  useEffect(() => {
    if (intake) {
      setFormState({
        docType: intake.docType,
        status: (intake.status === 'deleted' ? 'draft' : intake.status) as EditableFaxIntakeStatus,
        notes: intake.notes ?? '',
        linkedProjectId: intake.linkedProjectId ?? '',
        linkedOrderId: intake.linkedOrderId ?? '',
        linkedEstimateId: intake.linkedEstimateId ?? '',
      });
    }
  }, [intake]);

  const invoiceData = parseInvoiceData(intake?.ocrJson);
  const paymentRecipientMatch = matchPaymentRecipientFromInvoice(invoiceData, paymentRecipients);
  const customerMatch = matchCustomerFromInvoice(invoiceData, customers);
  const bankAccountText = getBankAccountText(invoiceData);
  const lineItems = getInvoiceLineItems(invoiceData);
  const limitedLines = lineItems.slice(0, 3);
  const remainingLines = lineItems.length - limitedLines.length;
  const totalGross = invoiceData?.expenseDraft?.totalGross ?? invoiceData?.totalAmount ?? null;
  const totalNet = invoiceData?.expenseDraft?.totalNet ?? invoiceData?.subtotalAmount ?? null;
  const taxAmount =
    invoiceData?.expenseDraft?.taxAmount ??
    invoiceData?.taxAmount ??
    (totalGross && totalNet ? totalGross - totalNet : null);
  const supplierName = invoiceData?.expenseDraft?.supplierName || invoiceData?.vendorName || intake?.fileName || '';
  const fallbackRecipientName = guessPaymentRecipientNameFromInvoice(invoiceData);
  const fallbackCustomerName = guessCustomerNameFromInvoice(invoiceData);

  if (!intake) return null;

  const handleSubmit = () => {
    onSave(intake.id, formState);
  };

  const showOrdersButton = formState.docType === 'order' || formState.docType === 'unknown';
  const showEstimatesButton = formState.docType === 'estimate' || formState.docType === 'unknown';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="mt-6 w-full max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{intake.fileName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              アップロード日時: {formatDateTime(intake.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">文書種別</label>
              <select
                value={formState.docType}
                onChange={(e) =>
                  setFormState(prev => ({ ...prev, docType: e.target.value as FaxIntake['docType'] }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {docTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">業務ステータス</label>
              <select
                value={formState.status}
                onChange={(e) =>
                  setFormState(prev => ({
                    ...prev,
                    status: e.target.value as EditableFaxIntakeStatus,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {intakeStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">メモ</label>
              <textarea
                value={formState.notes}
                onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                rows={5}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="OCR結果の補足や入力メモを追記してください。"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">受注ID</label>
                <input
                  type="text"
                  value={formState.linkedOrderId}
                  onChange={(e) =>
                    setFormState(prev => ({ ...prev, linkedOrderId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="例: job_xxx"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">見積ID</label>
                <input
                  type="text"
                  value={formState.linkedEstimateId}
                  onChange={(e) =>
                    setFormState(prev => ({ ...prev, linkedEstimateId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="例: est_xxx"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">案件ID</label>
                <input
                  type="text"
                  value={formState.linkedProjectId}
                  onChange={(e) =>
                    setFormState(prev => ({ ...prev, linkedProjectId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="任意"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {showOrdersButton && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  案件・受注管理を開く
                </button>
              )}
              {showEstimatesButton && (
                <button
                  type="button"
                  onClick={onNavigateToEstimates}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  見積管理を開く
                </button>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <div>ファイル種別: {intake.fileMimeType}</div>
              <div>サイズ: {formatFileSize(intake.fileSize)}</div>
              <div>アップロード者: {intake.uploadedBy}</div>
              {intake.fileUrl && (
                <a
                  href={intake.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  <FileText className="h-3.5 w-3.5" />
                  ファイルを開く
                </a>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">OCRステータス</p>
                  <p className={`text-xs font-semibold ${ocrStatusClass[intake.ocrStatus]} inline-flex rounded-full px-2 py-0.5`}>
                    {ocrStatusLabels[intake.ocrStatus]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryOcr(intake)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-400/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  disabled={isRetryingOcr}
                >
                  {isRetryingOcr ? (
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  OCR再実行
                </button>
              </div>
              {intake.ocrErrorMessage && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{intake.ocrErrorMessage}</p>
              )}
              {intake.ocrStatus === 'done' && invoiceData && (
                <div className="mt-3 space-y-2 rounded-md bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <div>
                    <span className="text-[11px] text-slate-400">発行元</span>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{supplierName}</div>
                  </div>
                  <div>請求日: {invoiceData.invoiceDate || '-'} / 支払期日: {invoiceData.dueDate || invoiceData.expenseDraft?.dueDate || '-'}</div>
                  {(totalGross !== null || totalNet !== null) && (
                    <div>
                      税込 {totalGross !== null ? formatJPY(totalGross) : '-'} （税抜 {totalNet !== null ? formatJPY(totalNet) : '-'} / 税額 {taxAmount !== null ? formatJPY(taxAmount) : '-'})
                    </div>
                  )}
                  {bankAccountText && <div>振込先: {bankAccountText}</div>}
                  <div>
                    支払先候補:{' '}
                    {paymentRecipientMatch ? `${paymentRecipientMatch.companyName || paymentRecipientMatch.recipientName}（自動突合）` : fallbackRecipientName || '未検出'}
                  </div>
                  <div>
                    顧客候補:{' '}
                    {customerMatch ? `${customerMatch.customerName}（自動突合）` : fallbackCustomerName || getOcrCustomerName(intake.ocrJson) || '未記載'}
                  </div>
                  {lineItems.length > 0 && (
                    <div className="rounded bg-slate-50 p-2 text-[11px] dark:bg-slate-800/40">
                      <div className="font-semibold">明細</div>
                      <ul className="mt-1 space-y-1">
                        {limitedLines.map((line, idx) => (
                          <li key={`${intake.id}-modal-line-${idx}`} className="flex items-center justify-between gap-3">
                            <span className="truncate">{line.description || '内容未検出'}</span>
                            <span>{line.amountExclTax !== undefined ? formatJPY(Number(line.amountExclTax)) : '-'}</span>
                          </li>
                        ))}
                      </ul>
                      {remainingLines > 0 && <div className="mt-1 text-right text-[10px] text-slate-500 dark:text-slate-400">+{remainingLines} 行</div>}
                    </div>
                  )}
                  {deriveReferenceNo(intake.ocrJson) && (
                    <div>参照番号: {deriveReferenceNo(intake.ocrJson)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {(intake.ocrJson || intake.ocrRawText) && (
          <div className="space-y-4 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            {intake.ocrJson && (
              <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200" open={false}>
                <summary className="cursor-pointer font-semibold text-slate-800 dark:text-white">
                  OCR構造化データ (JSON)
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  {JSON.stringify(intake.ocrJson, null, 2)}
                </pre>
              </details>
            )}
            {intake.ocrRawText && (
              <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                <summary className="cursor-pointer font-semibold text-slate-800 dark:text-white">
                  OCRテキスト全文
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-slate-700 whitespace-pre-wrap dark:bg-slate-950 dark:text-slate-200">
                  {intake.ocrRawText}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={isSaving}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-900/40"
          >
            {isSaving && <Loader className="h-4 w-4 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaxOcrIntakePage;
