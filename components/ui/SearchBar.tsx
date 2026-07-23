"use client";

import { Search, X } from "lucide-react";

import { cn } from "@/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showShortcut?: boolean;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Pesquisar...",
  className,
  showShortcut = false,
  disabled = false,
}: SearchBarProps) {
  return (
    <label className={cn("relative block w-full", className)}>
      <span className="sr-only">{placeholder}</span>

      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />

      <input
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 text-sm text-slate-900",
          "placeholder:text-slate-400",
          "focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10",
          "disabled:cursor-not-allowed disabled:bg-slate-100",
          value ? "pr-10" : showShortcut ? "pr-16" : "pr-3",
        )}
      />

      {value ? (
        <button
          type="button"
          aria-label="Limpar pesquisa"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={15} />
        </button>
      ) : showShortcut ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-400">
          Ctrl K
        </span>
      ) : null}
    </label>
  );
}