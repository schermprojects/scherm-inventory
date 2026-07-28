import { auth } from "@/auth";
import {
  Prisma,
  ProjectPriority,
  ProjectStatus,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EQUIPMENT_QUANTITY = 999999;

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

  /*
   * Se nenhum desses campos for enviado no PUT,
   * os equipamentos atuais serão preservados.
   *
   * Se uma lista vazia for enviada, todos os
   * equipamentos serão removidos do projeto.
   */
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

    const project =
      await prisma.$transaction(
        async (transaction) => {
          const existingProject =
            await transaction.project.findUnique({
              where: {
                id,
              },

              select: {
                id: true,
              },
            });

          if (!existingProject) {
            throw new Error(
              "PROJECT_NOT_FOUND",
            );
          }

          if (shouldUpdateEquipment) {
            await validateEquipmentIds(
              transaction,
              selectedEquipment,
            );

            /*
             * ProjectEquipment representa a
             * necessidade do projeto.
             *
             * Nenhuma quantidade do estoque físico
             * é reduzida ou alterada aqui.
             */
            await transaction.projectEquipment.deleteMany(
              {
                where: {
                  projectId: id,
                },
              },
            );

            if (
              selectedEquipment.length > 0
            ) {
              await transaction.projectEquipment.createMany(
                {
                  data:
                    selectedEquipment.map(
                      (item) => ({
                        projectId: id,
                        equipmentId:
                          item.equipmentId,
                        quantity:
                          item.quantity,
                        notes: item.notes,
                      }),
                    ),
                },
              );
            }
          }

          return transaction.project.update({
            where: {
              id,
            },

            data: {
              name,

              clientName: optionalText(
                body.clientName,
              ),

              description: optionalText(
                body.description,
              ),

              notes: optionalText(
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
                    new Date()
                  : null,
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

  const { id } = await params;

  try {
    /*
     * Os registros de ProjectEquipment são removidos
     * automaticamente pelo onDelete: Cascade.
     *
     * O equipamento do inventário não será excluído,
     * pois a relação Equipment usa onDelete: Restrict.
     */
    await prisma.project.delete({
      where: {
        id,
      },
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