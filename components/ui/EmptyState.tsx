import type {
  LucideIcon,
} from "lucide-react";

import { PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "Nenhum registro encontrado",
  description = "Não existem dados disponíveis para os filtros selecionados.",
  icon: Icon = PackageOpen,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={23} aria-hidden="true" />
      </div>

      <h2 className="mt-4 text-sm font-semibold text-slate-950">
        {title}
      </h2>

      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      {actionLabel && onAction ? (
        <Button
          className="mt-5"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}