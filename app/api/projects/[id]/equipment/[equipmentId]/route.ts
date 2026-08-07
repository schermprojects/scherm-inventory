import {
  EquipmentStatus,
  Prisma,
  ProjectStatus,
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
 * Atualiza a quantidade planejada de um
 * equipamento já vinculado ao projeto.
 *
 * Regras:
 * - projeto concluído não pode ser alterado;
 * - quantidade nunca pode ficar abaixo
 *   do que já foi efetivamente baixado;
 * - allocatedQuantity nunca é alterado aqui.
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
                  project: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },

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
              "PROJECT_EQUIPMENT_NOT_FOUND",
            );
          }

          /*
           * Projeto concluído é somente leitura.
           * Primeiro precisa ser reaberto.
           */
          if (
            existing.project.status ===
            ProjectStatus.COMPLETED
          ) {
            throw new Error(
              "COMPLETED_PROJECT_LOCKED",
            );
          }

          /*
           * Se já foram baixadas 3 unidades,
           * por exemplo, quantity nunca pode
           * passar para 2.
           *
           * A redução da quantidade baixada
           * será feita depois pelo fluxo
           * específico de devolução.
           */
          if (
            quantity <
            existing.allocatedQuantity
          ) {
            throw new Error(
              "EQUIPMENT_QUANTITY_BELOW_ALLOCATED",
            );
          }

          if (
            existing.equipment.status ===
            EquipmentStatus.UNAVAILABLE
          ) {
            throw new Error(
              "EQUIPMENT_UNAVAILABLE",
            );
          }

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
      error instanceof Error &&
      error.message ===
        "PROJECT_EQUIPMENT_NOT_FOUND"
    ) {
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

    if (
      error instanceof Error &&
      error.message ===
        "COMPLETED_PROJECT_LOCKED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto está concluído e bloqueado para alterações. Reabra o projeto antes de alterar os equipamentos.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "EQUIPMENT_QUANTITY_BELOW_ALLOCATED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A quantidade do equipamento não pode ser menor que a quantidade já baixada. Registre primeiro a devolução das unidades.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "EQUIPMENT_UNAVAILABLE"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento está indisponível.",
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
            "O projeto foi alterado por outro usuário. Tente novamente.",
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
 *
 * Remove um equipamento do projeto somente
 * quando ele nunca teve baixa de estoque.
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

              select: {
                id: true,
                allocatedQuantity: true,

                project: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          );

        if (!existing) {
          throw new Error(
            "PROJECT_EQUIPMENT_NOT_FOUND",
          );
        }

        /*
         * Projeto concluído é somente leitura.
         */
        if (
          existing.project.status ===
          ProjectStatus.COMPLETED
        ) {
          throw new Error(
            "COMPLETED_PROJECT_LOCKED",
          );
        }

        /*
         * Um vínculo que já teve baixa não
         * pode ser apagado.
         *
         * A devolução será responsável por
         * ajustar allocatedQuantity.
         */
        if (
          existing.allocatedQuantity > 0
        ) {
          throw new Error(
            "ALLOCATED_EQUIPMENT_CANNOT_BE_REMOVED",
          );
        }

        await transaction.projectEquipment.delete(
          {
            where: {
              projectId_equipmentId: {
                projectId,
                equipmentId,
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
        "Equipamento removido do projeto com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao remover equipamento do projeto:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_EQUIPMENT_NOT_FOUND"
    ) {
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

    if (
      error instanceof Error &&
      error.message ===
        "COMPLETED_PROJECT_LOCKED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto está concluído e bloqueado para alterações. Reabra o projeto antes de alterar os equipamentos.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "ALLOCATED_EQUIPMENT_CANNOT_BE_REMOVED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Não é possível remover um equipamento que já teve baixa de estoque. Registre primeiro a devolução das unidades baixadas.",
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

      if (error.code === "P2034") {
        return Response.json(
          {
            success: false,
            message:
              "O projeto foi alterado por outro usuário. Tente novamente.",
          },
          {
            status: 409,
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