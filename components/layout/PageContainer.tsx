import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
};

export function PageContainer({
  children,
  title,
  description,
  actions,
  breadcrumb,
}: PageContainerProps) {
  return (
    <main className="flex-1 bg-[#F6F7F9]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {breadcrumb ? <div className="mb-4">{breadcrumb}</div> : null}

        {title || description || actions ? (
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              {title ? (
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                  {title}
                </h1>
              ) : null}

              {description ? (
                <p className="mt-1 text-sm text-zinc-500">
                  {description}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </main>
  );
}