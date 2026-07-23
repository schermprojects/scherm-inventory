import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export type BadgeVariant =
  | "default"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "gray"
  | "purple";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  green: "bg-green-50 text-green-700 ring-green-600/20",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
        "text-[11px] font-semibold leading-none ring-1 ring-inset",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
