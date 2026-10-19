import {
  EquipmentStatus,
  Prisma,
  ProjectStatus,
  PurchaseStatus,
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
  equipmentUnitIds?: unknown;
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
    role === UserRole.BACKOFFICE ||
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

function parseEquipmentUnitIds(
  value: unknown,
) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(
      "INVALID_EQUIPMENT_UNIT_IDS",
    );
  }

  const equipmentUnitIds =
    value.map((item) => {
      if (
        typeof item !== "string" ||
        item.trim().length === 0
      ) {
        throw new Error(
          "INVALID_EQUIPMENT_UNIT_IDS",
        );
      }

      return item.trim();
    });

  if (
    new Set(equipmentUnitIds).size !==
    equipmentUnitIds.length
  ) {
    throw new Error(
      "DUPLICATE_EQUIPMENT_UNIT_IDS",
    );
  }

  return equipmentUnitIds;
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

    const equipmentUnitIds =
  parseEquipmentUnitIds(
    body.equipmentUnitIds,
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
                  equipmentUnits: {
                    select: {
                      equipmentUnitId: true,
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

          if (
            existing.purchaseStatus ===
              PurchaseStatus.ACQUIRED &&
            quantity <
              existing.quantity
          ) {
            throw new Error(
              "ACQUIRED_PURCHASE_LOCKED",
            );
          }

          if (
  existing.purchaseStatus ===
    PurchaseStatus.ACQUIRED &&
  equipmentUnitIds !== undefined
) {
  const currentEquipmentUnitIds =
    existing.equipmentUnits.map(
      (assignment) =>
        assignment.equipmentUnitId,
    );

  const normalizedCurrentIds =
    [...currentEquipmentUnitIds].sort();

  const normalizedIncomingIds =
    [...equipmentUnitIds].sort();

  const changed =
    normalizedCurrentIds.length !==
      normalizedIncomingIds.length ||
    normalizedCurrentIds.some(
      (id, index) =>
        id !==
        normalizedIncomingIds[index],
    );

  if (changed) {
    throw new Error(
      "ACQUIRED_PURCHASE_SERIAL_LOCKED",
    );
  }
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

          const currentReservedQuantity =
            Math.max(
              existing.reservedQuantity,
              0,
            );

          /*
          * Quantidade ainda necessária depois
          * das baixas físicas já realizadas.
          */
          const targetPendingQuantity =
            Math.max(
              quantity -
                existing.allocatedQuantity,
              0,
            );

          /*
          * Reservas dos outros projetos ativos.
          *
          * A reserva atual deste projeto não
          * entra nesta soma, pois ela pode ser
          * mantida, aumentada ou reduzida nesta
          * própria edição.
          */
          const otherActiveReservations =
            await transaction.projectEquipment.findMany({
              where: {
                equipmentId,

                projectId: {
                  not: projectId,
                },

                project: {
                  status: {
                    in: [
                      ProjectStatus.PLANNING,
                      ProjectStatus.IN_PROGRESS,
                    ],
                  },
                },
              },

              select: {
                reservedQuantity: true,
              },
            });

          const reservedByOtherProjects =
            otherActiveReservations.reduce(
              (
                total,
                reservation,
              ) =>
                total +
                Math.max(
                  reservation.reservedQuantity,
                  0,
                ),
              0,
            );

          /*
          * Quantidade física que este projeto
          * pode manter ou reservar sem retirar
          * estoque comprometido com outro
          * projeto.
          */
          const availableForCurrentProject =
            Math.max(
              existing.equipment.quantity -
                reservedByOtherProjects,
              0,
            );

          /*
          * Nova reserva deste projeto.
          *
          * - se a necessidade diminuir, libera
          *   automaticamente o excedente;
          * - se aumentar, utiliza apenas estoque
          *   ainda livre;
          * - nunca toma reserva de outro projeto.
          */
          const nextReservedQuantity =
            Math.min(
              targetPendingQuantity,
              availableForCurrentProject,
            );

          if (equipmentUnitIds !== undefined) {
            if (
              equipmentUnitIds.length >
              nextReservedQuantity
            ) {
              throw new Error(
                "TOO_MANY_EQUIPMENT_UNITS",
              );
            }

            const selectedEquipmentUnits =
              await transaction.equipmentUnit.findMany(
                {
                  where: {
                    id: {
                      in: equipmentUnitIds,
                    },
                  },

                  select: {
                    id: true,
                    equipmentId: true,
                    serialNumber: true,
                    condition: true,

                    movements: {
                      orderBy: {
                        createdAt: "desc",
                      },
                      take: 1,
                      select: {
                        type: true,
                      },
                    },

                    projectAssignment: {
                      select: {
                        projectEquipmentId: true,
                      },
                    },
                  },
                },
              );

            if (
              selectedEquipmentUnits.length !==
              equipmentUnitIds.length
            ) {
              throw new Error(
                "EQUIPMENT_UNIT_NOT_FOUND",
              );
            }

            const invalidEquipmentUnit =
              selectedEquipmentUnits.find(
                (unit) =>
                  unit.equipmentId !==
                  equipmentId,
              );

            if (invalidEquipmentUnit) {
              throw new Error(
                "EQUIPMENT_UNIT_MISMATCH",
              );
            }

            const installedSerializedComponents =
              await transaction.machineComponent.findMany({
                where: {
                  equipmentId,
                  status: "INSTALLED",
                  serialNumber: {
                    not: null,
                  },
                },

                select: {
                  serialNumber: true,
                },
              });

            const installedSerialNumbers =
              new Set(
                installedSerializedComponents
                  .map((component) =>
                    component.serialNumber
                      ?.trim()
                      .toUpperCase(),
                  )
                  .filter(
                    (serialNumber): serialNumber is string =>
                      Boolean(serialNumber),
                  ),
              );

            const unavailableEquipmentUnit =
              selectedEquipmentUnits.find(
                (unit) =>
                  unit.condition !== "OPERATIONAL" ||
                  unit.movements[0]?.type === "EXIT" ||
                  installedSerialNumbers.has(
                    unit.serialNumber
                      .trim()
                      .toUpperCase(),
                  ),
              );

            if (unavailableEquipmentUnit) {
              throw new Error(
                "EQUIPMENT_UNIT_NOT_AVAILABLE",
              );
            }

            const assignedToAnotherProject =
              selectedEquipmentUnits.find(
                (unit) =>
                  unit.projectAssignment !==
                    null &&
                  unit.projectAssignment
                    .projectEquipmentId !==
                    existing.id,
              );

            if (assignedToAnotherProject) {
              throw new Error(
                "EQUIPMENT_UNIT_ALREADY_ASSIGNED",
              );
            }
          }

          if (equipmentUnitIds !== undefined) {
            const currentEquipmentUnitIds =
              existing.equipmentUnits.map(
                (assignment) =>
                  assignment.equipmentUnitId,
              );

            const equipmentUnitIdsToRemove =
              currentEquipmentUnitIds.filter(
                (equipmentUnitId) =>
                  !equipmentUnitIds.includes(
                    equipmentUnitId,
                  ),
              );

            const equipmentUnitIdsToAdd =
              equipmentUnitIds.filter(
                (equipmentUnitId) =>
                  !currentEquipmentUnitIds.includes(
                    equipmentUnitId,
                  ),
              );

            if (
              equipmentUnitIdsToRemove.length > 0
            ) {
              await transaction.projectEquipmentUnit.deleteMany(
                {
                  where: {
                    projectEquipmentId:
                      existing.id,

                    equipmentUnitId: {
                      in: equipmentUnitIdsToRemove,
                    },
                  },
                },
              );
            }

            if (
              equipmentUnitIdsToAdd.length > 0
            ) {
              await transaction.projectEquipmentUnit.createMany(
                {
                  data: equipmentUnitIdsToAdd.map(
                    (equipmentUnitId) => ({
                      projectEquipmentId:
                        existing.id,
                      equipmentUnitId,
                    }),
                  ),
                },
              );
            }
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
                reservedQuantity:
                  nextReservedQuantity,
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
    "ACQUIRED_PURCHASE_LOCKED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Este item possui compra adquirida e não pode ter sua necessidade reduzida.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "ACQUIRED_PURCHASE_SERIAL_LOCKED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Este item possui compra adquirida e os S/N designados não podem ser alterados.",
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
  error.code === "P2002"
) {
  return Response.json(
    {
      success: false,
      message:
        "Um dos S/N selecionados acabou de ser designado para outro projeto. Atualize a lista e tente novamente.",
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

    if (
  error instanceof Error &&
  error.message ===
    "TOO_MANY_EQUIPMENT_UNITS"
) {
  return Response.json(
    {
      success: false,
      message:
        "A quantidade de S/N selecionados não pode ser maior que a quantidade reservada para este projeto.",
    },
    {
      status: 409,
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
                purchaseStatus: true,

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
        
        if (
          existing.purchaseStatus ===
          PurchaseStatus.ACQUIRED
        ) {
          throw new Error(
            "ACQUIRED_PURCHASE_CANNOT_BE_REMOVED",
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
    "ACQUIRED_PURCHASE_CANNOT_BE_REMOVED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Este item possui compra adquirida e não pode ser removido do projeto.",
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