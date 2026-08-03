'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type };

    setToasts((prev) => {
      // Prevent duplicate messages
      const exists = prev.some((t) => t.message === message && t.type === type);
      if (exists) return prev;
      return [...prev, newToast];
    });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isInfo = toast.type === 'info';

          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              aria-live={isError ? 'assertive' : 'polite'}
              className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold text-white transition-all animate-in slide-in-from-bottom-5 duration-200 pointer-events-auto ${
                isSuccess
                  ? 'bg-emerald-600 shadow-emerald-200'
                  : isError
                  ? 'bg-rose-600 shadow-rose-200'
                  : 'bg-blue-600 shadow-blue-200'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 shrink-0" />}
              {isInfo && <Info className="w-5 h-5 shrink-0" />}
              <span>{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="ml-2 text-white/80 hover:text-white transition-colors"
                aria-label="Đóng thông báo"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
