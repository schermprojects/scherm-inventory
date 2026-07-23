import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Wrench,
} from "lucide-react";

import {
  recentMovements,
  type RecentMovement,
} from "@/data/dashboard";

const movementStyles: Record<
  RecentMovement["type"],
  {
    icon: typeof ArrowDownToLine;
    className: string;
  }
> = {
  Entrada: {
    icon: ArrowDownToLine,
    className: "bg-emerald-50 text-emerald-700",
  },
  Saída: {
    icon: ArrowUpFromLine,
    className: "bg-red-50 text-red-700",
  },
  Transferência: {
    icon: ArrowLeftRight,
    className: "bg-blue-50 text-blue-700",
  },
  Manutenção: {
    icon: Wrench,
    className: "bg-amber-50 text-amber-700",
  },
};

export function RecentMovements() {
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex flex-col justify-between gap-3 border-b border-zinc-200 px-5 py-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Movimentações recentes
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Últimas alterações registradas no inventário.
          </p>
        </div>

        <button
          type="button"
          className="self-start text-sm font-semibold text-[#F57B00] transition hover:text-[#D96D00]"
        >
          Ver todas
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Equipamento
              </th>

              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Tipo
              </th>

              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Destino
              </th>

              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Responsável
              </th>

              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Data
              </th>
            </tr>
          </thead>

          <tbody>
            {recentMovements.map((movement) => {
              const movementStyle =
                movementStyles[movement.type];

              const Icon = movementStyle.icon;

              return (
                <tr
                  key={movement.id}
                  className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-zinc-900">
                      {movement.equipment}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {movement.patrimony}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${movementStyle.className}`}
                    >
                      <Icon size={14} />
                      {movement.type}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-zinc-600">
                    {movement.destination}
                  </td>

                  <td className="px-5 py-4 text-sm text-zinc-600">
                    {movement.responsible}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-sm text-zinc-500">
                    {movement.date}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}