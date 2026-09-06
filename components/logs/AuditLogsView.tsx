"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type AuditUser = {
  id: string;
  name: string;
  username: string;
};

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
  user: AuditUser | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type AuditFilters = {
  users: AuditUser[];
  actions: string[];
  entities: string[];
};

type AuditLogsResponse = {
  success: boolean;
  data?: AuditLog[];
  pagination?: Pagination;
  filters?: AuditFilters;
  message?: string;
};

type AuditRecord = Record<
  string,
  unknown
>;

type AuditChange = {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
};

type EquipmentChange = {
  key: string;
  name: string;
  type: "added" | "removed" | "changed";
  fields: AuditChange[];
};

const ACTION_LABELS: Record<
  string,
  string
> = {
  CREATE: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  LOGIN: "Login",
  LOGOUT: "Logout",
  STOCK_ENTRY: "Entrada",
  STOCK_EXIT: "Saída",
  ALLOCATE: "Alocação",
  DEALLOCATE: "Devolução",
};

const ENTITY_LABELS: Record<
  string,
  string
> = {
  USER: "Usuários",
  CLIENT: "Clientes",
  PROJECT: "Projetos",
  EQUIPMENT: "Estoque",
  MACHINE: "Máquinas",
  MACHINE_COMPONENT:
    "Componentes",
  PURCHASE: "Compras",
  MOVEMENT: "Movimentações",
};

const FIELD_LABELS: Record<
  string,
  string
> = {
  name: "Nome",
  title: "Título",
  status: "Status",
  condition: "Condição",

  quantity: "Quantidade",
  allocatedQuantity:
    "Quantidade alocada",
  availableQuantity:
    "Quantidade disponível",
  damagedQuantity:
    "Quantidade danificada",
  returnedQuantity:
    "Quantidade devolvida",
  returnCondition:
    "Condição da devolução",

  category: "Categoria",
  manufacturer: "Fabricante",
  model: "Modelo",
  serialNumber:
    "Número de série",
  assetTag: "Patrimônio",
  invoiceNumber: "Nota fiscal",

  description: "Descrição",
  notes: "Observações",
  clientName: "Cliente",
  priority: "Prioridade",

  rmaStatus: "Status do RMA",
  rmaReference:
    "Referência do RMA",
  rmaNotes:
    "Observações do RMA",
  rmaResolutionNotes:
    "Resolução do RMA",
  replacementSerialNumber:
    "Série da substituição",

  receivedAt:
    "Data de recebimento",
  startDate:
    "Data de início",
  dueDate: "Prazo",
  completedAt:
    "Data de conclusão",
  stockDeductedAt:
    "Baixa de estoque",
  rmaOpenedAt:
    "Abertura do RMA",
  rmaClosedAt:
    "Encerramento do RMA",
  createdAt: "Criado em",
  updatedAt: "Atualizado em",

  equipment: "Equipamentos",
  components: "Componentes",
  componentCount:
    "Quantidade de componentes",

  physicalStock:
    "Estoque físico",
  reason:
    "Motivo do ajuste",
  difference: "Diferença",

  projectName: "Projeto",
  equipmentName: "Equipamento",
  missingQuantity:
    "Quantidade faltante",
  pendingQuantity:
    "Quantidade pendente",
  requiredQuantity:
    "Quantidade necessária",
  freeStockQuantity:
    "Estoque livre",
  entryQuantityForProject:
    "Entrada destinada ao projeto",
  currentAllocatedQuantity:
    "Quantidade alocada atual",
  previousAllocatedQuantity:
    "Quantidade alocada anterior",

  source: "Origem",
};

const AUDIT_VALUE_LABELS: Record<
  string,
  string
> = {
  AVAILABLE: "Disponível",
  UNAVAILABLE: "Indisponível",
  IN_USE: "Entregue",
  HOMOLOGATION: "Homologação",

  PLANNING: "Planejamento",
  PURCHASING: "Em compras",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",

  NEW: "Novo",
  USED: "Usado",
  REPAIRED: "Reparado",
  DAMAGED: "Danificado",

  NONE: "Nenhum",
  PENDING: "Pendente",
  SENT: "Enviado",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  RETURNED: "Retornado",
  REPLACED: "Substituído",

  NORMAL: "Normal",
  INSTALLED: "Instalado",

  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",

  INVENTORY_CORRECTION:
    "Correção de inventário",

  PROJECT_QUICK_CREATE:
    "Criação rápida no projeto",
};

const HIDDEN_AUDIT_FIELDS =
  new Set([
    "id",
    "userId",
    "clientId",
    "createdById",
    "responsibleId",
    "salespersonId",
    "equipmentId",
    "projectEquipmentId",
    "rmaReplacementEquipmentId",
    "componentEquipmentIds",
    "movementId",
    "projectId",
  ]);

const COMPONENT_DETAIL_FIELDS = [
  "model",
  "category",
  "manufacturer",
  "status",
  "quantity",
  "serialNumber",
] as const;

const EQUIPMENT_DETAIL_FIELDS = [
  "category",
  "manufacturer",
  "serialNumber",
  "quantity",
  "allocatedQuantity",
] as const;

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "medium",
    },
  ).format(new Date(value));
}

function getActionLabel(
  action: string,
) {
  return (
    ACTION_LABELS[action] ?? action
  );
}

function getEntityLabel(
  entity: string,
) {
  return (
    ENTITY_LABELS[entity] ?? entity
  );
}

function isAuditRecord(
  value: unknown,
): value is AuditRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getFieldLabel(
  field: string,
) {
  return (
    FIELD_LABELS[field] ?? field
  );
}

function isDateField(
  field: string,
) {
  return (
    field.endsWith("At") ||
    field.endsWith("Date")
  );
}

function formatAuditValue(
  field: string,
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    if (
      AUDIT_VALUE_LABELS[value]
    ) {
      return AUDIT_VALUE_LABELS[
        value
      ];
    }

    if (isDateField(field)) {
      const date = new Date(value);

      if (
        !Number.isNaN(
          date.getTime(),
        )
      ) {
        return formatDateTime(
          value,
        );
      }
    }

    return value;
  }

  if (Array.isArray(value)) {
    return `${value.length} ${
      value.length === 1
        ? "item"
        : "itens"
    }`;
  }

  if (isAuditRecord(value)) {
    return "Dados estruturados";
  }

  return String(value);
}

function valuesAreEqual(
  before: unknown,
  after: unknown,
) {
  return (
    JSON.stringify(before) ===
    JSON.stringify(after)
  );
}

function hasAuditValue(
  value: unknown,
) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ""
  );
}

function getAuditComponents(
  value: unknown,
): AuditRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    isAuditRecord,
  );
}

function getAuditEquipment(
  value: unknown,
): AuditRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    isAuditRecord,
  );
}

function getEquipmentKey(
  equipment: AuditRecord,
  index: number,
) {
  const projectEquipmentId =
    equipment.projectEquipmentId;

  if (
    typeof projectEquipmentId ===
      "string" &&
    projectEquipmentId.trim()
  ) {
    return `project:${projectEquipmentId}`;
  }

  const equipmentId =
    equipment.equipmentId;

  if (
    typeof equipmentId === "string" &&
    equipmentId.trim()
  ) {
    return `equipment:${equipmentId}`;
  }

  const equipmentName =
    equipment.equipmentName;

  if (
    typeof equipmentName ===
      "string" &&
    equipmentName.trim()
  ) {
    return `name:${equipmentName.trim()}`;
  }

  return `index:${index}`;
}

/*
 * Equipamentos de projeto são comparados pelo vínculo do projeto,
 * mas identificadores internos são usados somente para associação
 * e nunca são exibidos na interface de auditoria.
 */
function getEquipmentChanges(
  beforeValue: unknown,
  afterValue: unknown,
): EquipmentChange[] {
  const beforeEquipment =
    getAuditEquipment(beforeValue);

  const afterEquipment =
    getAuditEquipment(afterValue);

  const beforeMap = new Map(
    beforeEquipment.map(
      (equipment, index) => [
        getEquipmentKey(
          equipment,
          index,
        ),
        equipment,
      ],
    ),
  );

  const afterMap = new Map(
    afterEquipment.map(
      (equipment, index) => [
        getEquipmentKey(
          equipment,
          index,
        ),
        equipment,
      ],
    ),
  );

  const keys = Array.from(
    new Set([
      ...beforeMap.keys(),
      ...afterMap.keys(),
    ]),
  );

  return keys
    .map((key) => {
      const before =
        beforeMap.get(key) ?? {};

      const after =
        afterMap.get(key) ?? {};

      const existsBefore =
        beforeMap.has(key);

      const existsAfter =
        afterMap.has(key);

      const changeType:
        EquipmentChange["type"] =
          !existsBefore && existsAfter
            ? "added"
            : existsBefore &&
                !existsAfter
              ? "removed"
              : "changed";

      const nameSource =
        typeof after.equipmentName ===
          "string"
          ? after.equipmentName
          : typeof before.equipmentName ===
              "string"
            ? before.equipmentName
            : "Equipamento";

      const fields =
        EQUIPMENT_DETAIL_FIELDS
          .filter(
            (field) =>
              !valuesAreEqual(
                before[field],
                after[field],
              ),
          )
          .map((field) => ({
            field,
            label: getFieldLabel(
              field,
            ),
            before: before[field],
            after: after[field],
          }));

      return {
        key,
        name: nameSource,
        type: changeType,
        fields,
      };
    })
    .filter(
      (equipment) =>
        equipment.fields.length > 0,
    );
}

/*
 * A comparação omite identificadores internos e exibe somente campos
 * relevantes para a leitura administrativa do histórico de auditoria.
 */
function getAuditChanges(
  oldData: unknown,
  newData: unknown,
): AuditChange[] {
  const before = isAuditRecord(
    oldData,
  )
    ? oldData
    : {};

  const after = isAuditRecord(
    newData,
  )
    ? newData
    : {};

  const fields = Array.from(
    new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]),
  );

  return fields
    .filter(
      (field) =>
        !HIDDEN_AUDIT_FIELDS.has(
          field,
        ),
    )
    .filter((field) => {
      const beforeValue =
        before[field];

      const afterValue =
        after[field];

      const beforeIsEmpty =
        beforeValue === null ||
        beforeValue === undefined ||
        beforeValue === "";

      const afterIsEmpty =
        afterValue === null ||
        afterValue === undefined ||
        afterValue === "";

      /*
       * Valores ausentes e nulos são tratados como equivalentes para evitar
       * alterações artificiais como "— → —" em registros de criação/exclusão.
       */
      if (
        beforeIsEmpty &&
        afterIsEmpty
      ) {
        return false;
      }

      return !valuesAreEqual(
        beforeValue,
        afterValue,
      );
    })
    .map((field) => ({
      field,
      label: getFieldLabel(
        field,
      ),
      before: before[field],
      after: after[field],
    }));
}

function EquipmentAuditDetails({
  equipment,
}: {
  equipment: EquipmentChange;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          {equipment.name}
        </p>

        {equipment.type === "added" ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Equipamento adicionado
          </span>
        ) : equipment.type ===
          "removed" ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            Equipamento removido
          </span>
        ) : null}
      </div>

      {equipment.type ===
      "changed" ? (
        <div className="mt-3 space-y-3">
          {equipment.fields.map(
            (fieldChange) => (
              <div
                key={
                  fieldChange.field
                }
                className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(150px,0.8fr)_minmax(0,1fr)_40px_minmax(0,1fr)] md:items-center md:gap-4"
              >
                <p className="text-xs font-medium text-zinc-500">
                  {
                    fieldChange.label
                  }
                </p>

                <div className="rounded-lg bg-red-50/70 px-3 py-2 md:bg-transparent md:px-0 md:py-0">
                  <p className="text-xs font-medium text-zinc-500 md:hidden">
                    Antes
                  </p>

                  <p className="mt-1 break-words text-sm text-zinc-700 md:mt-0">
                    {formatAuditValue(
                      fieldChange.field,
                      fieldChange.before,
                    )}
                  </p>
                </div>

                <div
                  aria-hidden="true"
                  className="hidden text-center text-zinc-300 md:block"
                >
                  →
                </div>

                <div className="rounded-lg bg-emerald-50/70 px-3 py-2 md:bg-transparent md:px-0 md:py-0">
                  <p className="text-xs font-medium text-zinc-500 md:hidden">
                    Depois
                  </p>

                  <p className="mt-1 break-words text-sm font-medium text-zinc-900 md:mt-0">
                    {formatAuditValue(
                      fieldChange.field,
                      fieldChange.after,
                    )}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {equipment.fields.map(
            (fieldChange) => {
              const value =
                equipment.type ===
                "added"
                  ? fieldChange.after
                  : fieldChange.before;

              if (
                !hasAuditValue(
                  value,
                )
              ) {
                return null;
              }

              return (
                <div
                  key={
                    fieldChange.field
                  }
                  className="min-w-0"
                >
                  <dt className="text-xs text-zinc-500">
                    {
                      fieldChange.label
                    }
                  </dt>

                  <dd className="mt-0.5 break-words text-sm font-medium text-zinc-800">
                    {formatAuditValue(
                      fieldChange.field,
                      value,
                    )}
                  </dd>
                </div>
              );
            },
          )}
        </dl>
      )}
    </div>
  );
}

export default function AuditLogsView() {
  const [logs, setLogs] = useState<
    AuditLog[]
  >([]);

  const [
    pagination,
    setPagination,
  ] = useState<Pagination | null>(
    null,
  );

  const [
    auditUsers,
    setAuditUsers,
  ] = useState<AuditUser[]>([]);

  const [
    availableActions,
    setAvailableActions,
  ] = useState<string[]>([]);

  const [
    availableEntities,
    setAvailableEntities,
  ] = useState<string[]>([]);

  const [
    selectedLog,
    setSelectedLog,
  ] = useState<AuditLog | null>(
    null,
  );

const [page, setPage] = useState(1);

const [search, setSearch] =
  useState("");

const [
  debouncedSearch,
  setDebouncedSearch,
] = useState("");

const [userId, setUserId] =
  useState("");

  const [action, setAction] =
    useState("");

  const [entity, setEntity] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState<
    string | null
  >(null);

  /*
 * A pesquisa aguarda uma pequena pausa na digitação antes de consultar
 * a API, evitando uma nova requisição para cada tecla pressionada.
 */
useEffect(() => {
  const timeoutId =
    window.setTimeout(() => {
      setDebouncedSearch(
        search.trim(),
      );
      setPage(1);
    }, 400);

  return () => {
    window.clearTimeout(
      timeoutId,
    );
  };
}, [search]);

const hasActiveFilters =
  Boolean(
    search.trim() ||
      userId ||
      action ||
      entity ||
      fromDate ||
      toDate,
  );

  const selectedChanges =
    selectedLog
      ? getAuditChanges(
          selectedLog.oldData,
          selectedLog.newData,
        )
      : [];

  const equipmentChange =
    selectedChanges.find(
      (change) =>
        change.field === "equipment",
    );

  const equipmentChanges =
    equipmentChange
      ? getEquipmentChanges(
          equipmentChange.before,
          equipmentChange.after,
        )
      : [];

  /*
   * A apresentação do detalhe depende dos dados efetivamente registrados:
   * eventos com apenas um estado mostram Campo/Valor; alterações com os
   * dois estados continuam usando a comparação Antes/Depois.
   */
  const hasOldData = selectedLog
    ? isAuditRecord(
        selectedLog.oldData,
      ) &&
      Object.keys(
        selectedLog.oldData,
      ).length > 0
    : false;

  const hasNewData = selectedLog
    ? isAuditRecord(
        selectedLog.newData,
      ) &&
      Object.keys(
        selectedLog.newData,
      ).length > 0
    : false;

  const isSingleSidedAudit =
    hasOldData !== hasNewData;

  const auditDetailsTitle =
    selectedLog?.action === "CREATE"
      ? "Dados criados"
      : selectedLog?.action ===
          "DELETE"
        ? "Dados removidos"
        : selectedLog?.action ===
            "ALLOCATE"
          ? "Dados da alocação"
          : isSingleSidedAudit
            ? "Dados da operação"
            : "Alterações registradas";

  const auditDetailsDescription =
    selectedLog?.action === "CREATE"
      ? "Valores registrados na criação deste registro."
      : selectedLog?.action ===
          "DELETE"
        ? "Valores preservados no histórico antes da exclusão."
        : isSingleSidedAudit
          ? "Informações registradas durante esta operação."
          : "Compare o estado anterior com o estado posterior à ação.";

  const loadLogs = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const searchParams =
          new URLSearchParams({
            page: String(page),
            pageSize: "25",
          });
        
        if (debouncedSearch) {
          searchParams.set(
            "q",
            debouncedSearch,
          );
        }

        if (userId) {
          searchParams.set(
            "userId",
            userId,
          );
        }

        if (action) {
          searchParams.set(
            "action",
            action,
          );
        }

        if (entity) {
          searchParams.set(
            "entity",
            entity,
          );
        }

        if (fromDate) {
          searchParams.set(
            "from",
            `${fromDate}T00:00:00`,
          );
        }

        if (toDate) {
          searchParams.set(
            "to",
            `${toDate}T23:59:59.999`,
          );
        }

        const response = await fetch(
          `/api/audit-logs?${searchParams.toString()}`,
          {
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as AuditLogsResponse;

        if (
          !response.ok ||
          !result.success ||
          !result.data ||
          !result.pagination
        ) {
          throw new Error(
            result.message ??
              "Não foi possível carregar os logs.",
          );
        }

        setLogs(result.data);
        setPagination(
          result.pagination,
        );

        if (result.filters) {
          setAuditUsers(
            result.filters.users,
          );

          setAvailableActions(
            result.filters.actions,
          );

          setAvailableEntities(
            result.filters.entities,
          );
        }
      } catch (loadError) {
        console.error(
          "Erro ao carregar logs de auditoria:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os logs.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      debouncedSearch,
      userId,
      action,
      entity,
      fromDate,
      toDate,
    ],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setUserId("");
    setAction("");
    setEntity("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function exportCsv() {
  const searchParams =
    new URLSearchParams();

  /*
   * A exportação reutiliza exatamente os filtros aplicados na tela,
   * mas não envia paginação porque o CSV deve conter todo o resultado filtrado.
   */
  if (debouncedSearch) {
    searchParams.set(
      "q",
      debouncedSearch,
    );
  }

  if (userId) {
    searchParams.set(
      "userId",
      userId,
    );
  }

  if (action) {
    searchParams.set(
      "action",
      action,
    );
  }

  if (entity) {
    searchParams.set(
      "entity",
      entity,
    );
  }

  if (fromDate) {
    searchParams.set(
      "from",
      `${fromDate}T00:00:00`,
    );
  }

  if (toDate) {
    searchParams.set(
      "to",
      `${toDate}T23:59:59.999`,
    );
  }

  const queryString =
    searchParams.toString();

  window.location.href = queryString
    ? `/api/audit-logs/export?${queryString}`
    : "/api/audit-logs/export";
}

  function renderEquipmentChanges() {
    if (
      equipmentChanges.length === 0
    ) {
      return null;
    }

    return (
      <div className="px-4 py-4">
        <p className="text-sm font-semibold text-zinc-900">
          Equipamentos
        </p>

        <div className="mt-3 divide-y divide-zinc-200">
          {equipmentChanges.map(
            (equipment) => (
              <EquipmentAuditDetails
                key={equipment.key}
                equipment={equipment}
              />
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
<div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-zinc-900">
        Histórico de auditoria
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        Ações registradas no sistema,
        das mais recentes para as mais
        antigas.
      </p>
    </div>

    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
      {pagination ? (
        <p className="text-xs font-medium text-zinc-500">
          {pagination.total}{" "}
          {pagination.total === 1
            ? "registro"
            : "registros"}
        </p>
      ) : null}

      <button
        type="button"
        onClick={exportCsv}
        disabled={
          loading ||
          Boolean(error) ||
          !pagination ||
          pagination.total === 0
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>

        Exportar CSV
      </button>
    </div>
  </div>
</div>

        {/*
         * Os filtros são refletidos diretamente na consulta paginada.
         * Qualquer alteração volta para a primeira página para evitar
         * solicitar uma página inexistente no novo conjunto filtrado.
         */}
        <div className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Filtros
              </h3>

              <p className="mt-0.5 text-xs text-zinc-500">
                Refine o histórico de
                auditoria.
              </p>
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          <div className="mb-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Pesquisar no histórico
              </span>

              <div className="relative">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />

                  <path d="m20 20-3.5-3.5" />
                </svg>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Serial, equipamento, projeto, cliente ou descrição..."
                  autoComplete="off"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <p className="mt-1.5 text-xs text-zinc-500">
                Pesquise também por informações
                registradas nos detalhes da
                auditoria.
              </p>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Usuário
              </span>

              <select
                value={userId}
                onChange={(event) => {
                  setUserId(
                    event.target.value,
                  );
                  resetPage();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Todos os usuários
                </option>

                {auditUsers.map(
                  (user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name} (
                      {user.username})
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Ação
              </span>

              <select
                value={action}
                onChange={(event) => {
                  setAction(
                    event.target.value,
                  );
                  resetPage();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Todas as ações
                </option>

                {availableActions.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {getActionLabel(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Módulo
              </span>

              <select
                value={entity}
                onChange={(event) => {
                  setEntity(
                    event.target.value,
                  );
                  resetPage();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  Todos os módulos
                </option>

                {availableEntities.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {getEntityLabel(
                        value,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Data inicial
              </span>

              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => {
                  setFromDate(
                    event.target.value,
                  );
                  resetPage();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Data final
              </span>

              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  setToDate(
                    event.target.value,
                  );
                  resetPage();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Carregando logs...
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                void loadLogs();
              }}
              className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Tentar novamente
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">
              Nenhum registro encontrado.
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Tente alterar ou limpar os
              filtros utilizados.
            </p>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/*
             * Mantemos tabela em telas maiores e cards no mobile para
             * preservar a legibilidade sem depender de rolagem horizontal.
             */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Data / hora
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Usuário
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Ação
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Módulo
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Descrição
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100 bg-white">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() =>
                        setSelectedLog(log)
                      }
                      className="cursor-pointer transition hover:bg-zinc-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-zinc-600">
                        {formatDateTime(
                          log.createdAt,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-sm font-medium text-zinc-900">
                          {log.user?.name ??
                            "Usuário removido"}
                        </p>

                        {log.user ? (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {
                              log.user
                                .username
                            }
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {getActionLabel(
                            log.action,
                          )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-zinc-700">
                        {getEntityLabel(
                          log.entity,
                        )}
                      </td>

                      <td className="max-w-[420px] px-5 py-4">
                        <p
                          className="truncate text-sm text-zinc-700"
                          title={
                            log.description
                          }
                        >
                          {log.description}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-100 md:hidden">
              {logs.map((log) => (
                <article
                  key={log.id}
                  onClick={() =>
                    setSelectedLog(log)
                  }
                  className="cursor-pointer px-4 py-4 transition active:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {log.user?.name ??
                          "Usuário removido"}
                      </p>

                      {log.user ? (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {
                            log.user
                              .username
                          }
                        </p>
                      ) : null}
                    </div>

                    <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                      {getActionLabel(
                        log.action,
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>
                      {formatDateTime(
                        log.createdAt,
                      )}
                    </span>

                    <span
                      aria-hidden="true"
                      className="text-zinc-300"
                    >
                      •
                    </span>

                    <span className="font-medium text-zinc-600">
                      {getEntityLabel(
                        log.entity,
                      )}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-zinc-700">
                    {log.description}
                  </p>

                  <p className="mt-3 text-xs font-semibold text-blue-600">
                    Ver detalhes
                  </p>
                </article>
              ))}
            </div>

            {pagination &&
            pagination.totalPages > 1 ? (
              <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-sm text-zinc-500">
                  Página{" "}
                  <span className="font-medium text-zinc-700">
                    {pagination.page}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-zinc-700">
                    {
                      pagination.totalPages
                    }
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    disabled={
                      !pagination.hasPreviousPage
                    }
                    onClick={() =>
                      setPage(
                        (currentPage) =>
                          Math.max(
                            1,
                            currentPage - 1,
                          ),
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                  >
                    Anterior
                  </button>

                  <button
                    type="button"
                    disabled={
                      !pagination.hasNextPage
                    }
                    onClick={() =>
                      setPage(
                        (currentPage) =>
                          currentPage + 1,
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {selectedLog ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-log-details-title"
          onClick={() =>
            setSelectedLog(null)
          }
        >
          {/*
           * O conteúdo do modal impede a propagação do clique para que
           * somente o backdrop ou o botão Fechar encerrem os detalhes.
           */}
          <div
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-5xl sm:rounded-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Auditoria
                </p>

                <h2
                  id="audit-log-details-title"
                  className="mt-1 text-lg font-semibold text-zinc-900"
                >
                  Detalhes do registro
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Informações registradas
                  no momento da ação.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedLog(null)
                }
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <div className="overflow-y-auto">
              <div className="border-b border-zinc-200 px-4 py-5 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      Data / hora
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {formatDateTime(
                        selectedLog.createdAt,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      Usuário
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {selectedLog.user
                        ?.name ??
                        "Usuário removido"}
                    </p>

                    {selectedLog.user ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {
                          selectedLog.user
                            .username
                        }
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      Ação
                    </p>

                    <div className="mt-1">
                      <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {getActionLabel(
                          selectedLog.action,
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      Módulo
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {getEntityLabel(
                        selectedLog.entity,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-medium text-zinc-500">
                    Descrição
                  </p>

                  <p className="mt-1 break-words text-sm leading-6 text-zinc-800">
                    {
                      selectedLog.description
                    }
                  </p>
                </div>
              </div>

              <div className="px-4 py-5 sm:px-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {auditDetailsTitle}
                  </h3>

                  <p className="mt-1 text-xs text-zinc-500">
                    {
                      auditDetailsDescription
                    }
                  </p>
                </div>

                {selectedChanges.length >
                0 ? (
                  isSingleSidedAudit ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-200">
                      <div className="grid grid-cols-[minmax(140px,0.8fr)_minmax(0,1.5fr)] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)]">
                        <span>
                          Campo
                        </span>

                        <span>
                          Valor
                        </span>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {selectedChanges.map(
                          (change) => {
                            const value =
                              hasNewData
                                ? change.after
                                : change.before;

                            if (
                              change.field ===
                                "equipment" &&
                              equipmentChanges.length >
                                0
                            ) {
                              return renderEquipmentChanges();
                            }

                            const components =
                              change.field ===
                              "components"
                                ? getAuditComponents(
                                    value,
                                  )
                                : [];

                            return (
                              <div
                                key={
                                  change.field
                                }
                                className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)] sm:gap-4"
                              >
                                <p className="text-sm font-semibold text-zinc-900">
                                  {
                                    change.label
                                  }
                                </p>

                                {change.field ===
                                  "components" &&
                                components.length >
                                  0 ? (
                                  <div className="min-w-0">
                                    <p className="mb-4 text-xs font-medium text-zinc-500">
                                      {
                                        components.length
                                      }{" "}
                                      {components.length ===
                                      1
                                        ? "componente registrado"
                                        : "componentes registrados"}
                                    </p>

                                    <div className="divide-y divide-zinc-200">
                                      {components.map(
                                        (
                                          component,
                                          index,
                                        ) => {
                                          const componentName =
                                            typeof component.name ===
                                              "string" &&
                                            component.name.trim()
                                              ? component.name
                                              : `Componente ${
                                                  index +
                                                  1
                                                }`;

                                          return (
                                            <div
                                              key={`${componentName}-${index}`}
                                              className="py-4 first:pt-0 last:pb-0"
                                            >
                                              <p className="text-sm font-semibold text-zinc-900">
                                                {
                                                  componentName
                                                }
                                              </p>

                                              <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                                                {COMPONENT_DETAIL_FIELDS.map(
                                                  (
                                                    field,
                                                  ) => {
                                                    const fieldValue =
                                                      component[
                                                        field
                                                      ];

                                                    if (
                                                      !hasAuditValue(
                                                        fieldValue,
                                                      )
                                                    ) {
                                                      return null;
                                                    }

                                                    return (
                                                      <div
                                                        key={
                                                          field
                                                        }
                                                        className="min-w-0"
                                                      >
                                                        <dt className="text-xs text-zinc-500">
                                                          {getFieldLabel(
                                                            field,
                                                          )}
                                                        </dt>

                                                        <dd className="mt-0.5 break-words text-sm text-zinc-800">
                                                          {formatAuditValue(
                                                            field,
                                                            fieldValue,
                                                          )}
                                                        </dd>
                                                      </div>
                                                    );
                                                  },
                                                )}
                                              </dl>
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="min-w-0 break-words text-sm text-zinc-700">
                                    {formatAuditValue(
                                      change.field,
                                      value,
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-200">
                      <div className="hidden grid-cols-[minmax(160px,0.8fr)_minmax(0,1fr)_40px_minmax(0,1fr)] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
                        <span>
                          Campo
                        </span>

                        <span>
                          Antes
                        </span>

                        <span />

                        <span>
                          Depois
                        </span>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {selectedChanges.map(
                          (change) => {
                            /*
                             * Arrays de equipamentos precisam de comparação interna.
                             * Assim, uma alteração em um item não é reduzida a algo
                             * genérico como "2 itens → 2 itens".
                             */
                            if (
                              change.field ===
                                "equipment" &&
                              equipmentChanges.length >
                                0
                            ) {
                              return renderEquipmentChanges();
                            }

                            return (
                              <div
                                key={
                                  change.field
                                }
                                className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(160px,0.8fr)_minmax(0,1fr)_40px_minmax(0,1fr)] md:items-center md:gap-4"
                              >
                                <div>
                                  <p className="text-xs font-medium text-zinc-500 md:hidden">
                                    Campo
                                  </p>

                                  <p className="mt-0.5 text-sm font-semibold text-zinc-900 md:mt-0">
                                    {
                                      change.label
                                    }
                                  </p>
                                </div>

                                <div className="min-w-0 rounded-lg bg-red-50/70 px-3 py-2 md:bg-transparent md:px-0 md:py-0">
                                  <p className="text-xs font-medium text-zinc-500 md:hidden">
                                    Antes
                                  </p>

                                  <p className="mt-1 break-words text-sm text-zinc-700 md:mt-0">
                                    {formatAuditValue(
                                      change.field,
                                      change.before,
                                    )}
                                  </p>
                                </div>

                                <div
                                  aria-hidden="true"
                                  className="hidden text-center text-zinc-300 md:block"
                                >
                                  →
                                </div>

                                <div className="min-w-0 rounded-lg bg-emerald-50/70 px-3 py-2 md:bg-transparent md:px-0 md:py-0">
                                  <p className="text-xs font-medium text-zinc-500 md:hidden">
                                    Depois
                                  </p>

                                  <p className="mt-1 break-words text-sm font-medium text-zinc-900 md:mt-0">
                                    {formatAuditValue(
                                      change.field,
                                      change.after,
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-zinc-200 px-4 py-8 text-center">
                    <p className="text-sm text-zinc-500">
                      Não há dados
                      adicionais para
                      exibir neste
                      registro.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}