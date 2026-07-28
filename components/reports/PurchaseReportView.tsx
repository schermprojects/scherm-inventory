"use client";

import {
  Download,
  FileText,
  Printer,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
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

type PurchaseItem = {
  equipmentId: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;

  physicalStock: number;
  minimumStock: number;
  totalNeeded: number;
  availableAfterDemand: number;
  purchaseQuantity: number;

  projectCount: number;
  projects: PurchaseProject[];

  isOutOfStock: boolean;
  isBelowMinimum: boolean;
  hasShortage: boolean;
};

type PurchasesSummary = {
  totalEquipment: number;
  equipmentWithShortage: number;
  totalPhysicalStock: number;
  totalNeeded: number;
  totalToPurchase: number;
  outOfStock: number;
  belowMinimum: number;
  affectedProjects: number;
};

type PurchasesResponse = {
  success: boolean;
  data?: PurchaseItem[];
  summary?: PurchasesSummary;
  message?: string;
  error?: string;
};

const initialSummary: PurchasesSummary = {
  totalEquipment: 0,
  equipmentWithShortage: 0,
  totalPhysicalStock: 0,
  totalNeeded: 0,
  totalToPurchase: 0,
  outOfStock: 0,
  belowMinimum: 0,
  affectedProjects: 0,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function getApiMessage(
  response: PurchasesResponse,
): string {
  return (
    response.message ??
    response.error ??
    "Não foi possível carregar o relatório."
  );
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function escapeCsvValue(
  value: string | number | null | undefined,
): string {
  const normalizedValue =
    value === null || value === undefined
      ? ""
      : String(value);

  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function getEquipmentDescription(
  item: PurchaseItem,
): string {
  return [
    item.manufacturer,
    item.model,
  ]
    .filter(Boolean)
    .join(" ");
}

export function PurchaseReportView() {
  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [summary, setSummary] =
    useState<PurchasesSummary>(
      initialSummary,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [generatedAt, setGeneratedAt] =
    useState<Date>(() => new Date());

  const loadReport =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/purchases",
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const result =
          (await response.json()) as PurchasesResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            getApiMessage(result),
          );
        }

        const purchaseItems =
          Array.isArray(result.data)
            ? result.data.filter(
                (item) =>
                  item.hasShortage &&
                  item.purchaseQuantity > 0,
              )
            : [];

        setItems(purchaseItems);

        setSummary(
          result.summary ??
            initialSummary,
        );

        setGeneratedAt(new Date());
      } catch (loadError) {
        setItems([]);
        setSummary(initialSummary);
        setError(
          getErrorMessage(loadError),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const reportTotals =
    useMemo(() => {
      const projectIds =
        new Set<string>();

      const values =
        items.reduce(
          (accumulator, item) => {
            accumulator.totalEquipment += 1;
            accumulator.totalStock +=
              item.physicalStock;
            accumulator.totalNeeded +=
              item.totalNeeded;
            accumulator.totalToPurchase +=
              item.purchaseQuantity;

            for (const project of item.projects) {
              projectIds.add(project.id);
            }

            return accumulator;
          },
          {
            totalEquipment: 0,
            totalProjects: 0,
            totalStock: 0,
            totalNeeded: 0,
            totalToPurchase: 0,
          },
        );

      values.totalProjects =
        projectIds.size;

      return values;
    }, [items]);

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    if (items.length === 0) {
      return;
    }

    const header = [
      "Equipamento",
      "Descrição",
      "Categoria",
      "Número de série",
      "Estoque físico",
      "Estoque mínimo",
      "Necessário",
      "Quantidade para compra",
      "Projetos afetados",
    ];

    const rows = items.map(
      (item) => [
        item.name,
        getEquipmentDescription(item),
        item.category,
        item.serialNumber ?? "",
        item.physicalStock,
        item.minimumStock,
        item.totalNeeded,
        item.purchaseQuantity,
        item.projectCount,
      ],
    );

    const csvContent = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) =>
            escapeCsvValue(value),
          )
          .join(";"),
      )
      .join("\r\n");

    const blob = new Blob(
      [
        "\uFEFF",
        csvContent,
      ],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    const fileDate =
      new Date()
        .toISOString()
        .slice(0, 10);

    link.href = url;
    link.download = `equipamentos-para-compra-${fileDate}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="space-y-5">
        <div className="report-actions flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              void loadReport()
            }
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Atualizar
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={
              loading ||
              items.length === 0
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={
              loading ||
              items.length === 0
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Printer size={16} />
            Imprimir / PDF
          </button>
        </div>

        <section
          id="purchase-report"
          className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
        >
          <header className="border-b border-zinc-200 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                  <FileText size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-zinc-900">
                    Relatório de Equipamentos para Compra
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Equipamentos com déficit para atender aos projetos ativos.
                  </p>
                </div>
              </div>

              <div className="text-left text-xs text-zinc-500 sm:text-right">
                <p>Emitido em</p>

                <p className="mt-1 font-semibold text-zinc-800">
                  {formatDateTime(
                    generatedAt,
                  )}
                </p>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <RefreshCw
                  size={24}
                  className="mx-auto animate-spin text-[#F57B00]"
                />

                <p className="mt-3 text-sm text-zinc-500">
                  Carregando relatório...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <p className="font-semibold text-red-600">
                Não foi possível carregar o relatório.
              </p>

              <p className="mt-2 max-w-lg text-sm text-zinc-500">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadReport()
                }
                className="report-actions mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <RefreshCw size={16} />
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 border-b border-zinc-200 md:grid-cols-4">
                <ReportMetric
                  label="Equipamentos"
                  value={
                    reportTotals.totalEquipment
                  }
                />

                <ReportMetric
                  label="Projetos afetados"
                  value={
                    reportTotals.totalProjects
                  }
                />

                <ReportMetric
                  label="Total necessário"
                  value={
                    reportTotals.totalNeeded
                  }
                />

                <ReportMetric
                  label="Total para compra"
                  value={
                    reportTotals.totalToPurchase
                  }
                  highlight
                />
              </div>

              {items.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center px-6 text-center">
                  <div>
                    <p className="font-semibold text-emerald-700">
                      Nenhuma compra necessária
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      O estoque atual cobre as necessidades dos projetos ativos.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <TableHeader>
                          Equipamento
                        </TableHeader>

                        <TableHeader>
                          Categoria
                        </TableHeader>

                        <TableHeader align="right">
                          Estoque
                        </TableHeader>

                        <TableHeader align="right">
                          Mínimo
                        </TableHeader>

                        <TableHeader align="right">
                          Necessário
                        </TableHeader>

                        <TableHeader align="right">
                          Comprar
                        </TableHeader>

                        <TableHeader align="center">
                          Projetos
                        </TableHeader>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map(
                        (item) => {
                          const description =
                            getEquipmentDescription(
                              item,
                            );

                          return (
                            <tr
                              key={
                                item.equipmentId
                              }
                              className="border-b border-zinc-100 last:border-b-0"
                            >
                              <td className="px-4 py-4">
                                <p className="font-semibold text-zinc-900">
                                  {item.name}
                                </p>

                                {description ? (
                                  <p className="mt-0.5 text-xs text-zinc-500">
                                    {description}
                                  </p>
                                ) : null}

                                {item.serialNumber ? (
                                  <p className="mt-0.5 text-[11px] text-zinc-400">
                                    SN:{" "}
                                    {
                                      item.serialNumber
                                    }
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-4 text-sm text-zinc-600">
                                {item.category}
                              </td>

                              <td className="px-4 py-4 text-right font-semibold tabular-nums text-zinc-700">
                                {
                                  item.physicalStock
                                }
                              </td>

                              <td className="px-4 py-4 text-right tabular-nums text-zinc-600">
                                {
                                  item.minimumStock
                                }
                              </td>

                              <td className="px-4 py-4 text-right font-semibold tabular-nums text-blue-700">
                                {
                                  item.totalNeeded
                                }
                              </td>

                              <td className="px-4 py-4 text-right">
                                <span className="inline-flex min-w-10 justify-center rounded-lg bg-red-50 px-3 py-1 font-bold tabular-nums text-red-600">
                                  {
                                    item.purchaseQuantity
                                  }
                                </span>
                              </td>

                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex min-w-8 justify-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
                                  {
                                    item.projectCount
                                  }
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                        <td
                          colSpan={2}
                          className="px-4 py-4 text-sm font-bold text-zinc-900"
                        >
                          Totais
                        </td>

                        <td className="px-4 py-4 text-right font-bold tabular-nums text-zinc-900">
                          {
                            reportTotals.totalStock
                          }
                        </td>

                        <td />

                        <td className="px-4 py-4 text-right font-bold tabular-nums text-blue-700">
                          {
                            reportTotals.totalNeeded
                          }
                        </td>

                        <td className="px-4 py-4 text-right font-bold tabular-nums text-red-600">
                          {
                            reportTotals.totalToPurchase
                          }
                        </td>

                        <td className="px-4 py-4 text-center font-bold tabular-nums text-zinc-900">
                          {
                            reportTotals.totalProjects
                          }
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <footer className="border-t border-zinc-200 px-6 py-4 text-xs text-zinc-400">
                Dados obtidos da lista de compras do sistema.
                Total geral informado pela API:{" "}
                {summary.totalToPurchase} unidade(s).
              </footer>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          aside,
          nav,
          .report-actions {
            display: none !important;
          }

          #purchase-report {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          #purchase-report table {
            min-width: 0 !important;
            width: 100% !important;
          }

          #purchase-report th,
          #purchase-report td {
            padding: 8px !important;
            font-size: 10px !important;
          }

          #purchase-report header {
            padding: 0 0 14px !important;
          }

          #purchase-report footer {
            padding: 12px 0 0 !important;
          }

          #purchase-report tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}

function ReportMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="border-b border-r border-zinc-200 p-4 last:border-r-0 md:border-b-0">
      <p className="text-xs font-medium text-zinc-500">
        {label}
      </p>

      <p
        className={[
          "mt-1 text-2xl font-bold tabular-nums",
          highlight
            ? "text-red-600"
            : "text-zinc-900",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?:
    | "left"
    | "center"
    | "right";
}) {
  const alignments = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${alignments[align]}`}
    >
      {children}
    </th>
  );
}