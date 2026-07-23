"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/utils/cn";

export type ToastType =
  | "success"
  | "error"
  | "warning"
  | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

export const ToastContext =
  createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastType,
  {
    container: string;
    icon: string;
    iconComponent: typeof CheckCircle2;
  }
> = {
  success: {
    container: "border-green-200",
    icon: "text-green-600",
    iconComponent: CheckCircle2,
  },
  error: {
    container: "border-red-200",
    icon: "text-red-600",
    iconComponent: XCircle,
  },
  warning: {
    container: "border-amber-200",
    icon: "text-amber-600",
    iconComponent: AlertCircle,
  },
  info: {
    container: "border-blue-200",
    icon: "text-blue-600",
    iconComponent: Info,
  },
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) =>
      current.filter((item) => item.id !== id),
    );
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      type = "info",
      duration = 4000,
    }: ToastOptions) => {
      const id = crypto.randomUUID();

      setToasts((current) => [
        ...current,
        {
          id,
          title,
          description,
          type,
          duration,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({
          title,
          description,
          type: "success",
        }),
      error: (title, description) =>
        toast({
          title,
          description,
          type: "error",
        }),
      warning: (title, description) =>
        toast({
          title,
          description,
          type: "warning",
        }),
      info: (title, description) =>
        toast({
          title,
          description,
          type: "info",
        }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      >
        {toasts.map((item) => {
          const type = item.type ?? "info";
          const style = toastStyles[type];
          const Icon = style.iconComponent;

          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-xl",
                style.container,
              )}
            >
              <Icon
                size={20}
                className={cn(
                  "mt-0.5 shrink-0",
                  style.icon,
                )}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>

                {item.description ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                aria-label="Fechar notificação"
                onClick={() => removeToast(item.id)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}