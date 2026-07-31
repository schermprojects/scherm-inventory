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

type UserRole =
  | "ADMIN"
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
    quantity > MAX_EQUIPMENT_QUANTITY
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
    body.equipment ?? body.equipments;

  if (
    receivedEquipment === undefined ||
    receivedEquipment === null
  ) {
    return [];
  }

  if (!Array.isArray(receivedEquipment)) {
    throw new Error(
      'O campo "equipment" deve ser uma lista de equipamentos.',
    );
  }

  /*
   * Map é usado para impedir registros duplicados.
   *
   * Caso o mesmo equipmentId seja enviado mais de
   * uma vez, as quantidades são somadas.
   */
  const equipmentMap = new Map<
    string,
    NormalizedProjectEquipment
  >();

  receivedEquipment.forEach(
    (
      rawItem: unknown,
      index: number,
    ) => {
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

      const existingItem =
        equipmentMap.get(equipmentId);

      if (existingItem) {
        const mergedQuantity =
          existingItem.quantity + quantity;

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
          notes:
            existingItem.notes ?? notes,
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
}

function serializeProject<
  T extends {
    equipment: Array<{
      quantity: number;
      equipment: {
        quantity: number;
      };
    }>;
    _count: {
      equipment: number;
    };
  },
>(project: T) {
  const neededUnits =
    project.equipment.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

  const physicalStockUnits =
    project.equipment.reduce(
      (total, item) =>
        total + item.equipment.quantity,
      0,
    );

  const shortageUnits =
    project.equipment.reduce(
      (total, item) => {
        const shortage = Math.max(
          item.quantity -
            item.equipment.quantity,
          0,
        );

        return total + shortage;
      },
      0,
    );

  const equipmentWithShortage =
    project.equipment.filter(
      (item) =>
        item.quantity >
        item.equipment.quantity,
    ).length;

  return {
    ...project,

    equipmentItems:
      project._count.equipment,

    /*
     * Novo nome correto.
     * Representa necessidade, não reserva.
     */
    neededUnits,

    /*
     * Mantido temporariamente para não quebrar
     * componentes antigos que ainda usam o nome.
     */
    reservedUnits: neededUnits,

    physicalStockUnits,
    shortageUnits,
    equipmentWithShortage,
    hasShortage: shortageUnits > 0,
  };
}

function serializeProjectForAudit(
  project: {
    id: string;
    name: string;
    clientId: string | null;
    clientName: string | null;
    description: string | null;
    status: ProjectStatus;
    priority: ProjectPriority;
    startDate: Date | null;
    dueDate: Date | null;
    completedAt: Date | null;
    notes: string | null;
    createdById: string | null;
    responsibleId: string | null;
    salespersonId: string | null;
    createdAt: Date;
    updatedAt: Date;

    equipment: Array<{
      quantity: number;
      notes: string | null;

      equipment: {
        id: string;
        name: string;
        category: string;
        manufacturer: string | null;
        model: string | null;
        serialNumber: string | null;
      };
    }>;
  },
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
          equipmentId:
            item.equipment.id,

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

  try {
    const { searchParams } = new URL(
      request.url,
    );

    const search =
      searchParams.get("search")?.trim() ??
      "";

    const status =
      searchParams.get("status");

    const priority =
      searchParams.get("priority");

    const responsibleId =
      searchParams
        .get("responsibleId")
        ?.trim() ?? "";

    const salespersonId =
      searchParams
        .get("salespersonId")
        ?.trim() ?? "";

    const where: Prisma.ProjectWhereInput = {
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                clientName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                responsible: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
              {
                salesperson: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
              {
                createdBy: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),

      ...(isProjectStatus(status)
        ? {
            status,
          }
        : {}),

      ...(isProjectPriority(priority)
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

    const [projects, groupedStatus] =
      await Promise.all([
        prisma.project.findMany({
          where,
          include: projectInclude,

          orderBy: [
            {
              createdAt: "desc",
            },
            {
              name: "asc",
            },
          ],
        }),

        prisma.project.groupBy({
          by: ["status"],

          _count: {
            _all: true,
          },
        }),
      ]);

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

    for (const item of groupedStatus) {
      const quantity =
        item._count._all;

      summary.total += quantity;

      if (
        item.status ===
        ProjectStatus.PLANNING
      ) {
        summary.planning = quantity;
      }

      if (
        item.status ===
        ProjectStatus.IN_PROGRESS
      ) {
        summary.inProgress = quantity;
      }

      if (
        item.status ===
        ProjectStatus.COMPLETED
      ) {
        summary.completed = quantity;
      }

      if (
        item.status ===
        ProjectStatus.CANCELLED
      ) {
        summary.cancelled = quantity;
      }
    }

    const data = projects.map(
      serializeProject,
    );

    for (const project of data) {
      summary.totalNeededUnits +=
        project.neededUnits;

      summary.totalShortageUnits +=
        project.shortageUnits;

      if (project.hasShortage) {
        summary.projectsWithShortage += 1;
      }
    }

    return Response.json({
      success: true,
      data,
      total: data.length,
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
          "Você não possui permissão para criar projetos.",
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
    const body =
      (await request.json()) as ProjectBody;

    const name = requiredText(
      body.name,
      "Nome do projeto",
    );

    const clientId = optionalId(
  body.clientId,
);

let clientName = optionalText(
  body.clientName,
);

    const createdById =
      sessionUser.id;

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
      throw new Error(
        "A data prevista não pode ser anterior à data de início.",
      );
    }

    const status = parseStatus(
      body.status,
    );

    


    const priority = parsePriority(
      body.priority,
    );

    const selectedEquipment =
      parseProjectEquipment(body);

    await Promise.all([
      validateActiveUser(
        responsibleId,
        "responsável",
      ),

      validateActiveUser(
        salespersonId,
        "vendedor",
      ),
    ]);

const project =
  await prisma.$transaction(
    async (transaction) => {
      if (clientId) {
        const selectedClient =
          await transaction.client.findUnique({
            where: {
              id: clientId,
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

        if (!selectedClient.active) {
          throw new Error(
            "CLIENT_INACTIVE",
          );
        }

        clientName =
          selectedClient.name;
      }

      if (
        selectedEquipment.length > 0
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
                  in: equipmentIds,
                },
              },

              select: {
                id: true,
              },
            },
          );

        const existingEquipmentIds =
          new Set(
            existingEquipment.map(
              (item) => item.id,
            ),
          );

        const missingEquipmentIds =
          equipmentIds.filter(
            (equipmentId) =>
              !existingEquipmentIds.has(
                equipmentId,
              ),
          );

        if (
          missingEquipmentIds.length > 0
        ) {
          throw new Error(
            missingEquipmentIds.length === 1
              ? "Um dos equipamentos selecionados não foi encontrado."
              : "Alguns equipamentos selecionados não foram encontrados.",
          );
        }
      }

      return transaction.project.create({
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
                      (item) => ({
                        quantity:
                          item.quantity,

                        notes:
                          item.notes,

                        equipment: {
                          connect: {
                            id:
                              item.equipmentId,
                          },
                        },
                      }),
                    ),
                }
              : undefined,
        },

        include: projectInclude,
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,
    },
  );

await logAudit({
  action: AuditAction.CREATE,
  entity: AuditEntity.PROJECT,
  entityId: project.id,
  userId: sessionUser.id,
  description:
    `Projeto "${project.name}" cadastrado.`,
  newData:
    serializeProjectForAudit(
      project,
    ),
});

return Response.json(
  {
    success: true,
    message:
      "Projeto cadastrado com sucesso.",
    data:
      serializeProject(project),
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
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        return Response.json(
          {
            success: false,
            message:
              "Já existe um projeto utilizando um campo que deve ser exclusivo.",
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

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto não pôde ser salvo devido a uma atualização simultânea. Tente novamente.",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof SyntaxError) {
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
          "Não foi possível cadastrar o projeto.",
      },
      {
        status: 500,
      },
    );
  }
}