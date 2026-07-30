"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ProjectEquipmentModal } from "@/components/projects/ProjectEquipmentModal";
import { ProjectPrintView } from "@/components/projects/ProjectPrintView";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  Package,
  Pencil,
  Printer,
  Save,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

type UserRole =
  | "ADMIN"
  | "COMMERCIAL"
  | "VIEWER";

type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type ProjectPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

type ProjectUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
};

type ProjectClient = {
  id: string;
  clientCode: string | null;
  shortName: string | null;
  name: string;
  contactName: string;
  active: boolean;
};

type ClientOption = {
  id: string;
  clientCode: string | null;
  shortName: string | null;
  name: string;
  contactName: string;
  active: boolean;
};

type ClientsResponse = {
  success: boolean;
  data?: ClientOption[];
  message?: string;
  error?: string;
};

type ProjectEquipment = {
  id: string;
  quantity: number;
  notes: string | null;

  needed: number;
  physicalStock: number;
  totalActiveNeeded: number;
  neededByOtherProjects: number;
  availableForProject: number;
  assignedFromStock: number;
  availableAfterProject: number;
  shortage: number;
  hasShortage: boolean;
  isOutOfStock: boolean;
  isBelowMinimum: boolean;

  equipment: {
    id: string;
    name: string;
    category: string;
    manufacturer: string | null;
    model: string | null;
    quantity: number;
  };
};

type Project = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  client: ProjectClient | null;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;

  createdById: string | null;
  salespersonId: string | null;
  responsibleId: string | null;

  createdBy: ProjectUser | null;
  salesperson: ProjectUser | null;
  responsible: ProjectUser | null;

  equipment: ProjectEquipment[];

  neededUnits: number;
  availableUnits: number;
  shortageUnits: number;
  equipmentWithShortage: number;
  hasShortage: boolean;

  createdAt: string;
  updatedAt: string;
};

type ProjectResponse = {
  success: boolean;
  data?: Project;
  message?: string;
};

type DeleteProjectResponse = {
  success: boolean;
  message?: string;
};

type UsersResponse = {
  success: boolean;
  users?: ProjectUser[];
  message?: string;
};

type ProjectForm = {
  name: string;
  clientId: string;
  clientName: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  dueDate: string;
  completedAt: string;
  salespersonId: string;
  responsibleId: string;
};

type SessionUser = {
  id?: string;
  role?: UserRole;
};

const emptyProjectForm: ProjectForm = {
  name: "",
  clientId: "",
  clientName: "",
  description: "",
  status: "PLANNING",
  priority: "NORMAL",
  startDate: "",
  dueDate: "",
  completedAt: "",
  salespersonId: "",
  responsibleId: "",
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

const priorityLabels: Record<
  ProjectPriority,
  string
> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const inputClassName =
  "h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

function formatDate(value: string | null) {
  if (!value) {
    return "Não definida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function projectToForm(
  project: Project,
): ProjectForm {
  return {
    name: project.name,

    clientId:
      project.clientId ??
      project.client?.id ??
      "",

    clientName:
      project.client?.name ??
      project.clientName ??
      "",

    description:
      project.description ?? "",

    status: project.status,
    priority: project.priority,

    startDate: formatDateInput(
      project.startDate,
    ),

    dueDate: formatDateInput(
      project.dueDate,
    ),

    completedAt: formatDateInput(
      project.completedAt,
    ),

    salespersonId:
      project.salespersonId ?? "",

    responsibleId:
      project.responsibleId ?? "",
  };
}

function validateProjectForm(
  form: ProjectForm,
) {
  if (!form.name.trim()) {
    return "Informe o nome do projeto.";
  }

  if (
    form.startDate &&
    form.dueDate &&
    form.dueDate < form.startDate
  ) {
    return "A data prevista não pode ser anterior à data de início.";
  }

  if (
    form.startDate &&
    form.completedAt &&
    form.completedAt < form.startDate
  ) {
    return "A data de conclusão não pode ser anterior à data de início.";
  }

  return "";
}

export function ProjectDetailsView({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const sessionUser =
    session?.user as SessionUser | undefined;

  const canEdit =
    sessionUser?.role === "ADMIN" ||
    sessionUser?.role === "COMMERCIAL";

  const canDelete =
    sessionUser?.role === "ADMIN" ||
    sessionUser?.role === "COMMERCIAL";

  const [project, setProject] =
    useState<Project | null>(null);

  const [users, setUsers] = useState<
    ProjectUser[]
  >([]);

  const [clients, setClients] =
  useState<ClientOption[]>([]);

const [
  loadingClients,
  setLoadingClients,
] = useState(false);

  const [form, setForm] =
    useState<ProjectForm>(emptyProjectForm);

  const [loading, setLoading] =
    useState(true);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [
  showEquipmentModal,
  setShowEquipmentModal,
] = useState(false);

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [error, setError] = useState("");

  const [modalError, setModalError] =
    useState("");

  const [deleteError, setDeleteError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadProject = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/projects/${projectId}`,
          {
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as ProjectResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.data
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar o projeto.",
          );
        }

        setProject(data.data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o projeto.",
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const loadUsers = useCallback(
    async () => {
      try {
        setLoadingUsers(true);
        setModalError("");

        const response = await fetch(
          "/api/users/options",
          {
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as UsersResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.users
        ) {
          throw new Error(
            data.message ??
              "Não foi possível carregar os usuários.",
          );
        }

        setUsers(
          data.users.filter(
            (user) => user.active,
          ),
        );
      } catch (loadError) {
        setModalError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os usuários.",
        );
      } finally {
        setLoadingUsers(false);
      }
    },
    [],
  );

  const loadClients =
  useCallback(async () => {
    try {
      setLoadingClients(true);
      setModalError("");

      const response = await fetch(
        "/api/clients",
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
        (await response.json()) as ClientsResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            data.error ??
            "Não foi possível carregar os clientes.",
        );
      }

      setClients(
        Array.isArray(data.data)
          ? data.data
          : [],
      );
    } catch (loadError) {
      setClients([]);

      setModalError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os clientes.",
      );
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (
      !showEditModal &&
      !showDeleteModal
    ) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key !== "Escape") {
        return;
      }

      if (
        showEditModal &&
        !saving
      ) {
        setShowEditModal(false);
        setModalError("");
      }

      if (
        showDeleteModal &&
        !deleting
      ) {
        setShowDeleteModal(false);
        setDeleteError("");
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow = "";
    };
  }, [
    showEditModal,
    showDeleteModal,
    saving,
    deleting,
  ]);

  async function openEditModal() {
  if (!project || !canEdit) {
    return;
  }

  setForm(projectToForm(project));
  setModalError("");
  setSuccessMessage("");
  setShowEditModal(true);

  const requests: Promise<void>[] = [];

  if (users.length === 0) {
    requests.push(loadUsers());
  }

  if (clients.length === 0) {
    requests.push(loadClients());
  }

  if (requests.length > 0) {
    await Promise.all(requests);
  }
}

  function closeEditModal() {
    if (saving) {
      return;
    }

    setShowEditModal(false);
    setModalError("");
  }

  function openDeleteModal() {
    if (!project || !canDelete) {
      return;
    }

    setDeleteError("");
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setShowDeleteModal(false);
    setDeleteError("");
  }

  function handleInputChange(
    event: ChangeEvent<
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function openEquipmentModal() {
  if (!canEdit) {
    return;
  }

  setSuccessMessage("");
  setShowEquipmentModal(true);
}

function closeEquipmentModal() {
  setShowEquipmentModal(false);
}

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!project || !canEdit) {
      return;
    }

    const validationError =
      validateProjectForm(form);

    if (validationError) {
      setModalError(validationError);
      return;
    }

    try {
      setSaving(true);
      setModalError("");
      setSuccessMessage("");

      const response = await fetch(
        `/api/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            clientId:
  form.clientId || null,

clientName:
  form.clientName.trim() ||
  null,
            description:
              form.description.trim() ||
              null,
            status: form.status,
            priority: form.priority,
            startDate:
              form.startDate || null,
            dueDate:
              form.dueDate || null,
            completedAt:
              form.status === "COMPLETED"
                ? form.completedAt || null
                : null,
            salespersonId:
              form.salespersonId || null,
            responsibleId:
              form.responsibleId || null,
          }),
        },
      );

      const data =
        (await response.json()) as ProjectResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.data
      ) {
        throw new Error(
          data.message ??
            "Não foi possível atualizar o projeto.",
        );
      }

      setProject(data.data);
      setShowEditModal(false);

      setSuccessMessage(
        data.message ??
          "Projeto atualizado com sucesso.",
      );

      window.setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (submitError) {
      setModalError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível atualizar o projeto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (!project || !canDelete) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const response = await fetch(
        `/api/projects/${project.id}`,
        {
          method: "DELETE",
        },
      );

      const data =
        (await response.json()) as DeleteProjectResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Não foi possível excluir o projeto.",
        );
      }

      setShowDeleteModal(false);

      router.replace("/projects");
      router.refresh();
    } catch (deleteProjectError) {
      setDeleteError(
        deleteProjectError instanceof Error
          ? deleteProjectError.message
          : "Não foi possível excluir o projeto.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-500">
        <Loader2
          size={18}
          className="mr-2 animate-spin"
        />

        Carregando projeto...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="font-semibold text-red-700">
          {error ||
            "Projeto não encontrado."}
        </p>

        <Link
          href="/projects"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline"
        >
          <ArrowLeft size={16} />
          Voltar para projetos
        </Link>
      </div>
    );
  }

  const reservedUnits =
    project.equipment.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

  const salespeople = users.filter(
    (user) =>
      user.role === "ADMIN" ||
      user.role === "COMMERCIAL",
  );

return (
  <>
    <ProjectPrintView project={project} />

    <div className="print:hidden">
      <div className="space-y-5">
        {successMessage ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
          >
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/projects"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-[#F57B00]"
            >
              <ArrowLeft size={16} />
              Voltar para projetos
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={project.status}
              />

              <PriorityBadge
                priority={
                  project.priority
                }
              />
            </div>

            <h1 className="mt-3 text-2xl font-bold text-zinc-900">
              {project.name}
            </h1>

            <div className="mt-1">
  {project.client ? (
    <>
      <p className="text-sm text-zinc-600">
        <span className="font-mono font-semibold text-[#F57B00]">
          {project.client.clientCode ??
            "SEM-CÓDIGO"}
        </span>

        <span className="mx-1.5 text-zinc-300">
          •
        </span>

        <span className="font-medium">
          {project.client.name}
        </span>
      </p>

      <p className="mt-1 text-xs text-zinc-400">
        Contato:{" "}
        {project.client.contactName}
      </p>
    </>
  ) : (
    <p className="text-sm text-zinc-500">
      {project.clientName ||
        "Cliente não informado"}
    </p>
  )}
</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
             <button
    type="button"
    onClick={() => window.print()}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
  >
    <Printer size={16} />
    Imprimir / PDF
  </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  void openEditModal();
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
              >
                
                <Pencil size={16} />
                Editar projeto
              </button>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                onClick={
                  openDeleteModal
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={16} />
                Excluir projeto
              </button>
            ) : null}
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Vendedor"
            value={
              project.salesperson?.name ??
              "Sem vendedor"
            }
            icon={
              <UserRound size={19} />
            }
          />

          <InfoCard
            label="Responsável"
            value={
              project.responsible?.name ??
              "Sem responsável"
            }
            icon={
              <UserRound size={19} />
            }
          />

          <InfoCard
            label="Prazo"
            value={formatDate(
              project.dueDate,
            )}
            icon={
              <CalendarDays
                size={19}
              />
            }
          />

          <InfoCard
            label="Equipamentos"
            value={`${project.equipment.length} item(ns) · ${reservedUnits} unidade(s)`}
            icon={
              <Package size={19} />
            }
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-zinc-900">
                  Equipamentos
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Equipamentos reservados para
                  este projeto.
                </p>
              </div>

              {canEdit ? (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <button
      type="button"
      onClick={openEquipmentModal}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-3 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
    >
      <Package size={16} />
      Adicionar
    </button>

    <Link
      href="/inventory/new"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-[#F57B00]"
    >
      <Wrench size={16} />
      Novo equipamento
    </Link>
  </div>
) : null}
            </header>

            {project.equipment.length ===
            0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
                  <Package size={25} />
                </div>

                <h3 className="mt-4 font-bold text-zinc-900">
                  Nenhum equipamento
                  vinculado
                </h3>

                <p className="mt-1 max-w-sm text-sm text-zinc-500">
                  Adicione equipamentos do
                  inventário para reservar as
                  unidades necessárias.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {project.equipment.map(
                  (item) => (
<div
  key={item.id}
  className={[
    "flex flex-col gap-3 bg-white px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
    item.hasShortage
      ? "border-l-4 border-red-500"
      : "border-l-4 border-transparent",
  ].join(" ")}
>
                      <div>
                        <p className="font-semibold text-zinc-900">
                          {
                            item.equipment
                              .name
                          }
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                          {
                            item.equipment
                              .category
                          }

                          {item.equipment
                            .manufacturer
                            ? ` · ${item.equipment.manufacturer}`
                            : ""}

                          {item.equipment
                            .model
                            ? ` ${item.equipment.model}`
                            : ""}
                        </p>
                        
                        {item.hasShortage ? (
  <div className="mt-3">
    <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
      <AlertTriangle
        size={16}
        aria-hidden="true"
      />

      {item.shortage === 1
        ? "Falta 1 unidade"
        : `Faltam ${item.shortage} unidades`}
    </div>

    <p className="mt-1 text-xs text-zinc-500">
      Disponível:{" "}
      <strong className="text-zinc-700">
        {item.availableForProject}
      </strong>

      <span className="mx-1.5 text-zinc-300">
        •
      </span>

      Necessário:{" "}
      <strong className="text-zinc-700">
        {item.needed}
      </strong>
    </p>
  </div>
) : null}
                        {item.notes ? (
                          <p className="mt-2 text-sm text-zinc-500">
                            {item.notes}
                          </p>
                        ) : null}
                      </div>

<div className="flex items-center gap-2">
<div
  className={[
    "rounded-lg px-3 py-2 text-sm font-semibold",
    item.hasShortage
      ? "bg-red-100 text-red-700"
      : "bg-zinc-100 text-zinc-700",
  ].join(" ")}
>
  {item.quantity}{" "}
  {item.quantity === 1
    ? "unidade"
    : "unidades"}
</div>

  {canEdit ? (
    <button
      type="button"
      onClick={openEquipmentModal}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]"
    >
      <Pencil size={15} />
      Gerenciar
    </button>
  ) : null}
</div>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-zinc-900">
                Dados gerais
              </h2>

              <dl className="mt-4 space-y-4">
                <DetailItem
                  label="Status"
                  value={
                    statusLabels[
                      project.status
                    ]
                  }
                />

                <DetailItem
                  label="Prioridade"
                  value={
                    priorityLabels[
                      project.priority
                    ]
                  }
                />

                <DetailItem
                  label="Criado por"
                  value={
                    project.createdBy
                      ?.name ??
                    "Não informado"
                  }
                />

                <DetailItem
                  label="Vendedor"
                  value={
                    project.salesperson
                      ?.name ??
                    "Não informado"
                  }
                />

                <DetailItem
                  label="Responsável"
                  value={
                    project.responsible
                      ?.name ??
                    "Não informado"
                  }
                />

                <DetailItem
                  label="Data de início"
                  value={formatDate(
                    project.startDate,
                  )}
                />

                <DetailItem
                  label="Data prevista"
                  value={formatDate(
                    project.dueDate,
                  )}
                />

             <DetailItem
  label="Conclusão do projeto"
  value={
    project.status === "COMPLETED"
      ? `Concluído em ${formatDate(
          project.completedAt,
        )}`
      : "Ainda não concluído"
  }
/>

                <DetailItem
                  label="Criado em"
                  value={formatDate(
                    project.createdAt,
                  )}
                />

                <DetailItem
                  label="Atualizado em"
                  value={formatDate(
                    project.updatedAt,
                  )}
                />
              </dl>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-zinc-900">
                Descrição
              </h2>

              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
                {project.description ||
                  "Nenhuma descrição informada."}
              </p>
            </section>

          </aside>
        </div>
      </div>

      {showEditModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeEditModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="edit-project-title"
                  className="text-lg font-bold text-zinc-900"
                >
                  Editar projeto
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Atualize os dados do
                  projeto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={saving}
                aria-label="Fechar modal"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </header>

            <form
              onSubmit={handleSubmit}
              className="flex max-h-[calc(100vh-8rem)] flex-col"
            >
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {modalError ? (
                  <div
                    role="alert"
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {modalError}
                  </div>
                ) : null}

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    label="Nome do projeto"
                    htmlFor="name"
                    required
                  >
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoFocus
                      maxLength={150}
                      value={form.name}
                      onChange={
                        handleInputChange
                      }
                      disabled={saving}
                      className={
                        inputClassName
                      }
                      placeholder="Nome do projeto"
                    />
                  </FormField>

                  <FormField
  label="Cliente"
  htmlFor="clientId"
>
  <select
    id="clientId"
    name="clientId"
    value={form.clientId}
    onChange={(event) => {
      const selectedClientId =
        event.target.value;

      const selectedClient =
        clients.find(
          (client) =>
            client.id ===
            selectedClientId,
        );

      setForm((currentForm) => ({
        ...currentForm,

        clientId:
          selectedClientId,

        clientName:
          selectedClient?.name ??
          "",
      }));
    }}
    disabled={
  saving ||
  loadingUsers ||
  loadingClients
}
    className={inputClassName}
  >
    <option value="">
      {loadingClients
        ? "Carregando clientes..."
        : "Sem cliente selecionado"}
    </option>

    {clients.map((client) => {
      const isCurrentClient =
        client.id ===
        project.clientId;

      return (
        <option
          key={client.id}
          value={client.id}
          disabled={
            !client.active &&
            !isCurrentClient
          }
        >
          {client.clientCode ??
            "SEM-CÓDIGO"}
          {" • "}
          {client.shortName ??
            client.name}
          {!client.active
            ? " — Inativo"
            : ""}
        </option>
      );
    })}
  </select>

  {loadingClients ? (
    <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
      <Loader2
        size={13}
        className="animate-spin"
      />

      Carregando clientes...
    </p>
  ) : null}

  {!loadingClients &&
  clients.length === 0 ? (
    <p className="mt-2 text-xs text-amber-700">
      Nenhum cliente cadastrado foi
      encontrado.
    </p>
  ) : null}
</FormField>

                  <FormField
                    label="Vendedor"
                    htmlFor="salespersonId"
                  >
                    <select
                      id="salespersonId"
                      name="salespersonId"
                      value={
                        form.salespersonId
                      }
                      onChange={
                        handleInputChange
                      }
                      disabled={
                        saving ||
                        loadingUsers
                      }
                      className={
                        inputClassName
                      }
                    >
                      <option value="">
                        Sem vendedor
                      </option>

                      {salespeople.map(
                        (user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.name}
                          </option>
                        ),
                      )}
                    </select>

                    {loadingUsers ? (
                      <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2
                          size={13}
                          className="animate-spin"
                        />

                        Carregando
                        usuários...
                      </p>
                    ) : null}
                  </FormField>

                  <FormField
                    label="Responsável"
                    htmlFor="responsibleId"
                  >
                    <select
                      id="responsibleId"
                      name="responsibleId"
                      value={
                        form.responsibleId
                      }
                      onChange={
                        handleInputChange
                      }
                      disabled={
                        saving ||
                        loadingUsers
                      }
                      className={
                        inputClassName
                      }
                    >
                      <option value="">
                        Sem responsável
                      </option>

                      {users.map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Status"
                    htmlFor="status"
                    required
                  >
                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={
                        handleInputChange
                      }
                      disabled={saving}
                      className={
                        inputClassName
                      }
                    >
                      {(
                        Object.entries(
                          statusLabels,
                        ) as Array<
                          [
                            ProjectStatus,
                            string,
                          ]
                        >
                      ).map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Prioridade"
                    htmlFor="priority"
                    required
                  >
                    <select
                      id="priority"
                      name="priority"
                      value={
                        form.priority
                      }
                      onChange={
                        handleInputChange
                      }
                      disabled={saving}
                      className={
                        inputClassName
                      }
                    >
                      {(
                        Object.entries(
                          priorityLabels,
                        ) as Array<
                          [
                            ProjectPriority,
                            string,
                          ]
                        >
                      ).map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Data de início"
                    htmlFor="startDate"
                  >
                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={
                        form.startDate
                      }
                      onChange={
                        handleInputChange
                      }
                      disabled={saving}
                      className={
                        inputClassName
                      }
                    />
                  </FormField>

                  <FormField
                    label="Data prevista"
                    htmlFor="dueDate"
                  >
                    <input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      min={
                        form.startDate ||
                        undefined
                      }
                      value={form.dueDate}
                      onChange={
                        handleInputChange
                      }
                      disabled={saving}
                      className={
                        inputClassName
                      }
                    />
                  </FormField>

                  {form.status ===
                  "COMPLETED" ? (
                    <FormField
                      label="Data de conclusão"
                      htmlFor="completedAt"
                    >
                      <input
                        id="completedAt"
                        name="completedAt"
                        type="date"
                        min={
                          form.startDate ||
                          undefined
                        }
                        value={
                          form.completedAt
                        }
                        onChange={
                          handleInputChange
                        }
                        disabled={saving}
                        className={
                          inputClassName
                        }
                      />
                    </FormField>
                  ) : null}

                  <div className="md:col-span-2">
                    <FormField
                      label="Descrição"
                      htmlFor="description"
                    >
                      <textarea
                        id="description"
                        name="description"
                        rows={4}
                        maxLength={3000}
                        value={
                          form.description
                        }
                        onChange={
                          handleInputChange
                        }
                        disabled={saving}
                        className={`${inputClassName} min-h-28 resize-y py-3`}
                        placeholder="Descrição do projeto"
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingUsers
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-5 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />

                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar alterações
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            aria-describedby="delete-project-description"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <AlertTriangle
                    size={22}
                  />
                </div>

                <div>
                  <h2
                    id="delete-project-title"
                    className="font-bold text-zinc-900"
                  >
                    Excluir projeto
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Esta ação não poderá
                    ser desfeita.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeDeleteModal
                }
                disabled={deleting}
                aria-label="Fechar confirmação"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </header>

            <div className="px-5 py-5">
              <p
                id="delete-project-description"
                className="text-sm leading-6 text-zinc-600"
              >
                Você está prestes a excluir o
                projeto{" "}
                <strong className="text-zinc-900">
                  {project.name}
                </strong>
                .
              </p>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Os dados vinculados ao projeto
                serão removidos conforme as
                regras configuradas no banco de
                dados.
              </p>

              {project.equipment.length >
              0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Este projeto possui{" "}
                  <strong>
                    {
                      project.equipment
                        .length
                    }{" "}
                    equipamento(s)
                  </strong>{" "}
                  vinculado(s).
                </div>
              ) : null}

              {deleteError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {deleteError}
                </div>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  closeDeleteModal
                }
                disabled={deleting}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleDeleteProject();
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
                    Confirmar exclusão
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
           <ProjectEquipmentModal
        open={showEquipmentModal}
        projectId={project.id}
        onClose={closeEquipmentModal}
        onUpdated={loadProject}
      />
    </div>
  </>
);
}

function FormField({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-semibold text-zinc-700"
      >
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </label>

      {children}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <article className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-bold text-zinc-900">
          {value}
        </p>
      </div>
    </article>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-semibold text-zinc-700">
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ProjectStatus;
}) {
  const colors: Record<
    ProjectStatus,
    string
  > = {
    PLANNING:
      "border-orange-100 bg-orange-50 text-orange-700",
    IN_PROGRESS:
      "border-blue-100 bg-blue-50 text-blue-700",
    COMPLETED:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
    CANCELLED:
      "border-zinc-200 bg-zinc-100 text-zinc-600",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: ProjectPriority;
}) {
  const colors: Record<
    ProjectPriority,
    string
  > = {
    LOW: "bg-zinc-100 text-zinc-600",
    NORMAL:
      "bg-blue-50 text-blue-600",
    HIGH:
      "bg-amber-50 text-amber-700",
    URGENT: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}