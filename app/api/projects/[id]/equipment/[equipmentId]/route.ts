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
    equipmentId: string;
  }>;
};

type UpdateEquipmentBody = {
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
 * PUT /api/projects/[id]/equipment/[equipmentId]
 *
 * Body:
 * {
 *   quantity: number;
 * }
 */
export async function PUT(
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
          "Você não possui permissão para editar equipamentos do projeto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: projectId,
      equipmentId,
    } = await context.params;

    const body =
      (await request.json()) as UpdateEquipmentBody;

    const quantity = requiredQuantity(
      body.quantity,
    );

    const updatedReservation =
      await prisma.$transaction(
        async (transaction) => {
          const existing =
            await transaction.projectEquipment.findUnique(
              {
                where: {
                  projectId_equipmentId: {
                    projectId,
                    equipmentId,
                  },
                },

                include: {
                  equipment: {
                    select: {
                      id: true,
                      name: true,
                      quantity: true,
                      status: true,
                    },
                  },
                },
              },
            );

          if (!existing) {
            throw new Error(
              "Este equipamento não está vinculado ao projeto.",
            );
          }

          if (
            existing.equipment.status ===
            EquipmentStatus.UNAVAILABLE
          ) {
            throw new Error(
              "Este equipamento está indisponível.",
            );
          }

          const reservedByOthers =
            await transaction.projectEquipment.aggregate(
              {
                where: {
                  equipmentId,
                  NOT: {
                    projectId,
                  },
                },

                _sum: {
                  quantity: true,
                },
              },
            );

          const totalReservedByOthers =
            reservedByOthers._sum.quantity ??
            0;

          const availableForProject =
            existing.equipment.quantity -
            totalReservedByOthers;

          return transaction.projectEquipment.update(
            {
              where: {
                projectId_equipmentId: {
                  projectId,
                  equipmentId,
                },
              },

              data: {
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

    return Response.json({
      success: true,
      message:
        "Quantidade atualizada com sucesso.",
      data: updatedReservation,
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar equipamento do projeto:",
      error,
    );

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
        error.message.includes(
          "não está vinculado",
        );

      const isConflict =
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
          "Não foi possível atualizar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/projects/[id]/equipment/[equipmentId]
 */
export async function DELETE(
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
          "Você não possui permissão para remover equipamentos do projeto.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: projectId,
      equipmentId,
    } = await context.params;

    const existing =
      await prisma.projectEquipment.findUnique(
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

    if (!existing) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento não está vinculado ao projeto.",
        },
        {
          status: 404,
        },
      );
    }

    await prisma.projectEquipment.delete({
      where: {
        projectId_equipmentId: {
          projectId,
          equipmentId,
        },
      },
    });

    return Response.json({
      success: true,
      message:
        "Equipamento removido do projeto com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao remover equipamento do projeto:",
      error,
    );

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2025") {
        return Response.json(
          {
            success: false,
            message:
              "O vínculo do equipamento não foi encontrado.",
          },
          {
            status: 404,
          },
        );
      }
    }

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível remover o equipamento do projeto.",
      },
      {
        status: 500,
      },
    );
  }
}