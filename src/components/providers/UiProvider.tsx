'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XIcon } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface UiContextValue {
  toast: (kind: ToastKind, text: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<{
    opts: ConfirmOptions;
    resolve: (b: boolean) => void;
  } | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ opts, resolve });
    });
  }, []);

  const value: UiContextValue = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  // Close confirm on Escape, accept on Enter.
  useEffect(() => {
    if (!pendingConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pendingConfirm.resolve(false);
        setPendingConfirm(null);
      } else if (e.key === 'Enter') {
        pendingConfirm.resolve(true);
        setPendingConfirm(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingConfirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-3 py-2 rounded-md shadow-xl text-sm border backdrop-blur-sm ${
              t.kind === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
                : t.kind === 'error'
                  ? 'bg-red-500/15 border-red-500/40 text-red-100'
                  : 'bg-slate-900/90 border-slate-700 text-slate-100'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            ) : t.kind === 'error' ? (
              <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span className="whitespace-pre-wrap break-words">{t.text}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 text-slate-400 hover:text-slate-100"
              aria-label="Dismiss"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            pendingConfirm.resolve(false);
            setPendingConfirm(null);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <h3 className="text-base font-semibold text-slate-100">
                {pendingConfirm.opts.title}
              </h3>
              {pendingConfirm.opts.description && (
                <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">
                  {pendingConfirm.opts.description}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  pendingConfirm.resolve(false);
                  setPendingConfirm(null);
                }}
                className="px-3 py-1.5 rounded-md text-sm border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {pendingConfirm.opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  pendingConfirm.resolve(true);
                  setPendingConfirm(null);
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pendingConfirm.opts.destructive
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {pendingConfirm.opts.confirmLabel ??
                  (pendingConfirm.opts.destructive ? 'Confirm' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}
