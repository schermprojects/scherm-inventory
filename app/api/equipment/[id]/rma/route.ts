import { auth } from "@/auth";
import {
  AuditAction,
  AuditEntity,
  EquipmentCondition,
  EquipmentRmaStatus,
  EquipmentStatus,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  reference?: unknown;
  notes?: unknown;
  equipmentUnitId?: unknown;
};

type PatchRequestBody = {
  rmaId?: unknown;
  action?: unknown;
  resolutionNotes?: unknown;
  replacementSerialNumber?: unknown;
};

type RmaAction =
  | "SEND"
  | "APPROVE"
  | "REJECT"
  | "RETURN"
  | "REPLACE";

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function getUserRole(
  role: unknown,
): UserRole | null {
  if (
    role === "ADMIN" ||
    role === "BACKOFFICE" ||
    role === "COMMERCIAL" ||
    role === "VIEWER"
  ) {
    return role;
  }

  return null;
}

/*
 * O RMA altera o processo administrativo de uma peça
 * e, no retorno, poderá alterar também o estoque físico.
 * Por isso somente ADMIN e BACKOFFICE podem gerenciá-lo.
 */
function canManageRma(
  role: UserRole | null,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
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

function requiredNotes(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      "Informe uma observação para abrir o RMA.",
    );
  }

  const notes = value.trim();

  if (notes.length < 3) {
    throw new ValidationError(
      "A observação do RMA deve possuir pelo menos 3 caracteres.",
    );
  }

  return notes;
}

function requiredId(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      `O campo "${label}" é obrigatório.`,
    );
  }

  return value.trim();
}

function requiredResolutionNotes(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      "Informe uma justificativa para rejeitar o RMA.",
    );
  }

  const notes = value.trim();

  if (notes.length < 3) {
    throw new ValidationError(
      "A justificativa da rejeição deve possuir pelo menos 3 caracteres.",
    );
  }

  return notes;
}

function requiredReplacementSerialNumber(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      "Informe o número de série da peça substituta.",
    );
  }

  return value.trim();
}

function parseRmaAction(
  value: unknown,
): RmaAction {
  if (
    value === "SEND" ||
    value === "APPROVE" ||
    value === "REJECT" ||
    value === "RETURN" ||
    value === "REPLACE"
  ) {
    return value;
  }

  throw new ValidationError(
    "A ação de RMA informada é inválida.",
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const role =
      getUserRole(
        session.user.role,
      );

    if (!canManageRma(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para gerenciar RMA.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } =
      await context.params;

    const body =
      (await request.json()) as RequestBody;

    const reference =
      optionalText(
        body.reference,
      );

    const notes =
      requiredNotes(
        body.notes,
      );

    const equipmentUnitId =
      optionalText(
        body.equipmentUnitId,
      );

    const equipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          minimumStock: true,
          serialNumber: true,

          quantity: true,
          installedQuantity: true,
          damagedQuantity: true,

          status: true,
          condition: true,

          rmaStatus: true,
          rmaReference: true,
          rmaNotes: true,
          rmaResolutionNotes: true,
          rmaOpenedAt: true,
          rmaClosedAt: true,
        },
      });

    if (!equipment) {
      return NextResponse.json(
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

    /*
     * damagedQuantity representa a quantidade física
     * atualmente existente no estoque danificado.
     *
     * O RMA só pode ser aberto quando existir pelo
     * menos uma unidade realmente nesse estado.
     */
    if (
      equipment.damagedQuantity <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O RMA só pode ser aberto para um equipamento danificado.",
        },
        {
          status: 409,
        },
      );
    }

    const now = new Date();

  const createdRma =
  await prisma.$transaction(
    async (tx) => {
      const damagedSerializedUnits =
        await tx.equipmentUnit.findMany({
          where: {
            equipmentId: id,
            condition: "DAMAGED",
          },

          select: {
            id: true,
          },
        });

      const activeRmaCount =
        await tx.equipmentRma.count({
          where: {
            equipmentId: id,

            closedAt: null,

            status: {
              in: [
                EquipmentRmaStatus.PENDING,
                EquipmentRmaStatus.SENT,
                EquipmentRmaStatus.APPROVED,
              ],
            },
          },
        });

      if (
        activeRmaCount >=
        equipment.damagedQuantity
      ) {
        throw new ValidationError(
          "Todas as unidades danificadas deste equipamento já possuem RMA ativo.",
        );
      }

      const genericDamagedQuantity =
        Math.max(
          equipment.damagedQuantity -
            damagedSerializedUnits.length,
          0,
        );

      if (equipmentUnitId) {
        const selectedUnit =
          damagedSerializedUnits.find(
            (unit) =>
              unit.id === equipmentUnitId,
          );

        if (!selectedUnit) {
          throw new ValidationError(
            "A unidade selecionada não está danificada ou não pertence a este equipamento.",
          );
        }

        const activeUnitRma =
          await tx.equipmentRma.findFirst({
            where: {
              equipmentUnitId,

              closedAt: null,

              status: {
                in: [
                  EquipmentRmaStatus.PENDING,
                  EquipmentRmaStatus.SENT,
                  EquipmentRmaStatus.APPROVED,
                ],
              },
            },

            select: {
              id: true,
            },
          });

        if (activeUnitRma) {
          throw new ValidationError(
            "Esta unidade já possui um processo de RMA em andamento.",
          );
        }
      } else if (
        genericDamagedQuantity <= 0
      ) {
        throw new ValidationError(
          "Selecione a unidade danificada que será enviada para RMA.",
        );
      }

      return tx.equipmentRma.create({
        data: {
          equipmentId: id,

          equipmentUnitId,

          status:
            EquipmentRmaStatus.PENDING,

          reference,

          notes,

          openedAt:
            now,
        },

        select: {
          id: true,
          status: true,
          equipmentUnitId: true,
          reference: true,
          notes: true,
          openedAt: true,
        },
      });
    },
  );

    const updatedEquipment =
      await prisma.equipment.findUniqueOrThrow({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          serialNumber: true,

          quantity: true,
          installedQuantity: true,
          damagedQuantity: true,

          status: true,
          condition: true,

          rmaStatus: true,
          rmaReference: true,
          rmaNotes: true,
          rmaOpenedAt: true,
          rmaClosedAt: true,
        },
      });

    try {
      await logAudit({
        action:
          AuditAction.UPDATE,

        entity:
          AuditEntity.EQUIPMENT,

        entityId:
          updatedEquipment.id,

        userId:
          session.user.id ??
          null,

        description:
          `RMA do equipamento "${updatedEquipment.name}" aberto.`,

        oldData: {
          damagedQuantity:
            equipment.damagedQuantity,
        },

        newData: {
          rmaId:
            createdRma.id,

          rmaStatus:
            createdRma.status,

          equipmentUnitId:
            createdRma.equipmentUnitId,

          reference:
            createdRma.reference,

          openedAt:
            createdRma.openedAt,
        },
      });
    } catch (auditError) {
      /*
       * O RMA já foi aberto neste ponto.
       * Uma falha de auditoria não deve transformar
       * uma operação bem-sucedida em erro para o usuário.
       */
      console.error(
        "RMA aberto, mas ocorreu erro ao registrar auditoria:",
        auditError,
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "RMA aberto com sucesso.",

      data: {
        rma:
          createdRma,

        equipment: {
          id:
            updatedEquipment.id,

          name:
            updatedEquipment.name,

          damagedQuantity:
            updatedEquipment.damagedQuantity,
        },
      },
    });
  } catch (error) {
    console.error(
      "Erro ao abrir RMA:",
      error,
    );

    if (error instanceof SyntaxError) {
      return NextResponse.json(
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
      error instanceof
      ValidationError
    ) {
      return NextResponse.json(
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

    /*
     * Erros inesperados não devem expor detalhes
     * internos da aplicação para o cliente.
     */
    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível abrir o RMA.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const role =
      getUserRole(
        session.user.role,
      );

    if (!canManageRma(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para gerenciar RMA.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } =
      await context.params;

    const body =
      (await request.json()) as PatchRequestBody;

    const rmaId =
    requiredId(
      body.rmaId,
      "RMA",
    );

    const action =
      parseRmaAction(
        body.action,
      );

    const equipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          minimumStock: true,

          quantity: true,
          installedQuantity: true,
          damagedQuantity: true,

          status: true,
          condition: true,

          rmaStatus: true,
          rmaReference: true,
          rmaNotes: true,
          rmaResolutionNotes: true,
          rmaOpenedAt: true,
          rmaClosedAt: true,
        },
      });

    if (!equipment) {
      return NextResponse.json(
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

    const activeRma =
  await prisma.equipmentRma.findFirst({
    where: {
      id: rmaId,
      equipmentId: id,
      closedAt: null,

      status: {
        in: [
          EquipmentRmaStatus.PENDING,
          EquipmentRmaStatus.SENT,
          EquipmentRmaStatus.APPROVED,
        ],
      },
    },

    select: {
      id: true,
      status: true,
      equipmentUnitId: true,

      equipmentUnit: {
        select: {
          serialNumber: true,
        },
      },
    },
  });

  if (!activeRma) {
  return NextResponse.json(
    {
      success: false,
      message:
        "O processo de RMA informado não está ativo.",
    },
    {
      status: 404,
    },
  );
}

if (action === "SEND") {
  if (
    activeRma.status !==
    EquipmentRmaStatus.PENDING
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Somente um RMA pendente pode ser marcado como enviado.",
      },
      {
        status: 409,
      },
    );
  }

  const rmaUpdate =
    await prisma.equipmentRma.updateMany({
      where: {
        id: activeRma.id,

        status:
          EquipmentRmaStatus.PENDING,

        closedAt: null,
      },

      data: {
        status:
          EquipmentRmaStatus.SENT,
      },
    });

  if (rmaUpdate.count !== 1) {
    return NextResponse.json(
      {
        success: false,
        message:
          "O RMA não pôde ser marcado como enviado porque seu estado foi alterado.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        equipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `RMA do equipamento "${equipment.name}" marcado como enviado.`,

      oldData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.PENDING,
      },

      newData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.SENT,
      },
    });
  } catch (auditError) {
    console.error(
      "RMA enviado, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "RMA marcado como enviado com sucesso.",

    data: {
      rmaId:
        activeRma.id,

      status:
        EquipmentRmaStatus.SENT,
    },
  });
}

if (action === "APPROVE") {
  if (
    activeRma.status !==
    EquipmentRmaStatus.SENT
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Somente um RMA enviado pode ser aprovado.",
      },
      {
        status: 409,
      },
    );
  }

  const resolutionNotes =
    optionalText(
      body.resolutionNotes,
    );

  const rmaUpdate =
    await prisma.equipmentRma.updateMany({
      where: {
        id: activeRma.id,

        status:
          EquipmentRmaStatus.SENT,

        closedAt: null,
      },

      data: {
        status:
          EquipmentRmaStatus.APPROVED,

        resolutionNotes,

        closedAt: null,
      },
    });

  if (rmaUpdate.count !== 1) {
    return NextResponse.json(
      {
        success: false,
        message:
          "O RMA não pôde ser aprovado porque seu estado foi alterado.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        equipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `RMA do equipamento "${equipment.name}" aprovado.`,

      oldData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.SENT,
      },

      newData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.APPROVED,

        resolutionNotes,
      },
    });
  } catch (auditError) {
    console.error(
      "RMA aprovado, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "RMA aprovado com sucesso.",

    data: {
      rmaId:
        activeRma.id,

      status:
        EquipmentRmaStatus.APPROVED,
    },
  });
}

if (action === "REJECT") {
  if (
    activeRma.status !==
    EquipmentRmaStatus.SENT
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Somente um RMA enviado pode ser rejeitado.",
      },
      {
        status: 409,
      },
    );
  }

  const resolutionNotes =
    requiredResolutionNotes(
      body.resolutionNotes,
    );

  const now =
    new Date();

  const rmaUpdate =
    await prisma.equipmentRma.updateMany({
      where: {
        id:
          activeRma.id,

        status:
          EquipmentRmaStatus.SENT,

        closedAt:
          null,
      },

      data: {
        status:
          EquipmentRmaStatus.REJECTED,

        resolutionNotes,

        closedAt:
          now,
      },
    });

  if (rmaUpdate.count !== 1) {
    return NextResponse.json(
      {
        success: false,
        message:
          "O RMA não pôde ser rejeitado porque seu estado foi alterado.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        equipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `RMA do equipamento "${equipment.name}" rejeitado.`,

      oldData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.SENT,
      },

      newData: {
        rmaId:
          activeRma.id,

        rmaStatus:
          EquipmentRmaStatus.REJECTED,

        resolutionNotes,

        closedAt:
          now,
      },
    });
  } catch (auditError) {
    console.error(
      "RMA rejeitado, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "RMA rejeitado com sucesso.",

    data: {
      rmaId:
        activeRma.id,

      status:
        EquipmentRmaStatus.REJECTED,

      closedAt:
        now,
    },
  });
}

if (action === "RETURN") {
  if (
    activeRma.status !==
    EquipmentRmaStatus.APPROVED
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Somente um RMA aprovado pode registrar o retorno reparado.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    equipment.damagedQuantity <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Não existe uma unidade danificada para retornar ao estoque.",
      },
      {
        status: 409,
      },
    );
  }

  const resolutionNotes =
    optionalText(
      body.resolutionNotes,
    );

  const now =
    new Date();

  const updatedEquipment =
    await prisma.$transaction(
      async (tx) => {
        const updateResult =
          await tx.equipment.updateMany({
            where: {
              id,

              damagedQuantity: {
                gte: 1,
              },
            },

            data: {
              quantity: {
                increment: 1,
              },

              damagedQuantity: {
                decrement: 1,
              },

              status:
                EquipmentStatus.AVAILABLE,
            },
          });

        if (
          updateResult.count !== 1
        ) {
          throw new ValidationError(
            "O retorno não pôde ser registrado porque o estoque físico foi alterado.",
          );
        }

        if (
          activeRma.equipmentUnitId
        ) {
          const unitUpdate =
            await tx.equipmentUnit.updateMany({
              where: {
                id:
                  activeRma.equipmentUnitId,

                equipmentId:
                  id,

                condition:
                  "DAMAGED",
              },

              data: {
                condition:
                  "OPERATIONAL",
              },
            });

          if (
            unitUpdate.count !== 1
          ) {
            throw new ValidationError(
              "A unidade física do RMA não pôde retornar ao estoque operacional.",
            );
          }

          await tx.equipmentUnitMovement.create({
            data: {
              type:
                "RETURN",

              equipmentUnitId:
                activeRma.equipmentUnitId,

              projectId:
                null,
            },
          });
        }

        await tx.equipmentMovement.create({
          data: {
            type:
              "RETURN",

            quantity:
              1,

            previousQuantity:
              equipment.quantity,

            currentQuantity:
              equipment.quantity + 1,

            equipmentId:
              id,

            createdById:
              session.user.id ??
              null,

            notes:
              "Retorno reparado de unidade em RMA.",
          },
        });

        const rmaUpdate =
          await tx.equipmentRma.updateMany({
            where: {
              id:
                activeRma.id,

              status:
                EquipmentRmaStatus.APPROVED,

              closedAt:
                null,
            },

            data: {
              status:
                EquipmentRmaStatus.RETURNED,

              resolutionNotes,

              closedAt:
                now,
            },
          });

        if (
          rmaUpdate.count !== 1
        ) {
          throw new ValidationError(
            "O histórico do RMA não pôde ser atualizado.",
          );
        }

        return tx.equipment.findUniqueOrThrow({
          where: {
            id,
          },

          select: {
            id: true,
            name: true,
            serialNumber: true,

            quantity: true,
            installedQuantity: true,
            damagedQuantity: true,

            status: true,
            condition: true,
          },
        });
      },
    );

  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        updatedEquipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `RMA do equipamento "${updatedEquipment.name}" retornou reparado.`,

      oldData: {
        rmaId:
          activeRma.id,

        quantity:
          equipment.quantity,

        damagedQuantity:
          equipment.damagedQuantity,

        rmaStatus:
          EquipmentRmaStatus.APPROVED,
      },

      newData: {
        rmaId:
          activeRma.id,

        quantity:
          updatedEquipment.quantity,

        damagedQuantity:
          updatedEquipment.damagedQuantity,

        rmaStatus:
          EquipmentRmaStatus.RETURNED,

        resolutionNotes,

        closedAt:
          now,
      },
    });
  } catch (auditError) {
    console.error(
      "Retorno do RMA concluído, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "Retorno reparado registrado com sucesso.",

    data: {
      equipment:
        updatedEquipment,

      rmaId:
        activeRma.id,

      status:
        EquipmentRmaStatus.RETURNED,
    },
  });
}

if (action === "REPLACE") {
  if (
    activeRma.status !==
    EquipmentRmaStatus.APPROVED
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Somente um RMA aprovado pode registrar uma peça substituta.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    equipment.damagedQuantity <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Não existe uma unidade danificada para ser substituída.",
      },
      {
        status: 409,
      },
    );
  }

  const replacementSerialNumber =
    requiredReplacementSerialNumber(
      body.replacementSerialNumber,
    );

  const resolutionNotes =
    optionalText(
      body.resolutionNotes,
    );

  const existingEquipmentUnit =
    await prisma.equipmentUnit.findUnique({
      where: {
        serialNumber:
          replacementSerialNumber,
      },

      select: {
        id: true,
      },
    });

  if (existingEquipmentUnit) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Já existe uma unidade com o número de série informado.",
      },
      {
        status: 409,
      },
    );
  }

  const now =
    new Date();

  const result =
    await prisma.$transaction(
      async (tx) => {
        const replacementEquipmentUnit =
          await tx.equipmentUnit.create({
            data: {
              equipmentId:
                id,

              serialNumber:
                replacementSerialNumber,

              condition:
                "OPERATIONAL",
            },
          });

        await tx.equipmentUnitMovement.create({
          data: {
            type:
              "ENTRY",

            equipmentUnitId:
              replacementEquipmentUnit.id,

            projectId:
              null,
          },
        });

        const updateResult =
          await tx.equipment.updateMany({
            where: {
              id,

              damagedQuantity: {
                gte: 1,
              },
            },

            data: {
              quantity: {
                increment: 1,
              },

              damagedQuantity: {
                decrement: 1,
              },

              status:
                EquipmentStatus.AVAILABLE,
            },
          });

        if (
          updateResult.count !== 1
        ) {
          throw new ValidationError(
            "A substituição não pôde ser registrada porque o estoque físico foi alterado.",
          );
        }

        if (
          activeRma.equipmentUnitId
        ) {
          const originalUnitUpdate =
            await tx.equipmentUnit.updateMany({
              where: {
                id:
                  activeRma.equipmentUnitId,

                equipmentId:
                  id,

                condition:
                  "DAMAGED",
              },

              data: {
                condition:
                  "REPLACED",
              },
            });

          if (
            originalUnitUpdate.count !== 1
          ) {
            throw new ValidationError(
              "A unidade original do RMA não pôde ser marcada como substituída.",
            );
          }
        }

        await tx.equipmentMovement.create({
          data: {
            type:
              "ENTRY",

            quantity:
              1,

            previousQuantity:
              equipment.quantity,

            currentQuantity:
              equipment.quantity + 1,

            equipmentId:
              id,

            createdById:
              session.user.id ??
              null,

            notes:
              `Entrada de unidade substituta recebida por RMA: ${replacementSerialNumber}.`,
          },
        });

        const rmaUpdate =
          await tx.equipmentRma.updateMany({
            where: {
              id:
                activeRma.id,

              status:
                EquipmentRmaStatus.APPROVED,

              closedAt:
                null,
            },

            data: {
              status:
                EquipmentRmaStatus.REPLACED,

              resolutionNotes,

              closedAt:
                now,

              replacementEquipmentUnitId:
                replacementEquipmentUnit.id,
            },
          });

        if (
          rmaUpdate.count !== 1
        ) {
          throw new ValidationError(
            "O histórico do RMA não pôde ser atualizado.",
          );
        }

        const updatedEquipment =
          await tx.equipment.findUniqueOrThrow({
            where: {
              id,
            },

            select: {
              id: true,
              name: true,
              serialNumber: true,

              quantity: true,
              installedQuantity: true,
              damagedQuantity: true,

              status: true,
              condition: true,
            },
          });

        return {
          updatedEquipment,
          replacementEquipmentUnit,
        };
      },
    );

  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        result.updatedEquipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `RMA do equipamento "${equipment.name}" foi resolvido com substituição de unidade.`,

      oldData: {
        rmaId:
          activeRma.id,

        damagedQuantity:
          equipment.damagedQuantity,

        rmaStatus:
          EquipmentRmaStatus.APPROVED,

        originalEquipmentUnitId:
          activeRma.equipmentUnitId,
        
        originalSerialNumber:
          activeRma.equipmentUnit
            ?.serialNumber ??
          null,
      },

      newData: {
        rmaId:
          activeRma.id,

        damagedQuantity:
          result.updatedEquipment
            .damagedQuantity,

        rmaStatus:
          EquipmentRmaStatus.REPLACED,

        replacementEquipmentUnitId:
          result.replacementEquipmentUnit.id,

        replacementSerialNumber:
          result.replacementEquipmentUnit.serialNumber,

        resolutionNotes,

        closedAt:
          now.toISOString(),
      },
    });
  } catch (auditError) {
    console.error(
      "Substituição do RMA concluída, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "Substituição do RMA registrada com sucesso.",

    data: {
      equipment:
        result.updatedEquipment,

      replacementEquipmentUnit:
        result.replacementEquipmentUnit,

      rmaId:
        activeRma.id,

      status:
        EquipmentRmaStatus.REPLACED,
    },
  });
}

    return NextResponse.json(
      {
        success: false,
        message:
          "Ação de RMA não suportada.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao atualizar RMA:",
      error,
    );

    if (
      error instanceof SyntaxError
    ) {
      return NextResponse.json(
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
      error instanceof
      ValidationError
    ) {
      return NextResponse.json(
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

    /*
     * Erros inesperados não devem expor detalhes
     * internos da aplicação para o cliente.
     */
    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível atualizar o RMA.",
      },
      {
        status: 500,
      },
    );
  }
}