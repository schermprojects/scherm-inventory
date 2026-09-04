"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Cpu,
  FileText,
  History,
  Loader2,
  PackageMinus,
  Pencil,
  Server,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  type FormEvent,
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

type RemovalReason =
  | "REALLOCATION"
  | "HARDWARE_FAILURE"
  | "OTHER";

type MachineComponent = {
  id: string;

  name: string;
  category: string;

  manufacturer: string | null;
  model: string | null;

  serialNumber: string;

  status: string;

  installedAt: string;
  removedAt?: string | null;

  notes: string | null;
};

type HistoryItem = {
  id: string;

  type: string;
  reason: string;
  notes: string | null;

  createdAt: string;

  createdBy: {
    id: string;
    name: string;
  } | null;

  component: {
    id: string;
    name: string;
    category: string;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string;
  };
};

type MachineDetails = {
  id: string;

  name: string;
  category: string | null;

  manufacturer: string | null;
  model: string | null;

  assetTag: string | null;
  serialNumber: string;
  invoiceNumber: string | null;

  receivedAt: string | null;

  notes: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: {
    id: string;
    name: string;
  } | null;

  components: MachineComponent[];
  removedComponents: MachineComponent[];

  history: HistoryItem[];

  totalCurrentComponents: number;
};

type MachineResponse = {
  success: boolean;
  data?: MachineDetails;
  categories?: string[];
  manufacturers?: string[];
  message?: string;
};

type RemovalResponse = {
  success: boolean;
  message?: string;
};

type MachineEditForm = {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  assetTag: string;
  invoiceNumber: string;
  receivedAt: string;
  notes: string;
};

type MachineUpdateResponse = {
  success: boolean;
  data?: MachineDetails;
  message?: string;
};

type MachineDeleteResponse = {
  success: boolean;
  message?: string;
};

type SessionUser = {
  role?: UserRole;
};

const removalReasonLabels: Record<
  RemovalReason,
  string
> = {
  REALLOCATION:
    "Remover para reutilização",
  HARDWARE_FAILURE:
    "Danificado / falha",
  OTHER:
    "Outro motivo",
};

const fieldClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100";

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
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

function formatDateOnly(
  value: string | null | undefined,
) {
  if (!value) {
    return "Não informada";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
    },
  ).format(date);
}

function toDateInputValue(
  value: string | null | undefined,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function MachineDetailsView({
  machineId,
}: {
  machineId: string;
}) { const router = useRouter();
  const {
    data: session,
  } = useSession();

  const sessionUser =
    session?.user as
      | SessionUser
      | undefined;

  const canManage =
    sessionUser?.role === "ADMIN" ||
    sessionUser?.role ===
      "BACKOFFICE";

  const [
    machine,
    setMachine,
  ] =
    useState<MachineDetails | null>(
      null,
    );

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
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
  editOpen,
  setEditOpen,
] = useState(false);

const [
  deleteOpen,
  setDeleteOpen,
] = useState(false);

const [
  deleting,
  setDeleting,
] = useState(false);

const [
  deleteError,
  setDeleteError,
] = useState("");

const [
  editForm,
  setEditForm,
] = useState<MachineEditForm>({
  name: "",
  category: "",
  manufacturer: "",
  model: "",
  assetTag: "",
  invoiceNumber: "",
  receivedAt: "",
  notes: "",
});

const [
  editError,
  setEditError,
] = useState("");

const [
  savingEdit,
  setSavingEdit,
] = useState(false);

  const [
    removalComponent,
    setRemovalComponent,
  ] =
    useState<MachineComponent | null>(
      null,
    );

 const [
  removalReason,
  setRemovalReason,
] =
  useState<RemovalReason>(
    "REALLOCATION",
  );

  const [
    removalNotes,
    setRemovalNotes,
  ] = useState("");

  const [
    removalError,
    setRemovalError,
  ] = useState("");

  const [
    removing,
    setRemoving,
  ] = useState(false);

  const loadMachine =
    useCallback(async () => {
      try {
        setLoading(true);
        setLoadError("");

        const response =
          await fetch(
            `/api/machines/${machineId}`,
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
          (await response.json()) as MachineResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.data
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar a máquina.",
          );
        }

        setMachine(data.data);

            setMachineCategories(
  Array.isArray(data.categories)
    ? data.categories
    : [],
);

setMachineManufacturers(
  Array.isArray(data.manufacturers)
    ? data.manufacturers
    : [],
);
      } catch (error) {
        setMachine(null);

        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a máquina.",
        );
      } finally {
        setLoading(false);
      }
    }, [machineId]);

  useEffect(() => {
    void loadMachine();
  }, [loadMachine]);

const removalHistory =
  useMemo(() => {
    return (
      machine?.history.filter(
        (item) =>
          item.type === "REMOVE",
      ) ?? []
    );
  }, [machine]);

function openEditModal() {
  if (
    !canManage ||
    !machine
  ) {
    return;
  }

  setEditForm({
    name:
      machine.name,

    category:
      machine.category ?? "",

    manufacturer:
      machine.manufacturer ?? "",

    model:
      machine.model ?? "",

    assetTag:
      machine.assetTag ?? "",

    invoiceNumber:
      machine.invoiceNumber ?? "",

    receivedAt:
      toDateInputValue(
        machine.receivedAt,
      ),

    notes:
      machine.notes ?? "",
  });

  setEditError("");
  setEditOpen(true);
}

function closeEditModal() {
  if (savingEdit) {
    return;
  }

  setEditOpen(false);
  setEditError("");
}

function updateEditForm<
  Field extends keyof MachineEditForm,
>(
  field: Field,
  value: MachineEditForm[Field],
) {
  setEditForm(
    (current) => ({
      ...current,
      [field]: value,
    }),
  );
}

async function handleEditMachine(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  if (!canManage) {
    return;
  }

  const name =
    editForm.name.trim();

  if (!name) {
    setEditError(
      "Informe o nome da máquina.",
    );

    return;
  }

  if (!editForm.receivedAt) {
    setEditError(
      "Informe a data de recebimento.",
    );

    return;
  }

  try {
    setSavingEdit(true);
    setEditError("");

    const response =
      await fetch(
        `/api/machines/${machineId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            name,

            category:
              editForm.category.trim() ||
              null,

            manufacturer:
              editForm.manufacturer.trim() ||
              null,

            model:
              editForm.model.trim() ||
              null,

            assetTag:
              editForm.assetTag
                .trim()
                .toUpperCase() ||
              null,

            invoiceNumber:
              editForm.invoiceNumber.trim() ||
              null,

            receivedAt:
              editForm.receivedAt,

            notes:
              editForm.notes.trim() ||
              null,
          }),
        },
      );

    const data =
      (await response.json()) as MachineUpdateResponse;

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
          "Não foi possível atualizar a máquina.",
      );
    }

    setEditOpen(false);

    setSuccessMessage(
      data.message ??
        "Dados da máquina atualizados com sucesso.",
    );

    await loadMachine();

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  } catch (error) {
    setEditError(
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar a máquina.",
    );
  } finally {
    setSavingEdit(false);
  }
}

function openDeleteModal() {
  if (
    !canManage ||
    !machine
  ) {
    return;
  }

  setDeleteError("");
  setDeleteOpen(true);
}

function closeDeleteModal() {
  if (deleting) {
    return;
  }

  setDeleteOpen(false);
  setDeleteError("");
}

async function handleDeleteMachine() {
  if (
    !canManage ||
    !machine
  ) {
    return;
  }

  try {
    setDeleting(true);
    setDeleteError("");

    const response =
      await fetch(
        `/api/machines/${machineId}`,
        {
          method: "DELETE",

          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const data =
      (await response.json()) as MachineDeleteResponse;

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ??
          "Não foi possível excluir a máquina.",
      );
    }

    setDeleteOpen(false);

    router.push("/machines");
    router.refresh();
  } catch (error) {
    setDeleteError(
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a máquina.",
    );
  } finally {
    setDeleting(false);
  }
}

  function openRemovalModal(
    component: MachineComponent,
  ) {
    if (!canManage) {
      return;
    }

    setRemovalComponent(
      component,
    );

   setRemovalReason(
  "REALLOCATION",
);

    setRemovalNotes("");
    setRemovalError("");
  }

  function closeRemovalModal() {
    if (removing) {
      return;
    }

    setRemovalComponent(null);
    setRemovalNotes("");
    setRemovalError("");
  }

  async function handleRemoveComponent(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !removalComponent ||
      !canManage
    ) {
      return;
    }

    const notes =
      removalNotes.trim();

    if (!notes) {
      setRemovalError(
        "Informe a justificativa da remoção.",
      );

      return;
    }

    try {
      setRemoving(true);
      setRemovalError("");

      const response =
        await fetch(
          `/api/machines/${machineId}/components/${removalComponent.id}/remove`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              reason:
                removalReason,

              notes,
            }),
          },
        );

      const data =
        (await response.json()) as RemovalResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível remover o componente.",
        );
      }

      setRemovalComponent(null);
      setRemovalNotes("");

      setSuccessMessage(
        data.message ??
          "Componente removido com sucesso.",
      );

      await loadMachine();

      window.setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (error) {
      setRemovalError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o componente.",
      );
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2
            size={30}
            className="animate-spin text-[#F57B00]"
          />

          <p className="text-sm">
            Carregando máquina...
          </p>
        </div>
      </div>
    );
  }

  if (
    loadError ||
    !machine
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <AlertTriangle className="text-red-600" />

        <h2 className="mt-3 font-bold text-red-800">
          Não foi possível abrir a máquina
        </h2>

        <p className="mt-2 text-sm text-red-700">
          {loadError}
        </p>

        <Link
          href="/machines"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <Link
      href="/machines"
      aria-label="Voltar para máquinas"
      title="Voltar para máquinas"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
    >
      <ArrowLeft size={19} />
    </Link>

    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
      <Server size={21} />
    </div>

    <div className="min-w-0">
      <h1 className="truncate text-lg font-bold text-zinc-900 sm:text-xl">
        {machine.name}
      </h1>

      <p className="mt-0.5 truncate text-xs text-zinc-500 sm:text-sm">
        {[
          machine.manufacturer,
          machine.model,
        ]
          .filter(Boolean)
          .join(" · ") ||
          "Fabricante e modelo não informados"}
      </p>
    </div>
  </div>

  <div className="ml-[52px] self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 sm:ml-0 sm:self-auto sm:px-4 sm:text-sm">
    <strong className="text-zinc-900">
      {machine.totalCurrentComponents}
    </strong>{" "}
    {machine.totalCurrentComponents === 1
      ? "componente instalado"
      : "componentes instalados"}
  </div>
</div>

        {successMessage ? (
          <div className="flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span>
              {successMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
<div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
  <div>
    <h2 className="font-bold text-zinc-900">
      Dados da máquina
    </h2>

    <p className="mt-1 text-xs text-zinc-500">
      Identificação do equipamento principal.
    </p>
  </div>

  {canManage ? (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={openEditModal}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
      >
        <Pencil size={15} />

        <span className="hidden sm:inline">
          Editar dados
        </span>
      </button>

      <button
        type="button"
        onClick={openDeleteModal}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Trash2 size={15} />

        <span className="hidden sm:inline">
          Excluir máquina
        </span>
      </button>
    </div>
  ) : null}
</div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              label="Número de série"
              value={
                machine.serialNumber
              }
              icon={<Tag size={16} />}
            />

            <InfoItem
              label="Patrimônio"
              value={
                machine.assetTag ??
                "Não informado"
              }
              icon={<Tag size={16} />}
            />

            <InfoItem
              label="Nota fiscal"
              value={
                machine.invoiceNumber ??
                "Não informada"
              }
              icon={
                <FileText size={16} />
              }
            />

            <InfoItem
              label="Categoria"
              value={
                machine.category ??
                "Não informada"
              }
              icon={<Server size={16} />}
            />

            <InfoItem
  label="Recebida em"
  value={formatDateOnly(
    machine.receivedAt,
  )}
  icon={
    <CalendarDays
      size={16}
    />
  }
/>

            <InfoItem
              label="Cadastrada em"
              value={formatDate(
                machine.createdAt,
              )}
              icon={
                <CalendarDays
                  size={16}
                />
              }
            />

            <InfoItem
              label="Cadastrada por"
              value={
                machine.createdBy
                  ?.name ??
                "Não informado"
              }
              icon={
                <UserRound size={16} />
              }
            />
          </div>

          {machine.notes ? (
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Observações
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                {machine.notes}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-zinc-900">
                Configuração atual
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                Componentes atualmente instalados nesta máquina.
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#F57B00]">
              <Cpu size={18} />
            </div>
          </div>

          {machine.components.length ===
          0 ? (
            <div className="p-8 text-center">
              <PackageMinus
                size={26}
                className="mx-auto text-zinc-400"
              />

              <p className="mt-3 text-sm font-semibold text-zinc-700">
                Nenhum componente instalado
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {machine.components.map(
                (component) => (
                  <article
  key={component.id}
  className="px-4 py-4 sm:px-5"
>
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-zinc-900">
        {component.name}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {[
          component.category,
          component.manufacturer,
          component.model,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-zinc-400">
            Número de série
          </p>

          <p className="mt-0.5 break-all font-mono text-xs font-semibold text-zinc-700">
            {component.serialNumber}
          </p>
        </div>

        <div>
          <p className="text-[11px] text-zinc-400">
            Instalado em
          </p>

          <p className="mt-0.5 text-xs font-medium text-zinc-600">
            {formatDate(
              component.installedAt,
            )}
          </p>
        </div>
      </div>
    </div>

    {canManage ? (
      <button
        type="button"
        onClick={() =>
          openRemovalModal(
            component,
          )
        }
        className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:w-auto"
      >
        <Trash2 size={15} />

        Remover
      </button>
    ) : null}
  </div>
</article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
              <History size={17} />
            </div>

            <div>
              <h2 className="font-bold text-zinc-900">
                Histórico de remoções
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                Componentes removidos desta máquina.
              </p>
            </div>
          </div>

          {removalHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhuma remoção registrada.
            </div>
          ) : 
            <div className="divide-y divide-zinc-100">
              {removalHistory.map(
              (item) => (
                  <article
                    key={
                      item.id
                    }
                    className="px-5 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                            <PackageMinus
                              size={13}
                            />

                            Remoção
                          </span>

                          <span className="text-sm font-semibold text-zinc-900">
                            {
                              item.component
                                .name
                            }
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-zinc-600">
                          SN{" "}
                          <strong className="font-mono text-zinc-800">
                            {
                              item.component
                                .serialNumber
                            }
                          </strong>
                        </p>

                        <p className="mt-2 text-sm text-zinc-600">
                          Motivo:{" "}
                          <strong>
                            {removalReasonLabels[
                              item.reason as RemovalReason
                            ] ??
                              item.reason}
                          </strong>
                        </p>

                        {item.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
                            {
                              item.notes
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-xs text-zinc-500 sm:text-right">
                        <p>
                          {formatDate(
                            item.createdAt,
                          )}
                        </p>

                        <p className="mt-1">
                          por{" "}
                          <strong className="text-zinc-700">
                            {item.createdBy
                              ?.name ??
                              "Usuário não informado"}
                          </strong>
                        </p>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
}
        </section>
      </div>

      {editOpen ? (
  <div
    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
    onMouseDown={(event) => {
      if (
        event.target ===
          event.currentTarget &&
        !savingEdit
      ) {
        closeEditModal();
      }
    }}
  >
    <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-bold text-zinc-900">
            Editar dados da máquina
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Altere somente os dados cadastrais. A composição da máquina não será modificada.
          </p>
        </div>

        <button
          type="button"
          onClick={closeEditModal}
          disabled={savingEdit}
          aria-label="Fechar edição"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
        >
          <X size={19} />
        </button>
      </header>

      <form
        onSubmit={
          handleEditMachine
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {editError ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <span>
                {editError}
              </span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Nome da máquina{" "}
                <span className="text-red-500">
                  *
                </span>
              </span>

              <input
                type="text"
                value={editForm.name}
                onChange={(event) =>
                  updateEditForm(
                    "name",
                    event.target.value,
                  )
                }
                required
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Categoria
              </span>

              <input
                type="text"
                value={
                  editForm.category
                }
                onChange={(event) =>
                  updateEditForm(
                    "category",
                    event.target.value,
                  )
                }
                placeholder="Ex.: Servidor"
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Fabricante
              </span>

              <input
                type="text"
                value={
                  editForm.manufacturer
                }
                onChange={(event) =>
                  updateEditForm(
                    "manufacturer",
                    event.target.value,
                  )
                }
                placeholder="Ex.: Fortinet"
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Modelo
              </span>

              <input
                type="text"
                value={editForm.model}
                onChange={(event) =>
                  updateEditForm(
                    "model",
                    event.target.value,
                  )
                }
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Patrimônio
              </span>

              <input
                type="text"
                value={
                  editForm.assetTag
                }
                onChange={(event) =>
                  updateEditForm(
                    "assetTag",
                    event.target.value
                      .toUpperCase(),
                  )
                }
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Nota fiscal
              </span>

              <input
                type="text"
                value={
                  editForm.invoiceNumber
                }
                onChange={(event) =>
                  updateEditForm(
                    "invoiceNumber",
                    event.target.value,
                  )
                }
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Data de recebimento{" "}
                <span className="text-red-500">
                  *
                </span>
              </span>

              <input
                type="date"
                value={
                  editForm.receivedAt
                }
                onChange={(event) =>
                  updateEditForm(
                    "receivedAt",
                    event.target.value,
                  )
                }
                required
                className={fieldClassName}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Observações
              </span>

              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  updateEditForm(
                    "notes",
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Informações adicionais sobre a máquina"
                className={`${fieldClassName} h-auto resize-y py-2.5`}
              />
            </label>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
            A edição altera somente os dados cadastrais da máquina. Componentes instalados e histórico de movimentações não serão alterados.
          </div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={closeEditModal}
            disabled={savingEdit}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={savingEdit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingEdit ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />

                Salvando...
              </>
            ) : (
              <>
                <Pencil size={16} />

                Salvar alterações
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  </div>
) : null}

{deleteOpen ? (
  <div
    className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
    onMouseDown={(event) => {
      if (
        event.target ===
          event.currentTarget &&
        !deleting
      ) {
        closeDeleteModal();
      }
    }}
  >
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 size={19} />
          </div>

          <div>
            <h2 className="font-bold text-zinc-900">
              Excluir máquina
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Esta ação não poderá ser desfeita.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={closeDeleteModal}
          disabled={deleting}
          aria-label="Fechar exclusão"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </header>

      <div className="space-y-4 p-5">
        {deleteError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />

            <span>
              {deleteError}
            </span>
          </div>
        ) : null}

        <p className="text-sm leading-6 text-zinc-600">
          Tem certeza que deseja excluir esta máquina?
        </p>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="font-semibold text-zinc-900">
            {machine.name}
          </p>

          <div className="mt-2 space-y-1 text-xs text-zinc-500">
            <p>
              Número de série:{" "}
              <strong className="font-mono text-zinc-700">
                {machine.serialNumber}
              </strong>
            </p>

            {machine.assetTag ? (
              <p>
                Patrimônio:{" "}
                <strong className="text-zinc-700">
                  {machine.assetTag}
                </strong>
              </p>
            ) : null}

            <p>
              Componentes atualmente instalados:{" "}
              <strong className="text-zinc-700">
                {
                  machine.totalCurrentComponents
                }
              </strong>
            </p>
          </div>
        </div>

        {machine.history.length > 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
            />

            <span>
              Esta máquina possui histórico de movimentações.
              Por segurança e rastreabilidade, o servidor poderá
              impedir a exclusão.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
            />

            <span>
              O cadastro da máquina e seus componentes associados
              serão removidos.
            </span>
          </div>
        )}
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={closeDeleteModal}
          disabled={deleting}
          className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => {
            void handleDeleteMachine();
          }}
          disabled={deleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? (
            <>
              <Loader2
                size={16}
                className="animate-spin"
              />

              Excluindo...
            </>
          ) : (
            <>
              <Trash2 size={16} />
              Excluir máquina
            </>
          )}
        </button>
      </footer>
    </div>
  </div>
) : null}

      {removalComponent ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !removing
            ) {
              closeRemovalModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-zinc-900">
  Remover componente da máquina
</h2>

<p className="mt-1 text-sm text-zinc-500">
  Informe o motivo e descreva o que será feito com este componente.
</p>
              </div>

              <button
                type="button"
                onClick={
                  closeRemovalModal
                }
                disabled={
                  removing
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              >
                <X size={18} />
              </button>
            </header>

            <form
              onSubmit={
                handleRemoveComponent
              }
            >
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="font-semibold text-zinc-900">
                    {
                      removalComponent.name
                    }
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {
                      removalComponent.category
                    }{" "}
                    · SN{" "}
                    <strong>
                      {
                        removalComponent.serialNumber
                      }
                    </strong>
                  </p>
                </div>

                {removalError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0"
                    />

                    {
                      removalError
                    }
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                    Motivo{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </span>

                  <select
                    value={
                      removalReason
                    }
                    onChange={(
                      event,
                    ) =>
                      setRemovalReason(
                        event.target
                          .value as RemovalReason,
                      )
                    }
                    className={
                      fieldClassName
                    }
                  >
                    {Object.entries(
                      removalReasonLabels,
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                    Justificativa{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </span>

                  <textarea
                    value={
                      removalNotes
                    }
                    onChange={(
                      event,
                    ) =>
                      setRemovalNotes(
                        event.target
                          .value,
                      )
                    }
                    rows={4}
                    required
                    placeholder="Ex.: componente apresentou falha no cliente e será substituído por outra peça."
                    className={`${fieldClassName} h-auto resize-y py-2.5`}
                  />
                </label>

                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
  <AlertTriangle
    size={15}
    className="mt-0.5 shrink-0"
  />

  Ao confirmar, o componente deixará de fazer parte desta máquina. A remoção ficará registrada com motivo, justificativa, usuário e data.
</div>
              </div>

              <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
                <button
                  type="button"
                  onClick={
                    closeRemovalModal
                  }
                  disabled={
                    removing
                  }
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    removing
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {removing ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />

                      Removendo...
                    </>
                  ) : (
                    <>
                      <Trash2
                        size={16}
                      />

                      Remover componente
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-zinc-400">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-zinc-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-zinc-700">
          {value}
        </p>
      </div>
    </div>
  );
}