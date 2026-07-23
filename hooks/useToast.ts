"use client";

import { useContext } from "react";
import {
  ToastContext,
  type ToastContextValue,
} from "@/components/ui/Toast";

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast precisa ser usado dentro de ToastProvider.",
    );
  }

  return context;
}