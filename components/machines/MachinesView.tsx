"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  AlertTriangle,
  Cpu,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

type MachineStatus =
  | "HOMOLOGATION"
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "UNAVAILABLE"
  | "RETIRED";

type MachineComponentStatus =
  | "INSTALLED"
  | "REMOVED"
  | "DAMAGED"
  | "MAINTENANCE"
  | "DISCARDED";

type MachineComponent = {
  id: string;
  equipmentId: string | null;

  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string;

  quantity: number;

  status: MachineComponentStatus;

  installedAt: string;
};

type Machine = {
  id: string;

  name: string;
  category: string | null;

  manufacturer: string | null;
  model: string | null;

  assetTag: string | null;
  serialNumber: string;

  invoiceNumber: string | null;

  status: MachineStatus;

  notes: string | null;

  createdById: string | null;

  createdBy: {
    id: string;
    name: string;
  } | null;

  components: MachineComponent[];

  totalComponentRecords: number;
  totalComponentUnits: number;

  createdAt: string;
  updatedAt: string;
};

type MachinesResponse = {
  success: boolean;
  data?: Machine[];
  categories?: string[];
  manufacturers?: string[];
  total?: number;
  message?: string;
};

type MachineMutationResponse = {
  success: boolean;
  data?: Machine;
  message?: string;
};

type MachineForm = {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  assetTag: string;
  serialNumber: string;
  invoiceNumber: string;
  receivedAt: string;
  notes: string;
};

type ComponentForm = {
  localId: string;

  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  notes: string;
};

type SessionUser = {
  role?: UserRole;
};

type ComponentEditorMode =
  | "CREATE"
  | "EDIT";

const PAGE_SIZE = 10;

const inputClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100";

function createInitialMachineForm(): MachineForm {
  return {
    name: "",
    category: "Servidor",
    manufacturer: "",
    model: "",
    assetTag: "",
    serialNumber: "",
    invoiceNumber: "",
    receivedAt: "",
    notes: "",
  };
}

function createComponentForm(): ComponentForm {
  return {
    localId: crypto.randomUUID(),

    name: "",
    category: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    notes: "",
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}

export function MachinesView() {
  const {
    data: session,
  } = useSession();

  const sessionUser =
    session?.user as
      | SessionUser
      | undefined;

/*
 * A aba Máquinas é uma área operacional.
 * Apenas ADMIN e BACKOFFICE podem cadastrar ou gerenciar máquinas.
 * COMMERCIAL e VIEWER consultam máquinas somente pelo Inventário.
 */
const canManageMachines =
  sessionUser?.role === "ADMIN" ||
  sessionUser?.role === "BACKOFFICE";

  const [
    machines,
    setMachines,
  ] = useState<Machine[]>([]);

const [
  machineCategories,
  setMachineCategories,
] = useState<string[]>([]);

const [
  machineManufacturers,
  setMachineManufacturers,
] = useState<string[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    modalError,
    setModalError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    machineForm,
    setMachineForm,
  ] = useState<MachineForm>(
    createInitialMachineForm,
  );

  const [
    components,
    setComponents,
  ] = useState<ComponentForm[]>(
    [],
  );

  const [
    componentEditorOpen,
    setComponentEditorOpen,
  ] = useState(false);

  const [
    componentEditorMode,
    setComponentEditorMode,
  ] =
    useState<ComponentEditorMode>(
      "CREATE",
    );

  const [
    componentEditorForm,
    setComponentEditorForm,
  ] = useState<ComponentForm>(
    createComponentForm,
  );

  const [
    componentEditorError,
    setComponentEditorError,
  ] = useState("");

  const loadMachines =
    useCallback(async () => {
      const controller =
        new AbortController();

      try {
        setLoading(true);
        setLoadError("");

        const response =
          await fetch(
            "/api/machines",
            {
              method: "GET",
              cache: "no-store",

              headers: {
                Accept:
                  "application/json",
              },

              signal:
                controller.signal,
            },
          );

        const data =
          (await response.json()) as MachinesResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar as máquinas.",
          );
        }

        setMachines(
          Array.isArray(data.data)
            ? data.data
            : [],
        );
        setMachineCategories(
  Array.isArray(data.categories)
    ? data.categories
    : [],
);

setMachineManufacturers(
  Array.isArray(
    data.manufacturers,
  )
    ? data.manufacturers
    : [],
);

      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setMachineCategories([]);

        setMachineManufacturers([]);

        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as máquinas.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadMachines();
  }, [
    loadMachines,
    refreshKey,
  ]);

const filteredMachines =
  useMemo(() => {
    const normalizedSearch =
      search
        .trim()
        .toLocaleLowerCase(
          "pt-BR",
        );

    return machines.filter(
      (machine) => {
        const searchableValues =
          [
            machine.name,
            machine.category,
            machine.manufacturer,
            machine.model,
            machine.assetTag,
            machine.serialNumber,
            machine.invoiceNumber,

            ...machine.components.flatMap(
              (component) => [
                component.name,
                component.category,
                component.manufacturer,
                component.model,
                component.serialNumber,
              ],
            ),
          ];

        return (
          !normalizedSearch ||
          searchableValues.some(
            (value) =>
              value
                ?.toLocaleLowerCase(
                  "pt-BR",
                )
                .includes(
                  normalizedSearch,
                ),
          )
        );
      },
    );
  }, [
    machines,
    search,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredMachines.length /
          PAGE_SIZE,
      ),
    );

  const safePage =
    Math.min(
      currentPage,
      totalPages,
    );

  const paginatedMachines =
    useMemo(() => {
      const start =
        (safePage - 1) *
        PAGE_SIZE;

      return filteredMachines.slice(
        start,
        start + PAGE_SIZE,
      );
    }, [
      filteredMachines,
      safePage,
    ]);

    /*
    * Estas verificações no cliente protegem a interface,
    * mas a autorização real deve continuar sendo validada nas APIs.
    */
  function openCreateModal() {
    if (!canManageMachines) {
      return;
    }

    setMachineForm(
      createInitialMachineForm(),
    );

    setComponents([]);

    setModalError("");

    setComponentEditorOpen(
      false,
    );

    setModalOpen(true);
  }

  function closeCreateModal() {
    if (
      saving ||
      componentEditorOpen
    ) {
      return;
    }

    setModalOpen(false);
    setModalError("");

    setMachineForm(
      createInitialMachineForm(),
    );

    setComponents([]);
  }

  function updateMachineForm<
    Field extends keyof MachineForm,
  >(
    field: Field,
    value: MachineForm[Field],
  ) {
    setMachineForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  function openAddComponentModal() {
  if (!canManageMachines || saving) {
    return;
  }

    setComponentEditorMode(
      "CREATE",
    );

    setComponentEditorForm(
      createComponentForm(),
    );

    setComponentEditorError("");

    setComponentEditorOpen(
      true,
    );
  }

  function openEditComponentModal(
  component: ComponentForm,
) {
  if (!canManageMachines || saving) {
    return;
  }

    setComponentEditorMode(
      "EDIT",
    );

    setComponentEditorForm({
      ...component,
    });

    setComponentEditorError("");

    setComponentEditorOpen(
      true,
    );
  }

  function closeComponentEditor() {
    setComponentEditorOpen(
      false,
    );

    setComponentEditorError("");

    setComponentEditorForm(
      createComponentForm(),
    );
  }

  function updateComponentEditor<
    Field extends keyof ComponentForm,
  >(
    field: Field,
    value: ComponentForm[Field],
  ) {
    setComponentEditorForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  function saveComponentEditor() {
  if (!canManageMachines) {
    return;
  }
    const name =
      componentEditorForm.name.trim();

    const category =
      componentEditorForm.category.trim();

    const serialNumber =
      componentEditorForm.serialNumber
        .trim()
        .toUpperCase();

    if (!name) {
      setComponentEditorError(
        "Informe o nome do componente.",
      );

      return;
    }

    if (!category) {
      setComponentEditorError(
        "Informe a categoria do componente.",
      );

      return;
    }

    if (!serialNumber) {
      setComponentEditorError(
        "Informe o número de série do componente.",
      );

      return;
    }

/*
 * Cada componente representa uma peça física individual.
 * Por isso, dois componentes da mesma máquina não podem compartilhar o mesmo serial.
 */
const duplicateSerial =
  components.some(
        (component) =>
          component.localId !==
            componentEditorForm.localId &&
          component.serialNumber
            .trim()
            .toUpperCase() ===
            serialNumber,
      );

    if (duplicateSerial) {
      setComponentEditorError(
        "Já existe um componente nesta máquina utilizando este número de série.",
      );

      return;
    }

    const normalizedComponent: ComponentForm =
      {
        ...componentEditorForm,

        name,
        category,

        manufacturer:
          componentEditorForm.manufacturer.trim(),

        model:
          componentEditorForm.model.trim(),

        serialNumber,

        notes:
          componentEditorForm.notes.trim(),
      };

    if (
      componentEditorMode ===
      "CREATE"
    ) {
      setComponents(
        (current) => [
          ...current,
          normalizedComponent,
        ],
      );
    } else {
      setComponents(
        (current) =>
          current.map(
            (component) =>
              component.localId ===
              normalizedComponent.localId
                ? normalizedComponent
                : component,
          ),
      );
    }

    closeComponentEditor();
    setModalError("");
  }

  function removeComponent(
  localId: string,
) {
  if (!canManageMachines || saving) {
    return;
  }

    setComponents(
      (current) =>
        current.filter(
          (component) =>
            component.localId !==
            localId,
        ),
    );

    setModalError("");
  }

  async function handleCreateMachine(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canManageMachines) {
      return;
    }

    const name =
      machineForm.name.trim();

    const serialNumber =
      machineForm.serialNumber
        .trim()
        .toUpperCase();

    if (!name) {
      setModalError(
        "Informe o nome da máquina.",
      );

      return;
    }

    if (!serialNumber) {
      setModalError(
        "Informe o número de série da máquina.",
      );

      return;
    }

/*
 * Uma máquina é cadastrada já com sua composição de fábrica.
 * Componentes não podem ser adicionados depois do cadastro.
 */
    if (components.length === 0) {
      setModalError(
        "Adicione pelo menos um componente à composição inicial.",
      );

      return;
    }

/*
 * Fazemos a validação também no formulário completo
 * para impedir serial duplicado mesmo que o estado local
 * tenha sido alterado fora do editor de componente.
 */
const normalizedSerials =
  components.map(
        (component) =>
          component.serialNumber
            .trim()
            .toUpperCase(),
      );

    if (
      new Set(normalizedSerials)
        .size !==
      normalizedSerials.length
    ) {
      setModalError(
        "Existem componentes com o mesmo número de série.",
      );

      return;
    }

    if (!machineForm.receivedAt) {
  setModalError(
    "Informe a data de recebimento da máquina.",
  );

  return;
}

    try {
      setSaving(true);
      setModalError("");

      const response =
        await fetch(
          "/api/machines",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              name,

              category:
                machineForm.category.trim() ||
                null,

              manufacturer:
                machineForm.manufacturer.trim() ||
                null,

              model:
                machineForm.model.trim() ||
                null,

              assetTag:
                machineForm.assetTag
                  .trim()
                  .toUpperCase() ||
                null,

              serialNumber,

              invoiceNumber:
                machineForm.invoiceNumber.trim() ||
                null,

               receivedAt:
                machineForm.receivedAt,                

              notes:
                machineForm.notes.trim() ||
                null,

              components:
                components.map(
                  (component) => ({
                    name:
                      component.name.trim(),

                    category:
                      component.category.trim(),

                    manufacturer:
                      component.manufacturer.trim() ||
                      null,

                    model:
                      component.model.trim() ||
                      null,

                    serialNumber:
                      component.serialNumber
                        .trim()
                        .toUpperCase(),

                    /*
                    * Cada MachineComponent representa exatamente
                    * uma peça física identificada por um serial.
                     */
                    quantity: 1,

                    notes:
                      component.notes.trim() ||
                      null,
                  }),
                ),
            }),
          },
        );

      const data =
        (await response.json()) as MachineMutationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível cadastrar a máquina.",
        );
      }

      setModalOpen(false);
      setModalError("");

      setMachineForm(
        createInitialMachineForm(),
      );

      setComponents([]);

      setSuccessMessage(
        data.message ??
          "Máquina cadastrada com sucesso.",
      );

      setRefreshKey(
        (current) =>
          current + 1,
      );

      window.setTimeout(
        () => {
          setSuccessMessage("");
        },
        5000,
      );
    } catch (error) {
      setModalError(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a máquina.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (loadError) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle
          size={28}
          className="text-red-600"
        />

        <h2 className="mt-4 font-bold text-red-800">
          Não foi possível carregar as máquinas
        </h2>

        <p className="mt-2 max-w-md text-sm text-red-600">
          {loadError}
        </p>

        <button
          type="button"
          onClick={() =>
            setRefreshKey(
              (current) =>
                current + 1,
            )
          }
          className="mt-5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {successMessage ? (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span>
              {successMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage(
                  "",
                )
              }
              aria-label="Fechar mensagem"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />

                <input
                  type="search"
                  value={search}
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
                  placeholder="Buscar por máquina, patrimônio, serial, fabricante, modelo ou componente..."
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-10 text-sm outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
                />

                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCurrentPage(
                        1,
                      );
                    }}
                    aria-label="Limpar pesquisa"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {canManageMachines ? (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
                >
                  <Plus size={17} />
                  Nova máquina
                </button>
              ) : null}
            </div>
          </div>

          {paginatedMachines.length ===
          0 ? (
          <EmptyMachines
  hasMachines={
    machines.length > 0
  }
  canCreate={
    canManageMachines
  }
  onCreate={
    openCreateModal
  }
  onClear={() => {
    setSearch("");
    setCurrentPage(1);
  }}
/>
          ) : (
            <div className="divide-y divide-zinc-100">
              {paginatedMachines.map(
                (machine) => (
                  <MachineRow
                    key={
                      machine.id
                    }
                    machine={
                      machine
                    }
                  />
                ),
              )}
            </div>
          )}

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <p>
              {
                filteredMachines.length
              }{" "}
              {filteredMachines.length ===
              1
                ? "máquina"
                : "máquinas"}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  safePage <= 1
                }
                onClick={() =>
                  setCurrentPage(
                    safePage - 1,
                  )
                }
                className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-sm">
                {safePage} /{" "}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  safePage >=
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    safePage + 1,
                  )
                }
                className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </footer>
        </section>
      </div>

      {modalOpen &&
      canManageMachines ? (
        <CreateMachineModal
          machineForm={
            machineForm
          }
          components={
            components
          }
          saving={saving}
          error={
            modalError
          }
          componentEditorOpen={
            componentEditorOpen
          }
          onClose={
            closeCreateModal
          }
          onSubmit={
            handleCreateMachine
          }
          onMachineChange={
            updateMachineForm
          }
          machineCategories={
            machineCategories
          }
          machineManufacturers={
            machineManufacturers
          }
          onAddComponent={
            openAddComponentModal
          }
          onEditComponent={
            openEditComponentModal
          }
          onRemoveComponent={
            removeComponent
          }
        />
      ) : null}

      {componentEditorOpen &&
      canManageMachines ? (
        <ComponentEditorModal
          mode={
            componentEditorMode
          }
          form={
            componentEditorForm
          }
          error={
            componentEditorError
          }
          onClose={
            closeComponentEditor
          }
          onChange={
            updateComponentEditor
          }
          onSave={
            saveComponentEditor
          }
        />
      ) : null}
    </>
  );
}

/*
 * IN_USE representa uma máquina que já saiu fisicamente
 * pelo projeto. Na gestão de Máquinas exibimos esse estado
 * como "Entregue", que corresponde ao processo operacional.
 */
function getMachineStatusLabel(
  status: MachineStatus,
) {
  switch (status) {
    case "AVAILABLE":
      return {
        label: "Disponível",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
      };

    case "IN_USE":
      return {
        label: "Entregue",
        className:
          "border-blue-200 bg-blue-50 text-blue-700",
      };

    case "HOMOLOGATION":
      return {
        label: "Homologação",
        className:
          "border-violet-200 bg-violet-50 text-violet-700",
      };

    case "MAINTENANCE":
      return {
        label: "Manutenção",
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
      };

    case "UNAVAILABLE":
      return {
        label: "Indisponível",
        className:
          "border-red-200 bg-red-50 text-red-700",
      };

    case "RETIRED":
      return {
        label: "Retirada",
        className:
          "border-zinc-200 bg-zinc-100 text-zinc-600",
      };
  }
}

function MachineRow({
  machine,
}: {
  machine: Machine;
}) {
  const machineStatus =
    getMachineStatusLabel(
      machine.status,
    );

  return (
    <article className="px-5 py-4 transition hover:bg-orange-50/30">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_190px] lg:items-center">
        <Link
          href={`/machines/${machine.id}`}
          className="flex min-w-0 items-start gap-3 rounded-lg outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-orange-200"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
            <Server size={20} />
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-sm font-bold text-zinc-900 sm:text-[15px]">
                {machine.name}
              </h3>

              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${machineStatus.className}`}
              >
                {machineStatus.label}
              </span>
            </div>

            <p className="mt-1 truncate text-xs text-zinc-500">
              {[
                machine.manufacturer,
                machine.model,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "Fabricante e modelo não informados"}
            </p>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                SN:{" "}
                <strong className="text-zinc-700">
                  {machine.serialNumber}
                </strong>
              </span>

              {machine.assetTag ? (
                <span>
                  Patrimônio:{" "}
                  <strong className="text-zinc-700">
                    {machine.assetTag}
                  </strong>
                </span>
              ) : null}
            </div>
          </div>
        </Link>

        <div>
          <p className="text-xs text-zinc-400">
            Composição atual
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-700">
            {machine.totalComponentRecords}{" "}
            {machine.totalComponentRecords === 1
              ? "componente"
              : "componentes"}
          </p>
        </div>

        <div className="text-sm">
          <p className="text-xs text-zinc-400">
            Cadastrada
          </p>

          <p className="mt-1 font-medium text-zinc-700">
            {formatDate(
              machine.createdAt,
            )}
          </p>

          {machine.createdBy ? (
            <p className="mt-1 truncate text-xs text-zinc-500">
              por{" "}
              {machine.createdBy.name}
            </p>
          ) : null}
        </div>
      </div>

      {machine.components.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
          {machine.components
            .slice(0, 6)
            .map((component) => (
              <span
                key={component.id}
                title={`${component.name} · SN ${component.serialNumber}`}
                className="inline-flex max-w-52 truncate rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
              >
                {component.name}
                {" · "}
                {component.serialNumber}
              </span>
            ))}

          {machine.components.length > 6 ? (
            <span className="rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
              +
              {machine.components.length -
                6}{" "}
              componente(s)
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EmptyMachines({
  hasMachines,
  canCreate,
  onCreate,
  onClear,
}: {
  hasMachines: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
        <Server size={26} />
      </div>

      <h2 className="mt-4 font-bold text-zinc-900">
        {hasMachines
          ? "Nenhuma máquina encontrada"
          : "Nenhuma máquina cadastrada"}
      </h2>

      <p className="mt-2 max-w-md text-sm text-zinc-500">
{hasMachines
  ? "Ajuste a pesquisa para localizar a máquina."
  : "Cadastre a primeira máquina completa e informe sua composição de hardware."}
      </p>

      {hasMachines ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          Limpar pesquisa
        </button>
      ) : canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F57B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
        >
          <Plus size={17} />
          Cadastrar máquina
        </button>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-[#F57B00]" />

        <p className="text-sm font-medium">
          Carregando máquinas...
        </p>
      </div>
    </div>
  );
}

function CreateMachineModal({
  machineForm,
  machineCategories,
  machineManufacturers,
  components,
  saving,
  error,
  componentEditorOpen,
  onClose,
  onSubmit,
  onMachineChange,
  onAddComponent,
  onEditComponent,
  onRemoveComponent,
}: {
  machineForm: MachineForm;
  machineCategories: string[];
  machineManufacturers: string[];
  components: ComponentForm[];

  saving: boolean;
  error: string;

  componentEditorOpen: boolean;

  onClose: () => void;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;

  onMachineChange: <
    Field extends keyof MachineForm,
  >(
    field: Field,
    value: MachineForm[Field],
  ) => void;

  onAddComponent: () => void;

  onEditComponent: (
    component: ComponentForm,
  ) => void;

  onRemoveComponent: (
    localId: string,
  ) => void;
}) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !saving &&
        !componentEditorOpen
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    componentEditorOpen,
    onClose,
    saving,
  ]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving &&
          !componentEditorOpen
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-machine-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="create-machine-title"
              className="text-lg font-bold text-zinc-900"
            >
              Nova máquina
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Cadastre a máquina recebida e monte sua composição inicial.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={
              saving ||
              componentEditorOpen
            }
            aria-label="Fechar modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>
              </div>
            ) : null}

            <section className="space-y-4">
              <SectionHeader
                title="Identificação da máquina"
                description="Dados próprios do equipamento principal recebido da fábrica."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Nome da máquina"
                  required
                >
                  <input
                    type="text"
                    value={
                      machineForm.name
                    }
                    onChange={(
                      event,
                    ) =>
                      onMachineChange(
                        "name",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: Servidor Supermicro UPD SYS-620P-TR"
                    className={
                      inputClassName
                    }
                    required
                    autoFocus
                  />
                </FormField>

                <FormField label="Categoria">
  <>
    <input
      type="text"
      list="machine-categories"
      value={machineForm.category}
      onChange={(event) =>
        onMachineChange(
          "category",
          event.target.value,
        )
      }
      placeholder="Ex.: Servidor"
      className={inputClassName}
    />

    <datalist id="machine-categories">
      {machineCategories.map(
        (category) => (
          <option
            key={category}
            value={category}
          />
        ),
      )}
    </datalist>
  </>
</FormField>

                <FormField label="Fabricante">
  <>
    <input
      type="text"
      list="machine-manufacturers"
      value={
        machineForm.manufacturer
      }
      onChange={(event) =>
        onMachineChange(
          "manufacturer",
          event.target.value,
        )
      }
      placeholder="Ex.: Fortinet"
      className={
        inputClassName
      }
    />

    <datalist id="machine-manufacturers">
      {machineManufacturers.map(
        (manufacturer) => (
          <option
            key={manufacturer}
            value={manufacturer}
          />
        ),
      )}
    </datalist>
  </>
</FormField>

                <FormField label="Modelo">
                  <input
                    type="text"
                    value={
                      machineForm.model
                    }
                    onChange={(
                      event,
                    ) =>
                      onMachineChange(
                        "model",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: SYS-620P-TR"
                    className={
                      inputClassName
                    }
                  />
                </FormField>

                <FormField
                  label="Número de série"
                  required
                >
                  <input
                    type="text"
                    value={
                      machineForm.serialNumber
                    }
                    onChange={(
                      event,
                    ) =>
                      onMachineChange(
                        "serialNumber",
                        event.target
                          .value
                          .toUpperCase(),
                      )
                    }
                    placeholder="Ex.: 3001157"
                    className={
                      inputClassName
                    }
                    required
                  />
                </FormField>

                <FormField label="Patrimônio">
                  <input
                    type="text"
                    value={
                      machineForm.assetTag
                    }
                    onChange={(
                      event,
                    ) =>
                      onMachineChange(
                        "assetTag",
                        event.target
                          .value
                          .toUpperCase(),
                      )
                    }
                    placeholder="Patrimônio / TAG"
                    className={
                      inputClassName
                    }
                  />
                </FormField>

                <FormField label="Nota fiscal">
                  <input
                    type="text"
                    value={
                      machineForm.invoiceNumber
                    }
                    onChange={(
                      event,
                    ) =>
                      onMachineChange(
                        "invoiceNumber",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Número da nota fiscal"
                    className={
                      inputClassName
                    }
                  />
                </FormField>
                            <FormField
  label="Data de recebimento"
  required
>
  <input
    type="date"
    value={machineForm.receivedAt}
    onChange={(event) =>
      onMachineChange(
        "receivedAt",
        event.target.value,
      )
    }
    required
    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
  />
</FormField>
              </div>

  

              <FormField label="Observações">
                <textarea
                  value={
                    machineForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    onMachineChange(
                      "notes",
                      event.target
                        .value,
                    )
                  }
                  rows={3}
                  placeholder="Informações adicionais sobre a máquina"
                  className={`${inputClassName} h-auto resize-y py-2.5`}
                />
              </FormField>
            </section>

            <section className="border-t border-zinc-200 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeader
                  title="Composição inicial"
                  description="Adicione individualmente os componentes instalados na máquina."
                />

                <button
                  type="button"
                  onClick={
                    onAddComponent
                  }
                  disabled={saving}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-[#F57B00] transition hover:bg-orange-100 disabled:opacity-50"
                >
                  <PackagePlus
                    size={16}
                  />

                  Adicionar componente
                </button>
              </div>

              {components.length ===
              0 ? (
                <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200">
                    <Cpu size={20} />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-zinc-800">
                    Nenhum componente adicionado
                  </p>

                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                    Adicione processadores, memórias, discos, placas e demais componentes instalados.
                  </p>

                  <button
                    type="button"
                    onClick={
                      onAddComponent
                    }
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#F57B00] px-3 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
                  >
                    <Plus size={16} />
                    Adicionar primeiro componente
                  </button>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                  <div className="hidden grid-cols-[minmax(0,1fr)_180px_200px_90px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
                    <span>
                      Componente
                    </span>

                    <span>
                      Categoria
                    </span>

                    <span>
                      Número de série
                    </span>

                    <span className="text-right">
                      Ações
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-100">
                    {components.map(
                      (
                        component,
                        index,
                      ) => (
                        <article
                          key={
                            component.localId
                          }
                          className="grid gap-3 px-4 py-4 transition hover:bg-zinc-50 md:grid-cols-[minmax(0,1fr)_180px_200px_90px] md:items-center md:gap-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900">
                              {
                                component.name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {[
                                component.manufacturer,
                                component.model,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  " · ",
                                ) ||
                                `Componente ${index + 1}`}
                            </p>
                          </div>

                          <div>
                            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {
                                component.category
                              }
                            </span>
                          </div>

                          <div>
                            <p className="font-mono text-xs font-semibold text-zinc-700">
                              {
                                component.serialNumber
                              }
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onEditComponent(
                                  component,
                                )
                              }
                              disabled={saving}
                              aria-label={`Editar ${component.name}`}
                              title="Editar componente"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-orange-50 hover:text-[#F57B00] disabled:opacity-40"
                            >
                              <Pencil
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onRemoveComponent(
                                  component.localId,
                                )
                              }
                              disabled={saving}
                              aria-label={`Remover ${component.name}`}
                              title="Remover componente"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>

                  <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                    <strong className="text-zinc-700">
                      {
                        components.length
                      }
                    </strong>{" "}
                    {components.length ===
                    1
                      ? "componente identificado"
                      : "componentes identificados"}
                  </div>
                </div>
              )}
            </section>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={
                  saving ||
                  componentEditorOpen
                }
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  componentEditorOpen
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Cadastrar máquina
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ComponentEditorModal({
  mode,
  form,
  error,
  onClose,
  onChange,
  onSave,
}: {
  mode: ComponentEditorMode;

  form: ComponentForm;

  error: string;

  onClose: () => void;

  onChange: <
    Field extends keyof ComponentForm,
  >(
    field: Field,
    value: ComponentForm[Field],
  ) => void;

  onSave: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        event.preventDefault();

        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    onSave();
  }

  const isEditing =
    mode === "EDIT";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-editor-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
              <Cpu size={19} />
            </div>

            <div>
              <h2
                id="component-editor-title"
                className="text-lg font-bold text-zinc-900"
              >
                {isEditing
                  ? "Editar componente"
                  : "Adicionar componente"}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Cada peça física deve possuir seu próprio número de série.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar cadastro de componente"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={20} />
          </button>
        </header>

        <form
  onSubmit={handleSubmit}
  className="flex min-h-0 flex-1 flex-col"
>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormField
                  label="Componente"
                  required
                >
                  <input
                    type="text"
                    value={
                      form.name
                    }
                    onChange={(
                      event,
                    ) =>
                      onChange(
                        "name",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: SSD 3.84TB SATA-III"
                    className={
                      inputClassName
                    }
                    autoFocus
                    required
                  />
                </FormField>
              </div>

              <FormField
                label="Categoria"
                required
              >
                <input
                  type="text"
                  value={
                    form.category
                  }
                  onChange={(
                    event,
                  ) =>
                    onChange(
                      "category",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: SSD"
                  className={
                    inputClassName
                  }
                  required
                />
              </FormField>

              <FormField
                label="Número de série"
                required
              >
                <input
                  type="text"
                  value={
                    form.serialNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    onChange(
                      "serialNumber",
                      event.target
                        .value
                        .toUpperCase(),
                    )
                  }
                  placeholder="Serial individual da peça"
                  className={
                    inputClassName
                  }
                  required
                />
              </FormField>

              <FormField label="Fabricante">
                <input
                  type="text"
                  value={
                    form.manufacturer
                  }
                  onChange={(
                    event,
                  ) =>
                    onChange(
                      "manufacturer",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: Samsung"
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <FormField label="Modelo">
                <input
                  type="text"
                  value={
                    form.model
                  }
                  onChange={(
                    event,
                  ) =>
                    onChange(
                      "model",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: PM893"
                  className={
                    inputClassName
                  }
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Observações">
                  <textarea
                    value={
                      form.notes
                    }
                    onChange={(
                      event,
                    ) =>
                      onChange(
                        "notes",
                        event.target
                          .value,
                      )
                    }
                    rows={3}
                    placeholder="Informações específicas sobre este componente"
                    className={`${inputClassName} h-auto resize-y py-2.5`}
                  />
                </FormField>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
              <strong>
                Rastreabilidade:
              </strong>{" "}
              este cadastro representa uma única peça física. Caso existam dois componentes iguais, cadastre cada um separadamente com seu respectivo Serial Number.
            </div>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
            >
              {isEditing ? (
                <>
                  <Pencil
                    size={16}
                  />
                  Salvar alterações
                </>
              ) : (
                <>
                  <Plus
                    size={16}
                  />
                  Adicionar componente
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900">
        {title}
      </h3>

      <p className="mt-1 text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-700">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </span>

      {children}
    </label>
  );
}