import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentMovementType,
  EquipmentUnitMovementType,
  EquipmentRmaStatus,
  EquipmentStatus,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUANTITY = 999999;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StockAdjustmentBody = {
  quantity?: unknown;
  reason?: unknown;
  notes?: unknown;
  serialNumbersToAdd?: unknown;
  serialNumbersToRemove?: unknown;
};

type SessionUser = {
  id?: string;
  role?: string;
};

function parseQuantity(
  value: unknown,
): number {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_QUANTITY
  ) {
    throw new Error(
      `A quantidade deve ser um número inteiro entre 0 e ${MAX_QUANTITY}.`,
    );
  }

  return quantity;
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

function parseSerialNumbers(
  value: unknown,
): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      "Os números de série informados são inválidos.",
    );
  }

  if (
    value.some(
      (serialNumber) =>
        typeof serialNumber !== "string",
    )
  ) {
    throw new Error(
      "Os números de série informados são inválidos.",
    );
  }

  const serialNumbers = value
    .map((serialNumber) =>
      serialNumber.trim().toUpperCase(),
    )
    .filter(Boolean);

  if (
    new Set(serialNumbers).size !==
    serialNumbers.length
  ) {
    throw new Error(
      "Existem números de série duplicados.",
    );
  }

  return serialNumbers;
}

export async function PATCH(
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
  sessionUser.role !== "ADMIN" &&
  sessionUser.role !== "BACKOFFICE"
) {
  return Response.json(
    {
      success: false,
      message:
        "Você não possui permissão para ajustar o estoque.",
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
    const { id } =
      await context.params;

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "Equipamento não informado.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request.json()) as StockAdjustmentBody;

    const requestedQuantity =
      parseQuantity(
        body.quantity,
      );

    const reason =
      optionalText(
        body.reason,
      );

    const notes =
      optionalText(
        body.notes,
      );

    const serialNumbersToAdd =
      parseSerialNumbers(
        body.serialNumbersToAdd,
      );

    const serialNumbersToRemove =
      parseSerialNumbers(
        body.serialNumbersToRemove,
      );

    const result =
      await prisma.$transaction(
        async (transaction) => {
          const equipment =
            await transaction.equipment.findUnique(
              {
                where: {
                  id,
                },

                select: {
                  id: true,
                  name: true,
                  quantity: true,
                  damagedQuantity: true,
                  status: true,
                  rmaStatus: true,

                 equipmentUnits: {
                  select: {
                    id: true,
                    serialNumber: true,
                    condition: true,
                    projectAssignment: {
                      select: {
                        id: true,
                      },
                    },
                    movements: {
                      orderBy: {
                        createdAt: "desc",
                      },
                      take: 1,
                      select: {
                        type: true,
                      },
                    },
                  },
                },
                },
              },
            );

          if (!equipment) {
            throw new Error(
              "EQUIPMENT_NOT_FOUND",
            );
          }

          /*
          * Um equipamento substituído por RMA é mantido somente
          * para rastreabilidade histórica e não pode receber
          * ajustes manuais de estoque operacional.
          */
          if (
            equipment.rmaStatus ===
            EquipmentRmaStatus.REPLACED
          ) {
            throw new Error(
              "HISTORICAL_RMA_EQUIPMENT",
            );
          }

          const previousQuantity =
            Math.max(
              equipment.quantity,
              0,
            );

          if (
            requestedQuantity ===
            previousQuantity
          ) {
            throw new Error(
              "STOCK_NOT_CHANGED",
            );
          }

          const difference =
            requestedQuantity -
            previousQuantity;

          const movementQuantity =
            Math.abs(difference);

          if (
            difference > 0 &&
            serialNumbersToAdd.length >
              movementQuantity
          ) {
            throw new Error(
              "A quantidade de números de série informados é maior que a quantidade adicionada ao estoque.",
            );
          }

          if (
            difference < 0 &&
            serialNumbersToRemove.length >
              movementQuantity
          ) {
            throw new Error(
              "A quantidade de números de série informados é maior que a quantidade removida do estoque.",
            );
          }

          if (
            difference > 0 &&
            serialNumbersToRemove.length > 0
          ) {
            throw new Error(
              "Não é possível remover números de série em uma entrada de estoque.",
            );
          }

          if (
            difference < 0 &&
            serialNumbersToAdd.length > 0
          ) {
            throw new Error(
              "Não é possível adicionar números de série em uma redução de estoque.",
            );
          }

          const existingSerialNumbers =
            new Set(
              equipment.equipmentUnits.map(
                (unit) => unit.serialNumber,
              ),
            );

          const invalidSerialNumbersToRemove =
            serialNumbersToRemove.filter(
              (serialNumber) =>
                !existingSerialNumbers.has(
                  serialNumber,
                ),
            );

          if (
            invalidSerialNumbersToRemove.length > 0
          ) {
            throw new Error(
              "Um ou mais números de série selecionados não pertencem a este equipamento.",
            );
          }

          const blockedSerialNumbersToRemove =
            equipment.equipmentUnits.filter(
              (unit) =>
                serialNumbersToRemove.includes(
                  unit.serialNumber,
                ) &&
                (
                  unit.condition !== "OPERATIONAL" ||
                  unit.projectAssignment !== null ||
                  unit.movements[0]?.type === "EXIT"
                ),
            );

          if (blockedSerialNumbersToRemove.length > 0) {
            throw new Error(
              "Não é possível retirar S/N danificados, já baixados ou designados a projetos.",
            );
          }


          const currentIdentifiedUnits =
            equipment.equipmentUnits.filter(
              (unit) =>
                unit.movements[0]?.type !== "EXIT",
            );

          const remainingIdentifiedUnits =
            currentIdentifiedUnits.filter(
              (unit) =>
                !serialNumbersToRemove.includes(
                  unit.serialNumber,
                ),
            );

          const physicalQuantityAfterAdjustment =
            requestedQuantity +
            equipment.damagedQuantity;

          if (
            remainingIdentifiedUnits.length >
            physicalQuantityAfterAdjustment
          ) {
            throw new Error(
              "A redução deixaria mais S/N ativos do que unidades físicas. Selecione os S/N que estão saindo.",
            );
          }
          /*
           * Toda redução manual precisa
           * possuir um motivo registrado.
           */
          if (
            difference < 0 &&
            !reason
          ) {
            throw new Error(
              "REDUCTION_REASON_REQUIRED",
            );
          }

          const movementType =
            difference > 0
              ? EquipmentMovementType.ENTRY
              : EquipmentMovementType.EXIT;

          /*
           * Caso um equipamento zerado
           * estivesse indisponível e volte
           * a possuir estoque operacional,
           * ele torna-se disponível.
           */
          const nextStatus =
            equipment.status ===
              EquipmentStatus.UNAVAILABLE &&
            previousQuantity === 0 &&
            requestedQuantity > 0
              ? EquipmentStatus.AVAILABLE
              : equipment.status;

          const updatedEquipment =
            await transaction.equipment.update(
              {
                where: {
                  id,
                },

                data: {
                  quantity:
                    requestedQuantity,

                  status:
                    nextStatus,

                 equipmentUnits: {
                  create: serialNumbersToAdd.map(
                    (serialNumber) => ({
                      serialNumber,
                    }),
                  ),
                },
                },

                select: {
                  id: true,
                  name: true,
                  quantity: true,
                  damagedQuantity: true,
                  status: true,
                  updatedAt: true,
                },
              },
            );

          if (serialNumbersToRemove.length > 0) {
            const unitsToRemove =
              equipment.equipmentUnits.filter(
                (unit) =>
                  serialNumbersToRemove.includes(
                    unit.serialNumber,
                  ),
              );

            await transaction.equipmentUnitMovement.createMany({
              data: unitsToRemove.map((unit) => ({
                equipmentUnitId: unit.id,
                type: EquipmentUnitMovementType.EXIT,
                projectId: null,
              })),
            });
          }

          const movement =
            await transaction.equipmentMovement.create(
              {
                data: {
                  type:
                    movementType,

                  quantity:
                    movementQuantity,

                  previousQuantity,

                  currentQuantity:
                    requestedQuantity,

                  equipmentId:
                    equipment.id,

                  createdById:
                    sessionUser.id,

                  notes:
                    difference < 0
                      ? [
                          `Redução manual de estoque operacional: ${previousQuantity} → ${requestedQuantity}.`,

                          `Motivo: ${reason}.`,

                          notes
                            ? `Observação: ${notes}.`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : [
                          `Aumento manual de estoque operacional: ${previousQuantity} → ${requestedQuantity}.`,

                          notes
                            ? `Observação: ${notes}.`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" "),
                },

                select: {
                  id: true,
                  type: true,
                  quantity: true,
                  previousQuantity: true,
                  currentQuantity: true,
                  createdAt: true,
                },
              },
            );

          return {
            previousQuantity,

            currentQuantity:
              requestedQuantity,

            difference,

            movement,

            equipment:
              updatedEquipment,
          };
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
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        result.equipment.id,

      userId:
        sessionUser.id,

      description:
        `Estoque operacional do equipamento "${result.equipment.name}" alterado de ${result.previousQuantity} para ${result.currentQuantity} unidade(s).`,

      oldData: {
        quantity:
          result.previousQuantity,

        damagedQuantity:
          result.equipment
            .damagedQuantity,

        physicalStock:
          result.previousQuantity +
          result.equipment
            .damagedQuantity,
      },

      newData: {
        quantity:
          result.currentQuantity,

        damagedQuantity:
          result.equipment
            .damagedQuantity,

        physicalStock:
          result.currentQuantity +
          result.equipment
            .damagedQuantity,

        movementId:
          result.movement.id,

        reason,

        notes,

        difference:
          result.difference,

        serialNumbersAdded:
          serialNumbersToAdd,

        serialNumbersRemoved:
          serialNumbersToRemove,
              },
    });

    return Response.json({
      success: true,

      message:
        result.difference < 0
          ? "Estoque reduzido com sucesso."
          : "Estoque aumentado com sucesso.",

      data: {
        id:
          result.equipment.id,

        name:
          result.equipment.name,

        previousQuantity:
          result.previousQuantity,

        quantity:
          result.currentQuantity,

        damagedQuantity:
          result.equipment
            .damagedQuantity,

        physicalStock:
          result.currentQuantity +
          result.equipment
            .damagedQuantity,

        difference:
          result.difference,

        status:
          result.equipment.status,

        updatedAt:
          result.equipment
            .updatedAt,

        movement:
          result.movement,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao ajustar estoque:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "EQUIPMENT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Equipamento não encontrado.",
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
            "Este equipamento foi substituído por RMA e está preservado somente para histórico. Ajustes de estoque não são permitidos.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "STOCK_NOT_CHANGED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "A quantidade informada é igual ao estoque atual.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "REDUCTION_REASON_REQUIRED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Informe o motivo da redução do estoque.",
        },
        {
          status: 400,
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
        "Este número de série já está cadastrado.",
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
            "O estoque foi alterado simultaneamente. Atualize os dados e tente novamente.",
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
          "Não foi possível atualizar o estoque.",
      },
      {
        status: 500,
      },
    );
  }
}