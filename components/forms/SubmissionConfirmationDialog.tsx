import React from 'react';
import { Loader } from 'lucide-react';

interface SubmissionConfirmationDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  draftLabel?: string;
  postConfirmMessage?: string;
}

const SubmissionConfirmationDialog: React.FC<SubmissionConfirmationDialogProps> = ({
  isOpen,
  title = '申請を実行しますか？',
  description = '申請ボタンを押すと申請が送信され、承認者に通知されます。誤りがないかご確認ください。',
  onClose,
  onConfirm,
  onSaveDraft,
  isSubmitting = false,
  isSavingDraft = false,
  confirmLabel = 'はい',
  cancelLabel = 'いいえ',
  draftLabel = '下書き',
  postConfirmMessage,
}) => {
  if (!isOpen) return null;

  const confirmText = isSubmitting ? '処理中…' : confirmLabel;
  const saveText = isSavingDraft ? `${draftLabel}中…` : draftLabel;

  const handleConfirm = () => {
    if (isSubmitting) return;
    onConfirm();
  };

  const handleSaveDraft = () => {
    if (!onSaveDraft || isSavingDraft || isSubmitting) return;
    onSaveDraft();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <div className="flex flex-col gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            {cancelLabel}
          </button>
          {onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {isSavingDraft ? (
                <span className="inline-flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  {saveText}
                </span>
              ) : (
                  saveText
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full px-6 py-4 text-xl font-black tracking-wide rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-2xl hover:from-blue-500 hover:to-blue-400 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-4 border-white dark:border-slate-800 sm:flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                処理中…
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
        {isSubmitting && postConfirmMessage && (
          <div className="px-6 pb-6 text-sm text-green-600 dark:text-green-400 font-semibold">
            {postConfirmMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionConfirmationDialog;
