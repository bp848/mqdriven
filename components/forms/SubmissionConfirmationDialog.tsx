import React from 'react';
import { Loader } from '../Icons';

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
  confirmLabel = 'はい（実行）',
  cancelLabel = 'いいえ（キャンセル）',
  draftLabel = '下書き保存',
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
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
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
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
};

export default SubmissionConfirmationDialog;
