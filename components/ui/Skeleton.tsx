import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-slate-200",
        className,
      )}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-20" />
        </div>

        <Skeleton className="size-9 rounded-lg" />
      </div>

      <Skeleton className="mt-4 h-3 w-40" />
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-5 gap-4 border-b border-slate-200 bg-slate-50 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={`header-${index}`}
            className="h-3"
          />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid grid-cols-5 gap-4 border-b border-slate-100 p-4 last:border-b-0"
        >
          {Array.from({ length: 5 }).map((_, columnIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${columnIndex}`}
              className="h-4"
            />
          ))}
        </div>
      ))}
    </div>
  );
}