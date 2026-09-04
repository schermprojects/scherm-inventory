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
};

type PatchRequestBody = {
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
 * Um equipamento substituído por RMA é preservado
 * somente como registro histórico. O processo original
 * é terminal e não pode receber um novo RMA.
 */
if (
  equipment.rmaStatus ===
  EquipmentRmaStatus.REPLACED
) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Este equipamento foi substituído por RMA e está preservado somente para histórico.",
    },
    {
      status: 409,
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

    if (
      equipment.rmaStatus !==
      EquipmentRmaStatus.NONE
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este equipamento já possui um processo de RMA.",
        },
        {
          status: 409,
        },
      );
    }

    const now = new Date();

    /*
     * Abrir um RMA não movimenta estoque.
     *
     * A peça continua no bucket damagedQuantity
     * até existir um retorno físico ou uma substituição.
     */
    const updateResult =
      await prisma.equipment.updateMany({
        where: {
          id,

          damagedQuantity: {
            gte: 1,
          },

          rmaStatus:
            EquipmentRmaStatus.NONE,
        },

        data: {
          rmaStatus:
            EquipmentRmaStatus.PENDING,

          rmaReference:
            reference,

          rmaNotes:
            notes,

          rmaResolutionNotes:
            null,

          rmaOpenedAt:
            now,

          rmaClosedAt:
            null,
        },
      });

    /*
     * O updateMany protege contra duas requisições
     * concorrentes tentando abrir o mesmo RMA.
     */
    if (updateResult.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O RMA não pôde ser aberto porque o estado do equipamento foi alterado.",
        },
        {
          status: 409,
        },
      );
    }

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
          rmaStatus:
            equipment.rmaStatus,

          rmaReference:
            equipment.rmaReference,

          rmaNotes:
            equipment.rmaNotes,

          rmaOpenedAt:
            equipment.rmaOpenedAt,

          rmaClosedAt:
            equipment.rmaClosedAt,
        },

        newData: {
          rmaStatus:
            updatedEquipment.rmaStatus,

          rmaReference:
            updatedEquipment.rmaReference,

          rmaNotes:
            updatedEquipment.rmaNotes,

          rmaOpenedAt:
            updatedEquipment.rmaOpenedAt,

          rmaClosedAt:
            updatedEquipment.rmaClosedAt,
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

      data:
        updatedEquipment,
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

    /*
    * Um equipamento substituído por RMA é preservado
    * somente como registro histórico. O processo original
    * é terminal e não pode receber um novo RMA.
    */
    if (
      equipment.rmaStatus ===
      EquipmentRmaStatus.REPLACED
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este equipamento foi substituído por RMA e está preservado somente para histórico.",
        },
        {
          status: 409,
        },
      );
    }

    if (action === "SEND") {
      if (
        equipment.rmaStatus !==
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

      /*
       * O envio altera apenas o estado administrativo do RMA.
       * A peça permanece no estoque danificado até existir
       * uma movimentação física posterior.
       */
      const updateResult =
        await prisma.equipment.updateMany({
          where: {
            id,

            rmaStatus:
              EquipmentRmaStatus.PENDING,
          },

          data: {
            rmaStatus:
              EquipmentRmaStatus.SENT,
          },
        });

      /*
       * A condição no updateMany protege a transição
       * contra requisições concorrentes.
       */
      if (
        updateResult.count !== 1
      ) {
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
            rmaResolutionNotes: true,
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
            `RMA do equipamento "${updatedEquipment.name}" marcado como enviado.`,

          oldData: {
            rmaStatus:
              equipment.rmaStatus,
          },

          newData: {
            rmaStatus:
              updatedEquipment.rmaStatus,
          },
        });
      } catch (auditError) {
        /*
         * A transição já foi persistida neste ponto.
         * Falha de auditoria não deve transformar
         * uma operação bem-sucedida em erro.
         */
        console.error(
          "RMA enviado, mas ocorreu erro ao registrar auditoria:",
          auditError,
        );
      }

      return NextResponse.json({
        success: true,

        message:
          "RMA marcado como enviado com sucesso.",

        data:
          updatedEquipment,
      });
    }

    if (action === "APPROVE") {
      if (
        equipment.rmaStatus !==
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

      /*
       * Aprovar o RMA representa apenas a decisão
       * administrativa do fabricante.
       *
       * O processo permanece aberto porque ainda falta
       * registrar o retorno físico da peça.
       */
      const updateResult =
        await prisma.equipment.updateMany({
          where: {
            id,

            rmaStatus:
              EquipmentRmaStatus.SENT,
          },

          data: {
            rmaStatus:
              EquipmentRmaStatus.APPROVED,

            rmaResolutionNotes:
              resolutionNotes,

            rmaClosedAt:
              null,
          },
        });

      /*
       * A condição no updateMany garante que somente
       * uma requisição consiga decidir o RMA enviado.
       */
      if (
        updateResult.count !== 1
      ) {
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
            rmaResolutionNotes: true,
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
            `RMA do equipamento "${updatedEquipment.name}" aprovado.`,

          oldData: {
            rmaStatus:
              equipment.rmaStatus,

            rmaResolutionNotes:
              equipment.rmaResolutionNotes,

            rmaClosedAt:
              equipment.rmaClosedAt,
          },

          newData: {
            rmaStatus:
              updatedEquipment.rmaStatus,

            rmaResolutionNotes:
              updatedEquipment.rmaResolutionNotes,

            rmaClosedAt:
              updatedEquipment.rmaClosedAt,
          },
        });
      } catch (auditError) {
        /*
         * A aprovação já foi persistida neste ponto.
         * Falha de auditoria não deve alterar o resultado
         * apresentado ao usuário.
         */
        console.error(
          "RMA aprovado, mas ocorreu erro ao registrar auditoria:",
          auditError,
        );
      }

      return NextResponse.json({
        success: true,

        message:
          "RMA aprovado com sucesso.",

        data:
          updatedEquipment,
      });
    }

    if (action === "REJECT") {
      if (
        equipment.rmaStatus !==
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

      /*
       * A rejeição encerra o processo administrativo,
       * mas não devolve a peça ao estoque operacional.
       *
       * A unidade continua fisicamente danificada até
       * existir outra destinação registrada no sistema.
       */
      const updateResult =
        await prisma.equipment.updateMany({
          where: {
            id,

            rmaStatus:
              EquipmentRmaStatus.SENT,
          },

          data: {
            rmaStatus:
              EquipmentRmaStatus.REJECTED,

            rmaResolutionNotes:
              resolutionNotes,

            rmaClosedAt:
              now,
          },
        });

      /*
       * A condição no updateMany garante que somente
       * uma decisão seja aplicada ao mesmo RMA enviado.
       */
      if (
        updateResult.count !== 1
      ) {
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
            rmaResolutionNotes: true,
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
            `RMA do equipamento "${updatedEquipment.name}" rejeitado.`,

          oldData: {
            rmaStatus:
              equipment.rmaStatus,

            rmaResolutionNotes:
              equipment.rmaResolutionNotes,

            rmaClosedAt:
              equipment.rmaClosedAt,
          },

          newData: {
            rmaStatus:
              updatedEquipment.rmaStatus,

            rmaResolutionNotes:
              updatedEquipment.rmaResolutionNotes,

            rmaClosedAt:
              updatedEquipment.rmaClosedAt,
          },
        });
      } catch (auditError) {
        /*
         * A rejeição já foi persistida neste ponto.
         * Falha de auditoria não deve transformar
         * a operação concluída em erro para o usuário.
         */
        console.error(
          "RMA rejeitado, mas ocorreu erro ao registrar auditoria:",
          auditError,
        );
      }

      return NextResponse.json({
        success: true,

        message:
          "RMA rejeitado com sucesso.",

        data:
          updatedEquipment,
      });
    }

    if (action === "RETURN") {
  if (
    equipment.rmaStatus !==
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

  /*
   * O retorno reparado é o ponto em que o RMA
   * volta a alterar o estoque físico.
   *
   * Uma unidade sai do estoque danificado e volta
   * ao estoque operacional como equipamento reparado.
   */
  const updatedEquipment =
    await prisma.$transaction(
      async (tx) => {
        /*
         * O updateMany protege simultaneamente o estado
         * do RMA e a existência física da unidade danificada,
         * evitando dois retornos concorrentes.
         */
        const updateResult =
          await tx.equipment.updateMany({
            where: {
              id,

              rmaStatus:
                EquipmentRmaStatus.APPROVED,

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

              condition:
                EquipmentCondition.REPAIRED,

              status:
                EquipmentStatus.AVAILABLE,

              rmaStatus:
                EquipmentRmaStatus.RETURNED,

              rmaResolutionNotes:
                resolutionNotes,

              rmaClosedAt:
                now,
            },
          });

        if (
          updateResult.count !== 1
        ) {
          throw new ValidationError(
            "O retorno não pôde ser registrado porque o estado do equipamento foi alterado.",
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

            rmaStatus: true,
            rmaReference: true,
            rmaNotes: true,
            rmaResolutionNotes: true,
            rmaOpenedAt: true,
            rmaClosedAt: true,
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
        `Equipamento "${updatedEquipment.name}" retornou reparado do RMA.`,

      oldData: {
        quantity:
          equipment.quantity,

        damagedQuantity:
          equipment.damagedQuantity,

        condition:
          equipment.condition,

        status:
          equipment.status,

        rmaStatus:
          equipment.rmaStatus,

        rmaResolutionNotes:
          equipment.rmaResolutionNotes,

        rmaClosedAt:
          equipment.rmaClosedAt,
      },

      newData: {
        quantity:
          updatedEquipment.quantity,

        damagedQuantity:
          updatedEquipment.damagedQuantity,

        condition:
          updatedEquipment.condition,

        status:
          updatedEquipment.status,

        rmaStatus:
          updatedEquipment.rmaStatus,

        rmaResolutionNotes:
          updatedEquipment.rmaResolutionNotes,

        rmaClosedAt:
          updatedEquipment.rmaClosedAt,
      },
    });
  } catch (auditError) {
    /*
     * O retorno físico já foi concluído neste ponto.
     * Falha de auditoria não deve transformar a
     * movimentação concluída em erro para o usuário.
     */
    console.error(
      "Retorno do RMA concluído, mas ocorreu erro ao registrar auditoria:",
      auditError,
    );
  }

  return NextResponse.json({
    success: true,

    message:
      "Retorno reparado registrado com sucesso.",

    data:
      updatedEquipment,
  });
}

if (action === "REPLACE") {
  if (
    equipment.rmaStatus !==
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

  /*
   * Uma substituição de RMA representa duas peças físicas
   * diferentes e, portanto, dois registros de Equipment.
   *
   * O serial da peça defeituosa nunca é sobrescrito:
   * ela permanece como histórico e a substituta recebe
   * uma nova identidade no inventário.
   */
  if (
    equipment.serialNumber ===
    replacementSerialNumber
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "A peça substituta deve possuir um número de série diferente da peça original.",
      },
      {
        status: 409,
      },
    );
  }

  const existingEquipment =
    await prisma.equipment.findFirst({
      where: {
        serialNumber:
          replacementSerialNumber,
      },

      select: {
        id: true,
      },
    });

  if (existingEquipment) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Já existe um equipamento com o número de série informado.",
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
        /*
         * A nova peça inicia uma vida própria no inventário.
         * Somente os metadados do tipo de equipamento são
         * herdados; histórico, RMA e serial não são copiados.
         */
        const replacementEquipment =
          await tx.equipment.create({
            data: {
              name:
                equipment.name,

              category:
                equipment.category,

              manufacturer:
                equipment.manufacturer,

              model:
                equipment.model,

              serialNumber:
                replacementSerialNumber,

              quantity: 1,
              installedQuantity: 0,
              damagedQuantity: 0,

              minimumStock:
                equipment.minimumStock,

              status:
                EquipmentStatus.AVAILABLE,

              condition:
                EquipmentCondition.NEW,

              rmaStatus:
                EquipmentRmaStatus.NONE,

              notes:
                resolutionNotes
                  ? `Peça recebida como substituição de RMA. ${resolutionNotes}`
                  : "Peça recebida como substituição de RMA.",
            },
          });

        /*
         * A condição do updateMany protege simultaneamente
         * o estado do RMA e a unidade danificada contra
         * duas substituições concorrentes.
         */
        const updateResult =
          await tx.equipment.updateMany({
            where: {
              id,

              rmaStatus:
                EquipmentRmaStatus.APPROVED,

              damagedQuantity: {
                gte: 1,
              },

              rmaReplacementEquipmentId:
                null,
            },

            data: {
              damagedQuantity: {
                decrement: 1,
              },

              status:
                EquipmentStatus.UNAVAILABLE,

              rmaStatus:
                EquipmentRmaStatus.REPLACED,

              rmaResolutionNotes:
                resolutionNotes,

              rmaClosedAt:
                now,

              rmaReplacementEquipmentId:
                replacementEquipment.id,
            },
          });

        if (
          updateResult.count !== 1
        ) {
          throw new ValidationError(
            "A substituição não pôde ser registrada porque o estado do equipamento foi alterado.",
          );
        }

        const originalEquipment =
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

              rmaStatus: true,
              rmaReference: true,
              rmaNotes: true,
              rmaResolutionNotes: true,
              rmaOpenedAt: true,
              rmaClosedAt: true,

              rmaReplacementEquipmentId:
                true,
            },
          });

        return {
          originalEquipment,
          replacementEquipment,
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
        result.originalEquipment.id,

      userId:
        session.user.id ??
        null,

      description:
        `Equipamento "${equipment.name}" foi substituído pelo fabricante através do RMA.`,

      oldData: {
        damagedQuantity:
          equipment.damagedQuantity,

        status:
          equipment.status,

        condition:
          equipment.condition,

        rmaStatus:
          equipment.rmaStatus,

        rmaResolutionNotes:
          equipment.rmaResolutionNotes,

        rmaClosedAt:
          equipment.rmaClosedAt,

        rmaReplacementEquipmentId:
          null,
      },

      newData: {
        damagedQuantity:
          result.originalEquipment
            .damagedQuantity,

        status:
          result.originalEquipment
            .status,

        condition:
          result.originalEquipment
            .condition,

        rmaStatus:
          result.originalEquipment
            .rmaStatus,

        rmaResolutionNotes:
          result.originalEquipment
            .rmaResolutionNotes,

        rmaClosedAt:
          result.originalEquipment
            .rmaClosedAt,

        rmaReplacementEquipmentId:
          result.replacementEquipment.id,

        replacementSerialNumber:
          result.replacementEquipment
            .serialNumber,
      },
    });
  } catch (auditError) {
    /*
     * A substituição física já foi concluída neste ponto.
     * Falha de auditoria não deve desfazer nem transformar
     * a operação concluída em erro para o usuário.
     */
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
        result.originalEquipment,

      replacementEquipment:
        result.replacementEquipment,
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