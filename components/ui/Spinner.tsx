import { cn } from "@/utils/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-9 border-[3px]",
};

export function Spinner({
  size = "md",
  className,
  label = "Carregando",
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin rounded-full border-current border-r-transparent text-blue-600",
        sizeClasses[size],
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingScreen({
  message = "Carregando informações...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
      <Spinner size="lg" />
      <p className="text-sm font-medium text-slate-600">
        {message}
      </p>
    </div>
  );
}