import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EQUIPMENT_QUANTITY = 999999;

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

/*
 * Ordem utilizada para disputar
 * estoque entre projetos ativos.
 *
 * Quanto menor o valor, maior
 * a prioridade.
 */
const PROJECT_STATUS_WEIGHT: Record<
  ProjectStatus,
  number
> = {
  [ProjectStatus.IN_PROGRESS]: 0,
  [ProjectStatus.PLANNING]: 1,
  [ProjectStatus.COMPLETED]: 2,
  [ProjectStatus.CANCELLED]: 3,
};

const PROJECT_PRIORITY_WEIGHT: Record<
  ProjectPriority,
  number
> = {
  [ProjectPriority.URGENT]: 0,
  [ProjectPriority.HIGH]: 1,
  [ProjectPriority.NORMAL]: 2,
  [ProjectPriority.LOW]: 3,
};

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

type SessionUser = {
  id?: string;
  role?: UserRole;
};

type ProjectEquipmentBody = {
  equipmentId?: unknown;
  quantity?: unknown;
  notes?: unknown;
};

type NormalizedProjectEquipment = {
  equipmentId: string;
  quantity: number;
  notes: string | null;
};

type ProjectBody = {
  name?: unknown;

  clientId?: unknown;
  clientName?: unknown;

  description?: unknown;
  status?: unknown;
  priority?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  completedAt?: unknown;
  notes?: unknown;
  responsibleId?: unknown;
  salespersonId?: unknown;

  equipment?: unknown;
  equipments?: unknown;
};

type ProjectStockAllocation = {
  availableBeforeProject: number;
  coveredByStock: number;
  availableAfterProject: number;
  shortage: number;
};

const projectPersonSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  active: true,
} satisfies Prisma.UserSelect;

const projectInclude = {
  createdBy: {
    select: projectPersonSelect,
  },

  responsible: {
    select: projectPersonSelect,
  },

  salesperson: {
    select: projectPersonSelect,
  },

  client: {
    select: {
      id: true,
      clientCode: true,
      shortName: true,
      name: true,
      contactName: true,
      active: true,
    },
  },

  equipment: {
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          quantity: true,
          minimumStock: true,
          status: true,
          condition: true,

          images: {
            orderBy: {
              position: "asc" as const,
            },

            take: 1,
          },
        },
      },
    },

    orderBy: {
      createdAt: "asc" as const,
    },
  },

  _count: {
    select: {
      equipment: true,
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations =
  Prisma.ProjectGetPayload<{
    include: typeof projectInclude;
  }>;

function requiredText(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `O campo "${label}" é obrigatório.`,
    );
  }

  return value.trim();
}

function optionalText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text || null;
}

function optionalId(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();

  return id || null;
}

function optionalDate(
  value: unknown,
  label: string,
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `O campo "${label}" possui uma data inválida.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `O campo "${label}" possui uma data inválida.`,
    );
  }

  return date;
}

function parseStatus(
  value: unknown,
): ProjectStatus {
  if (
    typeof value === "string" &&
    Object.values(ProjectStatus).includes(
      value as ProjectStatus,
    )
  ) {
    return value as ProjectStatus;
  }

  return ProjectStatus.PLANNING;
}

function parsePriority(
  value: unknown,
): ProjectPriority {
  if (
    typeof value === "string" &&
    Object.values(ProjectPriority).includes(
      value as ProjectPriority,
    )
  ) {
    return value as ProjectPriority;
  }

  return ProjectPriority.NORMAL;
}

function isProjectStatus(
  value: string | null,
): value is ProjectStatus {
  return (
    value !== null &&
    Object.values(ProjectStatus).includes(
      value as ProjectStatus,
    )
  );
}

function isProjectPriority(
  value: string | null,
): value is ProjectPriority {
  return (
    value !== null &&
    Object.values(ProjectPriority).includes(
      value as ProjectPriority,
    )
  );
}

function canManageProjects(
  role: UserRole | undefined,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE" ||
    role === "COMMERCIAL"
  );
}

function parseEquipmentQuantity(
  value: unknown,
  equipmentIndex: number,
): number {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity >
      MAX_EQUIPMENT_QUANTITY
  ) {
    throw new Error(
      `A quantidade do equipamento ${
        equipmentIndex + 1
      } deve ser um número inteiro entre 1 e ${MAX_EQUIPMENT_QUANTITY}.`,
    );
  }

  return quantity;
}

function parseProjectEquipment(
  body: ProjectBody,
): NormalizedProjectEquipment[] {
  const receivedEquipment =
    body.equipment ??
    body.equipments;

  if (
    receivedEquipment ===
      undefined ||
    receivedEquipment === null
  ) {
    return [];
  }

  if (
    !Array.isArray(
      receivedEquipment,
    )
  ) {
    throw new Error(
      'O campo "equipment" deve ser uma lista de equipamentos.',
    );
  }

  /*
   * Evita equipamentos duplicados
   * no mesmo projeto.
   *
   * Caso o mesmo equipmentId seja
   * recebido mais de uma vez,
   * somamos as quantidades.
   */
  const equipmentMap =
    new Map<
      string,
      NormalizedProjectEquipment
    >();

  receivedEquipment.forEach(
    (
      rawItem: unknown,
      index: number,
    ) => {
      if (
        typeof rawItem !==
          "object" ||
        rawItem === null ||
        Array.isArray(rawItem)
      ) {
        throw new Error(
          `O equipamento ${
            index + 1
          } possui um formato inválido.`,
        );
      }

      const item =
        rawItem as ProjectEquipmentBody;

      const equipmentId =
        requiredText(
          item.equipmentId,
          `Equipamento ${
            index + 1
          }`,
        );

      const quantity =
        parseEquipmentQuantity(
          item.quantity,
          index,
        );

      const notes =
        optionalText(
          item.notes,
        );

      const existingItem =
        equipmentMap.get(
          equipmentId,
        );

      if (existingItem) {
        const mergedQuantity =
          existingItem.quantity +
          quantity;

        if (
          mergedQuantity >
          MAX_EQUIPMENT_QUANTITY
        ) {
          throw new Error(
            `A quantidade total de um equipamento não pode ultrapassar ${MAX_EQUIPMENT_QUANTITY}.`,
          );
        }

        equipmentMap.set(
          equipmentId,
          {
            equipmentId,

            quantity:
              mergedQuantity,

            notes:
              existingItem.notes ??
              notes,
          },
        );

        return;
      }

      equipmentMap.set(
        equipmentId,
        {
          equipmentId,
          quantity,
          notes,
        },
      );
    },
  );

  return Array.from(
    equipmentMap.values(),
  );
}

async function validateActiveUser(
  userId: string | null,
  label: string,
  allowedRoles?: UserRole[],
): Promise<void> {
  if (!userId) {
    return;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        active: true,
        role: true,
      },
    });

  if (!user) {
    throw new Error(
      `O ${label} selecionado não foi encontrado.`,
    );
  }

  if (!user.active) {
    throw new Error(
      `O ${label} selecionado está inativo.`,
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(
      user.role as UserRole,
    )
  ) {
    throw new Error(
      `O ${label} selecionado não possui um perfil permitido.`,
    );
  }
}

function getProjectEquipmentKey(
  projectId: string,
  equipmentId: string,
): string {
  return `${projectId}:${equipmentId}`;
}

/*
 * Monta a distribuição GLOBAL do
 * estoque entre projetos ativos.
 *
 * Isso é importante porque o mesmo
 * estoque não pode ser contado duas
 * vezes.
 *
 * Exemplo:
 *
 * Estoque = 5
 *
 * Projeto A precisa 5
 * Projeto B precisa 5
 *
 * Resultado:
 *
 * A -> coberto 5 / déficit 0
 * B -> coberto 0 / déficit 5
 *
 * e nunca:
 *
 * A -> déficit 0
 * B -> déficit 0
 */
async function buildStockAllocation(
  projects: ProjectWithRelations[],
): Promise<
  Map<
    string,
    ProjectStockAllocation
  >
> {
  const equipmentIds =
    Array.from(
      new Set(
        projects.flatMap(
          (project) =>
            project.equipment.map(
              (item) =>
                item.equipmentId,
            ),
        ),
      ),
    );

  if (
    equipmentIds.length === 0
  ) {
    return new Map();
  }

  /*
   * Buscamos o estoque diretamente
   * do cadastro do equipamento.
   */
  const [
    equipmentRecords,
    activeProjectEquipment,
  ] = await Promise.all([
    prisma.equipment.findMany({
      where: {
        id: {
          in: equipmentIds,
        },
      },

      select: {
        id: true,
        quantity: true,
      },
    }),

    /*
     * IMPORTANTE:
     *
     * Mesmo se a listagem atual estiver
     * filtrada para somente um projeto,
     * precisamos considerar TODOS os
     * projetos ativos que disputam o
     * mesmo equipamento.
     */
    prisma.projectEquipment.findMany({
      where: {
        equipmentId: {
          in: equipmentIds,
        },

        project: {
          status: {
            in:
              ACTIVE_PROJECT_STATUSES,
          },
        },
      },

      select: {
        projectId: true,
        equipmentId: true,
        quantity: true,
        allocatedQuantity:
          true,

        project: {
          select: {
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const remainingStockByEquipment =
    new Map<string, number>(
      equipmentRecords.map(
        (equipment) => [
          equipment.id,

          Math.max(
            equipment.quantity,
            0,
          ),
        ],
      ),
    );

  /*
   * Ordem determinística de
   * atendimento:
   *
   * 1. Em andamento;
   * 2. Planejamento;
   * 3. Prioridade;
   * 4. Prazo mais próximo;
   * 5. Projeto mais antigo;
   * 6. ID como desempate.
   */
  const orderedDemand =
    [
      ...activeProjectEquipment,
    ].sort(
      (left, right) => {
        const statusDifference =
          PROJECT_STATUS_WEIGHT[
            left.project.status
          ] -
          PROJECT_STATUS_WEIGHT[
            right.project.status
          ];

        if (
          statusDifference !== 0
        ) {
          return statusDifference;
        }

        const priorityDifference =
          PROJECT_PRIORITY_WEIGHT[
            left.project.priority
          ] -
          PROJECT_PRIORITY_WEIGHT[
            right.project.priority
          ];

        if (
          priorityDifference !== 0
        ) {
          return priorityDifference;
        }

        const leftDueDate =
          left.project.dueDate
            ?.getTime() ??
          Number.MAX_SAFE_INTEGER;

        const rightDueDate =
          right.project.dueDate
            ?.getTime() ??
          Number.MAX_SAFE_INTEGER;

        if (
          leftDueDate !==
          rightDueDate
        ) {
          return (
            leftDueDate -
            rightDueDate
          );
        }

        const createdDifference =
          left.project.createdAt.getTime() -
          right.project.createdAt.getTime();

        if (
          createdDifference !== 0
        ) {
          return createdDifference;
        }

        return left.projectId.localeCompare(
          right.projectId,
        );
      },
    );

  const allocation =
    new Map<
      string,
      ProjectStockAllocation
    >();

  for (
    const item of
    orderedDemand
  ) {
    /*
     * quantity:
     * necessidade total.
     *
     * allocatedQuantity:
     * quantidade que já teve
     * baixa física.
     *
     * Portanto, somente a diferença
     * ainda disputa o estoque atual.
     */
    const pendingQuantity =
      Math.max(
        item.quantity -
          item.allocatedQuantity,
        0,
      );

    const availableBeforeProject =
      Math.max(
        remainingStockByEquipment.get(
          item.equipmentId,
        ) ?? 0,
        0,
      );

    const coveredByStock =
      Math.min(
        pendingQuantity,
        availableBeforeProject,
      );

    const availableAfterProject =
      Math.max(
        availableBeforeProject -
          coveredByStock,
        0,
      );

    const shortage =
      Math.max(
        pendingQuantity -
          coveredByStock,
        0,
      );

    remainingStockByEquipment.set(
      item.equipmentId,
      availableAfterProject,
    );

    allocation.set(
      getProjectEquipmentKey(
        item.projectId,
        item.equipmentId,
      ),
      {
        availableBeforeProject,
        coveredByStock,
        availableAfterProject,
        shortage,
      },
    );
  }

  return allocation;
}

function serializeProject(
  project: ProjectWithRelations,
  stockAllocation:
    Map<
      string,
      ProjectStockAllocation
    >,
) {
  let neededUnits = 0;

  let physicalStockUnits = 0;

  let availableUnits = 0;

  let shortageUnits = 0;

  let equipmentWithShortage = 0;

  let outOfStockItems = 0;

  const projectIsActive =
    ACTIVE_PROJECT_STATUSES.includes(
      project.status,
    );

  const equipment =
    project.equipment.map(
      (item) => {
        /*
         * equipment.quantity é o
         * estoque operacional atual.
         */
        const physicalStock =
          Math.max(
            item.equipment.quantity,
            0,
          );

        /*
         * Necessidade total registrada
         * neste projeto.
         */
        const needed =
          Math.max(
            item.quantity,
            0,
          );

        /*
         * Quantidade que já teve
         * baixa física real.
         */
        const allocatedQuantity =
          Math.max(
            item.allocatedQuantity,
            0,
          );

        /*
         * Necessidade que ainda precisa
         * ser atendida.
         */
        const pendingAllocationQuantity =
          Math.max(
            needed -
              allocatedQuantity,
            0,
          );

        const allocation =
          projectIsActive
            ? stockAllocation.get(
                getProjectEquipmentKey(
                  project.id,
                  item.equipmentId,
                ),
              )
            : undefined;

        /*
         * Quantidade do estoque atual
         * que consegue cobrir a parte
         * ainda pendente deste projeto.
         */
        const coveredByStock =
          projectIsActive
            ? allocation
                ?.coveredByStock ??
              0
            : 0;

        /*
         * Total considerado atendido:
         *
         * baixa física anterior
         * +
         * estoque atual reservado
         * virtualmente pela distribuição.
         */
        const assignedFromStock =
          Math.min(
            needed,
            allocatedQuantity +
              coveredByStock,
          );

        /*
         * Projetos não ativos não entram
         * na disputa de estoque nem
         * exibem déficit operacional.
         */
        const shortage =
          projectIsActive
            ? allocation
                ?.shortage ??
              pendingAllocationQuantity
            : 0;

        const availableForProject =
          projectIsActive
            ? allocation
                ?.availableBeforeProject ??
              0
            : physicalStock;

        const availableAfterProject =
          projectIsActive
            ? allocation
                ?.availableAfterProject ??
              0
            : physicalStock;

        const hasShortage =
          shortage > 0;

        const isOutOfStock =
          physicalStock === 0;

        neededUnits +=
          needed;

        physicalStockUnits +=
          physicalStock;

        availableUnits +=
          assignedFromStock;

        shortageUnits +=
          shortage;

        if (hasShortage) {
          equipmentWithShortage +=
            1;
        }

        if (isOutOfStock) {
          outOfStockItems +=
            1;
        }

        return {
          ...item,

          needed,

          allocatedQuantity,

          pendingAllocationQuantity,

          hasAllocatedQuantity:
            allocatedQuantity > 0,

          physicalStock,

          availableForProject,

          assignedFromStock,

          availableAfterProject,

          shortage,

          hasShortage,

          isOutOfStock,

          isBelowMinimum:
            physicalStock <=
            item.equipment.minimumStock,
        };
      },
    );

  return {
    ...project,

    equipment,

    equipmentItems:
      project._count.equipment,

    /*
     * Necessidade total do projeto.
     */
    neededUnits,

    /*
     * Mantido por compatibilidade
     * com componentes antigos.
     */
    reservedUnits:
      neededUnits,

    physicalStockUnits,

    /*
     * Quantidade do projeto que está
     * coberta por baixa anterior ou
     * pelo estoque operacional atual.
     */
    availableUnits,

    shortageUnits,

    equipmentWithShortage,

    outOfStockItems,

    hasShortage:
      shortageUnits > 0,
  };
}

function serializeProjectForAudit(
  project: ProjectWithRelations,
): Prisma.InputJsonValue {
  return {
    id:
      project.id,

    name:
      project.name,

    clientId:
      project.clientId,

    clientName:
      project.clientName,

    description:
      project.description,

    status:
      project.status,

    priority:
      project.priority,

    startDate:
      project.startDate
        ?.toISOString() ??
      null,

    dueDate:
      project.dueDate
        ?.toISOString() ??
      null,

    completedAt:
      project.completedAt
        ?.toISOString() ??
      null,

    notes:
      project.notes,

    createdById:
      project.createdById,

    responsibleId:
      project.responsibleId,

    salespersonId:
      project.salespersonId,

    equipment:
      project.equipment.map(
        (item) => ({
          equipmentId:
            item.equipment.id,

          equipmentName:
            item.equipment.name,

          category:
            item.equipment.category,

          manufacturer:
            item.equipment
              .manufacturer,

          model:
            item.equipment.model,

          serialNumber:
            item.equipment
              .serialNumber,

          quantity:
            item.quantity,

          allocatedQuantity:
            item.allocatedQuantity,

          notes:
            item.notes,
        }),
      ),

    createdAt:
      project.createdAt.toISOString(),

    updatedAt:
      project.updatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
) {
  const session =
    await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message:
          "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const {
      searchParams,
    } = new URL(
      request.url,
    );

    const search =
      searchParams
        .get("search")
        ?.trim() ??
      "";

    const status =
      searchParams.get(
        "status",
      );

    const priority =
      searchParams.get(
        "priority",
      );

    const responsibleId =
      searchParams
        .get(
          "responsibleId",
        )
        ?.trim() ??
      "";

    const salespersonId =
      searchParams
        .get(
          "salespersonId",
        )
        ?.trim() ??
      "";

    const where:
      Prisma.ProjectWhereInput =
      {
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  clientName: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  description: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },

                {
                  responsible: {
                    name: {
                      contains:
                        search,

                      mode:
                        "insensitive",
                    },
                  },
                },

                {
                  salesperson: {
                    name: {
                      contains:
                        search,

                      mode:
                        "insensitive",
                    },
                  },
                },

                {
                  createdBy: {
                    name: {
                      contains:
                        search,

                      mode:
                        "insensitive",
                    },
                  },
                },
              ],
            }
          : {}),

        ...(isProjectStatus(
          status,
        )
          ? {
              status,
            }
          : {}),

        ...(isProjectPriority(
          priority,
        )
          ? {
              priority,
            }
          : {}),

        ...(responsibleId
          ? {
              responsibleId,
            }
          : {}),

        ...(salespersonId
          ? {
              salespersonId,
            }
          : {}),
      };

    const [
      projects,
      groupedStatus,
    ] =
      await Promise.all([
        prisma.project.findMany({
          where,

          include:
            projectInclude,

          orderBy: [
            {
              createdAt:
                "desc",
            },

            {
              name:
                "asc",
            },
          ],
        }),

        prisma.project.groupBy({
          by: [
            "status",
          ],

          _count: {
            _all:
              true,
          },
        }),
      ]);

    /*
     * Aqui está a correção principal:
     *
     * antes de serializar cada projeto
     * isoladamente, distribuímos o
     * estoque globalmente entre todos
     * os projetos ativos.
     */
    const stockAllocation =
      await buildStockAllocation(
        projects,
      );

    const data =
      projects.map(
        (project) =>
          serializeProject(
            project,
            stockAllocation,
          ),
      );

    const summary = {
      total: 0,

      planning: 0,

      inProgress: 0,

      completed: 0,

      cancelled: 0,

      totalNeededUnits: 0,

      totalShortageUnits: 0,

      projectsWithShortage: 0,
    };

    for (
      const item of
      groupedStatus
    ) {
      const quantity =
        item._count._all;

      summary.total +=
        quantity;

      if (
        item.status ===
        ProjectStatus.PLANNING
      ) {
        summary.planning =
          quantity;
      }

      if (
        item.status ===
        ProjectStatus.IN_PROGRESS
      ) {
        summary.inProgress =
          quantity;
      }

      if (
        item.status ===
        ProjectStatus.COMPLETED
      ) {
        summary.completed =
          quantity;
      }

      if (
        item.status ===
        ProjectStatus.CANCELLED
      ) {
        summary.cancelled =
          quantity;
      }
    }

    for (
      const project of
      data
    ) {
      summary.totalNeededUnits +=
        project.neededUnits;

      summary.totalShortageUnits +=
        project.shortageUnits;

      if (
        project.hasShortage
      ) {
        summary.projectsWithShortage +=
          1;
      }
    }

    return Response.json({
      success: true,

      data,

      total:
        data.length,

      summary,
    });
  } catch (error) {
    console.error(
      "Erro ao listar projetos:",
      error,
    );

    return Response.json(
      {
        success: false,

        message:
          "Não foi possível carregar os projetos.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  const session =
    await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,

        message:
          "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const sessionUser =
    session.user as SessionUser;

  if (
    !canManageProjects(
      sessionUser.role,
    )
  ) {
    return Response.json(
      {
        success: false,

        message:
          "Você não possui permissão para criar projetos.",
      },
      {
        status: 403,
      },
    );
  }

  if (
    !sessionUser.id
  ) {
    return Response.json(
      {
        success: false,

        message:
          "Não foi possível identificar o usuário autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body =
      (await request.json()) as ProjectBody;

    const name =
      requiredText(
        body.name,
        "Nome do projeto",
      );

    const clientId =
      optionalId(
        body.clientId,
      );

    let clientName =
      optionalText(
        body.clientName,
      );

    const createdById =
      sessionUser.id;

    const responsibleId =
      optionalId(
        body.responsibleId,
      );

    const salespersonId =
      optionalId(
        body.salespersonId,
      );

    const startDate =
      optionalDate(
        body.startDate,
        "Data de início",
      );

    const dueDate =
      optionalDate(
        body.dueDate,
        "Data prevista",
      );

    const completedAt =
      optionalDate(
        body.completedAt,
        "Data de conclusão",
      );

    if (
      startDate &&
      dueDate &&
      dueDate < startDate
    ) {
      throw new Error(
        "A data prevista não pode ser anterior à data de início.",
      );
    }

    const status =
      parseStatus(
        body.status,
      );

    const priority =
      parsePriority(
        body.priority,
      );

    const selectedEquipment =
      parseProjectEquipment(
        body,
      );

    await Promise.all([
  validateActiveUser(
    responsibleId,
    "responsável",
  ),

  validateActiveUser(
    salespersonId,
    "vendedor",
    [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],
  ),
]);

    const project =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          if (clientId) {
            const selectedClient =
              await transaction.client.findUnique(
                {
                  where: {
                    id:
                      clientId,
                  },

                  select: {
                    id: true,
                    name: true,
                    active:
                      true,
                  },
                },
              );

            if (
              !selectedClient
            ) {
              throw new Error(
                "CLIENT_NOT_FOUND",
              );
            }

            if (
              !selectedClient.active
            ) {
              throw new Error(
                "CLIENT_INACTIVE",
              );
            }

            clientName =
              selectedClient.name;
          }

          if (
            selectedEquipment.length >
            0
          ) {
            const equipmentIds =
              selectedEquipment.map(
                (item) =>
                  item.equipmentId,
              );

            const existingEquipment =
              await transaction.equipment.findMany(
                {
                  where: {
                    id: {
                      in:
                        equipmentIds,
                    },
                  },

                  select: {
                    id:
                      true,
                  },
                },
              );

            const existingEquipmentIds =
              new Set(
                existingEquipment.map(
                  (item) =>
                    item.id,
                ),
              );

            const missingEquipmentIds =
              equipmentIds.filter(
                (
                  equipmentId,
                ) =>
                  !existingEquipmentIds.has(
                    equipmentId,
                  ),
              );

            if (
              missingEquipmentIds.length >
              0
            ) {
              throw new Error(
                missingEquipmentIds.length ===
                  1
                  ? "Um dos equipamentos selecionados não foi encontrado."
                  : "Alguns equipamentos selecionados não foram encontrados.",
              );
            }
          }

          return transaction.project.create(
            {
              data: {
                name,

                clientId,

                clientName,

                description:
                  optionalText(
                    body.description,
                  ),

                status,

                priority,

                startDate,

                dueDate,

                completedAt:
                  status ===
                  ProjectStatus.COMPLETED
                    ? completedAt ??
                      new Date()
                    : null,

                notes:
                  optionalText(
                    body.notes,
                  ),

                createdById,

                responsibleId,

                salespersonId,

                equipment:
                  selectedEquipment.length >
                  0
                    ? {
                        create:
                          selectedEquipment.map(
                            (
                              item,
                            ) => ({
                              /*
                               * Necessidade
                               * total do
                               * projeto.
                               */
                              quantity:
                                item.quantity,

                              /*
                               * CRÍTICO:
                               *
                               * Adicionar
                               * equipamento
                               * ao projeto
                               * NÃO significa
                               * baixa física.
                               */
                              allocatedQuantity:
                                0,

                              notes:
                                item.notes,

                              equipment:
                                {
                                  connect:
                                    {
                                      id:
                                        item.equipmentId,
                                    },
                                },
                            }),
                          ),
                      }
                    : undefined,
              },

              include:
                projectInclude,
            },
          );
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );

    await logAudit({
      action:
        AuditAction.CREATE,

      entity:
        AuditEntity.PROJECT,

      entityId:
        project.id,

      userId:
        sessionUser.id,

      description:
        `Projeto "${project.name}" cadastrado.`,

      newData:
        serializeProjectForAudit(
          project,
        ),
    });

    /*
     * Calculamos também o retorno do POST
     * com a mesma regra global.
     *
     * Dessa forma criar o projeto não
     * devolve um déficit diferente do GET.
     */
    const stockAllocation =
      await buildStockAllocation(
        [
          project,
        ],
      );

    const serializedProject =
      serializeProject(
        project,
        stockAllocation,
      );

    return Response.json(
      {
        success: true,

        message:
          "Projeto cadastrado com sucesso.",

        data:
          serializedProject,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao cadastrar projeto:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "CLIENT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "O cliente selecionado não foi encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "CLIENT_INACTIVE"
    ) {
      return Response.json(
        {
          success: false,

          message:
            "O cliente selecionado está inativo e não pode ser vinculado ao projeto.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code ===
        "P2002"
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Já existe um projeto utilizando um campo que deve ser exclusivo.",
          },
          {
            status: 409,
          },
        );
      }

      if (
        error.code ===
        "P2003"
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "Um dos usuários ou equipamentos selecionados não é válido.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        error.code ===
        "P2034"
      ) {
        return Response.json(
          {
            success:
              false,

            message:
              "O projeto não pôde ser salvo devido a uma atualização simultânea. Tente novamente.",
          },
          {
            status: 409,
          },
        );
      }
    }

    if (
      error instanceof
      SyntaxError
    ) {
      return Response.json(
        {
          success: false,

          message:
            "O conteúdo enviado não é um JSON válido.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error
    ) {
      return Response.json(
        {
          success: false,

          message:
            error.message,
        },
        {
          status: 400,
        },
      );
    }

    return Response.json(
      {
        success: false,

        message:
          "Não foi possível cadastrar o projeto.",
      },
      {
        status: 500,
      },
    );
  }
}