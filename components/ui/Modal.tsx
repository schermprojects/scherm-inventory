"use client";

import {
  useEffect,
  useId,
  type MouseEvent,
  type ReactNode,
} from "react";

import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[calc(100vw-2rem)]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  showCloseButton = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function handleOverlayClick(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (
      closeOnOverlay &&
      event.target === event.currentTarget
    ) {
      onClose();
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl",
          sizeClasses[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-base font-bold text-slate-950"
            >
              {title}
            </h2>

            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-slate-500"
              >
                {description}
              </p>
            ) : null}
          </div>

          {showCloseButton ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Fechar modal"
              onClick={onClose}
              className="shrink-0"
            >
              <X size={18} />
            </Button>
          ) : null}
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}