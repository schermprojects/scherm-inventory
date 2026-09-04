import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentMovementType,
  EquipmentRmaStatus,
  ProjectStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    equipmentId: string;
  }>;
};

type SessionUser = {
  id?: string;
  role?: UserRole;
};

type ReturnCondition =
  | "NORMAL"
  | "DAMAGED";

type ReturnEquipmentBody = {
  quantity?: unknown;
  condition?: unknown;
};

/*
 * Registrar uma devolução movimenta fisicamente o estoque
 * e altera o vínculo do equipamento com o projeto.
 * Por isso, a operação é restrita à gestão operacional.
 */
function canManageEquipment(
  role: UserRole | undefined,
): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.BACKOFFICE
  );
}

function parseQuantity(
  value: unknown,
): number {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999999
  ) {
    throw new Error(
      "A quantidade da devolução deve ser um número inteiro maior que zero.",
    );
  }

  return quantity;
}

function parseReturnCondition(
  value: unknown,
): ReturnCondition {
  if (
    value === "NORMAL" ||
    value === "DAMAGED"
  ) {
    return value;
  }

  throw new Error(
    "A condição da devolução é inválida.",
  );
}

/**
 * POST
 * /api/projects/[id]/equipment/[equipmentId]/return
 *
 * Body:
 * {
 *   quantity: 1,
 *   condition: "NORMAL" | "DAMAGED"
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
          "Você não possui permissão para registrar devoluções.",
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
    const {
      id: projectId,
      equipmentId,
    } = await context.params;

    const body =
      (await request.json()) as ReturnEquipmentBody;

    const quantity = parseQuantity(
      body.quantity,
    );

    const condition =
      parseReturnCondition(
        body.condition,
      );

    const result =
      await prisma.$transaction(
        async (transaction) => {
          /*
           * Carrega o vínculo entre
           * projeto e equipamento.
           */
          const projectEquipment =
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
                      name: true,
                      status: true,
                    },
                  },

                  equipment: {
                    select: {
                      id: true,
                      name: true,
                      quantity: true,
                      damagedQuantity: true,
                      rmaStatus: true,
                    },
                  },
                },
              },
            );

          if (!projectEquipment) {
            throw new Error(
              "PROJECT_EQUIPMENT_NOT_FOUND",
            );
          }

          /*
          * Um equipamento substituído por RMA permanece somente
          * como registro histórico. Mesmo que exista um vínculo
          * antigo com o projeto, ele não pode retornar ao estoque
          * operacional nem ao estoque danificado.
          */
          if (
            projectEquipment.equipment
              .rmaStatus ===
            EquipmentRmaStatus.REPLACED
          ) {
            throw new Error(
              "HISTORICAL_RMA_EQUIPMENT",
            );
          }

          /*
           * Projeto concluído continua
           * totalmente bloqueado.
           *
           * É necessário reabrir antes
           * de registrar devoluções.
           */
          if (
            projectEquipment.project
              .status ===
            ProjectStatus.COMPLETED
          ) {
            throw new Error(
              "COMPLETED_PROJECT_LOCKED",
            );
          }

          if (
            projectEquipment.project
              .status ===
            ProjectStatus.CANCELLED
          ) {
            throw new Error(
              "CANCELLED_PROJECT_LOCKED",
            );
          }

          /*
           * Só existe devolução se houver
           * quantidade efetivamente baixada.
           */
          if (
            projectEquipment
              .allocatedQuantity <= 0
          ) {
            throw new Error(
              "NO_ALLOCATED_QUANTITY",
            );
          }

          /*
           * Nunca pode devolver mais do que
           * permanece baixado no projeto.
           */
          if (
            quantity >
            projectEquipment
              .allocatedQuantity
          ) {
            throw new Error(
              "RETURN_QUANTITY_EXCEEDS_ALLOCATED",
            );
          }

          const previousAvailableQuantity =
            projectEquipment.equipment
              .quantity;

          const previousDamagedQuantity =
            projectEquipment.equipment
              .damagedQuantity;

          let currentAvailableQuantity =
            previousAvailableQuantity;

          let currentDamagedQuantity =
            previousDamagedQuantity;

          /*
           * DEVOLUÇÃO NORMAL
           *
           * A unidade volta para o estoque
           * disponível.
           */
          if (
            condition === "NORMAL"
          ) {
            currentAvailableQuantity =
              previousAvailableQuantity +
              quantity;

            await transaction.equipment.update(
              {
                where: {
                  id: equipmentId,
                },

                data: {
                  quantity: {
                    increment:
                      quantity,
                  },
                },
              },
            );
          }

          /*
           * DEVOLUÇÃO DANIFICADA
           *
           * A unidade existe fisicamente,
           * mas NÃO volta ao estoque
           * disponível.
           */
          if (
            condition === "DAMAGED"
          ) {
            currentDamagedQuantity =
              previousDamagedQuantity +
              quantity;

            await transaction.equipment.update(
              {
                where: {
                  id: equipmentId,
                },

                data: {
                  damagedQuantity: {
                    increment:
                      quantity,
                  },
                },
              },
            );
          }

 /*
 * A unidade devolvida deixa de fazer
 * parte da quantidade atual do projeto
 * e também deixa de estar baixada.
 */
const remainingProjectQuantity =
  projectEquipment.quantity -
  quantity;

const remainingAllocatedQuantity =
  projectEquipment.allocatedQuantity -
  quantity;

/*
 * Esta validação é uma proteção extra.
 * Em condições normais ela nunca deve
 * acontecer, porque allocatedQuantity
 * não deve ser maior que quantity.
 */
if (
  remainingProjectQuantity < 0 ||
  remainingAllocatedQuantity < 0
) {
  throw new Error(
    "INVALID_RETURN_QUANTITY",
  );
}

let updatedProjectEquipment: {
  id: string;
  quantity: number;
  allocatedQuantity: number;
};

if (remainingProjectQuantity === 0) {
  /*
   * Todas as unidades desse equipamento
   * foram devolvidas.
   *
   * Remove o vínculo atual do projeto.
   * O histórico continua preservado nos
   * movimentos de estoque e auditoria.
   */
  await transaction.projectEquipment.delete({
    where: {
      id:
        projectEquipment.id,
    },
  });

  updatedProjectEquipment = {
    id:
      projectEquipment.id,

    quantity: 0,

    allocatedQuantity: 0,
  };
} else {
  /*
   * Ainda existem unidades desse
   * equipamento no projeto.
   *
   * Reduz tanto a quantidade atual do
   * projeto quanto a quantidade baixada.
   */
  updatedProjectEquipment =
    await transaction.projectEquipment.update({
      where: {
        id:
          projectEquipment.id,
      },

      data: {
        quantity:
          remainingProjectQuantity,

        allocatedQuantity:
          remainingAllocatedQuantity,
      },

      select: {
        id: true,
        quantity: true,
        allocatedQuantity: true,
      },
    });
}

          /*
           * Registra histórico da
           * movimentação.
           *
           * Para retorno danificado,
           * quantity disponível não muda.
           */
          const movement =
            await transaction.equipmentMovement.create(
              {
                data: {
                  type:
                    condition ===
                    "NORMAL"
                      ? EquipmentMovementType.RETURN
                      : EquipmentMovementType.DAMAGED_RETURN,

                  quantity,

                  previousQuantity:
                    previousAvailableQuantity,

                  currentQuantity:
                    currentAvailableQuantity,

                  equipmentId,

                  projectId,

                  createdById:
                    sessionUser.id,

                  notes:
                    condition ===
                    "NORMAL"
                      ? `Devolução de ${quantity} unidade(s) do projeto "${projectEquipment.project.name}" para o estoque disponível.`
                      : `Devolução de ${quantity} unidade(s) danificada(s) do projeto "${projectEquipment.project.name}".`,
                },
              },
            );

          return {
            projectEquipment,
            updatedProjectEquipment,
            movement,

            previousAvailableQuantity,
            currentAvailableQuantity,

            previousDamagedQuantity,
            currentDamagedQuantity,
          };
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

    await logAudit({
      action:
        AuditAction.DEALLOCATE,

      entity:
        AuditEntity.PROJECT,

      entityId:
        projectId,

      userId:
        sessionUser.id,

      description:
        condition === "NORMAL"
          ? `${quantity} unidade(s) de "${result.projectEquipment.equipment.name}" devolvida(s) ao estoque pelo projeto "${result.projectEquipment.project.name}".`
          : `${quantity} unidade(s) de "${result.projectEquipment.equipment.name}" devolvida(s) como danificada(s) pelo projeto "${result.projectEquipment.project.name}".`,

      oldData: {
        projectEquipmentId:
          result.projectEquipment.id,

        equipmentId,

        allocatedQuantity:
          result.projectEquipment
            .allocatedQuantity,

        availableQuantity:
          result.previousAvailableQuantity,

        damagedQuantity:
          result.previousDamagedQuantity,
      },

      newData: {
        projectEquipmentId:
          result.updatedProjectEquipment.id,

        equipmentId,

        allocatedQuantity:
          result.updatedProjectEquipment
            .allocatedQuantity,

        availableQuantity:
          result.currentAvailableQuantity,

        damagedQuantity:
          result.currentDamagedQuantity,

        returnCondition:
          condition,

        returnedQuantity:
          quantity,
      },
    });

    return Response.json({
      success: true,

      message:
        condition === "NORMAL"
          ? quantity === 1
            ? "1 unidade devolvida ao estoque com sucesso."
            : `${quantity} unidades devolvidas ao estoque com sucesso.`
          : quantity === 1
            ? "1 unidade registrada como danificada com sucesso."
            : `${quantity} unidades registradas como danificadas com sucesso.`,

      data: {
        equipmentId,

        returnedQuantity:
          quantity,

        condition,

        allocatedQuantity:
          result.updatedProjectEquipment
            .allocatedQuantity,

        availableQuantity:
          result.currentAvailableQuantity,

        damagedQuantity:
          result.currentDamagedQuantity,

        movementId:
          result.movement.id,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao registrar devolução do equipamento:",
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
    "HISTORICAL_RMA_EQUIPMENT"
) {
  return Response.json(
    {
      success: false,
      message:
        "Este equipamento foi substituído por RMA e está preservado somente para histórico. Devoluções não são permitidas.",
    },
    {
      status: 409,
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
            "O projeto está concluído. Reabra o projeto antes de registrar devoluções.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "CANCELLED_PROJECT_LOCKED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Projetos cancelados não podem receber devoluções.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "NO_ALLOCATED_QUANTITY"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento não possui unidades baixadas para devolver.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "RETURN_QUANTITY_EXCEEDS_ALLOCATED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A quantidade devolvida não pode ser maior que a quantidade atualmente baixada.",
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
            "O estoque foi alterado simultaneamente por outro usuário. Tente novamente.",
        },
        {
          status: 409,
        },
      );
    }

    if (
  error instanceof Error &&
  error.message ===
    "INVALID_RETURN_QUANTITY"
) {
  return Response.json(
    {
      success: false,
      message:
        "A quantidade devolvida é incompatível com a quantidade atual do equipamento no projeto.",
    },
    {
      status: 409,
    },
  );
}

    if (
      error instanceof SyntaxError
    ) {
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
          "Não foi possível registrar a devolução.",
      },
      {
        status: 500,
      },
    );
  }
}