import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items?: BreadcrumbItem[];
};

export function Breadcrumb({ items = [] }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-2 text-sm text-zinc-500"
    >
      <Link
        href="/dashboard"
        className="transition hover:text-[#F57B00]"
        aria-label="Dashboard"
      >
        <Home size={16} />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            <ChevronRight size={15} className="text-zinc-400" />

            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition hover:text-[#F57B00]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast ? "font-medium text-zinc-900" : "text-zinc-500"
                }
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}