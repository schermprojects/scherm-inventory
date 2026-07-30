"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type PurchaseProject = {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
  quantity: number;
};

type PurchasePrintItem = {
  equipmentId: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;

  physicalStock: number;
  minimumStock: number;
  totalNeeded: number;
  purchaseQuantity: number;

  projectCount: number;
  projects: PurchaseProject[];

  isOutOfStock: boolean;
  isBelowMinimum: boolean;
  hasShortage: boolean;
};

type PurchasesPrintViewProps = {
  items: PurchasePrintItem[];
};

const statusLabels: Record<
  ProjectStatus,
  string
> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function formatDescription(
  item: PurchasePrintItem,
): string {
  return [
    item.manufacturer,
    item.model,
  ]
    .filter(Boolean)
    .join(" ");
}

export function PurchasesPrintView({
  items,
}: PurchasesPrintViewProps) {
  const [issuedAt, setIssuedAt] =
    useState("");

  useEffect(() => {
    setIssuedAt(
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "short",
        },
      ).format(new Date()),
    );
  }, []);

  const summary = useMemo(() => {
    const projectIds =
      new Set<string>();

    let totalUnits = 0;
    let outOfStock = 0;
    let totalNeeded = 0;

    for (const item of items) {
      totalUnits +=
        item.purchaseQuantity;

      totalNeeded +=
        item.totalNeeded;

      if (item.isOutOfStock) {
        outOfStock += 1;
      }

      for (const project of item.projects) {
        projectIds.add(project.id);
      }
    }

    return {
      equipment: items.length,
      totalUnits,
      projects: projectIds.size,
      outOfStock,
      totalNeeded,
    };
  }, [items]);

 return (
  <>
    <style>{`
      @page {
        size: A4 portrait;
        margin: 12mm;
      }

      @media print {
        html,
        body {
          margin: 0 !important;
          background: #ffffff !important;
        }

        body * {
          visibility: hidden !important;
        }

        .purchase-print-document,
        .purchase-print-document * {
          visibility: visible !important;
        }

        .purchase-print-document {
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #18181b !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .purchase-print-document img {
          display: block !important;
          visibility: visible !important;
          max-width: 100% !important;
        }

        .purchase-print-section,
        .purchase-print-row,
        .purchase-print-footer {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .purchase-print-document thead {
          display: table-header-group;
        }

        .purchase-print-document tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    `}</style>

    <article className="purchase-print-document hidden bg-white font-sans text-zinc-900 print:block">
       <header className="purchase-print-header">
  <div className="h-1.5 w-full bg-[#F57B00]" />

  <div className="flex items-center justify-between gap-8 border-b-2 border-zinc-800 px-1 py-5">
    <div className="flex items-center gap-5">
      <img
        src="/logo/scherm-logo-clara.png"
        alt="Scherm"
        className="h-14 w-auto max-w-[230px] object-contain"
      />

      <div className="border-l border-zinc-300 pl-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-600">
          Scherm Inventory
        </p>

        <p className="mt-1 text-[9px] text-zinc-500">
          Controle interno de equipamentos e projetos
        </p>

        <div className="mt-3 h-0.5 w-28 rounded-full bg-[#F57B00]" />
      </div>
    </div>

    <div className="text-right">
      <p className="text-[16px] font-bold uppercase tracking-wide text-[#F57B00]">
        Lista de compras
      </p>

      <p className="mt-1 text-[10px] font-semibold text-zinc-700">
        Equipamentos pendentes para aquisição
      </p>

      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-400">
        Documento interno
      </p>
    </div>
  </div>
</header>

       <section className="purchase-print-section mt-5">
  <div className="flex items-end justify-between gap-6">
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F57B00]">
        Relatório de necessidades
      </p>

      <h1 className="mt-1 text-[22px] font-bold text-zinc-900">
        Compras para projetos ativos
      </h1>

      <p className="mt-1 text-[10px] text-zinc-500">
        Equipamentos necessários para atender as demandas atuais.
      </p>
    </div>

    <div className="shrink-0 text-right">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400">
        Emitido em
      </p>

      <p className="mt-1 text-[10px] font-semibold text-zinc-700">
        {issuedAt || "—"}
      </p>
    </div>
  </div>

  <div className="mt-4 h-px w-full bg-zinc-200" />
</section>

        <section className="mt-5 grid grid-cols-4 gap-3">
          <PrintMetric
            label="Equipamentos"
            value={summary.equipment}
            suffix="item(ns)"
            tone="orange"
          />

          <PrintMetric
            label="Comprar"
            value={summary.totalUnits}
            suffix="unidade(s)"
            tone={
              summary.totalUnits > 0
                ? "red"
                : "green"
            }
          />

          <PrintMetric
            label="Projetos"
            value={summary.projects}
            suffix="afetado(s)"
            tone="blue"
          />

          <PrintMetric
            label="Sem estoque"
            value={summary.outOfStock}
            suffix="item(ns)"
            tone={
              summary.outOfStock > 0
                ? "red"
                : "green"
            }
          />
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-4 border-b-2 border-zinc-400 pb-2">
            <div>
              <h2 className="text-[13px] font-bold text-zinc-900">
                Equipamentos necessários para compra
              </h2>

              <p className="mt-1 text-[9px] text-zinc-500">
                Quantidades faltantes considerando os projetos ativos.
              </p>
            </div>

            <p className="text-[9px] text-zinc-500">
              {summary.equipment} item(ns) ·{" "}
              {summary.totalUnits} unidade(s) para comprar
            </p>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-8 text-center">
              <p className="text-[13px] font-bold text-emerald-700">
                Nenhuma compra necessária
              </p>

              <p className="mt-1 text-[10px] text-emerald-600">
                O estoque cobre as necessidades atuais dos projetos.
              </p>
            </div>
          ) : (
            <table className="mt-4 w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b-2 border-[#F57B00] bg-orange-50">
                  <PrintTableHeader className="w-[27%]">
                    Equipamento
                  </PrintTableHeader>

                  <PrintTableHeader className="w-[15%]">
                    Categoria
                  </PrintTableHeader>

                  <PrintTableHeader className="w-[27%]">
                    Projetos
                  </PrintTableHeader>

                  <PrintTableHeader
                    className="w-[9%]"
                    align="right"
                  >
                    Estoque
                  </PrintTableHeader>

                  <PrintTableHeader
                    className="w-[10%]"
                    align="right"
                  >
                    Necessário
                  </PrintTableHeader>

                  <PrintTableHeader
                    className="w-[12%]"
                    align="right"
                  >
                    Comprar
                  </PrintTableHeader>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const description =
                    formatDescription(item);

                  return (
                    <tr
                      key={item.equipmentId}
                      className="border-b border-zinc-200 align-top"
                    >
                      <td className="px-2 py-3">
                        <p className="text-[10px] font-bold text-zinc-900">
                          {item.name}
                        </p>

                        {description ? (
                          <p className="mt-1 text-[8px] text-zinc-500">
                            {description}
                          </p>
                        ) : null}

                        {item.serialNumber ? (
                          <p className="mt-1 text-[8px] text-zinc-400">
                            SN: {item.serialNumber}
                          </p>
                        ) : null}

                        {item.isOutOfStock ? (
                          <span className="mt-2 inline-flex rounded bg-red-50 px-2 py-1 text-[8px] font-bold uppercase text-red-700">
                            Sem estoque
                          </span>
                        ) : item.isBelowMinimum ? (
                          <span className="mt-2 inline-flex rounded bg-amber-50 px-2 py-1 text-[8px] font-bold uppercase text-amber-700">
                            Estoque mínimo
                          </span>
                        ) : null}
                      </td>

                      <td className="px-2 py-3 text-[9px] text-zinc-700">
                        {item.category}
                      </td>

                      <td className="px-2 py-3">
                        <div className="space-y-1.5">
                          {item.projects.map(
                            (project) => (
                              <div
                                key={project.id}
                                className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[8px] font-semibold text-zinc-800">
                                      {project.name}
                                    </p>

                                    <p className="mt-0.5 text-[7px] text-zinc-500">
                                      {project.clientName ||
                                        "Cliente não informado"}
                                    </p>
                                  </div>

                                  <span className="shrink-0 text-[7px] font-semibold text-zinc-500">
                                    {
                                      statusLabels[
                                        project.status
                                      ]
                                    }
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-3 text-right text-[10px] font-semibold tabular-nums text-zinc-700">
                        {item.physicalStock}
                      </td>

                      <td className="px-2 py-3 text-right text-[10px] font-semibold tabular-nums text-blue-700">
                        {item.totalNeeded}
                      </td>

                      <td className="px-2 py-3 text-right">
                        <span className="inline-flex min-w-10 justify-center rounded bg-red-50 px-2 py-1 text-[11px] font-bold tabular-nums text-red-600">
                          {item.purchaseQuantity}
                        </span>

                        <p className="mt-1 text-[7px] font-semibold uppercase tracking-wide text-red-500">
                          faltando
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-zinc-300 pt-3 text-[8px] text-zinc-400">
          <p>
            SCHERM Inventory · Documento interno
          </p>

          <p>
            Total necessário:{" "}
            <strong className="text-zinc-600">
              {summary.totalNeeded}
            </strong>
            {" · "}
            Total para compra:{" "}
            <strong className="text-red-600">
              {summary.totalUnits}
            </strong>
          </p>
        </footer>
          </article>
  </>
);
}

function PrintMetric({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix: string;
  tone:
    | "orange"
    | "blue"
    | "green"
    | "red";
}) {
  const colors = {
    orange: "border-orange-200 text-[#F57B00]",
    blue: "border-blue-200 text-blue-700",
    green: "border-emerald-200 text-emerald-700",
    red: "border-red-200 text-red-600",
  };

  return (
    <article
      className={`border-l-4 bg-white px-3 py-2.5 ${colors[tone]}`}
    >
      <p className="text-[8px] font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <div className="mt-1 flex items-end gap-2">
        <p className="text-[20px] font-bold leading-none tabular-nums">
          {value}
        </p>

        <p className="pb-0.5 text-[8px] text-zinc-500">
          {suffix}
        </p>
      </div>
    </article>
  );
}

function PrintTableHeader({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={[
        "px-2 py-2 text-[8px] font-bold uppercase tracking-wide text-zinc-700",
        align === "right"
          ? "text-right"
          : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}