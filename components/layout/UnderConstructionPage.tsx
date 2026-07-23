import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Construction,
  LayoutDashboard,
} from "lucide-react";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";

type UnderConstructionPageProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function UnderConstructionPage({
  title,
  description = "Esta funcionalidade está sendo preparada e estará disponível em breve.",
  backHref = "/dashboard",
  backLabel = "Voltar ao dashboard",
}: UnderConstructionPageProps) {
  return (
    <DashboardLayout>
      <PageContainer
        title={title}
        description={description}
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: title,
              },
            ]}
          />
        }
      >
        <section className="flex min-h-[520px] items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-50 text-[#F57B00]">
              <Construction size={38} strokeWidth={1.8} />
            </div>

            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#D96D00]">
              <CalendarClock size={14} />
              Funcionalidade em desenvolvimento
            </span>

            <h2 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900">
              {title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {description}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={backHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ArrowLeft size={17} />
                {backLabel}
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <LayoutDashboard size={17} />
                Ir para o dashboard
              </Link>
            </div>

            <div className="mt-10 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <p className="text-xs leading-5 text-zinc-600">
                O cadastro e a consulta do inventário continuam disponíveis
                normalmente. Esta página não interfere nos dados já registrados.
              </p>
            </div>
          </div>
        </section>
      </PageContainer>
    </DashboardLayout>
  );
}