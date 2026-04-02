"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

/** トーストの型 */
type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

/** トースト表示フック */
export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

/** トースト通知プロバイダー（layout.tsxで使用） */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* トースト表示エリア */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastMessage key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 個別トーストメッセージ */
function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colorMap: Record<ToastType, string> = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
  };

  const iconMap: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "i",
  };

  return (
    <div
      className={`${colorMap[toast.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-up pointer-events-auto`}
    >
      <span className="text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full bg-white/20">
        {iconMap[toast.type]}
      </span>
      {toast.message}
    </div>
  );
}
