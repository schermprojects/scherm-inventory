"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Package,
  PackageOpen,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { EquipmentStockEntryModal } from "@/components/inventory/EquipmentStockEntryModal";
import { PurchasesPrintView } from "@/components/purchases/PurchasesPrintView";

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
  categories?: string[];
  summary?: PurchasesSummary;
  message?: string;
  error?: string;
};

type SortOption =
  | "shortage-desc"
  | "shortage-asc"
  | "needed-desc"
  | "stock-asc"
  | "name-asc";

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

type PurchasesViewProps = {
  reportMode?: boolean;
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

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function getApiMessage(
  data: PurchasesResponse,
): string | undefined {
  return data.message ?? data.error;
}

function getEquipmentDescription(
  item: PurchaseItem,
): string {
  return [item.manufacturer, item.model]
    .filter(Boolean)
    .join(" ");
}

export function PurchasesView({
  reportMode = false,
}: PurchasesViewProps) {
  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [categories, setCategories] =
    useState<string[]>([]);

  const [summary, setSummary] =
    useState<PurchasesSummary>(
      initialSummary,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState("");

  const [
    onlyShortages,
    setOnlyShortages,
  ] = useState(true);

  const [sort, setSort] =
    useState<SortOption>(
      "shortage-desc",
    );

  const [
    stockEntryEquipment,
    setStockEntryEquipment,
  ] = useState<PurchaseItem | null>(
    null,
  );

  const [
    expandedEquipmentIds,
    setExpandedEquipmentIds,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  const [feedback, setFeedback] =
    useState<FeedbackState | null>(
      null,
    );

  const [issuedAt] = useState(
  () => new Date().toISOString(),
);

  const loadPurchases =
    useCallback(
      async (refresh = false) => {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        try {
          const response = await fetch(
            "/api/purchases",
            {
              method: "GET",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            },
          );

          const data =
            (await response.json()) as PurchasesResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              getApiMessage(data) ??
                "Não foi possível carregar a lista de compras.",
            );
          }

          setItems(
            Array.isArray(data.data)
              ? data.data
              : [],
          );

          setCategories(
            Array.isArray(
              data.categories,
            )
              ? data.categories
              : [],
          );

          setSummary(
            data.summary ??
              initialSummary,
          );

          if (refresh) {
            setFeedback({
              type: "success",
              message:
                "Lista de compras atualizada.",
            });
          }
        } catch (error) {
          setItems([]);
          setCategories([]);
          setSummary(initialSummary);

          setFeedback({
            type: "error",
            message:
              getErrorMessage(error),
          });
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const visibleCategories =
    useMemo(() => {
      if (onlyShortages) {
        return categories;
      }

      return Array.from(
        new Set(
          items
            .map((item) =>
              item.category.trim(),
            )
            .filter(Boolean),
        ),
      ).sort((first, second) =>
        first.localeCompare(
          second,
          "pt-BR",
          {
            sensitivity: "base",
          },
        ),
      );
    }, [
      categories,
      items,
      onlyShortages,
    ]);

  useEffect(() => {
    if (
      selectedCategory &&
      !visibleCategories.includes(
        selectedCategory,
      )
    ) {
      setSelectedCategory("");
    }
  }, [
    selectedCategory,
    visibleCategories,
  ]);

  const filteredItems =
    useMemo(() => {
      const normalizedSearch =
        normalizeText(search);

      const result = items.filter(
        (item) => {
          if (
            onlyShortages &&
            !item.hasShortage
          ) {
            return false;
          }

          if (
            selectedCategory &&
            item.category !==
              selectedCategory
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const searchableText =
            normalizeText(
              [
                item.name,
                item.category,
                item.manufacturer,
                item.model,
                item.serialNumber,
                ...item.projects.flatMap(
                  (project) => [
                    project.name,
                    project.clientName,
                  ],
                ),
              ]
                .filter(Boolean)
                .join(" "),
            );

          return searchableText.includes(
            normalizedSearch,
          );
        },
      );

      return [...result].sort(
        (first, second) => {
          switch (sort) {
            case "shortage-asc":
              return (
                first.purchaseQuantity -
                  second.purchaseQuantity ||
                first.name.localeCompare(
                  second.name,
                  "pt-BR",
                )
              );

            case "needed-desc":
              return (
                second.totalNeeded -
                  first.totalNeeded ||
                second.purchaseQuantity -
                  first.purchaseQuantity
              );

            case "stock-asc":
              return (
                first.physicalStock -
                  second.physicalStock ||
                second.purchaseQuantity -
                  first.purchaseQuantity
              );

            case "name-asc":
              return first.name.localeCompare(
                second.name,
                "pt-BR",
                {
                  sensitivity:
                    "base",
                },
              );

            case "shortage-desc":
            default:
              return (
                second.purchaseQuantity -
                  first.purchaseQuantity ||
                first.physicalStock -
                  second.physicalStock ||
                first.name.localeCompare(
                  second.name,
                  "pt-BR",
                )
              );
          }
        },
      );
    }, [
      items,
      onlyShortages,
      search,
      selectedCategory,
      sort,
    ]);

  const filteredSummary =
    useMemo(() => {
      const projectIds =
        new Set<string>();

      const values =
        filteredItems.reduce(
          (accumulator, item) => {
            accumulator.items += 1;
            accumulator.needed +=
              item.totalNeeded;
            accumulator.toPurchase +=
              item.purchaseQuantity;

            for (const project of item.projects) {
              projectIds.add(
                project.id,
              );
            }

            return accumulator;
          },
          {
            items: 0,
            projects: 0,
            needed: 0,
            toPurchase: 0,
          },
        );

      values.projects =
        projectIds.size;

      return values;
    }, [filteredItems]);

  const hasChangedFilters =
    Boolean(search.trim()) ||
    Boolean(selectedCategory) ||
    !onlyShortages ||
    sort !== "shortage-desc";

  function clearFilters() {
    setSearch("");
    setSelectedCategory("");
    setOnlyShortages(true);
    setSort("shortage-desc");
  }

  function toggleEquipment(
    equipmentId: string,
  ) {
    setExpandedEquipmentIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(equipmentId)
        ) {
          next.delete(equipmentId);
        } else {
          next.add(equipmentId);
        }

        return next;
      },
    );
  }

  function openStockEntry(
    item: PurchaseItem,
  ) {
    if (reportMode) {
      return;
    }

    setStockEntryEquipment(item);
  }

  function closeStockEntry() {
    setStockEntryEquipment(null);
  }

  async function handleStockEntrySuccess() {
    setStockEntryEquipment(null);
    await loadPurchases();
  }

  function handlePrint() {
  window.print();
}

 return (
  <>
    <PurchasesPrintView
      items={filteredItems}
      issuedAt={issuedAt}
    />

    <div className="space-y-5 print:hidden">      
      {!reportMode ? (
        <header className="print-hidden flex flex-wrap justify-end gap-2">
        <button
        type="button"
        onClick={handlePrint}
        disabled={loading}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Printer
        size={17}
        aria-hidden="true"
      />

      Imprimir / PDF
    </button>

    <button
      type="button"
      onClick={() =>
        void loadPurchases(true)
      }
      disabled={
        refreshing || loading
      }
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        size={17}
        className={
          refreshing
            ? "animate-spin"
            : ""
        }
        aria-hidden="true"
      />

      {refreshing
        ? "Atualizando..."
        : "Atualizar"}
    </button>
  </header>
) : null}

      <div className="print-only">
  <h1 className="text-2xl font-bold text-zinc-900">
    Lista de compras
  </h1>

  <p className="mt-1 text-sm text-zinc-600">
    Equipamentos pendentes para os projetos ativos.
  </p>

  <p className="mt-1 text-xs text-zinc-500">
    Emitido em{" "}
{new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(issuedAt))}
  </p>
</div>

      {feedback ? (
        <div
          className={[
  "print-hidden flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
            feedback.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          <span>
            {feedback.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setFeedback(null)
            }
            aria-label="Fechar mensagem"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          title="Itens"
          value={
            summary.equipmentWithShortage
          }
          suffix="para comprar"
          icon={
            <ShoppingCart
              size={20}
            />
          }
          tone={
            summary.equipmentWithShortage >
            0
              ? "orange"
              : "green"
          }
        />

        <SummaryCard
          title="Comprar"
          value={
            summary.totalToPurchase
          }
          suffix="unidades"
          icon={
            <Package size={20} />
          }
          tone={
            summary.totalToPurchase >
            0
              ? "red"
              : "green"
          }
        />

        <SummaryCard
          title="Projetos"
          value={
            summary.affectedProjects
          }
          suffix="afetados"
          icon={
            <ClipboardList
              size={20}
            />
          }
          tone="blue"
        />

        <SummaryCard
          title="Sem estoque"
          value={summary.outOfStock}
          suffix="itens"
          icon={
            <PackageOpen
              size={20}
            />
          }
          tone={
            summary.outOfStock > 0
              ? "red"
              : "zinc"
          }
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="print-hidden border-b border-zinc-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_210px_auto]">
            <label className="relative">
              <span className="sr-only">
                Buscar
              </span>

              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Buscar equipamento ou projeto..."
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <select
              value={
                selectedCategory
              }
              onChange={(event) =>
                setSelectedCategory(
                  event.target.value,
                )
              }
              aria-label="Categoria"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">
                Todas as categorias
              </option>

              {visibleCategories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ),
              )}
            </select>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target
                    .value as SortOption,
                )
              }
              aria-label="Ordenação"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="shortage-desc">
                Maior déficit
              </option>

              <option value="shortage-asc">
                Menor déficit
              </option>

              <option value="needed-desc">
                Maior necessidade
              </option>

              <option value="stock-asc">
                Menor estoque
              </option>

              <option value="name-asc">
                Nome A-Z
              </option>
            </select>

            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={onlyShortages}
                onChange={(event) =>
                  setOnlyShortages(
                    event.target.checked,
                  )
                }
                className="h-4 w-4 accent-[#F57B00]"
              />

              Somente déficit
            </label>
          </div>

          {hasChangedFilters ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-[#F57B00]"
              >
                <SlidersHorizontal
                  size={14}
                />

                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>

        {!loading ? (
          <div className="grid grid-cols-2 gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 md:grid-cols-4">
            <FilterMetric
              label="Itens exibidos"
              value={
                filteredSummary.items
              }
            />

            <FilterMetric
              label="Projetos"
              value={
                filteredSummary.projects
              }
            />

            <FilterMetric
              label="Necessário"
              value={
                filteredSummary.needed
              }
            />

            <FilterMetric
              label="Comprar"
              value={
                filteredSummary.toPurchase
              }
              highlight={
                filteredSummary.toPurchase >
                0
              }
            />
          </div>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : filteredItems.length ===
          0 ? (
          <EmptyState
            hasFilters={
              hasChangedFilters
            }
            clearFilters={
              clearFilters
            }
          />
        ) : (
          <>
            <div className="purchases-print-table hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[950px] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <TableHeader>
                      Equipamento
                    </TableHeader>

                    <TableHeader>
                      Categoria
                    </TableHeader>

                    <TableHeader align="center">
                      Projetos
                    </TableHeader>

                    <TableHeader align="right">
                      Estoque
                    </TableHeader>

                    <TableHeader align="right">
                      Necessário
                    </TableHeader>

                    <TableHeader align="right">
                      Comprar
                    </TableHeader>

                    <th className="print-hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
  Detalhes
</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map(
                    (item) => (
                      <EquipmentRows
                        key={
                          item.equipmentId
                        }
                        item={item}
                        expanded={expandedEquipmentIds.has(
                          item.equipmentId,
                        )}
                        onToggle={() =>
                          toggleEquipment(
                            item.equipmentId,
                          )
                        }
                        onStockEntry={() =>
                          openStockEntry(
                            item,
                          )
                        }
                        reportMode={
                          reportMode
                        }
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="purchases-print-cards space-y-3 p-3 sm:p-4 lg:hidden">
              {filteredItems.map(
                (item) => (
                  <EquipmentCard
                    key={
                      item.equipmentId
                    }
                    item={item}
                    expanded={expandedEquipmentIds.has(
                      item.equipmentId,
                    )}
                    onToggle={() =>
                      toggleEquipment(
                        item.equipmentId,
                      )
                    }
                    onStockEntry={() =>
                      openStockEntry(
                        item,
                      )
                    }
                    reportMode={
                      reportMode
                    }
                  />
                ),
              )}
            </div>
          </>
        )}
      </section>

      {!reportMode ? (
  <div className="print-hidden">
    <EquipmentStockEntryModal
      open={Boolean(
        stockEntryEquipment,
      )}
      equipment={
        stockEntryEquipment
          ? {
              id: stockEntryEquipment.equipmentId,
              name: stockEntryEquipment.name,
              category: stockEntryEquipment.category,
              manufacturer:
                stockEntryEquipment.manufacturer,
              model:
                stockEntryEquipment.model,
              quantity:
                stockEntryEquipment.physicalStock,
            }
          : null
      }
      onClose={closeStockEntry}
      onSuccess={
        handleStockEntrySuccess
      }
    />
  </div>
) : null}
    </div>
  </>
);
}

function EquipmentRows({
  item,
  expanded,
  onToggle,
  onStockEntry,
  reportMode,
}: {
  item: PurchaseItem;
  expanded: boolean;
  onToggle: () => void;
  onStockEntry: () => void;
  reportMode: boolean;
}) {
  const description =
    getEquipmentDescription(item);

  return (
    <>
      <tr className="border-b border-zinc-100 bg-white transition hover:bg-orange-50/30">
        <td className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#F57B00]">
              <Package size={19} />
            </div>

            <div className="min-w-0">
              <Link
                href={`/inventory/${item.equipmentId}`}
                className="font-bold text-zinc-900 transition hover:text-[#F57B00]"
              >
                {item.name}
              </Link>

              {description ? (
                <p className="mt-0.5 text-xs text-zinc-500">
                  {description}
                </p>
              ) : null}

              {item.serialNumber ? (
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  SN:{" "}
                  {item.serialNumber}
                </p>
              ) : null}

              <StockBadge
                item={item}
              />
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-zinc-600">
          {item.category}
        </td>

        <td className="px-4 py-4 text-center">
          <span className="inline-flex min-w-8 justify-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
            {item.projectCount}
          </span>
        </td>

        <td className="px-4 py-4 text-right">
          <Quantity
            value={
              item.physicalStock
            }
            tone={
              item.physicalStock ===
              0
                ? "red"
                : "zinc"
            }
          />
        </td>

        <td className="px-4 py-4 text-right">
          <Quantity
            value={
              item.totalNeeded
            }
            tone="blue"
          />
        </td>

        <td className="px-4 py-4 text-right">
          <div className="inline-flex flex-col items-end">
            <span className="rounded-lg bg-red-50 px-3 py-1 text-lg font-bold tabular-nums text-red-600">
              {
                item.purchaseQuantity
              }
            </span>

            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-500">
              faltando
            </span>
          </div>
        </td>

        <td className="print-hidden px-4 py-4">
  <div className="flex items-center justify-center gap-2">
            {!reportMode ? (
              <button
                type="button"
                onClick={
                  onStockEntry
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F57B00] px-3 text-xs font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <ArrowDownToLine
                  size={15}
                />
                Entrada
              </button>
            ) : null}

            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
            >
              {expanded ? (
                <ChevronUp
                  size={15}
                />
              ) : (
                <ChevronDown
                  size={15}
                />
              )}

              Projetos
            </button>
          </div>
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-zinc-200 bg-zinc-50">
          <td
            colSpan={7}
            className="px-5 py-4"
          >
            <ProjectsList
              item={item}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EquipmentCard({
  item,
  expanded,
  onToggle,
  onStockEntry,
  reportMode,
}: {
  item: PurchaseItem;
  expanded: boolean;
  onToggle: () => void;
  onStockEntry: () => void;
  reportMode: boolean;
}) {
  const description =
    getEquipmentDescription(item);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#F57B00]">
          <Package size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/inventory/${item.equipmentId}`}
            className="font-bold text-zinc-900 transition hover:text-[#F57B00]"
          >
            {item.name}
          </Link>

          <p className="mt-0.5 text-xs text-zinc-500">
            {description ||
              item.category}
          </p>

          {item.serialNumber ? (
            <p className="mt-0.5 text-[11px] text-zinc-400">
              SN:{" "}
              {item.serialNumber}
            </p>
          ) : null}
        </div>

        <AlertTriangle
          size={19}
          className="shrink-0 text-red-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
          {item.category}
        </span>

        <StockBadge item={item} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MobileMetric
          label="Estoque"
          value={
            item.physicalStock
          }
          tone={
            item.physicalStock === 0
              ? "red"
              : "zinc"
          }
        />

        <MobileMetric
          label="Necessário"
          value={item.totalNeeded}
          tone="blue"
        />

        <MobileMetric
          label="Comprar"
          value={
            item.purchaseQuantity
          }
          tone="red"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {item.projectCount}{" "}
          projeto(s)
        </span>

        <span>
          Mínimo:{" "}
          {item.minimumStock}
        </span>
      </div>

      <div
        className={[
          "mt-3 grid gap-2",
          reportMode
            ? "grid-cols-1"
            : "grid-cols-2",
        ].join(" ")}
      >
        {!reportMode ? (
          <button
            type="button"
            onClick={onStockEntry}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-3 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
          >
            <ArrowDownToLine
              size={16}
            />
            Entrada
          </button>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
        >
          {expanded ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown
              size={16}
            />
          )}

          {expanded
            ? "Ocultar projetos"
            : "Ver projetos"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <ProjectsList
            item={item}
          />
        </div>
      ) : null}
    </article>
  );
}

function ProjectsList({
  item,
}: {
  item: PurchaseItem;
}) {
  if (
    item.projects.length === 0
  ) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum projeto ativo
        utiliza este equipamento.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-zinc-900">
          Necessidade por projeto
        </h3>

        <span className="text-xs text-zinc-500">
          Total:{" "}
          <strong>
            {item.totalNeeded}
          </strong>
        </span>
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        {item.projects.map(
          (project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-3 py-3 transition hover:border-orange-200 hover:bg-orange-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {project.name}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {project.clientName ||
                      "Cliente não informado"}
                  </span>

                  <ProjectStatusBadge
                    status={
                      project.status
                    }
                  />
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                  Necessário
                </p>

                <p className="text-lg font-bold text-blue-700">
                  {
                    project.quantity
                  }
                </p>
              </div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function StockBadge({
  item,
}: {
  item: PurchaseItem;
}) {
  if (item.isOutOfStock) {
    return (
      <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
        Sem estoque
      </span>
    );
  }

  if (item.isBelowMinimum) {
    return (
      <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Estoque mínimo
      </span>
    );
  }

  return null;
}

function ProjectStatusBadge({
  status,
}: {
  status: ProjectStatus;
}) {
  const colors: Record<
    ProjectStatus,
    string
  > = {
    PLANNING:
      "bg-orange-50 text-orange-700",
    IN_PROGRESS:
      "bg-blue-50 text-blue-700",
    COMPLETED:
      "bg-emerald-50 text-emerald-700",
    CANCELLED:
      "bg-zinc-100 text-zinc-600",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  suffix,
  icon,
  tone,
}: {
  title: string;
  value: number;
  suffix: string;
  icon: ReactNode;
  tone:
    | "zinc"
    | "orange"
    | "blue"
    | "green"
    | "red";
}) {
  const colors = {
    zinc:
      "bg-zinc-100 text-zinc-700",
    orange:
      "bg-orange-50 text-[#F57B00]",
    blue:
      "bg-blue-50 text-blue-600",
    green:
      "bg-emerald-50 text-emerald-600",
    red:
      "bg-red-50 text-red-600",
  };

  return (
    <article className="flex min-h-28 items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">
          {title}
        </p>

        <p className="mt-1 text-2xl font-bold text-zinc-900">
          {value}
        </p>

        <p className="mt-0.5 text-xs text-zinc-400">
          {suffix}
        </p>
      </div>

      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}
      >
        {icon}
      </div>
    </article>
  );
}

function FilterMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-500">
        {label}
      </p>

      <p
        className={[
          "mt-0.5 text-lg font-bold",
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

function Quantity({
  value,
  tone,
}: {
  value: number;
  tone:
    | "zinc"
    | "blue"
    | "red";
}) {
  const colors = {
    zinc: "text-zinc-700",
    blue: "text-blue-700",
    red: "text-red-600",
  };

  return (
    <span
      className={`text-base font-semibold tabular-nums ${colors[tone]}`}
    >
      {value}
    </span>
  );
}

function MobileMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "zinc"
    | "blue"
    | "red";
}) {
  const colors = {
    zinc:
      "border-zinc-200 bg-zinc-50 text-zinc-800",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`rounded-lg border px-2 py-2 text-center ${colors[tone]}`}
    >
      <p className="text-[10px] font-medium opacity-75">
        {label}
      </p>

      <p className="mt-0.5 text-lg font-bold">
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: ReactNode;
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

function LoadingState() {
  return (
    <div className="flex min-h-72 items-center justify-center">
      <div className="text-center">
        <RefreshCw
          size={24}
          className="mx-auto animate-spin text-[#F57B00]"
        />

        <p className="mt-3 text-sm text-zinc-500">
          Carregando lista de
          compras...
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  clearFilters,
}: {
  hasFilters: boolean;
  clearFilters: () => void;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <CheckCircle2
          size={27}
        />
      </div>

      <h2 className="mt-4 text-base font-bold text-zinc-900">
        {hasFilters
          ? "Nenhum item encontrado"
          : "Nenhuma compra necessária"}
      </h2>

      <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">
        {hasFilters
          ? "Nenhum equipamento corresponde aos filtros selecionados."
          : "O estoque atual cobre as necessidades dos projetos ativos."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          <SlidersHorizontal
            size={16}
          />

          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}