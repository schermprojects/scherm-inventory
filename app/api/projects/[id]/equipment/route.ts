import {
  EquipmentStatus,
  Prisma,
  UserRole,
} from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AddEquipmentBody = {
  equipmentId?: unknown;
  quantity?: unknown;
};

type SessionUser = {
  id?: string;
  role?: UserRole;
};

function canManageEquipment(
  role: UserRole | undefined,
) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.COMMERCIAL
  );
}

function requiredId(
  value: unknown,
  label: string,
) {
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

function requiredQuantity(
  value: unknown,
) {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999999
  ) {
    throw new Error(
      "A quantidade deve ser um número inteiro maior que zero.",
    );
  }

  return quantity;
}

/**
 * GET /api/projects/[id]/equipment
 *
 * Retorna os equipamentos do estoque com:
 * - quantidade total;
 * - quantidade reservada;
 * - quantidade reservada neste projeto;
 * - disponibilidade para este projeto.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
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
  !canManageEquipment(
    sessionUser.role,
  )
) {
  return Response.json(
    {
      success: false,
      message:
        "Você não possui permissão para gerenciar equipamentos do projeto.",
    },
    {
      status: 403,
    },
  );
}

  try {
    const { id: projectId } =
      await context.params;

    const project =
      await prisma.project.findUnique({
        where: {
          id: projectId,
        },
        select: {
          id: true,
        },
      });

    if (!project) {
      return Response.json(
        {
          success: false,
          message: "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const equipment =
      await prisma.equipment.findMany({
        include: {
          images: {
            orderBy: {
              position: "asc",
            },
            take: 1,
          },

          projects: {
            select: {
              projectId: true,
              quantity: true,
            },
          },
        },

        orderBy: [
          {
            name: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    const data = equipment.map((item) => {
      const totalReserved =
        item.projects.reduce(
          (total, reservation) =>
            total + reservation.quantity,
          0,
        );

      const currentReservation =
        item.projects.find(
          (reservation) =>
            reservation.projectId ===
            projectId,
        );

      const currentProjectQuantity =
        currentReservation?.quantity ?? 0;

      const reservedByOtherProjects =
        totalReserved -
        currentProjectQuantity;

      /*
       * Ao editar a reserva atual, as unidades já
       * reservadas pelo próprio projeto podem ser
       * reutilizadas.
       */
      const availableForProject = Math.max(
        item.quantity -
          reservedByOtherProjects,
        0,
      );

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        manufacturer: item.manufacturer,
        model: item.model,
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        status: item.status,
        condition: item.condition,
        image: item.images[0] ?? null,

        totalReserved,
        reservedByOtherProjects,
        currentProjectQuantity,
        availableForProject,
        availableNow: Math.max(
          item.quantity - totalReserved,
          0,
        ),
      };
    });

    return Response.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar equipamentos do projeto:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os equipamentos.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST /api/projects/[id]/equipment
 *
 * Body:
 * {
 *   equipmentId: string;
 *   quantity: number;
 * }
 */
export async function POST(
  request: Request,
  context: RouteContext,
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
    !canManageEquipment(
      sessionUser.role,
    )
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para adicionar equipamentos ao projeto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const { id: projectId } =
      await context.params;

    const body =
      (await request.json()) as AddEquipmentBody;

    const equipmentId = requiredId(
      body.equipmentId,
      "Equipamento",
    );

    const quantity = requiredQuantity(
      body.quantity,
    );

    const projectEquipment =
      await prisma.$transaction(
        async (transaction) => {
          const project =
            await transaction.project.findUnique({
              where: {
                id: projectId,
              },
              select: {
                id: true,
              },
            });

          if (!project) {
            throw new Error(
              "Projeto não encontrado.",
            );
          }

          const equipment =
            await transaction.equipment.findUnique({
              where: {
                id: equipmentId,
              },
              select: {
                id: true,
                name: true,
                quantity: true,
                status: true,
              },
            });

          if (!equipment) {
            throw new Error(
              "Equipamento não encontrado.",
            );
          }

          if (
            equipment.status ===
            EquipmentStatus.UNAVAILABLE
          ) {
            throw new Error(
              "Este equipamento está indisponível.",
            );
          }

          const existing =
            await transaction.projectEquipment.findUnique(
              {
                where: {
                  projectId_equipmentId: {
                    projectId,
                    equipmentId,
                  },
                },
                select: {
                  id: true,
                },
              },
            );

          if (existing) {
            throw new Error(
              "Este equipamento já está vinculado ao projeto. Edite a quantidade da reserva existente.",
            );
          }

          return transaction.projectEquipment.create(
            {
              data: {
                projectId,
                equipmentId,
                quantity,
              },

              include: {
                equipment: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    manufacturer: true,
                    model: true,
                    quantity: true,
                    status: true,
                    condition: true,
                  },
                },
              },
            },
          );
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

    return Response.json(
      {
        success: true,
        message:
          "Equipamento adicionado ao projeto com sucesso.",
        data: projectEquipment,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao adicionar equipamento ao projeto:",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento já está vinculado ao projeto.",
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
            "O estoque foi alterado por outro usuário. Tente novamente.",
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
      const isNotFound =
        error.message ===
          "Projeto não encontrado." ||
        error.message ===
          "Equipamento não encontrado.";

      const isConflict =
        error.message.includes(
          "já está vinculado",
        ) ||
        error.message.includes(
          "Quantidade indisponível",
        );

      return Response.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: isNotFound
            ? 404
            : isConflict
              ? 409
              : 400,
        },
      );
    }

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível adicionar o equipamento ao projeto.",
      },
      {
        status: 500,
      },
    );
  }
}