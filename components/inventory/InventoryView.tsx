"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Grid2X2,
  List,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type ViewMode =
  | "table"
  | "cards";

type EquipmentStatus =
  | "Disponível"
  | "Em uso"
  | "Indisponível";

type EquipmentCondition =
  | "Novo"
  | "Danificado";

type ApiEquipmentStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "UNAVAILABLE";

type ApiEquipmentCondition =
  | "NEW"
  | "DAMAGED";

type ApiEquipmentRmaStatus =
  | "NONE"
  | "PENDING"
  | "SENT"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "REPLACED";

type EquipmentImage = {
  id?: string;
  url: string;
  pathname?: string;
  position?: number;
};

type ApiEquipment = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;

  quantity: number;

  physicalStock: number;
  installedQuantity: number;
  inUse: number;
  availableStock: number;
  shortage: number;

  damagedQuantity: number;
  hasDamagedUnits: boolean;

  minimumStock: number;

  serialNumber: string | null;
  category: string;

  status: ApiEquipmentStatus;
  condition: ApiEquipmentCondition;
  rmaStatus: ApiEquipmentRmaStatus;

  invoiceNumber: string | null;
  notes: string | null;

  images?: EquipmentImage[];

  createdAt: string;
  updatedAt: string;
};

type Equipment = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;

  quantity: number;

  physicalStock: number;
  installedQuantity: number;
  inUse: number;
  availableStock: number;
  shortage: number;

  damagedQuantity: number;
  hasDamagedUnits: boolean;

  minimumStock: number;

  serialNumber: string | null;
  category: string;

  status: EquipmentStatus;
  condition: EquipmentCondition;
  rmaStatus: ApiEquipmentRmaStatus;

  invoiceNumber: string | null;
  notes: string | null;

  images: EquipmentImage[];

  createdAt: string;
  updatedAt: string;
};

type EquipmentApiResponse = {
  success: boolean;
  message?: string;
  data?: ApiEquipment[];
};

const PAGE_SIZE = 8;

const conditionStyles: Record<
  EquipmentCondition,
  string
> = {
  Novo:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",

  Danificado:
    "bg-red-50 text-red-700 ring-red-600/20",
};

const statusFromApi: Record<
  ApiEquipmentStatus,
  EquipmentStatus
> = {
  AVAILABLE:
    "Disponível",

  IN_USE:
    "Em uso",

  UNAVAILABLE:
    "Indisponível",
};

const conditionFromApi: Record<
  ApiEquipmentCondition,
  EquipmentCondition
> = {
  NEW:
    "Novo",

  DAMAGED:
    "Danificado",
};

function mapApiEquipment(
  item: ApiEquipment,
): Equipment {
  return {
    id: item.id,
    name: item.name,

    manufacturer:
      item.manufacturer,

    model:
      item.model,

    quantity:
      item.quantity,

    physicalStock:
      item.physicalStock,

    installedQuantity:
      item.installedQuantity ?? 0,

    inUse:
      item.inUse,

    availableStock:
      item.availableStock,

    shortage:
      item.shortage,

    damagedQuantity:
      item.damagedQuantity ?? 0,

    hasDamagedUnits:
      item.hasDamagedUnits ??
      (item.damagedQuantity ?? 0) > 0,

    minimumStock:
      item.minimumStock ?? 0,

    serialNumber:
      item.serialNumber,

    category:
      item.category,

    status:
      statusFromApi[item.status],

    condition:
      conditionFromApi[
        item.condition
      ],

    rmaStatus:
        item.rmaStatus,

    invoiceNumber:
      item.invoiceNumber,

    notes:
      item.notes,

    images:
      item.images ?? [],

    createdAt:
      item.createdAt,

    updatedAt:
      item.updatedAt,
  };
}

/*
 * Equipamentos substituídos por RMA permanecem apenas
 * como histórico. Na listagem, priorizamos esse estado
 * em vez de alertas operacionais ou da condição danificada.
 */
function isHistoricalRmaReplacement(
  item: Equipment,
): boolean {
  return (
    item.rmaStatus ===
    "REPLACED"
  );
}

/*
 * Sem estoque significa:
 * nenhuma unidade física existente.
 *
 * Um item pode ter disponível = 0
 * e ainda possuir unidades físicas
 * totalmente comprometidas com projetos.
 */
function isOutOfStock(
  item: Equipment,
): boolean {
  return (
    item.physicalStock === 0
  );
}

function isLowStock(
  item: Equipment,
): boolean {
  return (
    item.physicalStock > 0 &&
    item.availableStock > 0 &&
    item.minimumStock > 0 &&
    item.availableStock <=
      item.minimumStock
  );
}

function isFullyCommitted(
  item: Equipment,
): boolean {
  return (
    item.physicalStock > 0 &&
    item.availableStock === 0 &&
    item.inUse > 0
  );
}

function hasStockAlert(
  item: Equipment,
): boolean {
  if (
    isHistoricalRmaReplacement(
      item,
    )
  ) {
    return false;
  }

  return (
    isOutOfStock(item) ||
    isLowStock(item) ||
    item.shortage > 0
  );
}

export function InventoryView() {
  const {
    data: session,
  } = useSession();

  const searchParams =
    useSearchParams();

 const canManageInventory =
  session?.user?.role === "ADMIN" ||
  session?.user?.role === "BACKOFFICE";

  const [
    equipmentList,
    setEquipmentList,
  ] = useState<Equipment[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("Todos");

  const [
    category,
    setCategory,
  ] = useState("Todas");

  const [
    stockFilter,
    setStockFilter,
  ] = useState("Todos");

  const [
    viewMode,
    setViewMode,
  ] = useState<ViewMode>(
    "table",
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    mobileFiltersOpen,
    setMobileFiltersOpen,
  ] = useState(false);

  useEffect(() => {
    const stockParam =
      searchParams.get(
        "stock",
      );

    if (
      stockParam === "alert"
    ) {
      setStockFilter(
        "Alertas de estoque",
      );

      setCurrentPage(1);

      return;
    }

    if (
      stockParam === "low"
    ) {
      setStockFilter(
        "Baixo estoque",
      );

      setCurrentPage(1);

      return;
    }

    if (
      stockParam === "out"
    ) {
      setStockFilter(
        "Sem estoque",
      );

      setCurrentPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadEquipment() {
      try {
        setIsLoading(true);

        const response =
          await fetch(
            "/api/equipment",
            {
              method: "GET",
              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },

              signal:
                controller.signal,
            },
          );

        const result =
          (await response.json()) as EquipmentApiResponse;

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ??
              "Não foi possível carregar o estoque.",
          );
        }

        const mappedEquipment =
          (
            result.data ?? []
          ).map(
            mapApiEquipment,
          );

        setEquipmentList(
          mappedEquipment,
        );

        setLoadError(null);
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o estoque.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setIsLoading(false);
        }
      }
    }

    void loadEquipment();

    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  useEffect(() => {
    function handleEquipmentCreated() {
      setRefreshKey(
        (current) =>
          current + 1,
      );
    }

    window.addEventListener(
      "equipment-created",
      handleEquipmentCreated,
    );

    return () => {
      window.removeEventListener(
        "equipment-created",
        handleEquipmentCreated,
      );
    };
  }, []);

  const categories =
    useMemo(() => {
      return Array.from(
        new Set(
          equipmentList.map(
            (equipment) =>
              equipment.category,
          ),
        ),
      ).sort(
        (
          first,
          second,
        ) =>
          first.localeCompare(
            second,
            "pt-BR",
          ),
      );
    }, [equipmentList]);

  const filteredEquipment =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase(
            "pt-BR",
          );

      return equipmentList.filter(
        (
          equipment:
            Equipment,
        ) => {
          const searchableValues =
            [
              equipment.name,
              equipment.manufacturer,
              equipment.model,
              equipment.serialNumber,
              equipment.category,
              equipment.invoiceNumber,
            ];

          const matchesSearch =
            normalizedSearch
              .length === 0 ||
            searchableValues.some(
              (value) =>
                value
                  ?.toLocaleLowerCase(
                    "pt-BR",
                  )
                  .includes(
                    normalizedSearch,
                  ),
            );

          const matchesStatus =
            status ===
              "Todos" ||
            equipment.status ===
              status;

          const matchesCategory =
            category ===
              "Todas" ||
            equipment.category ===
              category;

          const matchesStock =
            stockFilter ===
              "Todos" ||
            (stockFilter ===
              "Alertas de estoque" &&
              hasStockAlert(
                equipment,
              )) ||
            (stockFilter ===
              "Baixo estoque" &&
              isLowStock(
                equipment,
              )) ||
            (stockFilter ===
              "Sem estoque" &&
              !isHistoricalRmaReplacement(
                equipment,
              ) &&
              isOutOfStock(
                equipment,
              )) ||
              (stockFilter ===
                "Instalados" &&
                equipment.installedQuantity >
              0) ||
            (stockFilter ===
            "Danificados" &&
            !isHistoricalRmaReplacement(
              equipment,
            ) &&
            equipment.damagedQuantity >
              0) ||
            (stockFilter ===
  "Estoque normal" &&
  !isOutOfStock(
    equipment,
  ) &&
  !isLowStock(
    equipment,
  ) &&
  equipment.shortage ===
    0 &&
  equipment.installedQuantity ===
    0);

          return (
            matchesSearch &&
            matchesStatus &&
            matchesCategory &&
            matchesStock
          );
        },
      );
    }, [
      equipmentList,
      search,
      status,
      category,
      stockFilter,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredEquipment.length /
          PAGE_SIZE,
      ),
    );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages,
    );

  const paginatedEquipment =
    useMemo(() => {
      const start =
        (safeCurrentPage -
          1) *
        PAGE_SIZE;

      return filteredEquipment.slice(
        start,
        start +
          PAGE_SIZE,
      );
    }, [
      filteredEquipment,
      safeCurrentPage,
    ]);

  const activeFiltersCount =
    [
      status !== "Todos",
      category !== "Todas",
      stockFilter !==
        "Todos",
    ].filter(Boolean).length;

  function updateFilter(
    setter: (
      value: string,
    ) => void,
    value: string,
  ) {
    setter(value);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearch("");
    setStatus("Todos");
    setCategory("Todas");
    setStockFilter("Todos");
    setCurrentPage(1);
  }

  function retryLoading() {
    setLoadError(null);

    setRefreshKey(
      (current) =>
        current + 1,
    );
  }

  function exportCsv() {
    const columns = [
  "Equipamento",
  "Fabricante",
  "Modelo",
  "Estoque físico",
  "Disponível",
  "Em uso",
  "Instalados",
  "Déficit",
  "Danificados",
  "Estoque mínimo",
  "Número de série",
  "Categoria",
  "Status",
  "Condição",
  "Nota fiscal",
  "Observações",
];

    const rows =
      filteredEquipment.map(
        (equipment) => [
          equipment.name,

          equipment.manufacturer ??
            "",

          equipment.model ??
            "",

          equipment.physicalStock,

          equipment.availableStock,

          equipment.inUse,

          equipment.installedQuantity,

          equipment.shortage,

          equipment.damagedQuantity,

          equipment.minimumStock,

          equipment.serialNumber ??
            "",

          equipment.category,

          equipment.status,

          equipment.condition,

          equipment.invoiceNumber ??
            "",

          equipment.notes ??
            "",
        ],
      );

    const csv = [
      columns,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(
                cell,
              ).replaceAll(
                '"',
                '""',
              )}"`,
          )
          .join(";"),
      )
      .join("\n");

    const blob = new Blob(
      [
        `\uFEFF${csv}`,
      ],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        "a",
      );

    link.href = url;

    link.download =
      `inventario-scherm-${new Date()
        .toISOString()
        .slice(
          0,
          10,
        )}.csv`;

    document.body.appendChild(
      link,
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      url,
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-[#F57B00]" />

          <p className="text-sm font-medium">
            Carregando
            estoque...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-center">
        <p className="font-semibold text-red-800">
          Não foi possível
          carregar o estoque
        </p>

        <p className="mt-2 max-w-md text-sm text-red-600">
          {loadError}
        </p>

        <button
          type="button"
          onClick={
            retryLoading
          }
          className="mt-5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InventorySummary
        equipment={
          filteredEquipment
        }
      />

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="search"
                value={
                  search
                }
                onChange={(
                  event,
                ) => {
                  setSearch(
                    event.target
                      .value,
                  );

                  setCurrentPage(
                    1,
                  );
                }}
                placeholder="Buscar por nome, fabricante, modelo, categoria ou número de série..."
                className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:bg-white focus:ring-2 focus:ring-[#F57B00]/15"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch(
                      "",
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
                  aria-label="Limpar pesquisa"
                >
                  <X
                    size={
                      17
                    }
                  />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMobileFiltersOpen(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 xl:hidden"
              >
                <SlidersHorizontal
                  size={
                    17
                  }
                />

                Filtros

                {activeFiltersCount >
                0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F57B00] px-1 text-xs font-bold text-white">
                    {
                      activeFiltersCount
                    }
                  </span>
                ) : null}
              </button>

              <div className="flex rounded-lg border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "table",
                    )
                  }
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-md transition",

                    viewMode ===
                    "table"
                      ? "bg-[#F57B00] text-white"
                      : "text-zinc-500 hover:bg-zinc-100",
                  ].join(
                    " ",
                  )}
                  aria-label="Visualização em tabela"
                  aria-pressed={
                    viewMode ===
                    "table"
                  }
                >
                  <List
                    size={
                      17
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "cards",
                    )
                  }
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-md transition",

                    viewMode ===
                    "cards"
                      ? "bg-[#F57B00] text-white"
                      : "text-zinc-500 hover:bg-zinc-100",
                  ].join(
                    " ",
                  )}
                  aria-label="Visualização em cards"
                  aria-pressed={
                    viewMode ===
                    "cards"
                  }
                >
                  <Grid2X2
                    size={
                      17
                    }
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={
                  exportCsv
                }
                disabled={
                  filteredEquipment.length ===
                  0
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download
                  size={17}
                />

                <span className="hidden sm:inline">
                  Exportar
                  CSV
                </span>
              </button>

              {canManageInventory ? (
  <Link
    href="/inventory/new"
    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
  >
    <Plus size={18} />

    Novo equipamento
  </Link>
) : null}
            </div>
          </div>

          <div
            className={[
              "mt-4 gap-3 xl:grid xl:grid-cols-3",

              mobileFiltersOpen
                ? "grid"
                : "hidden xl:grid",
            ].join(" ")}
          >
            <FilterSelect
              label="Status"
              value={status}
              options={[
                "Todos",
                "Disponível",
                "Em uso",
                "Indisponível",
              ]}
              onChange={(
                value,
              ) =>
                updateFilter(
                  setStatus,
                  value,
                )
              }
            />

            <FilterSelect
              label="Categoria"
              value={
                category
              }
              options={[
                "Todas",
                ...categories,
              ]}
              onChange={(
                value,
              ) =>
                updateFilter(
                  setCategory,
                  value,
                )
              }
            />

            <FilterSelect
              label="Estoque"
              value={
                stockFilter
              }
              options={[
  "Todos",
  "Alertas de estoque",
  "Estoque normal",
  "Baixo estoque",
  "Sem estoque",
  "Instalados",
  "Danificados",
]}
              onChange={(
                value,
              ) =>
                updateFilter(
                  setStockFilter,
                  value,
                )
              }
            />
          </div>

          {activeFiltersCount >
            0 ||
          search ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                Filtros
                ativos:
              </span>

              {search ? (
                <FilterTag
                  label={`Busca: ${search}`}
                  onRemove={() => {
                    setSearch(
                      "",
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                />
              ) : null}

              {status !==
              "Todos" ? (
                <FilterTag
                  label={
                    status
                  }
                  onRemove={() => {
                    setStatus(
                      "Todos",
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                />
              ) : null}

              {category !==
              "Todas" ? (
                <FilterTag
                  label={
                    category
                  }
                  onRemove={() => {
                    setCategory(
                      "Todas",
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                />
              ) : null}

              {stockFilter !==
              "Todos" ? (
                <FilterTag
                  label={
                    stockFilter
                  }
                  onRemove={() => {
                    setStockFilter(
                      "Todos",
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="text-xs font-semibold text-[#F57B00] transition hover:text-[#D96D00]"
              >
                Limpar todos
              </button>
            </div>
          ) : null}
        </div>

        {paginatedEquipment.length ===
        0 ? (
          <EmptyInventory
  hasEquipment={
    equipmentList.length >
    0
  }
  onClear={
    clearFilters
  }
  canEdit={
    canManageInventory
  }
/>
        ) : viewMode ===
          "table" ? (
          <EquipmentTable
            equipment={
              paginatedEquipment
            }
          />
        ) : (
          <EquipmentCards
            equipment={
              paginatedEquipment
            }
          />
        )}

        <Pagination
          currentPage={
            safeCurrentPage
          }
          totalPages={
            totalPages
          }
          totalItems={
            filteredEquipment.length
          }
          pageSize={
            PAGE_SIZE
          }
          onChange={
            setCurrentPage
          }
        />
      </section>
    </div>
  );
}

function InventorySummary({
  equipment,
}: {
  equipment: Equipment[];
}) {
  const totalItems =
    equipment.length;

  const totalPhysicalStock =
    equipment.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.physicalStock,
      0,
    );

  const totalAvailable =
    equipment.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.availableStock,
      0,
    );

  const totalInstalled =
  equipment.reduce(
    (
      total,
      item,
    ) =>
      total +
      item.installedQuantity,
    0,
  );

  const totalDamaged =
    equipment.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.damagedQuantity,
      0,
    );

  const stockAlerts =
    equipment.filter(
      hasStockAlert,
    ).length;

  const summary = [
    {
      label:
        "Equipamentos cadastrados",

      value:
        totalItems,

      color:
        "text-zinc-900",

      background:
        "bg-zinc-100",

      icon:
        Package,
    },

    {
      label:
        "Estoque físico",

      value:
        totalPhysicalStock,

      color:
        "text-blue-700",

      background:
        "bg-blue-50",

      icon:
        Boxes,
    },

    {
      label:
        "Unidades disponíveis",

      value:
        totalAvailable,

      color:
        "text-emerald-700",

      background:
        "bg-emerald-50",

      icon:
        Boxes,
    },

    {
  label:
    "Unidades instaladas",

  value:
    totalInstalled,

  color:
    "text-violet-700",

  background:
    "bg-violet-50",

  icon:
    Boxes,
},

    {
      label:
        "Unidades danificadas",

      value:
        totalDamaged,

      color:
        totalDamaged >
        0
          ? "text-red-700"
          : "text-zinc-900",

      background:
        totalDamaged >
        0
          ? "bg-red-50"
          : "bg-zinc-100",

      icon:
        AlertTriangle,
    },

    {
      label:
        "Alertas de estoque",

      value:
        stockAlerts,

      color:
        stockAlerts > 0
          ? "text-red-700"
          : "text-zinc-900",

      background:
        stockAlerts > 0
          ? "bg-red-50"
          : "bg-zinc-100",

      icon:
        AlertTriangle,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {summary.map(
        (item) => {
          const Icon =
            item.icon;

          return (
            <article
              key={
                item.label
              }
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    {
                      item.label
                    }
                  </p>

                  <p
                    className={`mt-2 text-2xl font-bold ${item.color}`}
                  >
                    {
                      item.value
                    }
                  </p>
                </div>

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.background} ${item.color}`}
                >
                  <Icon
                    size={
                      19
                    }
                  />
                </div>
              </div>
            </article>
          );
        },
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-zinc-600">
        {label}
      </span>

      <div className="relative">
        <Filter
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />

        <select
          value={value}
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          className="h-10 w-full appearance-none rounded-lg border border-zinc-200 bg-white pl-9 pr-8 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/15"
        >
          {options.map(
            (option) => (
              <option
                key={
                  option
                }
                value={
                  option
                }
              >
                {
                  option
                }
              </option>
            ),
          )}
        </select>
      </div>
    </label>
  );
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-[#D96D00]">
      {label}

      <button
        type="button"
        onClick={
          onRemove
        }
        className="rounded-full p-0.5 transition hover:bg-orange-100"
        aria-label={`Remover filtro ${label}`}
      >
        <X size={13} />
      </button>
    </span>
  );
}

function EquipmentTable({
  equipment,
}: {
  equipment: Equipment[];
}) {
  const router =
    useRouter();

  function openEquipment(
    id: string,
  ) {
    router.push(
      `/inventory/${id}`,
    );
  }

  function handleRowKeyDown(
    event:
      KeyboardEvent<HTMLTableRowElement>,
    id: string,
  ) {
    if (
      event.key ===
        "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      openEquipment(
        id,
      );
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <TableHeader>
              Equipamento
            </TableHeader>

            <TableHeader>
              Modelo / Série
            </TableHeader>

            <TableHeader>
              Categoria
            </TableHeader>

            <TableHeader>
              Estoque
            </TableHeader>

            <TableHeader>
              Condição
            </TableHeader>

            <TableHeader className="text-right">
              Detalhes
            </TableHeader>
          </tr>
        </thead>

        <tbody>
          {equipment.map(
            (item) => {
              const mainImage =
                item.images[0]
                  ?.url;

              const isHistorical =
                isHistoricalRmaReplacement(
                  item,
                );

              return (
                <tr
                  key={
                    item.id
                  }
                  role="link"
                  tabIndex={
                    0
                  }
                  onClick={() =>
                    openEquipment(
                      item.id,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) =>
                    handleRowKeyDown(
                      event,
                      item.id,
                    )
                  }
                  className="group cursor-pointer border-b border-zinc-100 outline-none transition last:border-0 hover:bg-[#F57B00]/[0.06] hover:shadow-[inset_3px_0_0_#F57B00] focus:bg-[#F57B00]/[0.06] focus:shadow-[inset_3px_0_0_#F57B00] focus:ring-2 focus:ring-inset focus:ring-[#F57B00]/20"
                  aria-label={`Abrir detalhes de ${item.name}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-[#F57B00]">
                        {mainImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              mainImage
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Boxes
                            size={
                              19
                            }
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate text-sm font-semibold text-zinc-900 transition group-hover:text-[#D96D00]">
                          {
                            item.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {[
                            item.manufacturer,
                            item.model,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              " · ",
                            ) ||
                            "Sem fabricante ou modelo"}
                        </p>

                        {!isHistorical &&
                          item.damagedQuantity > 0 ? (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                            <AlertTriangle
                              size={
                                13
                              }
                            />

                            {
                              item.damagedQuantity
                            }{" "}
                            {item.damagedQuantity ===
                            1
                              ? "unidade danificada"
                              : "unidades danificadas"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-zinc-700">
                      {item.model ||
                        "—"}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {item.serialNumber ||
                        "Sem número de série"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <CategoryBadge
                      category={
                        item.category
                      }
                    />
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                   <StockBadge
                    physicalStock={
                      item.physicalStock
                    }
                    inUse={
                      item.inUse
                    }
                    availableStock={
                      item.availableStock
                    }
                    installedQuantity={
                      item.installedQuantity
                    }
                    shortage={
                      item.shortage
                    }
                    damagedQuantity={
                      item.damagedQuantity
                    }
                    minimumStock={
                      item.minimumStock
                    }
                    isHistorical={
                      isHistorical
                    }
                  />
                  </td>

                  <td className="px-5 py-4">
                  {isHistorical ? (
                    <div className="flex flex-col items-start gap-1.5">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                        Histórico de RMA
                      </span>

                      <span className="inline-flex whitespace-nowrap rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                        Substituído
                      </span>
                    </div>
                  ) : (
                    <ConditionBadge
                      condition={
                        item.condition
                      }
                    />
                  )}
                </td>

                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex translate-x-2 items-center gap-1 whitespace-nowrap text-sm font-semibold text-zinc-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-[#F57B00] group-hover:opacity-100 group-focus:translate-x-0 group-focus:text-[#F57B00] group-focus:opacity-100">
                      Ver
                      detalhes

                      <ChevronRight
                        size={
                          16
                        }
                      />
                    </span>
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${className}`}
    >
      {children}
    </th>
  );
}

function EquipmentCards({
  equipment,
}: {
  equipment: Equipment[];
}) {
  return (
    <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 2xl:grid-cols-3">
      {equipment.map(
        (item) => {
          const isHistorical =
            isHistoricalRmaReplacement(
              item,
            );

          const outOfStock =
            isOutOfStock(
              item,
            );

          const lowStock =
            isLowStock(
              item,
            );

          const fullyCommitted =
            isFullyCommitted(
              item,
            );

          const mainImage =
            item.images[0]
              ?.url;

          return (
            <Link
              key={
                item.id
              }
              href={`/inventory/${item.id}`}
              className="group block rounded-xl border border-zinc-200 bg-white p-4 outline-none transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/20"
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-[#F57B00]">
                    {mainImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          mainImage
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Boxes
                        size={
                          21
                        }
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 transition group-hover:text-[#D96D00]">
                      {
                        item.name
                      }
                    </h3>

                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {[
                        item.manufacturer,
                        item.model,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          " · ",
                        ) ||
                        "Sem fabricante ou modelo"}
                    </p>

                    {!isHistorical &&
                      item.damagedQuantity > 0 ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        <AlertTriangle
                          size={
                            13
                          }
                        />

                        {
                          item.damagedQuantity
                        }{" "}
                        {item.damagedQuantity ===
                        1
                          ? "unidade danificada"
                          : "unidades danificadas"}
                      </span>
                    ) : null}

                    {item.installedQuantity >
0 ? (
  <span className="mt-2 inline-flex items-center rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
    {item.installedQuantity}{" "}
    {item.installedQuantity ===
    1
      ? "unidade instalada"
      : "unidades instaladas"}
  </span>
) : null}
                  </div>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-400">
                    Categoria
                  </dt>

                  <dd className="mt-1">
                    <CategoryBadge
                      category={
                        item.category
                      }
                    />
                  </dd>
                </div>

                <div className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-400">
                    Condição
                  </dt>

                  <dd className="mt-1">
                    {isHistorical ? (
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          Histórico de RMA
                        </span>

                        <span className="inline-flex whitespace-nowrap rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          Substituído
                        </span>
                      </div>
                    ) : (
                      <ConditionBadge
                        condition={
                          item.condition
                        }
                      />
                    )}
                  </dd>
                </div>

                <div className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-400">
                    Quantidade
                  </dt>

                  <dd className="mt-1">
                    <StockBadge
                      physicalStock={
                        item.physicalStock
                      }
                      inUse={
                        item.inUse
                      }
                      availableStock={
                        item.availableStock
                      }
                      installedQuantity={
                        item.installedQuantity
                      }
                      shortage={
                        item.shortage
                      }
                      damagedQuantity={
                        item.damagedQuantity
                      }
                      minimumStock={
                        item.minimumStock
                      }
                      isHistorical={
                      isHistorical
                    }
                    />
                  </dd>
                </div>

                <CardDetail
                  label="Estoque mínimo"
                  value={`${item.minimumStock} ${
                    item.minimumStock ===
                    1
                      ? "unidade"
                      : "unidades"
                  }`}
                />

                <CardDetail
                  label="Número de série"
                  value={
                    item.serialNumber ||
                    "Não informado"
                  }
                />

                <CardDetail
                  label="Nota fiscal"
                  value={
                    item.invoiceNumber ||
                    "Não informada"
                  }
                />
              </dl>

              {!isHistorical &&
              outOfStock ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  <AlertTriangle
                    size={
                      15
                    }
                  />

                  Item sem
                  estoque
                  físico
                </div>
              ) : fullyCommitted ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                  <Boxes
                    size={
                      15
                    }
                  />

                  Todo o
                  estoque está
                  comprometido
                  com projetos
                </div>
              ) : lowStock ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  <AlertTriangle
                    size={
                      15
                    }
                  />

                  Estoque
                  disponível
                  abaixo ou
                  igual ao
                  mínimo
                </div>
              ) : null}

              {!isHistorical &&
              item.shortage > 0 ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  <AlertTriangle
                    size={
                      15
                    }
                  />

                  Déficit de{" "}
                  {
                    item.shortage
                  }{" "}
                  unidade(s)
                </div>
              ) : null}

              <div className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm font-semibold text-zinc-700 transition group-hover:text-[#F57B00]">
                Abrir
                detalhes
              </div>
            </Link>
          );
        },
      )}
    </div>
  );
}

function CardDetail({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?:
    | "default"
    | "warning"
    | "danger";
}) {
  const valueColor =
    tone === "danger"
      ? "text-red-700"
      : tone ===
          "warning"
        ? "text-amber-700"
        : "text-zinc-700";

  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-400">
        {label}
      </dt>

      <dd
        className={`mt-1 truncate text-sm font-medium ${valueColor}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function StockBadge({
  physicalStock,
  inUse,
  availableStock,
  installedQuantity,
  shortage,
  damagedQuantity,
  minimumStock,
  isHistorical = false,
}: {
  physicalStock: number;
  inUse: number;
  availableStock: number;
  installedQuantity: number;
  shortage: number;
  damagedQuantity: number;
  minimumStock: number;
  isHistorical?: boolean;
}) {
  const hasNoPhysicalStock =
    physicalStock === 0;

  const fullyInstalled =
    physicalStock > 0 &&
    installedQuantity > 0 &&
    availableStock === 0 &&
    inUse === 0 &&
    damagedQuantity === 0;

  const fullyCommitted =
    physicalStock > 0 &&
    availableStock === 0 &&
    inUse > 0;

  const lowStock =
    availableStock > 0 &&
    minimumStock > 0 &&
    availableStock <=
      minimumStock;

  let label =
    "Estoque OK";

  let styles =
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20";

  let dotStyles =
    "bg-emerald-500";
  
  if (isHistorical) {
  label =
    "Histórico de RMA";

  styles =
    "bg-purple-50 text-purple-700 ring-purple-600/20";

  dotStyles =
    "bg-purple-500";
} else if (
  hasNoPhysicalStock
) {
    label =
      "Sem estoque";

    styles =
      "bg-red-50 text-red-700 ring-red-600/20";

    dotStyles =
      "bg-red-500";
  } else if (
    fullyInstalled
  ) {
    label =
      "Instalado";

    styles =
      "bg-violet-50 text-violet-700 ring-violet-600/20";

    dotStyles =
      "bg-violet-500";
  } else if (
    fullyCommitted
  ) {
    label =
      "Totalmente em uso";

    styles =
      "bg-blue-50 text-blue-700 ring-blue-600/20";

    dotStyles =
      "bg-blue-500";
  } else if (
    lowStock
  ) {
    label =
      "Baixo estoque";

    styles =
      "bg-amber-50 text-amber-700 ring-amber-600/20";

    dotStyles =
      "bg-amber-500";
  }

  return (
    <div className="space-y-2">
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">
            Físico
          </span>

          <span className="font-semibold text-zinc-800">
            {
              physicalStock
            }
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-emerald-600">
            Disponível
          </span>

          <span className="font-semibold text-emerald-700">
            {
              availableStock
            }
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-blue-600">
            Em uso
          </span>

          <span className="font-semibold text-blue-700">
            {inUse}
          </span>
        </div>

        {installedQuantity >
        0 ? (
          <div className="flex justify-between gap-4">
            <span className="text-violet-600">
              Instalado
            </span>

            <span className="font-semibold text-violet-700">
              {
                installedQuantity
              }
            </span>
          </div>
        ) : null}

        {damagedQuantity >
        0 ? (
          <div className="flex justify-between gap-4">
            <span className="text-red-600">
              Danificado
            </span>

            <span className="font-semibold text-red-700">
              {
                damagedQuantity
              }
            </span>
          </div>
        ) : null}

        {shortage >
        0 ? (
          <div className="flex justify-between gap-4">
            <span className="font-medium text-red-600">
              Déficit
            </span>

            <span className="font-bold text-red-700">
              {
                shortage
              }
            </span>
          </div>
        ) : null}
      </div>

        {!isHistorical ? (
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${dotStyles}`}
              />

              {label}
            </span>

            {shortage > 0 ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertTriangle size={12} />

                Déficit: {shortage}
              </span>
            ) : null}
          </div>
        ) : null}
    </div>
  );
}

function CategoryBadge({
  category,
}: {
  category: string;
}) {
  return (
    <span className="inline-flex max-w-[180px] truncate rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-500/10">
      {category}
    </span>
  );
}

function ConditionBadge({
  condition,
}: {
  condition:
    EquipmentCondition;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${conditionStyles[condition]}`}
    >
      {condition}
    </span>
  );
}

function EmptyInventory({
  hasEquipment,
  onClear,
  canEdit,
}: {
  hasEquipment: boolean;
  onClear: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
        <Search
          size={25}
        />
      </div>

      <h2 className="mt-4 text-base font-semibold text-zinc-900">
        {hasEquipment
          ? "Nenhum equipamento encontrado"
          : "Nenhum equipamento cadastrado"}
      </h2>

      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {hasEquipment
          ? "Não encontramos equipamentos correspondentes à busca e aos filtros selecionados."
          : "O estoque ainda está vazio. Cadastre o primeiro equipamento para começar."}
      </p>

      {hasEquipment ? (
        <button
          type="button"
          onClick={
            onClear
          }
          className="mt-5 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          Limpar
          filtros
        </button>
      ) : canEdit ? (
        <Link
          href="/inventory/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          <Plus
            size={17}
          />

          Cadastrar
          equipamento
        </Link>
      ) : null}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (
    page: number,
  ) => void;
}) {
  const firstItem =
    totalItems === 0
      ? 0
      : (currentPage -
          1) *
          pageSize +
        1;

  const lastItem =
    Math.min(
      currentPage *
        pageSize,
      totalItems,
    );

  const pages =
    Array.from(
      {
        length:
          totalPages,
      },
      (
        _,
        index,
      ) =>
        index + 1,
    ).filter(
      (page) =>
        page === 1 ||
        page ===
          totalPages ||
        Math.abs(
          page -
            currentPage,
        ) <= 1,
    );

  return (
    <footer className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-zinc-500">
        Mostrando{" "}
        <span className="font-semibold text-zinc-700">
          {firstItem}–
          {lastItem}
        </span>{" "}
        de{" "}
        <span className="font-semibold text-zinc-700">
          {totalItems}
        </span>{" "}
        equipamentos
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={
            currentPage ===
            1
          }
          onClick={() =>
            onChange(
              currentPage -
                1,
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft
            size={17}
          />
        </button>

        {pages.map(
          (
            page,
            index,
          ) => {
            const previousPage =
              pages[
                index -
                  1
              ];

            const hasGap =
              previousPage !==
                undefined &&
              page -
                previousPage >
                1;

            return (
              <div
                key={
                  page
                }
                className="flex items-center gap-1"
              >
                {hasGap ? (
                  <span className="px-1 text-sm text-zinc-400">
                    …
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      page,
                    )
                  }
                  aria-current={
                    currentPage ===
                    page
                      ? "page"
                      : undefined
                  }
                  className={[
                    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition",

                    currentPage ===
                    page
                      ? "bg-[#F57B00] text-white"
                      : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                  ].join(
                    " ",
                  )}
                >
                  {page}
                </button>
              </div>
            );
          },
        )}

        <button
          type="button"
          disabled={
            currentPage ===
            totalPages
          }
          onClick={() =>
            onChange(
              currentPage +
                1,
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight
            size={17}
          />
        </button>
      </div>
    </footer>
  );
}