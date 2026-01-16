import { useCallback, useMemo, useState } from 'react';
import SubmissionConfirmationDialog from '../components/forms/SubmissionConfirmationDialog';

type ConfirmableAction = () => Promise<void> | void;

export interface ConfirmableActionOptions {
  label: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  draftLabel?: string;
  postConfirmMessage?: string;
  /**
   * 実行本体。キーワードに一致しない場合は即座に実行されます。
   */
  onConfirm: ConfirmableAction;
  /**
   * 3ボタン構成にしたい場合に指定。指定しなければ表示されません。
   */
  onDraft?: ConfirmableAction;
  /**
   * 強制的に確認モーダルを表示したい場合に true。デフォルトはラベルベースで自動判定。
   */
  forceConfirmation?: boolean;
}

interface DialogState extends ConfirmableActionOptions {
  forceConfirmation?: boolean;
}

const KEYWORDS = ['登録', '申請', '送信', '確定', '提出', '承認依頼', '承認', '更新', '差し戻し送信', '差し戻し', '削除', '取り下げ'];

const normalizeLabel = (label?: string) => (label || '').replace(/\s+/g, '');

const matchKeyword = (label: string): boolean => {
  const normalized = normalizeLabel(label);
  return KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const useSubmitWithConfirmation = () => {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const closeDialog = useCallback(() => {
    console.log('[useSubmitWithConfirmation] closeDialog called - resetting states');
    setDialogState(null);
  }, []);

  const runAction = useCallback(
    async (action: ConfirmableAction | undefined, setBusy?: (value: boolean) => void) => {
      if (!action) {
        console.log('[useSubmitWithConfirmation] No action provided, closing dialog');
        closeDialog();
        return;
      }
      console.log('[useSubmitWithConfirmation] Starting action, setBusy:', !!setBusy);
      
      // Close dialog immediately and run action in background
      closeDialog();
      
      // Run action asynchronously without blocking the UI
      (async () => {
        try {
          await action();
          console.log('[useSubmitWithConfirmation] Action completed successfully');
        } catch (error) {
          console.error('Action failed:', error);
          // Could show toast notification here if needed
        }
      })();
    },
    [closeDialog]
  );

  const handleConfirm = useCallback(() => {
    console.log('[useSubmitWithConfirmation] handleConfirm called');
    runAction(dialogState?.onConfirm);
  }, [dialogState?.onConfirm, runAction]);

  const handleDraft = useCallback(() => {
    console.log('[useSubmitWithConfirmation] handleDraft called');
    runAction(dialogState?.onDraft);
  }, [dialogState?.onDraft, runAction]);

  const requestConfirmation = useCallback(
    async (options: ConfirmableActionOptions) => {
      const needsConfirmation = options.forceConfirmation ?? matchKeyword(options.label);
      if (!needsConfirmation) {
        return options.onConfirm();
      }
      setDialogState({
        ...options,
      });
    },
    []
  );

  const ConfirmationDialog = useMemo(
    () => (
      <SubmissionConfirmationDialog
        isOpen={Boolean(dialogState)}
        title={dialogState?.title}
        description={dialogState?.description}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        onSaveDraft={dialogState?.onDraft ? handleDraft : undefined}
        confirmLabel={dialogState?.confirmLabel}
        cancelLabel={dialogState?.cancelLabel}
        draftLabel={dialogState?.draftLabel}
        postConfirmMessage={dialogState?.postConfirmMessage}
      />
    ),
    [dialogState, closeDialog, handleConfirm, handleDraft]
  );

  return {
    requestConfirmation,
    ConfirmationDialog,
    confirmationKeywords: KEYWORDS,
  };
};
