"use client";

import Link from "next/link";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ViewMode = "table" | "cards";

type EquipmentStatus =
  | "Disponível"
  | "Em uso"
  | "Em manutenção"
  | "Indisponível";

type EquipmentCondition =
  | "Novo"
  | "Bom"
  | "Regular"
  | "Danificado";

type ApiEquipmentStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "UNAVAILABLE";

type ApiEquipmentCondition =
  | "NEW"
  | "GOOD"
  | "REGULAR"
  | "DAMAGED";

type ApiEquipment = {
  id: string;
  patrimony: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  category: string;
  status: ApiEquipmentStatus;
  condition: ApiEquipmentCondition;
  client: string;
  location: string;
  responsible: string;
  acquisitionDate: string;
  warrantyEndDate: string | null;
  value: string | number | null;
  supplier: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Equipment = {
  id: string;
  patrimony: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  category: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  client: string;
  location: string;
  responsible: string;
  acquisitionDate: string;
  warrantyEndDate: string | null;
  value: number;
  supplier: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type EquipmentApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T[];
};

const PAGE_SIZE = 8;

const statusStyles: Record<EquipmentStatus, string> = {
  Disponível:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Em uso": "bg-blue-50 text-blue-700 ring-blue-600/20",
  "Em manutenção":
    "bg-amber-50 text-amber-700 ring-amber-600/20",
  Indisponível: "bg-red-50 text-red-700 ring-red-600/20",
};

const statusDotStyles: Record<EquipmentStatus, string> = {
  Disponível: "bg-emerald-500",
  "Em uso": "bg-blue-500",
  "Em manutenção": "bg-amber-500",
  Indisponível: "bg-red-500",
};

const statusFromApi: Record<
  ApiEquipmentStatus,
  EquipmentStatus
> = {
  AVAILABLE: "Disponível",
  IN_USE: "Em uso",
  MAINTENANCE: "Em manutenção",
  UNAVAILABLE: "Indisponível",
};

const conditionFromApi: Record<
  ApiEquipmentCondition,
  EquipmentCondition
> = {
  NEW: "Novo",
  GOOD: "Bom",
  REGULAR: "Regular",
  DAMAGED: "Danificado",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function mapApiEquipment(item: ApiEquipment): Equipment {
  const numericValue =
    item.value === null || item.value === ""
      ? 0
      : Number(item.value);

  return {
    id: item.id,
    patrimony: item.patrimony,
    name: item.name,
    manufacturer: item.manufacturer,
    model: item.model,
    serialNumber: item.serialNumber,
    category: item.category,
    status: statusFromApi[item.status],
    condition: conditionFromApi[item.condition],
    client: item.client,
    location: item.location,
    responsible: item.responsible,
    acquisitionDate: item.acquisitionDate,
    warrantyEndDate: item.warrantyEndDate,
    value: Number.isFinite(numericValue) ? numericValue : 0,
    supplier: item.supplier,
    invoiceNumber: item.invoiceNumber,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function InventoryView() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [category, setCategory] = useState("Todas");
  const [client, setClient] = useState("Todos");
  const [location, setLocation] = useState("Todas");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);

useEffect(() => {
  const controller = new AbortController();

fetch("/api/equipment", {
  method: "GET",
  cache: "no-store",
  headers: {
    Accept: "application/json",
  },
  signal: controller.signal,
})
  .then(async (response) => {
    const result =
      (await response.json()) as EquipmentApiResponse<
        Parameters<typeof mapApiEquipment>[0]
      >;

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ??
          "Não foi possível carregar o inventário.",
      );
    }

    return (result.data ?? []).map(mapApiEquipment);
  })
  .then((mappedEquipment) => {
    setEquipmentList(mappedEquipment);
    setLoadError(null);
  })
  .catch((error: unknown) => {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return;
    }

    setLoadError(
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o inventário.",
    );
  })
  .finally(() => {
    if (!controller.signal.aborted) {
      setIsLoading(false);
    }
  });

  return () => {
    controller.abort();
  };
}, [refreshKey]);

useEffect(() => {
  function handleEquipmentCreated() {
    setIsLoading(true);
    setRefreshKey((current) => current + 1);
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

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          equipmentList.map(
            (equipment) => equipment.category,
          ),
        ),
      ).sort((first, second) =>
        first.localeCompare(second, "pt-BR"),
      ),
    [equipmentList],
  );

  const clients = useMemo(
    () =>
      Array.from(
        new Set(
          equipmentList.map((equipment) => equipment.client),
        ),
      ).sort((first, second) =>
        first.localeCompare(second, "pt-BR"),
      ),
    [equipmentList],
  );

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          equipmentList.map(
            (equipment) => equipment.location,
          ),
        ),
      ).sort((first, second) =>
        first.localeCompare(second, "pt-BR"),
      ),
    [equipmentList],
  );

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return equipmentList.filter((equipment) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          equipment.name,
          equipment.patrimony,
          equipment.serialNumber,
          equipment.manufacturer,
          equipment.model,
          equipment.client,
          equipment.location,
        ].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );

      const matchesStatus =
        status === "Todos" || equipment.status === status;

      const matchesCategory =
        category === "Todas" ||
        equipment.category === category;

      const matchesClient =
        client === "Todos" || equipment.client === client;

      const matchesLocation =
        location === "Todas" ||
        equipment.location === location;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesClient &&
        matchesLocation
      );
    });
  }, [
    equipmentList,
    search,
    status,
    category,
    client,
    location,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEquipment.length / PAGE_SIZE),
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages,
  );

  const paginatedEquipment = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredEquipment.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredEquipment, safeCurrentPage]);

  const activeFiltersCount = [
    status !== "Todos",
    category !== "Todas",
    client !== "Todos",
    location !== "Todas",
  ].filter(Boolean).length;

  function updateFilter(
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearch("");
    setStatus("Todos");
    setCategory("Todas");
    setClient("Todos");
    setLocation("Todas");
    setCurrentPage(1);
  }

  function exportCsv() {
    const columns = [
      "Patrimônio",
      "Equipamento",
      "Fabricante",
      "Modelo",
      "Número de série",
      "Categoria",
      "Status",
      "Condição",
      "Cliente",
      "Localização",
      "Responsável",
      "Valor",
    ];

    const rows = filteredEquipment.map((equipment) => [
      equipment.patrimony,
      equipment.name,
      equipment.manufacturer,
      equipment.model,
      equipment.serialNumber,
      equipment.category,
      equipment.status,
      equipment.condition,
      equipment.client,
      equipment.location,
      equipment.responsible,
      equipment.value.toFixed(2).replace(".", ","),
    ]);

    const csv = [columns, ...rows]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(cell).replaceAll('"', '""')}"`,
          )
          .join(";"),
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `inventario-scherm-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-[#F57B00]" />

          <p className="text-sm font-medium">
            Carregando inventário...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-center">
        <p className="font-semibold text-red-800">
          Não foi possível carregar o inventário
        </p>

        <p className="mt-2 max-w-md text-sm text-red-600">
          {loadError}
        </p>

<button
  type="button"
  onClick={() => {
    setLoadError(null);
    setIsLoading(true);
    setRefreshKey((current) => current + 1);
  }}
  className="mt-5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
>
  Tentar novamente
</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InventorySummary equipment={filteredEquipment} />

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
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por nome, patrimônio ou número de série..."
                className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:bg-white focus:ring-2 focus:ring-[#F57B00]/15"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
                  aria-label="Limpar pesquisa"
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMobileFiltersOpen((current) => !current)
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 xl:hidden"
              >
                <SlidersHorizontal size={17} />
                Filtros

                {activeFiltersCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F57B00] px-1 text-xs font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              <div className="flex rounded-lg border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    viewMode === "table"
                      ? "bg-[#F57B00] text-white"
                      : "text-zinc-500 hover:bg-zinc-100",
                  ].join(" ")}
                  aria-label="Visualização em tabela"
                >
                  <List size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    viewMode === "cards"
                      ? "bg-[#F57B00] text-white"
                      : "text-zinc-500 hover:bg-zinc-100",
                  ].join(" ")}
                  aria-label="Visualização em cards"
                >
                  <Grid2X2 size={17} />
                </button>
              </div>

              <button
                type="button"
                onClick={exportCsv}
                disabled={filteredEquipment.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={17} />
                <span className="hidden sm:inline">
                  Exportar CSV
                </span>
              </button>

              <Link
                href="/inventory/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <Plus size={18} />
                Novo equipamento
              </Link>
            </div>
          </div>

          <div
            className={[
              "mt-4 grid gap-3 xl:grid xl:grid-cols-4",
              mobileFiltersOpen ? "grid" : "hidden",
            ].join(" ")}
          >
            <FilterSelect
              label="Status"
              value={status}
              options={[
                "Todos",
                "Disponível",
                "Em uso",
                "Em manutenção",
                "Indisponível",
              ]}
              onChange={(value) =>
                updateFilter(setStatus, value)
              }
            />

            <FilterSelect
              label="Categoria"
              value={category}
              options={["Todas", ...categories]}
              onChange={(value) =>
                updateFilter(setCategory, value)
              }
            />

            <FilterSelect
              label="Cliente"
              value={client}
              options={["Todos", ...clients]}
              onChange={(value) =>
                updateFilter(setClient, value)
              }
            />

            <FilterSelect
              label="Localização"
              value={location}
              options={["Todas", ...locations]}
              onChange={(value) =>
                updateFilter(setLocation, value)
              }
            />
          </div>

          {activeFiltersCount > 0 || search ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                Filtros ativos:
              </span>

              {search ? (
                <FilterTag
                  label={`Busca: ${search}`}
                  onRemove={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                />
              ) : null}

              {status !== "Todos" ? (
                <FilterTag
                  label={status}
                  onRemove={() => {
                    setStatus("Todos");
                    setCurrentPage(1);
                  }}
                />
              ) : null}

              {category !== "Todas" ? (
                <FilterTag
                  label={category}
                  onRemove={() => {
                    setCategory("Todas");
                    setCurrentPage(1);
                  }}
                />
              ) : null}

              {client !== "Todos" ? (
                <FilterTag
                  label={client}
                  onRemove={() => {
                    setClient("Todos");
                    setCurrentPage(1);
                  }}
                />
              ) : null}

              {location !== "Todas" ? (
                <FilterTag
                  label={location}
                  onRemove={() => {
                    setLocation("Todas");
                    setCurrentPage(1);
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-[#F57B00] transition hover:text-[#D96D00]"
              >
                Limpar todos
              </button>
            </div>
          ) : null}
        </div>

        {paginatedEquipment.length === 0 ? (
          <EmptyInventory
            hasEquipment={equipmentList.length > 0}
            onClear={clearFilters}
          />
        ) : viewMode === "table" ? (
          <EquipmentTable equipment={paginatedEquipment} />
        ) : (
          <EquipmentCards equipment={paginatedEquipment} />
        )}

        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={filteredEquipment.length}
          pageSize={PAGE_SIZE}
          onChange={setCurrentPage}
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
  const summary = [
    {
      label: "Equipamentos encontrados",
      value: equipment.length,
      color: "text-zinc-900",
      background: "bg-zinc-100",
    },
    {
      label: "Disponíveis",
      value: equipment.filter(
        (item) => item.status === "Disponível",
      ).length,
      color: "text-emerald-700",
      background: "bg-emerald-50",
    },
    {
      label: "Em uso",
      value: equipment.filter(
        (item) => item.status === "Em uso",
      ).length,
      color: "text-blue-700",
      background: "bg-blue-50",
    },
    {
      label: "Exigem atenção",
      value: equipment.filter(
        (item) =>
          item.status === "Em manutenção" ||
          item.status === "Indisponível",
      ).length,
      color: "text-amber-700",
      background: "bg-amber-50",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <article
          key={item.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {item.label}
              </p>

              <p
                className={`mt-2 text-2xl font-bold ${item.color}`}
              >
                {item.value}
              </p>
            </div>

            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.background} ${item.color}`}
            >
              <Boxes size={19} />
            </div>
          </div>
        </article>
      ))}
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
  onChange: (value: string) => void;
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
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-zinc-200 bg-white pl-9 pr-8 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/15"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
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
        onClick={onRemove}
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <TableHeader>Equipamento</TableHeader>
            <TableHeader>Patrimônio</TableHeader>
            <TableHeader>Categoria</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Cliente</TableHeader>
            <TableHeader>Localização</TableHeader>
            <TableHeader>Valor</TableHeader>
            <TableHeader className="text-right">
              Ações
            </TableHeader>
          </tr>
        </thead>

        <tbody>
          {equipment.map((item) => (
            <tr
              key={item.id}
              className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#F57B00]">
                    <Boxes size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="max-w-[260px] truncate text-sm font-semibold text-zinc-900">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {item.manufacturer} · {item.model}
                    </p>
                  </div>
                </div>
              </td>

              <td className="whitespace-nowrap px-5 py-4">
                <p className="text-sm font-medium text-zinc-700">
                  {item.patrimony}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {item.serialNumber}
                </p>
              </td>

              <td className="px-5 py-4 text-sm text-zinc-600">
                {item.category}
              </td>

              <td className="px-5 py-4">
                <StatusBadge status={item.status} />
              </td>

              <td className="px-5 py-4 text-sm text-zinc-600">
                {item.client}
              </td>

              <td className="max-w-[220px] px-5 py-4">
                <p className="truncate text-sm text-zinc-600">
                  {item.location}
                </p>
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-zinc-700">
                {currencyFormatter.format(item.value)}
              </td>

              <td className="px-5 py-4 text-right">
                <Link
                  href={`/inventory/${item.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-[#F57B00] hover:bg-orange-50 hover:text-[#D96D00]"
                >
                  <Eye size={15} />
                  Detalhes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${className}`}
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
      {equipment.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                <Boxes size={21} />
              </div>

              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900">
                  {item.name}
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  {item.patrimony}
                </p>
              </div>
            </div>

            <StatusBadge status={item.status} />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            <CardDetail
              label="Categoria"
              value={item.category}
            />
            <CardDetail
              label="Condição"
              value={item.condition}
            />
            <CardDetail label="Cliente" value={item.client} />
            <CardDetail
              label="Valor"
              value={currencyFormatter.format(item.value)}
            />

            <div className="col-span-2">
              <CardDetail
                label="Localização"
                value={item.location}
              />
            </div>
          </dl>

          <div className="mt-5 border-t border-zinc-100 pt-4">
            <Link
              href={`/inventory/${item.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F57B00]"
            >
              <Eye size={16} />
              Ver detalhes
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function CardDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-400">
        {label}
      </dt>

      <dd className="mt-1 truncate text-sm font-medium text-zinc-700">
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: EquipmentStatus;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[status]}`}
      />

      {status}
    </span>
  );
}

function EmptyInventory({
  hasEquipment,
  onClear,
}: {
  hasEquipment: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
        <Search size={25} />
      </div>

      <h2 className="mt-4 text-base font-semibold text-zinc-900">
        {hasEquipment
          ? "Nenhum equipamento encontrado"
          : "Nenhum equipamento cadastrado"}
      </h2>

      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {hasEquipment
          ? "Não encontramos equipamentos correspondentes à busca e aos filtros selecionados."
          : "O inventário ainda está vazio. Cadastre o primeiro equipamento para começar."}
      </p>

      {hasEquipment ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          Limpar filtros
        </button>
      ) : (
        <Link
          href="/inventory/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          <Plus size={17} />
          Cadastrar equipamento
        </Link>
      )}
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
  onChange: (page: number) => void;
}) {
  const firstItem =
    totalItems === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const lastItem = Math.min(
    currentPage * pageSize,
    totalItems,
  );

  const pages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter(
    (page) =>
      page === 1 ||
      page === totalPages ||
      Math.abs(page - currentPage) <= 1,
  );

  return (
    <footer className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-zinc-500">
        Mostrando{" "}
        <span className="font-semibold text-zinc-700">
          {firstItem}–{lastItem}
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
          disabled={currentPage === 1}
          onClick={() => onChange(currentPage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft size={17} />
        </button>

        {pages.map((page, index) => {
          const previousPage = pages[index - 1];

          const hasGap =
            previousPage !== undefined &&
            page - previousPage > 1;

          return (
            <div
              key={page}
              className="flex items-center gap-1"
            >
              {hasGap ? (
                <span className="px-1 text-sm text-zinc-400">
                  …
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onChange(page)}
                className={[
                  "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition",
                  currentPage === page
                    ? "bg-[#F57B00] text-white"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                ].join(" ")}
              >
                {page}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onChange(currentPage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </footer>
  );
}