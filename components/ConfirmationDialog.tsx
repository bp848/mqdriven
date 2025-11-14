
import React from 'react';
import { ConfirmationDialogProps } from '../types';
import { X, AlertTriangle } from './Icons';

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ isOpen, title, message, onConfirm, onClose }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600">
            キャンセル
          </button>
          <button onClick={handleConfirm} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700">
            実行する
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
