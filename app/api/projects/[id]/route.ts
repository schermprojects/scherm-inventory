import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentMovementType,
  ProjectPriority,
  ProjectStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EQUIPMENT_QUANTITY = 999999;

class InsufficientProjectStockError extends Error {
  constructor(
    readonly equipmentName: string,
    readonly availableQuantity: number,
    readonly requestedQuantity: number,
  ) {
    super("INSUFFICIENT_PROJECT_STOCK");
    this.name =
      "InsufficientProjectStockError";
  }
}

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

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

const projectUserSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  active: true,
} satisfies Prisma.UserSelect;

const projectInclude = {
  createdBy: {
    select: projectUserSelect,
  },

  responsible: {
    select: projectUserSelect,
  },

  salesperson: {
    select: projectUserSelect,
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
        include: {
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
      createdAt: "desc" as const,
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
    value === null ||
    value === undefined ||
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

  throw new Error(
    "Status do projeto inválido.",
  );
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

  throw new Error(
    "Prioridade do projeto inválida.",
  );
}

function canManageProjects(
  role: UserRole | undefined,
): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.COMMERCIAL
  );
}

function parseEquipmentQuantity(
  value: unknown,
  index: number,
): number {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > MAX_EQUIPMENT_QUANTITY
  ) {
    throw new Error(
      `A quantidade do equipamento ${
        index + 1
      } deve ser um número inteiro entre 1 e ${MAX_EQUIPMENT_QUANTITY}.`,
    );
  }

  return quantity;
}

function hasEquipmentField(
  body: ProjectBody,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(
      body,
      "equipment",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "equipments",
    )
  );
}

function hasClientIdField(
  body: ProjectBody,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    body,
    "clientId",
  );
}

function parseProjectEquipment(
  body: ProjectBody,
): NormalizedProjectEquipment[] {
  const rawEquipment =
    body.equipment ?? body.equipments;

  if (
    rawEquipment === undefined ||
    rawEquipment === null
  ) {
    return [];
  }

  if (!Array.isArray(rawEquipment)) {
    throw new Error(
      'O campo "equipment" deve ser uma lista.',
    );
  }

  const equipmentMap = new Map<
    string,
    NormalizedProjectEquipment
  >();

  rawEquipment.forEach(
    (rawItem: unknown, index: number) => {
      if (
        typeof rawItem !== "object" ||
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

      const equipmentId = requiredText(
        item.equipmentId,
        `Equipamento ${index + 1}`,
      );

      const quantity =
        parseEquipmentQuantity(
          item.quantity,
          index,
        );

      const notes = optionalText(
        item.notes,
      );

      const existing =
        equipmentMap.get(equipmentId);

      if (existing) {
        const mergedQuantity =
          existing.quantity + quantity;

        if (
          mergedQuantity >
          MAX_EQUIPMENT_QUANTITY
        ) {
          throw new Error(
            `A quantidade total de um equipamento não pode ultrapassar ${MAX_EQUIPMENT_QUANTITY}.`,
          );
        }

        equipmentMap.set(equipmentId, {
          equipmentId,
          quantity: mergedQuantity,
          notes: existing.notes ?? notes,
        });

        return;
      }

      equipmentMap.set(equipmentId, {
        equipmentId,
        quantity,
        notes,
      });
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
): Promise<string | null> {
  if (!userId) {
    return null;
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
      `${label} não encontrado.`,
    );
  }

  if (!user.active) {
    throw new Error(
      `${label} está inativo.`,
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    throw new Error(
      `${label} não possui um perfil permitido.`,
    );
  }

  return user.id;
}

async function validateEquipmentIds(
  transaction: Prisma.TransactionClient,
  selectedEquipment:
    NormalizedProjectEquipment[],
): Promise<void> {
  if (selectedEquipment.length === 0) {
    return;
  }

  const equipmentIds =
    selectedEquipment.map(
      (item) => item.equipmentId,
    );

  const equipment =
    await transaction.equipment.findMany({
      where: {
        id: {
          in: equipmentIds,
        },
      },

      select: {
        id: true,
      },
    });

  const existingIds = new Set(
    equipment.map((item) => item.id),
  );

  const missingIds =
    equipmentIds.filter(
      (equipmentId) =>
        !existingIds.has(equipmentId),
    );

  if (missingIds.length === 1) {
    throw new Error(
      "Um dos equipamentos selecionados não foi encontrado.",
    );
  }

  if (missingIds.length > 1) {
    throw new Error(
      "Alguns equipamentos selecionados não foram encontrados.",
    );
  }
}

function isPrismaNotFoundError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

async function serializeProject(
  project: ProjectWithRelations,
) {
  const equipmentIds =
    project.equipment.map(
      (item) => item.equipmentId,
    );

  const activeNeeds =
    equipmentIds.length > 0
      ? await prisma.projectEquipment.groupBy({
          by: ["equipmentId"],

          where: {
            equipmentId: {
              in: equipmentIds,
            },

            project: {
              status: {
                in: ACTIVE_PROJECT_STATUSES,
              },
            },
          },

          _sum: {
            quantity: true,
          },
        })
      : [];

  const totalActiveNeedByEquipment =
    new Map<string, number>(
      activeNeeds.map((item) => [
        item.equipmentId,
        item._sum.quantity ?? 0,
      ]),
    );

  let neededUnits = 0;
  let availableUnits = 0;
  let shortageUnits = 0;
  let equipmentWithShortage = 0;
  let outOfStockItems = 0;

  const equipment =
    project.equipment.map((item) => {
      const physicalStock =
        item.equipment.quantity;

      const neededForProject =
        item.quantity;

      const totalActiveNeeded =
        totalActiveNeedByEquipment.get(
          item.equipmentId,
        ) ?? 0;

      const projectCountsAsActive =
        ACTIVE_PROJECT_STATUSES.includes(
          project.status,
        );

      const neededByOtherProjects =
        Math.max(
          totalActiveNeeded -
            (projectCountsAsActive
              ? neededForProject
              : 0),
          0,
        );

      const availableForProject =
        Math.max(
          physicalStock -
            neededByOtherProjects,
          0,
        );

      const assignedFromStock =
        Math.min(
          neededForProject,
          availableForProject,
        );

      const shortage = Math.max(
        neededForProject -
          availableForProject,
        0,
      );

      const availableAfterProject =
        Math.max(
          availableForProject -
            neededForProject,
          0,
        );

      const isOutOfStock =
        physicalStock === 0;

      const hasShortage =
        shortage > 0;

      neededUnits += neededForProject;
      availableUnits += assignedFromStock;
      shortageUnits += shortage;

      if (hasShortage) {
        equipmentWithShortage += 1;
      }

      if (isOutOfStock) {
        outOfStockItems += 1;
      }

      return {
        ...item,

        needed: neededForProject,
        physicalStock,
        totalActiveNeeded,
        neededByOtherProjects,
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
    });

  return {
    ...project,
    equipment,

    equipmentItems:
      project._count.equipment,

    neededUnits,

    /*
     * Mantido por compatibilidade com telas antigas.
     * Agora representa necessidade, não reserva.
     */
    reservedUnits: neededUnits,

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
    id: project.id,
    name: project.name,

    clientId: project.clientId,
    clientName: project.clientName,

    description: project.description,
    status: project.status,
    priority: project.priority,

    startDate:
      project.startDate?.toISOString() ??
      null,

    dueDate:
      project.dueDate?.toISOString() ??
      null,

    completedAt:
      project.completedAt?.toISOString() ??
      null,

    stockDeductedAt:
      project.stockDeductedAt
      ?.toISOString() ?? null,

    notes: project.notes,

    createdById:
      project.createdById,

    responsibleId:
      project.responsibleId,

    salespersonId:
      project.salespersonId,

    equipment:
      project.equipment.map(
        (item) => ({
          projectEquipmentId:
            item.id,

          equipmentId:
            item.equipmentId,

          equipmentName:
            item.equipment.name,

          category:
            item.equipment.category,

          manufacturer:
            item.equipment.manufacturer,

          model:
            item.equipment.model,

          serialNumber:
            item.equipment.serialNumber,

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
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const { id } = await params;

  try {
    const project =
      await prisma.project.findUnique({
        where: {
          id,
        },
        include: projectInclude,
      });

    if (!project) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      success: true,
      data: await serializeProject(
        project,
      ),
    });
  } catch (error) {
    console.error(
      "Erro ao carregar projeto:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar o projeto.",
      },
      {
        status: 500,
      },
    );
  }
}
export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const sessionUser =
    session.user as SessionUser;

  if (
    !canManageProjects(sessionUser.role)
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para editar projetos.",
      },
      {
        status: 403,
      },
    );
  }

  if (!sessionUser.id) {
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
    const { id } = await params;

    const body =
      (await request.json()) as ProjectBody;

    const name = requiredText(
      body.name,
      "Nome",
    );

    const responsibleId = optionalId(
      body.responsibleId,
    );

    const salespersonId = optionalId(
      body.salespersonId,
    );

    const startDate = optionalDate(
      body.startDate,
      "Data de início",
    );

    const dueDate = optionalDate(
      body.dueDate,
      "Data prevista",
    );

    const completedAt = optionalDate(
      body.completedAt,
      "Data de conclusão",
    );

    if (
      startDate &&
      dueDate &&
      dueDate < startDate
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A data prevista não pode ser anterior à data de início.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      startDate &&
      completedAt &&
      completedAt < startDate
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A data de conclusão não pode ser anterior à data de início.",
        },
        {
          status: 400,
        },
      );
    }

    const [
      validResponsibleId,
      validSalespersonId,
    ] = await Promise.all([
      validateActiveUser(
        responsibleId,
        "Responsável",
      ),

      validateActiveUser(
        salespersonId,
        "Vendedor",
        [
          UserRole.ADMIN,
          UserRole.COMMERCIAL,
        ],
      ),
    ]);

    const status = parseStatus(
      body.status,
    );

    const priority = parsePriority(
      body.priority,
    );

    const shouldUpdateEquipment =
      hasEquipmentField(body);

    const selectedEquipment =
      shouldUpdateEquipment
        ? parseProjectEquipment(body)
        : [];

const {
  existingProject,
  project,
} = await prisma.$transaction(
  async (transaction) => {
    const existingProject =
      await transaction.project.findUnique({
        where: {
          id,
        },
        include: projectInclude,
      });

    if (!existingProject) {
      throw new Error(
        "PROJECT_NOT_FOUND",
      );
    }

    const isCompletingProject =
      existingProject.status !==
        ProjectStatus.COMPLETED &&
      status ===
        ProjectStatus.COMPLETED;

    console.log({
  previousStatus: existingProject.status,
  newStatus: status,
  isCompletingProject,
  stockDeductedAt: existingProject.stockDeductedAt,
});

    const isReopeningProject =
      existingProject.status ===
        ProjectStatus.COMPLETED &&
      status !==
        ProjectStatus.COMPLETED;

    const isCancellingCompletedProject =
      existingProject.status ===
        ProjectStatus.COMPLETED &&
      status ===
        ProjectStatus.CANCELLED;

    if (isCancellingCompletedProject) {
      throw new Error(
        "COMPLETED_PROJECT_CANNOT_BE_CANCELLED",
      );
    }

    const hasDeliveredEquipment =
      existingProject.equipment.some(
        (item) =>
          item.allocatedQuantity > 0,
      );

    if (
      shouldUpdateEquipment &&
      hasDeliveredEquipment
    ) {
      throw new Error(
        "DELIVERED_PROJECT_EQUIPMENT_LOCKED",
      );
    }

    let nextClientId =
      existingProject.clientId;

    let nextClientName =
      existingProject.clientName;

    if (hasClientIdField(body)) {
      const requestedClientId =
        optionalId(body.clientId);

      if (!requestedClientId) {
        nextClientId = null;

        nextClientName =
          optionalText(
            body.clientName,
          );
      } else {
        const selectedClient =
          await transaction.client.findUnique({
            where: {
              id: requestedClientId,
            },
            select: {
              id: true,
              name: true,
              active: true,
            },
          });

        if (!selectedClient) {
          throw new Error(
            "CLIENT_NOT_FOUND",
          );
        }

        const isExistingClient =
          selectedClient.id ===
          existingProject.clientId;

        if (
          !selectedClient.active &&
          !isExistingClient
        ) {
          throw new Error(
            "CLIENT_INACTIVE",
          );
        }

        nextClientId =
          selectedClient.id;

        nextClientName =
          selectedClient.name;
      }
    } else if (
      !existingProject.clientId &&
      Object.prototype.hasOwnProperty.call(
        body,
        "clientName",
      )
    ) {
      nextClientName =
        optionalText(
          body.clientName,
        );
    }

    if (shouldUpdateEquipment) {
      await validateEquipmentIds(
        transaction,
        selectedEquipment,
      );

      await transaction.projectEquipment.deleteMany({
        where: {
          projectId: id,
        },
      });

      if (
        selectedEquipment.length > 0
      ) {
        await transaction.projectEquipment.createMany({
          data: selectedEquipment.map(
            (item) => ({
              projectId: id,
              equipmentId:
                item.equipmentId,
              quantity:
                item.quantity,
              allocatedQuantity: 0,
              notes:
                item.notes,
            }),
          ),
        });
      }
    }

    let nextStockDeductedAt =
      existingProject.stockDeductedAt;

    if (
      isCompletingProject &&
      !existingProject.stockDeductedAt
    ) {
      const finalProjectEquipment =
        await transaction.projectEquipment.findMany({
          where: {
            projectId: id,
          },

          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                quantity: true,
              },
            },
          },

          orderBy: {
            createdAt: "asc",
          },
        });

      /*
       * Primeiro validamos todos os itens.
       * Se um item não tiver estoque, toda a
       * transação é cancelada.
       */
      for (
        const item of
        finalProjectEquipment
      ) {
        const quantityToDeduct =
          Math.max(
            item.quantity -
              item.allocatedQuantity,
            0,
          );

        if (quantityToDeduct === 0) {
          continue;
        }

        if (
          item.equipment.quantity <
          quantityToDeduct
        ) {
          throw new InsufficientProjectStockError(
            item.equipment.name,
            item.equipment.quantity,
            quantityToDeduct,
          );
        }
      }

      /*
       * Depois da validação, realiza as baixas.
       */
      for (
        const item of
        finalProjectEquipment
      ) {
        const quantityToDeduct =
          Math.max(
            item.quantity -
              item.allocatedQuantity,
            0,
          );

        if (quantityToDeduct === 0) {
          continue;
        }

        const previousQuantity =
          item.equipment.quantity;

        const currentQuantity =
          previousQuantity -
          quantityToDeduct;

        const stockUpdate =
          await transaction.equipment.updateMany({
            where: {
              id: item.equipmentId,
              quantity: {
                gte: quantityToDeduct,
              },
            },

            data: {
              quantity: {
                decrement:
                  quantityToDeduct,
              },
            },
          });

        if (stockUpdate.count !== 1) {
          throw new InsufficientProjectStockError(
            item.equipment.name,
            previousQuantity,
            quantityToDeduct,
          );
        }

        await transaction.projectEquipment.update({
          where: {
            id: item.id,
          },

          data: {
            allocatedQuantity:
              item.allocatedQuantity +
              quantityToDeduct,
          },
        });

        await transaction.equipmentMovement.create({
          data: {
            type:
              EquipmentMovementType.EXIT,

            quantity:
              quantityToDeduct,

            previousQuantity,
            currentQuantity,

            equipmentId:
              item.equipmentId,

            projectId: id,

            createdById:
              sessionUser.id,

            notes:
              `Baixa automática pela conclusão do projeto "${existingProject.name}".`,
          },
        });
      }

      nextStockDeductedAt =
        new Date();
    }

    /*
     * Reabrir não devolve estoque.
     * O marcador da baixa permanece preenchido.
     */
    if (isReopeningProject) {
      nextStockDeductedAt =
        existingProject.stockDeductedAt;
    }

    const project =
      await transaction.project.update({
        where: {
          id,
        },

        data: {
          name,

          clientId:
            nextClientId,

          clientName:
            nextClientName,

          description:
            optionalText(
              body.description,
            ),

          notes:
            optionalText(
              body.notes,
            ),

          responsibleId:
            validResponsibleId,

          salespersonId:
            validSalespersonId,

          status,
          priority,

          startDate,
          dueDate,

          completedAt:
            status ===
            ProjectStatus.COMPLETED
              ? completedAt ??
                existingProject.completedAt ??
                new Date()
              : null,

          stockDeductedAt:
            nextStockDeductedAt,
        },

        include:
          projectInclude,
      });

    return {
      existingProject,
      project,
    };
  },
  {
    isolationLevel:
      Prisma.TransactionIsolationLevel
        .Serializable,
  },
);

await logAudit({
  action: AuditAction.UPDATE,
  entity: AuditEntity.PROJECT,
  entityId: project.id,
  userId: sessionUser.id,
  description: `Projeto "${project.name}" atualizado.`,
  oldData: serializeProjectForAudit(
    existingProject,
  ),
  newData: serializeProjectForAudit(
    project,
  ),
});

    return Response.json({
      success: true,
      message:
        "Projeto atualizado com sucesso.",
      data: await serializeProject(
        project,
      ),
    });

  } catch (error) {
    console.error(
      "Erro ao atualizar projeto:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

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
    InsufficientProjectStockError
) {
  return Response.json(
    {
      success: false,
      message:
        `Estoque insuficiente de "${error.equipmentName}". ` +
        `Estoque físico disponível: ${error.availableQuantity}. ` +
        `Quantidade necessária para concluir: ${error.requestedQuantity}.`,
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "COMPLETED_PROJECT_CANNOT_BE_CANCELLED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Projetos concluídos não podem ser cancelados. Utilize a opção de reabrir o projeto.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "DELIVERED_PROJECT_EQUIPMENT_LOCKED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Os equipamentos já entregues não podem ser alterados pelo formulário comum. Utilize o gerenciamento de devoluções.",
    },
    {
      status: 409,
    },
  );
}

    if (isPrismaNotFoundError(error)) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto foi alterado simultaneamente. Tente salvar novamente.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        return Response.json(
          {
            success: false,
            message:
              "Existem equipamentos duplicados no projeto.",
          },
          {
            status: 409,
          },
        );
      }

      if (error.code === "P2003") {
        return Response.json(
          {
            success: false,
            message:
              "Um dos usuários ou equipamentos selecionados não é válido.",
          },
          {
            status: 400,
          },
        );
      }
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          success: false,
          message:
            "Os dados enviados não são um JSON válido.",
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof Error) {
      return Response.json(
        {
          success: false,
          message: error.message,
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
          "Não foi possível atualizar o projeto.",
      },
      {
        status: 500,
      },
    );
  
  }
   
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        success: false,
        message: "Não autenticado.",
      },
      {
        status: 401,
      },
    );
  }

  const sessionUser =
    session.user as SessionUser;

  if (
    sessionUser.role !== UserRole.ADMIN
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Somente administradores podem excluir projetos.",
      },
      {
        status: 403,
      },
    );
  }

  if (!sessionUser.id) {
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

  const { id } = await params;

  try {
    const deletedProject =
      await prisma.$transaction(
        async (transaction) => {
          const existingProject =
            await transaction.project.findUnique(
              {
                where: {
                  id,
                },

                include:
                  projectInclude,
              },
            );

          if (!existingProject) {
            throw new Error(
              "PROJECT_NOT_FOUND",
            );
          }

          if (
  existingProject.status ===
    ProjectStatus.COMPLETED ||
  existingProject.stockDeductedAt
) {
  throw new Error(
    "DELIVERED_PROJECT_CANNOT_BE_DELETED",
  );
}

          await transaction.project.delete({
            where: {
              id,
            },
          });

          return existingProject;
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

    await logAudit({
      action: AuditAction.DELETE,
      entity: AuditEntity.PROJECT,
      entityId: deletedProject.id,
      userId: sessionUser.id,
      description: `Projeto "${deletedProject.name}" removido.`,
      oldData:
        serializeProjectForAudit(
          deletedProject,
        ),
    });

    return Response.json({
      success: true,
      message:
        "Projeto removido com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao remover projeto:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
  error instanceof Error &&
  error.message ===
    "DELIVERED_PROJECT_CANNOT_BE_DELETED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Projetos concluídos ou com equipamentos entregues não podem ser excluídos.",
    },
    {
      status: 409,
    },
  );
}

    if (isPrismaNotFoundError(error)) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto possui registros vinculados e não pode ser removido.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto foi alterado simultaneamente. Tente remover novamente.",
        },
        {
          status: 409,
        },
      );
    }

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível remover o projeto.",
      },
      {
        status: 500,
      },
    );
  }
}