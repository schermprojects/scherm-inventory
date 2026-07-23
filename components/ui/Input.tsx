import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/utils/cn";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      id,
      label,
      error,
      hint,
      leftIcon,
      rightElement,
      className,
      containerClassName,
      required,
      disabled,
      ...props
    },
    ref,
  ) {
    const inputId =
      id ??
      `input-${label?.toLowerCase().replace(/\s+/g, "-") ?? "field"}`;

    const descriptionId = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            {label}

            {required ? (
              <span className="ml-1 text-red-500">*</span>
            ) : null}
          </label>
        ) : null}

        <div className="relative">
          {leftIcon ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              {leftIcon}
            </div>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={descriptionId}
            className={cn(
              "h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900",
              "placeholder:text-slate-400",
              "transition-colors",
              "focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
              "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
              leftIcon && "pl-10",
              rightElement && "pr-10",
              error
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                : "border-slate-200",
              className,
            )}
            {...props}
          />

          {rightElement ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {rightElement}
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs font-medium text-red-600"
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-xs text-slate-500"
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);