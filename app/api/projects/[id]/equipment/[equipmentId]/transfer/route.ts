import {
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

type TransferReservationBody = {
  sourceProjectId?: unknown;
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
    role === UserRole.BACKOFFICE ||
    role === UserRole.COMMERCIAL
  );
}

function requiredProjectId(
  value: unknown,
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      "SOURCE_PROJECT_ID_INVALID",
    );
  }

  return value.trim();
}

function requiredTransferQuantity(
  value: unknown,
) {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999999
  ) {
    throw new Error(
      "TRANSFER_QUANTITY_INVALID",
    );
  }

  return quantity;
}

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
          "Você não possui permissão para consultar transferências de reservas.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: targetProjectId,
      equipmentId,
    } = await context.params;

    const targetReservation =
      await prisma.projectEquipment.findUnique(
        {
          where: {
            projectId_equipmentId: {
              projectId:
                targetProjectId,
              equipmentId,
            },
          },

          select: {
            quantity: true,
            reservedQuantity: true,
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

    if (!targetReservation) {
      return Response.json(
        {
          success: false,
          message:
            "A necessidade do projeto de destino não foi encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    const targetShortage =
      Math.max(
        targetReservation.quantity -
          targetReservation
            .reservedQuantity -
          targetReservation
            .allocatedQuantity,
        0,
      );

    if (
      targetReservation.purchaseStatus ===
      PurchaseStatus.ACQUIRED
    ) {
      return Response.json({
        success: true,
        data: [],
        targetShortage,
        transferLocked: true,
      });
    }

    if (targetShortage === 0) {
      return Response.json({
        success: true,
        data: [],
        targetShortage: 0,
        transferLocked: false,
      });
    }

    const sourceReservations =
      await prisma.projectEquipment.findMany(
        {
          where: {
            equipmentId,

            projectId: {
              not: targetProjectId,
            },

            reservedQuantity: {
              gt: 0,
            },

            OR: [
              {
                purchaseStatus: null,
              },
              {
                purchaseStatus:
                  PurchaseStatus.REQUESTED,
              },
            ],

            project: {
              status: {
                in: [
                  ProjectStatus.PLANNING,
                  ProjectStatus.IN_PROGRESS,
                ],
              },
            },
          },

          include: {
            project: {
              select: {
                id: true,
                name: true,
                clientName: true,
                status: true,
              },
            },

            equipmentUnits: {
              select: {
                equipmentUnitId: true,
              },
            },
          },

          orderBy: {
            project: {
              name: "asc",
            },
          },
        },
      );

    const data =
      sourceReservations
        .map((reservation) => {
          const reservedQuantity =
            Math.max(
              reservation.reservedQuantity,
              0,
            );

          const assignedSerialQuantity =
            reservation.equipmentUnits
              .length;

          const transferableQuantity =
            Math.max(
              reservedQuantity -
                assignedSerialQuantity,
              0,
            );

          return {
            projectId:
              reservation.project.id,

            projectName:
              reservation.project.name,

            clientName:
              reservation.project
                .clientName,

            reservedQuantity,

            assignedSerialQuantity,

            transferableQuantity:
              Math.min(
                transferableQuantity,
                targetShortage,
              ),
          };
        })
        .filter(
          (reservation) =>
            reservation
              .transferableQuantity > 0,
        );

    return Response.json({
      success: true,
      data,
      targetShortage,
      transferLocked: false,
    });
  } catch (error) {
    console.error(
      "Erro ao consultar reservas transferíveis:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível consultar as reservas disponíveis para transferência.",
      },
      {
        status: 500,
      },
    );
  }
}

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
          "Você não possui permissão para transferir reservas entre projetos.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id: targetProjectId,
      equipmentId,
    } = await context.params;

    const body =
      (await request.json()) as TransferReservationBody;

    const sourceProjectId =
      requiredProjectId(
        body.sourceProjectId,
      );

    const quantity =
      requiredTransferQuantity(
        body.quantity,
      );

    if (
      sourceProjectId ===
      targetProjectId
    ) {
      throw new Error(
        "SOURCE_AND_TARGET_PROJECTS_ARE_EQUAL",
      );
    }

const result =
  await prisma.$transaction(
    async (transaction) => {
      const [
        sourceReservation,
        targetReservation,
      ] = await Promise.all([
        transaction.projectEquipment.findUnique(
          {
            where: {
              projectId_equipmentId: {
                projectId:
                  sourceProjectId,
                equipmentId,
              },
            },

            include: {
              project: {
                select: {
                  id: true,
                  name: true,
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
        ),

        transaction.projectEquipment.findUnique(
          {
            where: {
              projectId_equipmentId: {
                projectId:
                  targetProjectId,
                equipmentId,
              },
            },

            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        ),
      ]);

      if (!sourceReservation) {
        throw new Error(
          "SOURCE_RESERVATION_NOT_FOUND",
        );
      }

      if (!targetReservation) {
        throw new Error(
          "TARGET_RESERVATION_NOT_FOUND",
        );
      }

        const activeStatuses: ProjectStatus[] = [
        ProjectStatus.PLANNING,
        ProjectStatus.IN_PROGRESS,
        ];

      if (
        !activeStatuses.includes(
          sourceReservation.project.status,
        ) ||
        !activeStatuses.includes(
          targetReservation.project.status,
        )
      ) {
        throw new Error(
          "INACTIVE_PROJECT_TRANSFER",
        );
      }

      /*
       * Compra adquirida fica totalmente
       * protegida contra redistribuição.
       */
      if (
        sourceReservation.purchaseStatus ===
          PurchaseStatus.ACQUIRED ||
        targetReservation.purchaseStatus ===
          PurchaseStatus.ACQUIRED
      ) {
        throw new Error(
          "ACQUIRED_PURCHASE_TRANSFER_LOCKED",
        );
      }

      const sourceReservedQuantity =
        Math.max(
          sourceReservation.reservedQuantity,
          0,
        );

      const targetShortage =
        Math.max(
          targetReservation.quantity -
            targetReservation
              .reservedQuantity -
            targetReservation
              .allocatedQuantity,
          0,
        );

      if (targetShortage === 0) {
        throw new Error(
          "TARGET_HAS_NO_SHORTAGE",
        );
      }

      if (quantity > targetShortage) {
        throw new Error(
          "TRANSFER_EXCEEDS_TARGET_SHORTAGE",
        );
      }

      /*
       * S/N já designados permanecem presos
       * ao projeto de origem neste fluxo.
       *
       * Neste primeiro fluxo de transferência
       * só movimentamos reserva genérica.
       */
      const assignedSerialQuantity =
        sourceReservation.equipmentUnits
          .length;

      const transferableQuantity =
        Math.max(
          sourceReservedQuantity -
            assignedSerialQuantity,
          0,
        );

      if (
        quantity >
        transferableQuantity
      ) {
        throw new Error(
          "SOURCE_RESERVATION_INSUFFICIENT",
        );
      }

      const updatedSource =
        await transaction.projectEquipment.update(
          {
            where: {
              projectId_equipmentId: {
                projectId:
                  sourceProjectId,
                equipmentId,
              },
            },

            data: {
              reservedQuantity: {
                decrement: quantity,
              },
            },

            select: {
              reservedQuantity: true,
            },
          },
        );

      const updatedTarget =
        await transaction.projectEquipment.update(
          {
            where: {
              projectId_equipmentId: {
                projectId:
                  targetProjectId,
                equipmentId,
              },
            },

            data: {
              reservedQuantity: {
                increment: quantity,
              },
            },

            select: {
              reservedQuantity: true,
            },
          },
        );

      return {
        quantity,

        sourceProject: {
          id:
            sourceReservation.project.id,
          name:
            sourceReservation.project.name,
          reservedQuantity:
            updatedSource.reservedQuantity,
        },

        targetProject: {
          id:
            targetReservation.project.id,
          name:
            targetReservation.project.name,
          reservedQuantity:
            updatedTarget.reservedQuantity,
        },
      };
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
    "Reserva transferida com sucesso.",
  data: result,
});
  } catch (error) {
    if (
      error instanceof SyntaxError
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
      error instanceof Error &&
      error.message ===
        "SOURCE_PROJECT_ID_INVALID"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto de origem informado é inválido.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "TRANSFER_QUANTITY_INVALID"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A quantidade a transferir deve ser um número inteiro maior que zero.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "SOURCE_AND_TARGET_PROJECTS_ARE_EQUAL"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto de origem e o projeto de destino devem ser diferentes.",
        },
        {
          status: 400,
        },
      );
    }

    if (
  error instanceof Error &&
  error.message ===
    "SOURCE_RESERVATION_NOT_FOUND"
) {
  return Response.json(
    {
      success: false,
      message:
        "A reserva do projeto de origem não foi encontrada.",
    },
    {
      status: 404,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "TARGET_RESERVATION_NOT_FOUND"
) {
  return Response.json(
    {
      success: false,
      message:
        "A reserva do projeto de destino não foi encontrada.",
    },
    {
      status: 404,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "INACTIVE_PROJECT_TRANSFER"
) {
  return Response.json(
    {
      success: false,
      message:
        "A transferência só pode ser realizada entre projetos ativos.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "ACQUIRED_PURCHASE_TRANSFER_LOCKED"
) {
  return Response.json(
    {
      success: false,
      message:
        "Não é possível transferir uma reserva vinculada a uma compra adquirida.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "TARGET_HAS_NO_SHORTAGE"
) {
  return Response.json(
    {
      success: false,
      message:
        "O projeto de destino não possui déficit para este equipamento.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "TRANSFER_EXCEEDS_TARGET_SHORTAGE"
) {
  return Response.json(
    {
      success: false,
      message:
        "A quantidade informada é maior que o déficit do projeto de destino.",
    },
    {
      status: 409,
    },
  );
}

if (
  error instanceof Error &&
  error.message ===
    "SOURCE_RESERVATION_INSUFFICIENT"
) {
  return Response.json(
    {
      success: false,
      message:
        "O projeto de origem não possui reserva genérica suficiente para esta transferência.",
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
        "As reservas foram alteradas por outro usuário. Atualize os dados e tente novamente.",
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
          "Não foi possível processar a transferência da reserva.",
      },
      {
        status: 500,
      },
    );
  }
}