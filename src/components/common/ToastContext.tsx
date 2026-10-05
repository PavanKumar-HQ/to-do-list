import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContextType {
  showToast: (message: string, options?: { actionLabel?: string; onAction?: () => void; type?: ToastMessage['type'] }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, options?: { actionLabel?: string; onAction?: () => void; type?: ToastMessage['type'] }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      id,
      message,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      type: options?.type || 'info'
    };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.actionLabel ? 6000 : 3500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" role="alert">
            <span>{toast.message}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.actionLabel && toast.onAction && (
                <button
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id);
                  }}
                  style={{
                    color: '#60a5fa',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    padding: '4px 6px'
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                onClick={() => dismissToast(toast.id)}
                style={{ color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }}
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
