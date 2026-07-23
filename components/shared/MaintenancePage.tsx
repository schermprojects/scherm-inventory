import {
  Construction,
  HardHat,
  PackageSearch,
} from "lucide-react";
import Link from "next/link";

type MaintenancePageProps = {
  title: string;
  description?: string;
};

export function MaintenancePage({
  title,
  description = "Este módulo está sendo preparado e ficará disponível em uma próxima atualização.",
}: MaintenancePageProps) {
  return (
    <div className="flex min-h-[560px] items-center justify-center">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#F57B00]">
          <Construction size={30} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F57B00]">
          <HardHat size={15} />
          Em manutenção
        </div>

        <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
          {title}
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-500">
          {description}
        </p>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-600">
            <PackageSearch size={18} />
            Cadastro e inventário continuam disponíveis normalmente.
          </div>
        </div>

        <Link
          href="/inventory"
          className="mt-7 inline-flex h-11 items-center justify-center rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          Acessar inventário
        </Link>
      </section>
    </div>
  );
}