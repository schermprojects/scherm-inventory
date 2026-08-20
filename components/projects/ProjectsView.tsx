"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/stockAlert";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
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

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

type ProjectUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
};

type ClientOption = {
  id: string;
  clientCode: string;
  shortName: string | null;
  name: string;
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

type ProjectItem = {
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
  responsibleId: string | null;
  salespersonId: string | null;

  createdBy: ProjectUser | null;
  responsible: ProjectUser | null;
  salesperson: ProjectUser | null;

  equipmentItems: number;

  neededUnits?: number;

  /*
   * Mantido pela API para compatibilidade.
   */
  reservedUnits: number;

  availableUnits?: number;
  shortageUnits?: number;
  equipmentWithShortage?: number;
  outOfStockItems?: number;
  hasShortage?: boolean;

  createdAt: string;
  updatedAt: string;
};

type ProjectSummary = {
  total: number;
  planning: number;
  inProgress: number;
  completed: number;
  cancelled: number;

  totalNeededUnits?: number;
  totalShortageUnits?: number;
  projectsWithShortage?: number;
};

type EquipmentOption = {
  id: string;
  name: string;

  category?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;

  quantity: number;
  minimumStock?: number;

  status?: string;
  condition?: string;
  notes?: string | null;

  physicalStock?: number;
  inUse?: number;
  availableStock?: number;
  shortage?: number;
};

type ProjectEquipmentFormItem = {
  rowId: string;
  equipmentId: string;
  quantity: string;
  notes: string;
};

type ProjectsResponse = {
  success: boolean;
  data: ProjectItem[];
  total: number;
  summary: ProjectSummary;
  message?: string;
  error?: string;
};

type UsersOptionsResponse = {
  success: boolean;
  users: ProjectUser[];
  message?: string;
  error?: string;
};

type EquipmentResponse = {
  success: boolean;
  data?: EquipmentOption[];
  equipment?: EquipmentOption[];
  message?: string;
  error?: string;
};

type CreateEquipmentResponse = {
  success?: boolean;
  data?: EquipmentOption;
  message?: string;
  error?: string;
};

type CreateProjectResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

type ManufacturersResponse = {
  success: boolean;
  data?: string[];
  message?: string;
  error?: string;
};

type ProjectFormState = {
  name: string;
  clientId: string;
  clientName: string;
  description: string;
  salespersonId: string;
  responsibleId: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  dueDate: string;
  equipment: ProjectEquipmentFormItem[];
};

type NewEquipmentFormState = {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  requestedQuantity: string;
  notes: string;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const MAX_EQUIPMENT_QUANTITY = 999999;

const EQUIPMENT_CATEGORIES = [
  "Processador",
  "Placa-mãe",
  "Memória RAM",
  "Armazenamento (SSD/HD)",
  "Placa de vídeo",
  "Fonte",
  "Gabinete",
  "Cooler/Refrigeração",
  "Monitor",
  "Teclado",
  "Mouse",
  "Controladora RAID",
  "Controladora SAS",
  "Switch de rede",
  "Cabo de energia",
  "Cabo de rede Ethernet",
  "Cabo de rede Infiniband",
  "Periférico",
  "Rede",
  "Outro",
];

const DEFAULT_MANUFACTURERS = [
  "AMD",
  "AOC",
  "APC",
  "Arista",
  "Aruba",
  "ASRock Rack",
  "ASUS",
  "Belden",
  "Broadcom",
  "Cisco",
  "Cooler Master",
  "Corsair",
  "Crucial",
  "Dell",
  "Dell EMC",
  "Eaton",
  "Fortinet",
  "Furukawa",
  "Gigabyte",
  "HPE",
  "Huawei",
  "Intel",
  "Intelbras",
  "Juniper",
  "Kingston",
  "Legrand",
  "Lenovo",
  "LG",
  "Logitech",
  "Micron",
  "Microsoft",
  "MikroTik",
  "NetApp",
  "Nexans",
  "NVIDIA",
  "Noctua",
  "Palo Alto Networks",
  "Panduit",
  "Pure Storage",
  "QNAP",
  "Samsung",
  "Schneider Electric",
  "Seagate",
  "Seasonic",
  "Sophos",
  "Supermicro",
  "Synology",
  "Toshiba",
  "Ubiquiti",
  "Vertiv",
  "Western Digital",
];

const initialSummary: ProjectSummary = {
  total: 0,
  planning: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  totalNeededUnits: 0,
  totalShortageUnits: 0,
  projectsWithShortage: 0,
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
  "h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100";

const fieldClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

function createRowId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function createEquipmentRow(
  equipmentId = "",
): ProjectEquipmentFormItem {
  return {
    rowId: createRowId(),
    equipmentId,
    quantity: "1",
    notes: "",
  };
}

function createInitialFormState(): ProjectFormState {
  return {
    name: "",
    clientId: "",
    clientName: "",
    description: "",
    salespersonId: "",
    responsibleId: "",
    status: "PLANNING",
    priority: "NORMAL",
    startDate: "",
    dueDate: "",
    equipment: [],
  };
}

function createInitialEquipmentFormState(): NewEquipmentFormState {
  return {
    name: "",
    category: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    requestedQuantity: "1",
    notes: "",
  };
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Não definida";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function getApiMessage(data: {
  message?: string;
  error?: string;
}): string | undefined {
  return data.message ?? data.error;
}

function getPhysicalStock(
  equipment: EquipmentOption,
): number {
  const value =
    equipment.physicalStock ??
    equipment.quantity;

  return Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function getProjectNeededUnits(
  project: ProjectItem,
): number {
  return (
    project.neededUnits ??
    project.reservedUnits ??
    0
  );
}

function getProjectShortageUnits(
  project: ProjectItem,
): number {
  return project.shortageUnits ?? 0;
}

function sortEquipmentOptions(
  options: EquipmentOption[],
): EquipmentOption[] {
  return [...options].sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        "pt-BR",
        {
          sensitivity: "base",
        },
      ),
  );
}

function mergeManufacturerOptions(
  manufacturers: string[],
): string[] {
  const map = new Map<string, string>();

  for (const manufacturer of [
    ...DEFAULT_MANUFACTURERS,
    ...manufacturers,
  ]) {
    const trimmed =
      manufacturer.trim();

    if (!trimmed) {
      continue;
    }

    const key = trimmed
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLocaleLowerCase("pt-BR");

    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  }

  return Array.from(
    map.values(),
  ).sort(
    (first, second) =>
      first.localeCompare(
        second,
        "pt-BR",
        {
          sensitivity: "base",
        },
      ),
  );
}

export function ProjectsView() {
  const { data: session } =
    useSession();

  const sessionUser =
    session?.user as
      | {
          role?: UserRole;
        }
      | undefined;

const canManageProjects =
  sessionUser?.role === "ADMIN" ||
  sessionUser?.role === "BACKOFFICE" ||
  sessionUser?.role === "COMMERCIAL";

  const [projects, setProjects] =
    useState<ProjectItem[]>([]);

  const [
    expandedProjectIds,
    setExpandedProjectIds,
  ] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const [users, setUsers] =
    useState<ProjectUser[]>([]);

  const [clients, setClients] =
    useState<ClientOption[]>([]);

  const [
    loadingClients,
    setLoadingClients,
  ] = useState(true);

  const [
    equipmentOptions,
    setEquipmentOptions,
  ] = useState<
    EquipmentOption[]
  >([]);

  const [
    manufacturerOptions,
    setManufacturerOptions,
  ] = useState<string[]>(
    () => [
      ...DEFAULT_MANUFACTURERS,
    ],
  );

  const [summary, setSummary] =
    useState(initialSummary);

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    "" | ProjectStatus
  >("");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState<
    "" | ProjectPriority
  >("");

  const [loading, setLoading] =
    useState(true);

  const [
    loadingUsers,
    setLoadingUsers,
  ] = useState(true);

  const [
    loadingEquipment,
    setLoadingEquipment,
  ] = useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    savingEquipment,
    setSavingEquipment,
  ] = useState(false);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    equipmentModalOpen,
    setEquipmentModalOpen,
  ] = useState(false);

  const [
    equipmentPickerOpen,
    setEquipmentPickerOpen,
  ] = useState(false);

  const [
    equipmentPickerSearch,
    setEquipmentPickerSearch,
  ] = useState("");

  const [
    equipmentPickerQuantities,
    setEquipmentPickerQuantities,
  ] = useState<
    Record<string, number>
  >({});

  const [form, setForm] =
    useState<ProjectFormState>(
      createInitialFormState,
    );

  const [
    newEquipmentForm,
    setNewEquipmentForm,
  ] =
    useState<NewEquipmentFormState>(
      createInitialEquipmentFormState,
    );

  const [
    newEquipmentError,
    setNewEquipmentError,
  ] = useState<string | null>(
    null,
  );

  const [feedback, setFeedback] =
    useState<FeedbackState | null>(
      null,
    );

  function toggleProjectExpanded(
    projectId: string,
  ) {
    setExpandedProjectIds(
      (current) => {
        const next =
          new Set(current);

        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }

        return next;
      },
    );
  }

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }

      if (statusFilter) {
        params.set(
          "status",
          statusFilter,
        );
      }

      if (priorityFilter) {
        params.set(
          "priority",
          priorityFilter,
        );
      }

      return params.toString();
    }, [
      priorityFilter,
      search,
      statusFilter,
    ]);

const salespersonOptions =
  useMemo(() => {
    return users.filter(
      (user) =>
        user.active &&
        (
          user.role === "ADMIN" ||
          user.role === "BACKOFFICE" ||
          user.role === "COMMERCIAL"
        ),
    );
  }, [users]);

  const responsibleOptions =
    useMemo(() => {
      return users.filter(
        (user) => user.active,
      );
    }, [users]);

  const equipmentById =
    useMemo(() => {
      return new Map(
        equipmentOptions.map(
          (equipment) => [
            equipment.id,
            equipment,
          ],
        ),
      );
    }, [equipmentOptions]);

  const selectedEquipmentIds =
    useMemo(() => {
      return new Set(
        form.equipment
          .map(
            (item) =>
              item.equipmentId,
          )
          .filter(Boolean),
      );
    }, [form.equipment]);

  const filteredEquipmentOptions =
    useMemo(() => {
      const normalizedSearch =
        equipmentPickerSearch
          .trim()
          .toLocaleLowerCase(
            "pt-BR",
          );

      if (!normalizedSearch) {
        return equipmentOptions;
      }

      return equipmentOptions.filter(
        (equipment) => {
          const searchableText =
            [
              equipment.name,
              equipment.category,
              equipment.manufacturer,
              equipment.model,
              equipment.serialNumber,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(
                "pt-BR",
              );

          return searchableText.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      equipmentOptions,
      equipmentPickerSearch,
    ]);

  const formEquipmentSummary =
    useMemo(() => {
      let totalNeeded = 0;
      let totalAvailable = 0;
      let totalShortage = 0;
      let itemsWithShortage = 0;

      for (const item of form.equipment) {
        if (!item.equipmentId) {
          continue;
        }

        const equipment =
          equipmentById.get(
            item.equipmentId,
          );

        if (!equipment) {
          continue;
        }

        const quantity =
          Number(item.quantity);

        const needed =
          Number.isInteger(quantity) &&
          quantity > 0
            ? quantity
            : 0;

        const physicalStock =
          getPhysicalStock(
            equipment,
          );

        const availableStock =
          Math.max(
            equipment.availableStock ??
              physicalStock,
            0,
          );

        const shortage =
          Math.max(
            needed -
              availableStock,
            0,
          );

        totalNeeded += needed;

        totalAvailable +=
          availableStock;

        totalShortage +=
          shortage;

        if (shortage > 0) {
          itemsWithShortage += 1;
        }
      }

      return {
        totalNeeded,
        totalAvailable,
        totalShortage,
        itemsWithShortage,
      };
    }, [
      equipmentById,
      form.equipment,
    ]);

  const activeProjects =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            project.status ===
              "PLANNING" ||
            project.status ===
              "IN_PROGRESS",
        ),
      [projects],
    );

  const completedProjects =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            project.status ===
            "COMPLETED",
        ),
      [projects],
    );

  const cancelledProjects =
    useMemo(
      () =>
        projects.filter(
          (project) =>
            project.status ===
            "CANCELLED",
        ),
      [projects],
    );

  const loadProjects =
    useCallback(async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/projects${
              queryString
                ? `?${queryString}`
                : ""
            }`,
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
          (await response.json()) as ProjectsResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            getApiMessage(data) ??
              "Não foi possível carregar os projetos.",
          );
        }

        setProjects(
          Array.isArray(data.data)
            ? data.data
            : [],
        );

        setSummary(
          data.summary ??
            initialSummary,
        );
      } catch (error) {
        setProjects([]);
        setSummary(
          initialSummary,
        );

        setFeedback({
          type: "error",
          message:
            getErrorMessage(error),
        });
      } finally {
        setLoading(false);
      }
    }, [queryString]);

  const loadUsers =
    useCallback(async () => {
      setLoadingUsers(true);

      try {
        const response =
          await fetch(
            "/api/users/options",
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
          (await response.json()) as UsersOptionsResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            getApiMessage(data) ??
              "Não foi possível carregar os usuários.",
          );
        }

        const activeUsers =
          Array.isArray(data.users)
            ? data.users.filter(
                (user) =>
                  user.active,
              )
            : [];

        setUsers(activeUsers);
      } catch (error) {
        console.error(
          "Erro ao carregar usuários do projeto:",
          error,
        );

        setUsers([]);

        setFeedback({
          type: "error",
          message:
            getErrorMessage(error),
        });
      } finally {
        setLoadingUsers(false);
      }
    }, []);

  const loadClients =
    useCallback(async () => {
      setLoadingClients(true);

      try {
        const response =
          await fetch(
            "/api/clients",
            {
              cache: "no-store",
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ??
              "Erro ao carregar clientes.",
          );
        }

        setClients(
          (data.data ?? []).filter(
            (
              client: ClientOption,
            ) => client.active,
          ),
        );
      } catch (error) {
        console.error(
          "Erro ao carregar clientes:",
          error,
        );

        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    }, []);

  const loadEquipment =
    useCallback(async () => {
      setLoadingEquipment(true);

      try {
        const response =
          await fetch(
            "/api/equipment",
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
          (await response.json()) as EquipmentResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            getApiMessage(data) ??
              "Não foi possível carregar os equipamentos.",
          );
        }

        const options =
          Array.isArray(data.data)
            ? data.data
            : Array.isArray(
                  data.equipment,
                )
              ? data.equipment
              : [];

        setEquipmentOptions(
          sortEquipmentOptions(
            options,
          ),
        );
      } catch (error) {
        console.error(
          "Erro ao carregar equipamentos:",
          error,
        );

        setEquipmentOptions([]);

        setFeedback({
          type: "error",
          message:
            getErrorMessage(error),
        });
      } finally {
        setLoadingEquipment(false);
      }
    }, []);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadManufacturers() {
      try {
        const response =
          await fetch(
            "/api/manufacturers",
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
          (await response.json()) as ManufacturersResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            getApiMessage(data) ??
              "Não foi possível carregar os fabricantes.",
          );
        }

        setManufacturerOptions(
          mergeManufacturerOptions(
            Array.isArray(
              data.data,
            )
              ? data.data
              : [],
          ),
        );
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        console.error(
          "Erro ao carregar fabricantes:",
          error,
        );

        setManufacturerOptions(
          mergeManufacturerOptions(
            [],
          ),
        );
      }
    }

    void loadManufacturers();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!canManageProjects) {
      return;
    }

    void Promise.all([
      loadUsers(),
      loadClients(),
      loadEquipment(),
    ]);
  }, [
    canManageProjects,
    loadClients,
    loadEquipment,
    loadUsers,
  ]);

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          void loadProjects();
        },
        250,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [loadProjects]);

  function openCreateModal() {
    if (!canManageProjects) {
      return;
    }

    setForm(
      createInitialFormState(),
    );

    setNewEquipmentForm(
      createInitialEquipmentFormState(),
    );

    setNewEquipmentError(null);

    setEquipmentModalOpen(
      false,
    );

    setFeedback(null);

    setModalOpen(true);

    setEquipmentPickerOpen(
      false,
    );

    setEquipmentPickerSearch(
      "",
    );

    if (
      users.length === 0 &&
      !loadingUsers
    ) {
      void loadUsers();
    }

    if (
      equipmentOptions.length ===
        0 &&
      !loadingEquipment
    ) {
      void loadEquipment();
    }
  }

  function closeCreateModal() {
    if (equipmentPickerOpen) {
      setEquipmentPickerOpen(
        false,
      );

      setEquipmentPickerSearch(
        "",
      );

      return;
    }

    if (equipmentModalOpen) {
      if (!savingEquipment) {
        setEquipmentModalOpen(
          false,
        );

        setNewEquipmentError(
          null,
        );
      }

      return;
    }

    if (saving) {
      return;
    }

    setModalOpen(false);

    setEquipmentModalOpen(
      false,
    );

    setNewEquipmentError(null);

    setForm(
      createInitialFormState(),
    );

    setNewEquipmentForm(
      createInitialEquipmentFormState(),
    );
  }

  function openCreateEquipmentModal() {
    if (!canManageProjects) {
      return;
    }

    setNewEquipmentForm(
      createInitialEquipmentFormState(),
    );

    setNewEquipmentError(null);

    setEquipmentModalOpen(
      true,
    );
  }

  function closeCreateEquipmentModal() {
    if (savingEquipment) {
      return;
    }

    setEquipmentModalOpen(
      false,
    );

    setNewEquipmentError(null);

    setNewEquipmentForm(
      createInitialEquipmentFormState(),
    );
  }

  function openEquipmentPicker() {
    if (!canManageProjects) {
      return;
    }

    setEquipmentPickerSearch(
      "",
    );

    const quantities: Record<
      string,
      number
    > = {};

    for (
      const item of
      form.equipment
    ) {
      if (!item.equipmentId) {
        continue;
      }

      const parsedQuantity =
        Number(item.quantity);

      quantities[
        item.equipmentId
      ] =
        Number.isInteger(
          parsedQuantity,
        ) &&
        parsedQuantity > 0
          ? parsedQuantity
          : 1;
    }

    setEquipmentPickerQuantities(
      quantities,
    );

    setEquipmentPickerOpen(
      true,
    );
  }

  function closeEquipmentPicker() {
    setEquipmentPickerOpen(
      false,
    );

    setEquipmentPickerSearch(
      "",
    );
  }

  function getPickerQuantity(
    equipmentId: string,
  ): number {
    return (
      equipmentPickerQuantities[
        equipmentId
      ] ?? 1
    );
  }

  function setPickerQuantity(
    equipmentId: string,
    quantity: number,
  ) {
    const normalizedQuantity =
      Math.min(
        Math.max(
          Math.trunc(
            Number.isFinite(
              quantity,
            )
              ? quantity
              : 1,
          ),
          1,
        ),
        MAX_EQUIPMENT_QUANTITY,
      );

    setEquipmentPickerQuantities(
      (current) => ({
        ...current,
        [equipmentId]:
          normalizedQuantity,
      }),
    );
  }

  function changePickerQuantity(
    equipmentId: string,
    difference: number,
  ) {
    const currentQuantity =
      getPickerQuantity(
        equipmentId,
      );

    setPickerQuantity(
      equipmentId,
      currentQuantity +
        difference,
    );
  }

  function saveEquipmentFromPicker(
    equipment: EquipmentOption,
  ) {
    const quantity =
      getPickerQuantity(
        equipment.id,
      );

    setForm((current) => {
      const existing =
        current.equipment.find(
          (item) =>
            item.equipmentId ===
            equipment.id,
        );

      if (existing) {
        return {
          ...current,
          equipment:
            current.equipment.map(
              (item) =>
                item.rowId ===
                existing.rowId
                  ? {
                      ...item,
                      quantity:
                        String(
                          quantity,
                        ),
                    }
                  : item,
            ),
        };
      }

      return {
        ...current,
        equipment: [
          ...current.equipment,
          {
            ...createEquipmentRow(
              equipment.id,
            ),
            quantity:
              String(quantity),
          },
        ],
      };
    });
  }

  function removeEquipmentFromPicker(
    equipmentId: string,
  ) {
    setForm((current) => ({
      ...current,
      equipment:
        current.equipment.filter(
          (item) =>
            item.equipmentId !==
            equipmentId,
        ),
    }));

    setEquipmentPickerQuantities(
      (current) => {
        const next = {
          ...current,
        };

        delete next[equipmentId];

        return next;
      },
    );
  }

  function updateForm<
    Field extends Exclude<
      keyof ProjectFormState,
      "equipment"
    >,
  >(
    field: Field,
    value: ProjectFormState[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateNewEquipmentForm<
    Field extends keyof NewEquipmentFormState,
  >(
    field: Field,
    value: NewEquipmentFormState[Field],
  ) {
    setNewEquipmentForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  function addOrSelectCreatedEquipment(
    equipmentId: string,
    quantity = 1,
  ) {
    const normalizedQuantity =
      Math.min(
        Math.max(
          Math.trunc(quantity),
          1,
        ),
        MAX_EQUIPMENT_QUANTITY,
      );

    setForm((current) => {
      const existing =
        current.equipment.find(
          (item) =>
            item.equipmentId ===
            equipmentId,
        );

      if (existing) {
        return {
          ...current,
          equipment:
            current.equipment.map(
              (item) =>
                item.rowId ===
                existing.rowId
                  ? {
                      ...item,
                      quantity:
                        String(
                          normalizedQuantity,
                        ),
                    }
                  : item,
            ),
        };
      }

      return {
        ...current,
        equipment: [
          ...current.equipment,
          {
            ...createEquipmentRow(
              equipmentId,
            ),
            quantity:
              String(
                normalizedQuantity,
              ),
          },
        ],
      };
    });
  }

  function removeEquipmentRow(
    rowId: string,
  ) {
    setForm((current) => ({
      ...current,
      equipment:
        current.equipment.filter(
          (item) =>
            item.rowId !== rowId,
        ),
    }));
  }

  function updateEquipmentRow(
    rowId: string,
    patch: Partial<
      Omit<
        ProjectEquipmentFormItem,
        "rowId"
      >
    >,
  ) {
    setForm((current) => ({
      ...current,
      equipment:
        current.equipment.map(
          (item) =>
            item.rowId === rowId
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    }));
  }

  function validateEquipmentRows():
    | {
        equipmentId: string;
        quantity: number;
        notes: string | null;
      }[]
    | null {
    const selectedIds =
      new Set<string>();

    const normalized: {
      equipmentId: string;
      quantity: number;
      notes: string | null;
    }[] = [];

    for (
      let index = 0;
      index <
      form.equipment.length;
      index += 1
    ) {
      const item =
        form.equipment[index];

      if (!item.equipmentId) {
        setFeedback({
          type: "error",
          message: `Selecione o equipamento da linha ${
            index + 1
          }.`,
        });

        return null;
      }

      if (
        selectedIds.has(
          item.equipmentId,
        )
      ) {
        setFeedback({
          type: "error",
          message:
            "O mesmo equipamento não pode ser selecionado mais de uma vez.",
        });

        return null;
      }

      const quantity =
        Number(item.quantity);

      if (
        !Number.isInteger(
          quantity,
        ) ||
        quantity <= 0 ||
        quantity >
          MAX_EQUIPMENT_QUANTITY
      ) {
        setFeedback({
          type: "error",
          message: `A quantidade da linha ${
            index + 1
          } deve ser um número inteiro entre 1 e ${MAX_EQUIPMENT_QUANTITY}.`,
        });

        return null;
      }

      selectedIds.add(
        item.equipmentId,
      );

      normalized.push({
        equipmentId:
          item.equipmentId,
        quantity,
        notes:
          item.notes.trim() ||
          null,
      });
    }

    return normalized;
  }

  async function handleCreateEquipment(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!canManageProjects) {
      setNewEquipmentError(
        "Você não possui permissão para cadastrar equipamentos.",
      );

      return;
    }

    setNewEquipmentError(null);

    const name =
      newEquipmentForm.name.trim();

    const category =
      newEquipmentForm.category.trim();

    const requestedQuantity =
      Number(
        newEquipmentForm.requestedQuantity,
      );

    if (!name) {
      setNewEquipmentError(
        "Informe o nome do equipamento.",
      );

      return;
    }

    if (!category) {
      setNewEquipmentError(
        "Informe a categoria do equipamento.",
      );

      return;
    }

    if (
      !Number.isInteger(
        requestedQuantity,
      ) ||
      requestedQuantity < 1 ||
      requestedQuantity >
        MAX_EQUIPMENT_QUANTITY
    ) {
      setNewEquipmentError(
        `A quantidade necessária deve ser um número inteiro entre 1 e ${MAX_EQUIPMENT_QUANTITY}.`,
      );

      return;
    }

    setSavingEquipment(true);

    try {
      const response =
        await fetch(
          "/api/equipment",
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
              category,

              manufacturer:
                newEquipmentForm.manufacturer.trim() ||
                null,

              model:
                newEquipmentForm.model.trim() ||
                null,

              serialNumber:
                newEquipmentForm.serialNumber.trim() ||
                null,

              /*
               * Cadastro rápido:
               * equipamento ainda não entrou
               * fisicamente no estoque.
               */
              quantity: 0,

              damagedQuantity: 0,

              minimumStock:
                LOW_STOCK_THRESHOLD,

              /*
               * AVAILABLE aqui significa que
               * o cadastro está ativo para uso
               * no sistema.
               *
               * Estoque 0 não deve impedir
               * a criação da demanda.
               */
              status: "AVAILABLE",

              condition: "NEW",

              notes:
                newEquipmentForm.notes.trim() ||
                null,
            }),
          },
        );

      const data =
        (await response.json()) as CreateEquipmentResponse;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          getApiMessage(data) ??
            "Não foi possível cadastrar o equipamento.",
        );
      }

      if (
        !data.data?.id ||
        !data.data.name
      ) {
        throw new Error(
          "O equipamento foi cadastrado, mas a API não retornou os dados necessários.",
        );
      }

      const createdEquipment: EquipmentOption =
        {
          ...data.data,

          quantity:
            Number.isFinite(
              data.data.quantity,
            )
              ? data.data.quantity
              : 0,

          physicalStock:
            data.data.physicalStock ??
            data.data.quantity ??
            0,

          inUse:
            data.data.inUse ?? 0,

          availableStock:
            data.data.availableStock ??
            data.data.quantity ??
            0,

          shortage:
            data.data.shortage ?? 0,

          minimumStock:
            data.data.minimumStock ??
            LOW_STOCK_THRESHOLD,
        };

      setEquipmentOptions(
        (current) => {
          const withoutDuplicate =
            current.filter(
              (equipment) =>
                equipment.id !==
                createdEquipment.id,
            );

          return sortEquipmentOptions([
            ...withoutDuplicate,
            createdEquipment,
          ]);
        },
      );

      if (
        createdEquipment.manufacturer
      ) {
        setManufacturerOptions(
          (current) =>
            mergeManufacturerOptions([
              ...current,
              createdEquipment.manufacturer ??
                "",
            ]),
        );
      }

      /*
       * O equipamento nasce com estoque 0,
       * mas já entra no projeto com a
       * quantidade solicitada pelo usuário.
       */
      addOrSelectCreatedEquipment(
        createdEquipment.id,
        requestedQuantity,
      );

      setEquipmentPickerQuantities(
        (current) => ({
          ...current,
          [createdEquipment.id]:
            requestedQuantity,
        }),
      );

      setEquipmentModalOpen(
        false,
      );

      setNewEquipmentForm(
        createInitialEquipmentFormState(),
      );

      setNewEquipmentError(null);

      setFeedback({
        type: "success",
        message: `${createdEquipment.name} foi cadastrado com estoque inicial zerado e adicionado ao projeto com necessidade de ${requestedQuantity} ${
          requestedQuantity === 1
            ? "unidade"
            : "unidades"
        }.`,
      });
    } catch (error) {
      setNewEquipmentError(
        getErrorMessage(error),
      );
    } finally {
      setSavingEquipment(false);
    }
  }

  async function handleCreateProject(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!canManageProjects) {
      setFeedback({
        type: "error",
        message:
          "Você não possui permissão para cadastrar projetos.",
      });

      return;
    }

    setFeedback(null);

    const name =
      form.name.trim();

    if (!name) {
      setFeedback({
        type: "error",
        message:
          "Informe o nome do projeto.",
      });

      return;
    }

    if (
      form.startDate &&
      form.dueDate &&
      new Date(form.dueDate) <
        new Date(form.startDate)
    ) {
      setFeedback({
        type: "error",
        message:
          "A data prevista não pode ser anterior à data de início.",
      });

      return;
    }

    const normalizedEquipment =
      validateEquipmentRows();

    if (
      normalizedEquipment ===
      null
    ) {
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/projects",
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

              clientId:
                form.clientId ||
                null,

              description:
                form.description.trim() ||
                null,

              salespersonId:
                form.salespersonId ||
                null,

              responsibleId:
                form.responsibleId ||
                null,

              status: form.status,

              priority:
                form.priority,

              startDate:
                form.startDate ||
                null,

              dueDate:
                form.dueDate ||
                null,

              equipment:
                normalizedEquipment,
            }),
          },
        );

      const data =
        (await response.json()) as CreateProjectResponse;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          getApiMessage(data) ??
            "Não foi possível criar o projeto.",
        );
      }

      setModalOpen(false);

      setEquipmentModalOpen(
        false,
      );

      setEquipmentPickerOpen(
        false,
      );

      setForm(
        createInitialFormState(),
      );

      setNewEquipmentForm(
        createInitialEquipmentFormState(),
      );

      setFeedback({
        type: "success",
        message:
          data.message ??
          "Projeto cadastrado com sucesso.",
      });

      await Promise.all([
        loadProjects(),
        loadEquipment(),
      ]);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          className={[
            "flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
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
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Projetos cadastrados"
          value={summary.total}
          icon={
            <FolderKanban
              size={20}
            />
          }
          color="zinc"
        />

        <SummaryCard
          title="Em planejamento"
          value={
            summary.planning
          }
          icon={
            <ClipboardList
              size={20}
            />
          }
          color="orange"
        />

        <SummaryCard
          title="Em andamento"
          value={
            summary.inProgress
          }
          icon={
            <CircleAlert
              size={20}
            />
          }
          color="blue"
        />

        <SummaryCard
          title="Déficit de unidades"
          value={
            summary.totalShortageUnits ??
            0
          }
          icon={
            <ShoppingCart
              size={20}
            />
          }
          color={
            (summary.totalShortageUnits ??
              0) > 0
              ? "red"
              : "green"
          }
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Buscar projetos
              </span>

              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="search"
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Buscar por projeto, cliente, vendedor ou responsável..."
                className={
                  inputClassName
                }
              />
            </label>

            <select
              value={statusFilter}
              onChange={(
                event,
              ) =>
                setStatusFilter(
                  event.target
                    .value as
                    | ""
                    | ProjectStatus,
                )
              }
              aria-label="Filtrar por status"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 xl:w-52"
            >
              <option value="">
                Todos os status
              </option>

              <option value="PLANNING">
                Planejamento
              </option>

              <option value="IN_PROGRESS">
                Em andamento
              </option>

              <option value="COMPLETED">
                Concluído
              </option>

              <option value="CANCELLED">
                Cancelado
              </option>
            </select>

            <select
              value={
                priorityFilter
              }
              onChange={(
                event,
              ) =>
                setPriorityFilter(
                  event.target
                    .value as
                    | ""
                    | ProjectPriority,
                )
              }
              aria-label="Filtrar por prioridade"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100 xl:w-44"
            >
              <option value="">
                Todas as prioridades
              </option>

              <option value="LOW">
                Baixa
              </option>

              <option value="NORMAL">
                Normal
              </option>

              <option value="HIGH">
                Alta
              </option>

              <option value="URGENT">
                Urgente
              </option>
            </select>

            {canManageProjects ? (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <Plus size={17} />

                Novo projeto
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-zinc-500">
            Carregando projetos...
          </div>
        ) : projects.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-[#F57B00]">
              <FolderKanban
                size={26}
              />
            </div>

            <h2 className="mt-4 text-base font-bold text-zinc-900">
              Nenhum projeto encontrado
            </h2>

            <p className="mt-1 max-w-md text-sm text-zinc-500">
              {canManageProjects
                ? "Ajuste os filtros ou cadastre o primeiro projeto do sistema."
                : "Ajuste a pesquisa ou os filtros para localizar um projeto."}
            </p>

            {canManageProjects ? (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
              >
                <Plus size={17} />

                Criar projeto
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            {activeProjects.length >
            0 ? (
              <section className="p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">
                      Projetos ativos
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Projetos em planejamento ou em andamento.
                    </p>
                  </div>

                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#F57B00]">
                    {
                      activeProjects.length
                    }
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {activeProjects.map(
                    (project) => (
                      <ProjectCard
                        key={
                          project.id
                        }
                        project={
                          project
                        }
                        expanded={expandedProjectIds.has(
                          project.id,
                        )}
                        onToggle={() =>
                          toggleProjectExpanded(
                            project.id,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ) : null}

            {cancelledProjects.length >
            0 ? (
              <section className="border-t border-zinc-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">
                      Projetos cancelados
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Projetos que não estão mais em execução.
                    </p>
                  </div>

                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {
                      cancelledProjects.length
                    }
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {cancelledProjects.map(
                    (project) => (
                      <CompactProjectRow
                        key={
                          project.id
                        }
                        project={
                          project
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ) : null}

            {completedProjects.length >
            0 ? (
              <section className="border-t border-zinc-200 bg-zinc-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        size={18}
                        className="text-emerald-600"
                      />

                      <h2 className="text-sm font-bold text-zinc-900">
                        Projetos concluídos
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      Histórico dos projetos finalizados.
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {
                      completedProjects.length
                    }
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {completedProjects.map(
                    (project) => (
                      <CompactProjectRow
                        key={
                          project.id
                        }
                        project={
                          project
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>

      {canManageProjects &&
      modalOpen ? (
        <Modal
          title="Novo projeto"
          titleId="project-modal-title"
          onClose={
            closeCreateModal
          }
          maxWidthClass="max-w-5xl"
          zIndexClass="z-[100]"
        >
          <form
            onSubmit={
              handleCreateProject
            }
            className="space-y-5"
          >
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Dados do projeto
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Informe os dados comerciais e o planejamento.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Nome do projeto"
                  required
                >
                  <input
                    type="text"
                    value={form.name}
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "name",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: Projeto IA USP"
                    className={
                      fieldClassName
                    }
                    maxLength={150}
                    autoFocus
                    required
                  />
                </FormField>

                <FormField label="Cliente">
                  <select
                    value={
                      form.clientId
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "clientId",
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      loadingClients
                    }
                    className={
                      fieldClassName
                    }
                  >
                    <option value="">
                      {loadingClients
                        ? "Carregando clientes..."
                        : "Selecione um cliente"}
                    </option>

                    {clients.map(
                      (client) => (
                        <option
                          key={
                            client.id
                          }
                          value={
                            client.id
                          }
                        >
                          {
                            client.clientCode
                          }{" "}
                          •{" "}
                          {client.shortName ??
                            client.name}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Vendedor">
                  <select
                    value={
                      form.salespersonId
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "salespersonId",
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      loadingUsers
                    }
                    className={
                      fieldClassName
                    }
                  >
                    <option value="">
                      {loadingUsers
                        ? "Carregando vendedores..."
                        : "Selecione um vendedor"}
                    </option>

                    {salespersonOptions.map(
                      (user) => (
                        <option
                          key={
                            user.id
                          }
                          value={
                            user.id
                          }
                        >
                          {user.name}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>

                <FormField label="Responsável">
                  <select
                    value={
                      form.responsibleId
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "responsibleId",
                        event.target
                          .value,
                      )
                    }
                    disabled={
                      loadingUsers
                    }
                    className={
                      fieldClassName
                    }
                  >
                    <option value="">
                      {loadingUsers
                        ? "Carregando responsáveis..."
                        : "Selecione um responsável"}
                    </option>

                    {responsibleOptions.map(
                      (user) => (
                        <option
                          key={
                            user.id
                          }
                          value={
                            user.id
                          }
                        >
                          {user.name}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>
              </div>

              {!loadingUsers &&
              users.length ===
                0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Nenhum usuário ativo foi encontrado para seleção.
                </div>
              ) : null}

              <FormField label="Descrição">
                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "description",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Descreva o objetivo do projeto"
                  rows={3}
                  maxLength={1000}
                  className={`${fieldClassName} h-auto resize-y py-2.5`}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Status"
                  required
                >
                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "status",
                        event.target
                          .value as ProjectStatus,
                      )
                    }
                    className={
                      fieldClassName
                    }
                    required
                  >
                    <option value="PLANNING">
                      Planejamento
                    </option>

                    <option value="IN_PROGRESS">
                      Em andamento
                    </option>

                    <option value="COMPLETED">
                      Concluído
                    </option>
                  </select>
                </FormField>

                <FormField
                  label="Prioridade"
                  required
                >
                  <select
                    value={
                      form.priority
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "priority",
                        event.target
                          .value as ProjectPriority,
                      )
                    }
                    className={
                      fieldClassName
                    }
                    required
                  >
                    <option value="LOW">
                      Baixa
                    </option>

                    <option value="NORMAL">
                      Normal
                    </option>

                    <option value="HIGH">
                      Alta
                    </option>

                    <option value="URGENT">
                      Urgente
                    </option>
                  </select>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Data de início">
                  <input
                    type="date"
                    value={
                      form.startDate
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "startDate",
                        event.target
                          .value,
                      )
                    }
                    className={
                      fieldClassName
                    }
                  />
                </FormField>

                <FormField label="Data prevista">
                  <input
                    type="date"
                    value={
                      form.dueDate
                    }
                    min={
                      form.startDate ||
                      undefined
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "dueDate",
                        event.target
                          .value,
                      )
                    }
                    className={
                      fieldClassName
                    }
                  />
                </FormField>
              </div>
            </section>

            <section className="space-y-4 border-t border-zinc-200 pt-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Equipamentos necessários
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    A quantidade informa a necessidade do projeto. É permitido solicitar mais unidades do que há em estoque.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={
                      openEquipmentPicker
                    }
                    disabled={
                      loadingEquipment
                    }
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-[#F57B00] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={16} />

                    Adicionar equipamento
                  </button>

                  <button
                    type="button"
                    onClick={
                      openCreateEquipmentModal
                    }
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-[#F57B00]"
                  >
                    <Wrench
                      size={16}
                    />

                    Novo equipamento
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                <CircleAlert
                  size={16}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  Quando um equipamento ainda não existir, cadastre-o pelo botão{" "}
                  <strong>
                    Novo equipamento
                  </strong>
                  . Ele será criado com estoque físico zerado e selecionado automaticamente neste projeto. A necessidade ficará registrada como déficit para compra.
                </span>
              </div>

              {loadingEquipment ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                  Carregando equipamentos...
                </div>
              ) : form.equipment
                  .length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
                  <Package
                    size={24}
                    className="mx-auto text-zinc-400"
                  />

                  <p className="mt-2 text-sm font-medium text-zinc-700">
                    Nenhum equipamento adicionado
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    O projeto pode ser criado sem equipamentos e atualizado depois.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.equipment.map(
                    (
                      item,
                      index,
                    ) => {
                      const equipment =
                        equipmentById.get(
                          item.equipmentId,
                        );

                      const physicalStock =
                        equipment
                          ? getPhysicalStock(
                              equipment,
                            )
                          : 0;

                      const inUse =
                        Math.max(
                          equipment?.inUse ??
                            0,
                          0,
                        );

                      const availableStock =
                        Math.max(
                          equipment?.availableStock ??
                            physicalStock,
                          0,
                        );

                      const needed =
                        Number(
                          item.quantity,
                        );

                      const validNeeded =
                        Number.isInteger(
                          needed,
                        ) &&
                        needed > 0
                          ? needed
                          : 0;

                      const shortage =
                        Math.max(
                          validNeeded -
                            availableStock,
                          0,
                        );

                      return (
                        <div
                          key={
                            item.rowId
                          }
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-zinc-800">
                              Equipamento{" "}
                              {index +
                                1}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                removeEquipmentRow(
                                  item.rowId,
                                )
                              }
                              aria-label={`Remover equipamento ${
                                index +
                                1
                              }`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px]">
                            <FormField
                              label="Equipamento"
                              required
                            >
                              <select
                                value={
                                  item.equipmentId
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateEquipmentRow(
                                    item.rowId,
                                    {
                                      equipmentId:
                                        event.target
                                          .value,
                                    },
                                  )
                                }
                                className={
                                  fieldClassName
                                }
                                required
                              >
                                <option value="">
                                  Selecione um equipamento
                                </option>

                                {equipmentOptions.map(
                                  (
                                    option,
                                  ) => {
                                    const disabled =
                                      selectedEquipmentIds.has(
                                        option.id,
                                      ) &&
                                      option.id !==
                                        item.equipmentId;

                                    const stock =
                                      getPhysicalStock(
                                        option,
                                      );

                                    const details =
                                      [
                                        option.manufacturer,
                                        option.model,
                                      ]
                                        .filter(
                                          Boolean,
                                        )
                                        .join(
                                          " ",
                                        );

                                    return (
                                      <option
                                        key={
                                          option.id
                                        }
                                        value={
                                          option.id
                                        }
                                        disabled={
                                          disabled
                                        }
                                      >
                                        {
                                          option.name
                                        }
                                        {details
                                          ? ` — ${details}`
                                          : ""}
                                        {" — Estoque: "}
                                        {stock}
                                      </option>
                                    );
                                  },
                                )}
                              </select>
                            </FormField>

                            <FormField
                              label="Necessário"
                              required
                            >
                              <input
                                type="number"
                                min={1}
                                max={
                                  MAX_EQUIPMENT_QUANTITY
                                }
                                step={1}
                                value={
                                  item.quantity
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateEquipmentRow(
                                    item.rowId,
                                    {
                                      quantity:
                                        event.target
                                          .value,
                                    },
                                  )
                                }
                                className={
                                  fieldClassName
                                }
                                required
                              />
                            </FormField>
                          </div>

                          {equipment ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-4">
                              <EquipmentMetric
                                label="Estoque físico"
                                value={
                                  physicalStock
                                }
                                tone="zinc"
                              />

                              <EquipmentMetric
                                label="Em uso"
                                value={
                                  inUse
                                }
                                tone="blue"
                              />

                              <EquipmentMetric
                                label="Disponível"
                                value={
                                  availableStock
                                }
                                tone={
                                  availableStock ===
                                  0
                                    ? "red"
                                    : "green"
                                }
                              />

                              <EquipmentMetric
                                label="Déficit"
                                value={
                                  shortage
                                }
                                tone={
                                  shortage >
                                  0
                                    ? "red"
                                    : "green"
                                }
                              />
                            </div>
                          ) : null}

                          {equipment &&
                          shortage > 0 ? (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                              <AlertTriangle
                                size={16}
                                className="mt-0.5 shrink-0"
                              />

                              <span>
                                O projeto precisa de{" "}
                                <strong>
                                  {
                                    validNeeded
                                  }
                                </strong>{" "}
                                unidade(s), mas existem apenas{" "}
                                <strong>
                                  {
                                    availableStock
                                  }
                                </strong>
                                . Será registrado um déficit de{" "}
                                <strong>
                                  {
                                    shortage
                                  }
                                </strong>{" "}
                                unidade(s) para compra.
                              </span>
                            </div>
                          ) : equipment ? (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                              <PackageCheck
                                size={16}
                                className="mt-0.5 shrink-0"
                              />

                              <span>
                                O estoque disponível cobre esta necessidade.
                              </span>
                            </div>
                          ) : null}

                          <div className="mt-3">
                            <FormField label="Observação">
                              <input
                                type="text"
                                value={
                                  item.notes
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateEquipmentRow(
                                    item.rowId,
                                    {
                                      notes:
                                        event.target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="Ex.: modelo específico ou configuração necessária"
                                maxLength={
                                  500
                                }
                                className={
                                  fieldClassName
                                }
                              />
                            </FormField>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}

              {form.equipment.length >
              0 ? (
                <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-3">
                  <EquipmentMetric
                    label="Necessidade total"
                    value={
                      formEquipmentSummary.totalNeeded
                    }
                    tone="blue"
                  />

                  <EquipmentMetric
                    label="Disponível dos itens"
                    value={
                      formEquipmentSummary.totalAvailable
                    }
                    tone="zinc"
                  />

                  <EquipmentMetric
                    label="Comprar / déficit"
                    value={
                      formEquipmentSummary.totalShortage
                    }
                    tone={
                      formEquipmentSummary.totalShortage >
                      0
                        ? "red"
                        : "green"
                    }
                  />
                </div>
              ) : null}
            </section>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={saving}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  loadingUsers ||
                  loadingEquipment ||
                  savingEquipment
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={17} />

                {saving
                  ? "Salvando..."
                  : "Criar projeto"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {canManageProjects &&
      modalOpen &&
      equipmentPickerOpen ? (
        <Modal
          title="Equipamentos do projeto"
          titleId="project-equipment-picker-title"
          onClose={
            closeEquipmentPicker
          }
          maxWidthClass="max-w-5xl"
          zIndexClass="z-[115]"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="search"
                value={
                  equipmentPickerSearch
                }
                onChange={(
                  event,
                ) =>
                  setEquipmentPickerSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Buscar por nome, categoria, fabricante, modelo ou número de série"
                autoFocus
                className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-orange-100"
              />

              {equipmentPickerSearch ? (
                <button
                  type="button"
                  onClick={() =>
                    setEquipmentPickerSearch(
                      "",
                    )
                  }
                  aria-label="Limpar busca"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            {filteredEquipmentOptions.length ===
            0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                <Package
                  size={28}
                  className="text-zinc-400"
                />

                <p className="mt-3 text-sm font-semibold text-zinc-800">
                  Nenhum equipamento encontrado
                </p>

                <button
                  type="button"
                  onClick={() => {
                    closeEquipmentPicker();
                    openCreateEquipmentModal();
                  }}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-[#F57B00] transition hover:bg-orange-100"
                >
                  <Wrench
                    size={15}
                  />

                  Novo equipamento
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
                {filteredEquipmentOptions.map(
                  (equipment) => {
                    const isSelected =
                      form.equipment.some(
                        (item) =>
                          item.equipmentId ===
                          equipment.id,
                      );

                    const quantity =
                      getPickerQuantity(
                        equipment.id,
                      );

                    const physicalStock =
                      getPhysicalStock(
                        equipment,
                      );

                    const inUse =
                      Math.max(
                        equipment.inUse ??
                          0,
                        0,
                      );

                    const availableStock =
                      Math.max(
                        equipment.availableStock ??
                          physicalStock,
                        0,
                      );

                    const requestedShortage =
                      Math.max(
                        quantity -
                          availableStock,
                        0,
                      );

                    /*
                     * Estoque zerado NÃO bloqueia
                     * a inclusão no projeto.
                     *
                     * Toda quantidade não coberta
                     * pelo estoque disponível vira
                     * déficit para compra.
                     */
                    const hasNoStock =
                      availableStock ===
                      0;

                    return (
                      <article
                        key={
                          equipment.id
                        }
                        className={[
                          "p-4 transition sm:p-5",
                          isSelected
                            ? "bg-orange-50/40"
                            : "bg-white",
                        ].join(" ")}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-zinc-900">
                                {
                                  equipment.name
                                }
                              </h3>

                              {isSelected ? (
                                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                  Adicionado ao projeto
                                </span>
                              ) : null}

                              {hasNoStock ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  Sem estoque
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Disponível
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-zinc-500">
                              {
                                equipment.category
                              }

                              {equipment.manufacturer
                                ? ` · ${equipment.manufacturer}`
                                : ""}

                              {equipment.model
                                ? ` ${equipment.model}`
                                : ""}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                              <span className="text-zinc-500">
                                Estoque:{" "}
                                <strong className="text-zinc-800">
                                  {
                                    physicalStock
                                  }
                                </strong>
                              </span>

                              <span className="text-blue-600">
                                Em uso:{" "}
                                <strong>
                                  {inUse}
                                </strong>
                              </span>

                              <span
                                className={
                                  availableStock ===
                                  0
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }
                              >
                                Disponível:{" "}
                                <strong>
                                  {
                                    availableStock
                                  }
                                </strong>
                              </span>

                              {requestedShortage >
                              0 ? (
                                <span className="font-semibold text-red-600">
                                  Déficit:{" "}
                                  {
                                    requestedShortage
                                  }
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-end gap-2">
                            <div>
                              <label
                                htmlFor={`new-project-equipment-${equipment.id}`}
                                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                              >
                                Quantidade
                              </label>

                              <div className="flex h-10 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    changePickerQuantity(
                                      equipment.id,
                                      -1,
                                    )
                                  }
                                  disabled={
                                    quantity <=
                                    1
                                  }
                                  aria-label={`Diminuir quantidade de ${equipment.name}`}
                                  className="flex w-10 items-center justify-center text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  −
                                </button>

                                <input
                                  id={`new-project-equipment-${equipment.id}`}
                                  type="number"
                                  min={1}
                                  max={
                                    MAX_EQUIPMENT_QUANTITY
                                  }
                                  step={1}
                                  value={
                                    quantity
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setPickerQuantity(
                                      equipment.id,
                                      Number(
                                        event.target
                                          .value,
                                      ),
                                    )
                                  }
                                  className="w-16 border-x border-zinc-200 text-center text-sm font-bold outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    changePickerQuantity(
                                      equipment.id,
                                      1,
                                    )
                                  }
                                  aria-label={`Aumentar quantidade de ${equipment.name}`}
                                  className="flex w-10 items-center justify-center text-zinc-600 transition hover:bg-zinc-100"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/*
                              Importante:
                              NÃO existe disabled baseado
                              em estoque ou status.

                              Estoque zero também pode
                              ser solicitado.
                            */}
                            <button
                              type="button"
                              onClick={() =>
                                saveEquipmentFromPicker(
                                  equipment,
                                )
                              }
                              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00]"
                            >
                              <Plus
                                size={16}
                              />

                              {isSelected
                                ? "Atualizar"
                                : "Adicionar"}
                            </button>

                            {isSelected ? (
                              <button
                                type="button"
                                onClick={() =>
                                  removeEquipmentFromPicker(
                                    equipment.id,
                                  )
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2
                                  size={15}
                                />

                                Remover
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {requestedShortage >
                        0 ? (
                          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            <AlertTriangle
                              size={15}
                              className="mt-0.5 shrink-0"
                            />

                            <span>
                              É permitido solicitar{" "}
                              <strong>
                                {
                                  quantity
                                }
                              </strong>{" "}
                              unidade(s). O estoque disponível cobre{" "}
                              <strong>
                                {Math.min(
                                  quantity,
                                  availableStock,
                                )}
                              </strong>{" "}
                              e o déficit de{" "}
                              <strong>
                                {
                                  requestedShortage
                                }
                              </strong>{" "}
                              unidade(s) será considerado para compra.
                            </span>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                            <PackageCheck
                              size={15}
                              className="mt-0.5 shrink-0"
                            />

                            <span>
                              O estoque disponível cobre a quantidade solicitada.
                            </span>
                          </div>
                        )}
                      </article>
                    );
                  },
                )}
              </div>
            )}

            <footer className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                {
                  form.equipment
                    .length
                }{" "}
                {form.equipment
                  .length === 1
                  ? "equipamento selecionado"
                  : "equipamentos selecionados"}
              </p>

              <button
                type="button"
                onClick={
                  closeEquipmentPicker
                }
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Concluir
              </button>
            </footer>
          </div>
        </Modal>
      ) : null}

      {canManageProjects &&
      modalOpen &&
      equipmentModalOpen ? (
        <Modal
          title="Novo equipamento"
          titleId="quick-equipment-modal-title"
          onClose={
            closeCreateEquipmentModal
          }
          maxWidthClass="max-w-3xl"
          zIndexClass="z-[120]"
        >
          <form
            onSubmit={
              handleCreateEquipment
            }
            className="space-y-5"
          >
            <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <Package
                size={20}
                className="mt-0.5 shrink-0 text-[#F57B00]"
              />

              <div>
                <p className="text-sm font-semibold text-orange-900">
                  Cadastro para o projeto
                </p>

                <p className="mt-1 text-xs leading-5 text-orange-700">
                  O equipamento será criado com estoque físico inicial igual a{" "}
                  <strong>
                    0
                  </strong>
                  , poderá ser solicitado normalmente neste projeto e a quantidade necessária será considerada no déficit para compra.
                </p>
              </div>
            </div>

            {newEquipmentError ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {
                    newEquipmentError
                  }
                </span>
              </div>
            ) : null}

            <section className="rounded-xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h3 className="text-sm font-bold text-zinc-900">
                  Informações do item
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Informe os dados utilizados para identificar o equipamento e a quantidade necessária para este projeto.
                </p>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <FormField
                  label="Nome"
                  required
                >
                  <input
                    type="text"
                    value={
                      newEquipmentForm.name
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNewEquipmentForm(
                        "name",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: Servidor Dell PowerEdge R760"
                    maxLength={150}
                    className={
                      fieldClassName
                    }
                    autoFocus
                    required
                  />
                </FormField>

                <FormField
                  label="Categoria"
                  required
                >
                  <select
                    value={
                      newEquipmentForm.category
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNewEquipmentForm(
                        "category",
                        event.target
                          .value,
                      )
                    }
                    className={
                      fieldClassName
                    }
                    required
                  >
                    <option value="">
                      Selecione
                    </option>

                    {EQUIPMENT_CATEGORIES.map(
                      (category) => (
                        <option
                          key={
                            category
                          }
                          value={
                            category
                          }
                        >
                          {category}
                        </option>
                      ),
                    )}
                  </select>
                </FormField>

                <FormField label="Fabricante">
                  <SearchableSelect
                    id="project-new-equipment-manufacturer"
                    name="manufacturer"
                    value={
                      newEquipmentForm.manufacturer
                    }
                    options={
                      manufacturerOptions
                    }
                    placeholder="Digite ou selecione um fabricante"
                    emptyMessage="Nenhum fabricante encontrado."
                    allowCustomValue
                    onChange={(
                      manufacturer,
                    ) =>
                      updateNewEquipmentForm(
                        "manufacturer",
                        manufacturer,
                      )
                    }
                  />
                </FormField>

                <FormField label="Modelo">
                  <input
                    type="text"
                    value={
                      newEquipmentForm.model
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNewEquipmentForm(
                        "model",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ex.: PowerEdge R760"
                    maxLength={120}
                    className={
                      fieldClassName
                    }
                  />
                </FormField>

                <FormField label="Número de série">
                  <input
                    type="text"
                    value={
                      newEquipmentForm.serialNumber
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNewEquipmentForm(
                        "serialNumber",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Opcional"
                    maxLength={150}
                    className={
                      fieldClassName
                    }
                  />
                </FormField>

                <FormField
                  label="Quantidade necessária"
                  required
                >
                  <input
                    type="number"
                    min={1}
                    max={
                      MAX_EQUIPMENT_QUANTITY
                    }
                    step={1}
                    value={
                      newEquipmentForm.requestedQuantity
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNewEquipmentForm(
                        "requestedQuantity",
                        event.target
                          .value,
                      )
                    }
                    className={
                      fieldClassName
                    }
                    required
                  />

                  <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                    Quantidade que este projeto precisa. Como o estoque inicial será 0, essa quantidade ficará inicialmente como déficit para compra.
                  </p>
                </FormField>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 sm:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">
                        Estoque operacional inicial
                      </p>

                      <p className="mt-1 text-xl font-bold text-zinc-900">
                        0
                      </p>

                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        A entrada física será registrada posteriormente pela área de compras.
                      </p>
                    </div>

                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-xs font-medium text-red-600">
                        Déficit inicial deste projeto
                      </p>

                      <p className="mt-1 text-xl font-bold text-red-700">
                        {Number.isInteger(
                          Number(
                            newEquipmentForm.requestedQuantity,
                          ),
                        ) &&
                        Number(
                          newEquipmentForm.requestedQuantity,
                        ) > 0
                          ? Number(
                              newEquipmentForm.requestedQuantity,
                            )
                          : 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h3 className="text-sm font-bold text-zinc-900">
                  Controle automático de estoque
                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Regras aplicadas automaticamente pelo sistema.
                </p>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <EquipmentMetric
                  label="Estoque inicial"
                  value={0}
                  tone="zinc"
                />

                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  <p className="text-[11px] font-medium opacity-75">
                    Situação inicial
                  </p>

                  <p className="mt-0.5 text-sm font-bold">
                    Sem estoque físico
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  <p className="text-[11px] font-medium opacity-75">
                    Alerta automático
                  </p>

                  <p className="mt-0.5 text-sm font-bold">
                    Até{" "}
                    {
                      LOW_STOCK_THRESHOLD
                    }{" "}
                    unidades
                  </p>

                  <p className="mt-1 text-[11px]">
                    Regra fixa do sistema
                  </p>
                </div>
              </div>
            </section>

            <FormField label="Observações">
              <textarea
                value={
                  newEquipmentForm.notes
                }
                onChange={(
                  event,
                ) =>
                  updateNewEquipmentForm(
                    "notes",
                    event.target
                      .value,
                  )
                }
                placeholder="Descreva configurações, acessórios ou detalhes necessários para o projeto."
                rows={4}
                maxLength={1000}
                className={`${fieldClassName} h-auto min-h-28 resize-y py-2.5`}
              />
            </FormField>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={
                  closeCreateEquipmentModal
                }
                disabled={
                  savingEquipment
                }
                className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  savingEquipment
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F57B00] px-4 text-sm font-semibold text-white transition hover:bg-[#DD6F00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={17} />

                {savingEquipment
                  ? "Cadastrando..."
                  : "Cadastrar e adicionar"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const neededUnits =
    getProjectNeededUnits(
      project,
    );

  const shortageUnits =
    getProjectShortageUnits(
      project,
    );

  const hasShortage =
    project.hasShortage ??
    shortageUnits > 0;

  const clientName =
    project.client?.shortName ??
    project.client?.name ??
    project.clientName ??
    "Cliente não informado";

  return (
    <article
      className={[
        "overflow-hidden rounded-xl border bg-white transition-shadow",
        hasShortage
          ? "border-amber-200"
          : "border-zinc-200",
        expanded
          ? "shadow-sm"
          : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 p-4">
        <Link
          href={`/projects/${project.id}`}
          className="min-w-0 flex-1 rounded-lg outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-orange-200"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                project.status
              }
            />

            <PriorityBadge
              priority={
                project.priority
              }
            />

            {hasShortage ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <AlertTriangle
                  size={13}
                />

                Déficit:{" "}
                {shortageUnits}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 truncate text-base font-bold text-zinc-900">
            {project.name}
          </h2>

          <p className="mt-1 truncate text-sm text-zinc-500">
            {project.client
              ?.clientCode
              ? `${project.client.clientCode} · `
              : ""}

            {clientName}
          </p>
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={
            expanded
          }
          aria-label={
            expanded
              ? `Recolher projeto ${project.name}`
              : `Expandir projeto ${project.name}`
          }
          title={
            expanded
              ? "Recolher"
              : "Expandir"
          }
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
            expanded
              ? "border-orange-200 bg-orange-50 text-[#F57B00]"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-orange-200 hover:bg-orange-50 hover:text-[#F57B00]",
          ].join(" ")}
        >
          <ChevronDown
            size={18}
            className={[
              "transition-transform duration-200",
              expanded
                ? "rotate-180"
                : "",
            ].join(" ")}
          />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-zinc-100">
          <Link
            href={`/projects/${project.id}`}
            className="block px-4 pb-4 pt-3 transition hover:bg-zinc-50/70"
          >
            {project.description ? (
              <p className="line-clamp-2 text-sm leading-6 text-zinc-500">
                {
                  project.description
                }
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                Sem descrição informada.
              </p>
            )}

            {hasShortage ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                <AlertTriangle
                  size={15}
                  className="shrink-0"
                />

                Faltam{" "}
                {shortageUnits}{" "}
                unidade(s) para atender este projeto.
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <UserRound
                  size={16}
                  className="shrink-0 text-zinc-400"
                />

                <span className="truncate">
                  Vendedor:{" "}
                  {project.salesperson
                    ?.name ??
                    "Não informado"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <UserRound
                  size={16}
                  className="shrink-0 text-zinc-400"
                />

                <span className="truncate">
                  Responsável:{" "}
                  {project.responsible
                    ?.name ??
                    "Não informado"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <CalendarDays
                  size={16}
                  className="shrink-0 text-zinc-400"
                />

                <span>
                  Prazo:{" "}
                  {formatDate(
                    project.dueDate,
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Package
                  size={16}
                  className="shrink-0 text-zinc-400"
                />

                <span>
                  {
                    project.equipmentItems
                  }{" "}
                  item(ns) ·{" "}
                  {neededUnits}{" "}
                  unidade(s) necessária(s)
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
              <p className="text-xs text-zinc-400">
                Criado em{" "}
                {formatDate(
                  project.createdAt,
                )}
              </p>

              <span className="text-xs font-semibold text-[#F57B00]">
                Abrir projeto →
              </span>
            </div>
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function CompactProjectRow({
  project,
}: {
  project: ProjectItem;
}) {
  const neededUnits =
    getProjectNeededUnits(
      project,
    );

  const clientName =
    project.client?.shortName ??
    project.client?.name ??
    project.clientName ??
    "Cliente não informado";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block border-b border-zinc-100 px-4 py-3 transition last:border-b-0 hover:bg-zinc-50"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge
              status={
                project.status
              }
            />

            <PriorityBadge
              priority={
                project.priority
              }
            />

            <h3 className="min-w-0 truncate text-sm font-bold text-zinc-900 group-hover:text-[#F57B00]">
              {project.name}
            </h3>
          </div>

          <p className="mt-1 truncate text-xs text-zinc-500">
            {project.client
              ?.clientCode
              ? `${project.client.clientCode} · `
              : ""}

            {clientName}

            {project.responsible
              ?.name
              ? ` · Responsável: ${project.responsible.name}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Package
              size={14}
            />

            {
              project.equipmentItems
            }{" "}
            item(ns)
          </span>

          <span>
            {neededUnits}{" "}
            unidade(s)
          </span>

          {project.status ===
          "COMPLETED" ? (
            <span className="font-medium text-emerald-700">
              {project.completedAt
                ? `Concluído em ${formatDate(
                    project.completedAt,
                  )}`
                : "Concluído"}
            </span>
          ) : (
            <span>
              Atualizado em{" "}
              {formatDate(
                project.updatedAt,
              )}
            </span>
          )}

          <span className="font-semibold text-zinc-400 transition group-hover:text-[#F57B00]">
            Abrir →
          </span>
        </div>
      </div>
    </Link>
  );
}

function EquipmentMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "zinc"
    | "blue"
    | "green"
    | "red";
}) {
  const colors = {
    zinc:
      "border-zinc-200 bg-zinc-50 text-zinc-800",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${colors[tone]}`}
    >
      <p className="text-[11px] font-medium opacity-75">
        {label}
      </p>

      <p className="mt-0.5 text-lg font-bold">
        {value}
      </p>
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
      {
        statusLabels[
          status
        ]
      }
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
    LOW:
      "bg-zinc-100 text-zinc-600",
    NORMAL:
      "bg-blue-50 text-blue-600",
    HIGH:
      "bg-amber-50 text-amber-700",
    URGENT:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[priority]}`}
    >
      {
        priorityLabels[
          priority
        ]
      }
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color:
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
    <article className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-zinc-500">
          {title}
        </p>

        <p className="mt-2 text-2xl font-bold text-zinc-900">
          {value}
        </p>
      </div>

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}
      >
        {icon}
      </div>
    </article>
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
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
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

function Modal({
  title,
  titleId,
  children,
  onClose,
  maxWidthClass,
  zIndexClass,
}: {
  title: string;
  titleId: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClass: string;
  zIndexClass: string;
}) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={
        titleId
      }
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
        className={`max-h-[92vh] w-full ${maxWidthClass} overflow-y-auto rounded-xl bg-white shadow-2xl`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <h2
            id={titleId}
            className="text-base font-bold text-zinc-900"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}