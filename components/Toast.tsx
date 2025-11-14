
import React, { useEffect } from 'react';
import { Toast } from '../types';
import { CheckCircle, AlertTriangle, X } from './Icons';

interface ToastMessageProps {
  toast: Toast;
  onDismiss: (id: number) => void;
}

const ToastMessage: React.FC<ToastMessageProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-500" />,
    error: <AlertTriangle className="w-6 h-6 text-red-500" />,
    info: <AlertTriangle className="w-6 h-6 text-blue-500" />,
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-700',
    error: 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-700',
    info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700',
  };

  return (
    <div className={`w-full max-w-sm p-4 rounded-xl shadow-lg border ${colors[toast.type]} flex items-start gap-3 animate-fade-in-up`}>
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</div>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-8 right-8 z-[200] space-y-3">
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
