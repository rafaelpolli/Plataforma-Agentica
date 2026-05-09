import { useState, useEffect, useCallback } from 'react';

interface Toast {
  id: number;
  message: string;
}

let toastId = 0;
let globalAddToast: ((msg: string) => void) | null = null;

export function showToast(msg: string) {
  globalAddToast?.(msg);
}

export function Toast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((msg: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message: msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => { globalAddToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 transition-all duration-350"
          style={{
            opacity: i === toasts.length - 1 ? 1 : 0.5,
            transform: `translateY(${(toasts.length - 1 - i) * -4}px)`,
          }}
        >
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,98,0,0.1)' }}>
            <svg className="w-3 h-3" fill="none" stroke="#FF6200" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-semibold text-sm">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
