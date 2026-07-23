import {
  forwardRef,
  type SelectHTMLAttributes,
} from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/utils/cn";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      id,
      label,
      error,
      hint,
      options,
      placeholder,
      className,
      containerClassName,
      required,
      disabled,
      ...props
    },
    ref,
  ) {
    const selectId =
      id ??
      `select-${label?.toLowerCase().replace(/\s+/g, "-") ?? "field"}`;

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-xs font-semibold text-slate-700"
          >
            {label}

            {required ? (
              <span className="ml-1 text-red-500">*</span>
            ) : null}
          </label>
        ) : null}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={cn(
              "h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900",
              "focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
              "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
              error
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                : "border-slate-200",
              className,
            )}
            {...props}
          >
            {placeholder ? (
              <option value="">{placeholder}</option>
            ) : null}

            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        {error ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-slate-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);