import {
  EquipmentStatus,
  Prisma,
} from "@/generated/prisma/client";
import { auth } from "@/auth";
import {
  AuditAction,
  AuditEntity,
  EquipmentMovementType,
  ProjectStatus,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STOCK_ENTRY = 999999;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SessionUser = {
  id?: string;
  role?: string;
};

type StockEntryBody = {
  quantity?: unknown;
  projectId?: unknown;
  invoiceNumber?: unknown;
  notes?: unknown;
};

function parsePositiveInteger(
  value: unknown,
  label: string,
): number {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > MAX_STOCK_ENTRY
  ) {
    throw new Error(
      `O campo "${label}" deve ser um número inteiro entre 1 e ${MAX_STOCK_ENTRY}.`,
    );
  }

  return parsedValue;
}

function requiredText(
  value: unknown,
  maxLength: number,
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

  const normalizedValue =
    value.trim();

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new Error(
      `O campo "${label}" deve possuir no máximo ${maxLength} caracteres.`,
    );
  }

  return normalizedValue;
}

function optionalText(
  value: unknown,
  maxLength: number,
  label: string,
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `O campo "${label}" deve ser um texto.`,
    );
  }

  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.length >
    maxLength
  ) {
    throw new Error(
      `O campo "${label}" deve possuir no máximo ${maxLength} caracteres.`,
    );
  }

  return normalizedValue;
}

/**
 * PATCH /api/equipment/[id]/stock
 *
 * Registra uma entrada física de estoque
 * vinculada obrigatoriamente a um projeto
 * ativo que utiliza o equipamento.
 *
 * Regras importantes:
 *
 * - toda entrada de Compras exige projeto;
 * - o equipamento precisa estar vinculado
 *   ao projeto;
 * - o projeto precisa estar ativo;
 * - o projeto ainda precisa possuir
 *   necessidade pendente;
 * - a entrada aumenta o estoque físico/
 *   operacional;
 * - allocatedQuantity NÃO é alterado aqui;
 * - eventual excedente da entrada permanece
 *   como estoque disponível.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
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

  const sessionUser =
    session.user as SessionUser;

if (
  sessionUser.role !== "ADMIN" &&
  sessionUser.role !== "BACKOFFICE" &&
  sessionUser.role !== "COMMERCIAL"
) {
    return Response.json(
      {
        success: false,
        message:
          "Você não tem permissão para registrar entradas de estoque.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const {
      id,
    } = await context.params;

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
      (await request.json()) as StockEntryBody;

    const entryQuantity =
      parsePositiveInteger(
        body.quantity,
        "Quantidade recebida",
      );

    /*
     * Projeto agora é obrigatório.
     *
     * Não existe mais entrada livre
     * através deste fluxo de Compras.
     */
    const projectId =
      requiredText(
        body.projectId,
        191,
        "Projeto",
      );

    const invoiceNumber =
      optionalText(
        body.invoiceNumber,
        150,
        "Número da nota fiscal",
      );

    const notes =
      optionalText(
        body.notes,
        1000,
        "Observações",
      );

    const result =
      await prisma.$transaction(
        async (transaction) => {
          /*
           * Equipamento que receberá
           * fisicamente a entrada.
           */
          const existingEquipment =
            await transaction.equipment.findUnique(
              {
                where: {
                  id,
                },

                select: {
                  id: true,
                  name: true,
                  quantity: true,
                  status: true,
                  invoiceNumber: true,
                  notes: true,
                },
              },
            );

          if (!existingEquipment) {
            throw new Error(
              "EQUIPMENT_NOT_FOUND",
            );
          }

          /*
           * Como o projeto é obrigatório,
           * validamos diretamente o vínculo
           * projeto/equipamento.
           */
          const projectEquipment =
            await transaction.projectEquipment.findUnique(
              {
                where: {
                  projectId_equipmentId: {
                    projectId,
                    equipmentId: id,
                  },
                },

                select: {
                  id: true,
                  quantity: true,
                  allocatedQuantity:
                    true,

                  project: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
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
           * Somente projetos ativos podem
           * ser destino de uma entrada de
           * compra.
           */
          if (
            projectEquipment.project
              .status !==
              ProjectStatus.PLANNING &&
            projectEquipment.project
              .status !==
              ProjectStatus.IN_PROGRESS
          ) {
            throw new Error(
              "PROJECT_NOT_ACTIVE",
            );
          }

          /*
           * Necessidade total registrada
           * para este equipamento dentro
           * do projeto.
           */
          const requiredQuantity =
            Math.max(
              projectEquipment.quantity,
              0,
            );

          /*
           * Quantidade que já teve baixa
           * física anteriormente.
           */
          const currentAllocatedQuantity =
            Math.max(
              projectEquipment
                .allocatedQuantity,
              0,
            );

          /*
           * Parte da necessidade que ainda
           * não teve baixa física.
           *
           * IMPORTANTE:
           *
           * Esta entrada NÃO modifica
           * allocatedQuantity.
           */
          const pendingQuantity =
            Math.max(
              requiredQuantity -
                currentAllocatedQuantity,
              0,
            );

          if (
            pendingQuantity === 0
          ) {
            throw new Error(
              "PROJECT_ALREADY_FULFILLED",
            );
          }

          /*
           * Parte da entrada que corresponde
           * à necessidade ainda pendente do
           * projeto.
           *
           * Isso é informativo para esta
           * operação. Não representa baixa.
           */
          const allocationQuantity =
            Math.min(
              entryQuantity,
              pendingQuantity,
            );

          /*
           * Caso a nota/entrega tenha mais
           * unidades do que o projeto ainda
           * necessita, o excedente continua
           * existindo no estoque operacional.
           *
           * Exemplo:
           *
           * projeto precisa 5
           * entrada recebida 8
           *
           * 5 -> necessidade do projeto
           * 3 -> estoque disponível
           */
          const freeStockQuantity =
            Math.max(
              entryQuantity -
                allocationQuantity,
              0,
            );

          const selectedProject = {
            id:
              projectEquipment
                .project.id,

            name:
              projectEquipment
                .project.name,

            requiredQuantity,

            previousAllocatedQuantity:
              currentAllocatedQuantity,

            currentAllocatedQuantity:
              currentAllocatedQuantity,

            pendingQuantity,

            allocationQuantity,

            freeStockQuantity,

            missingQuantity:
              Math.max(
                pendingQuantity -
                  allocationQuantity,
                0,
              ),
          };

          const previousQuantity =
            Math.max(
              existingEquipment.quantity,
              0,
            );

          const currentQuantity =
            previousQuantity +
            entryQuantity;

          /*
           * Uma entrada física torna o
           * equipamento disponível quando
           * ele estava UNAVAILABLE apenas
           * por estar sem estoque.
           *
           * IN_USE não deve ser definido
           * aqui. O uso é derivado das
           * necessidades/alocações dos
           * projetos.
           */
          const nextStatus =
            existingEquipment.status ===
              EquipmentStatus.UNAVAILABLE &&
            previousQuantity <= 0 &&
            currentQuantity > 0
              ? EquipmentStatus.AVAILABLE
              : existingEquipment.status;

          /*
           * A entrada física aumenta o
           * estoque operacional.
           */
          const equipment =
            await transaction.equipment.update(
              {
                where: {
                  id,
                },

                data: {
                  quantity: {
                    increment:
                      entryQuantity,
                  },

                  status:
                    nextStatus,

                  invoiceNumber:
                    invoiceNumber ??
                    existingEquipment.invoiceNumber,

                  notes:
                    notes ??
                    existingEquipment.notes,
                },

                select: {
                  id: true,
                  name: true,
                  category: true,
                  manufacturer: true,
                  model: true,
                  serialNumber: true,
                  quantity: true,
                  minimumStock: true,
                  invoiceNumber: true,
                  status: true,
                  condition: true,
                  notes: true,
                  updatedAt: true,
                },
              },
            );

          /*
           * Toda movimentação deste fluxo
           * fica obrigatoriamente vinculada
           * ao projeto informado.
           */
          const movement =
            await transaction.equipmentMovement.create(
              {
                data: {
                  type:
                    EquipmentMovementType.ENTRY,

                  quantity:
                    entryQuantity,

                  previousQuantity,
                  currentQuantity,

                  invoiceNumber,
                  notes,

                  equipmentId:
                    existingEquipment.id,

                  projectId:
                    selectedProject.id,

                  createdById:
                    sessionUser.id ??
                    null,
                },

                select: {
                  id: true,
                  type: true,
                  quantity: true,
                  previousQuantity:
                    true,
                  currentQuantity:
                    true,
                  invoiceNumber: true,
                  notes: true,
                  equipmentId: true,
                  projectId: true,
                  createdById: true,
                  createdAt: true,
                },
              },
            );

          return {
            equipment,
            movement,
            project:
              selectedProject,

            previousQuantity,
            currentQuantity,
          };
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );

    /*
     * Não existe mais mensagem de
     * "entrada em estoque livre sem
     * projeto".
     *
     * O projeto sempre existe.
     */
    const projectMessage =
      result.project
        .freeStockQuantity > 0
        ? ` ${result.project.allocationQuantity} unidade(s) correspondem à necessidade do projeto "${result.project.name}" e ${result.project.freeStockQuantity} unidade(s) ficaram disponíveis no estoque.`
        : ` ${result.project.allocationQuantity} unidade(s) correspondem à necessidade do projeto "${result.project.name}".`;

    /*
     * Auditoria da entrada física.
     */
    await logAudit({
      action:
        AuditAction.STOCK_ENTRY,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        result.equipment.id,

      userId:
        sessionUser.id ??
        null,

      description:
        `Entrada de ${entryQuantity} unidade(s) no equipamento "${result.equipment.name}" vinculada ao projeto "${result.project.name}".`,

      newData: {
        equipmentId:
          result.equipment.id,

        equipmentName:
          result.equipment.name,

        previousQuantity:
          result.previousQuantity,

        entryQuantity,

        currentQuantity:
          result.currentQuantity,

        invoiceNumber,
        notes,

        movementId:
          result.movement.id,

        projectId:
          result.project.id,

        projectName:
          result.project.name,
      },
    });

    /*
     * Auditoria da destinação da compra.
     *
     * Isto NÃO representa baixa física e
     * NÃO altera allocatedQuantity.
     */
    if (
      result.project
        .allocationQuantity > 0
    ) {
      await logAudit({
        action:
          AuditAction.ALLOCATE,

        entity:
          AuditEntity.PROJECT,

        entityId:
          result.project.id,

        userId:
          sessionUser.id ??
          null,

        description:
          `${result.project.allocationQuantity} unidade(s) do equipamento "${result.equipment.name}" foram vinculadas à necessidade do projeto "${result.project.name}" por entrada de estoque.`,

        newData: {
          projectId:
            result.project.id,

          projectName:
            result.project.name,

          equipmentId:
            result.equipment.id,

          equipmentName:
            result.equipment.name,

          entryQuantityForProject:
            result.project
              .allocationQuantity,

          freeStockQuantity:
            result.project
              .freeStockQuantity,

          requiredQuantity:
            result.project
              .requiredQuantity,

          previousAllocatedQuantity:
            result.project
              .previousAllocatedQuantity,

          currentAllocatedQuantity:
            result.project
              .currentAllocatedQuantity,

          pendingQuantity:
            result.project
              .pendingQuantity,

          missingQuantity:
            result.project
              .missingQuantity,
        },
      });
    }

    return Response.json({
      success: true,

      message:
        `Entrada de ${entryQuantity} unidade(s) registrada com sucesso.${projectMessage}`,

      data: {
        ...result.equipment,

        previousQuantity:
          result.previousQuantity,

        entryQuantity,

        currentQuantity:
          result.currentQuantity,

        projectId:
          result.project.id,

        projectName:
          result.project.name,

        projectAllocation: {
          requiredQuantity:
            result.project
              .requiredQuantity,

          previousAllocatedQuantity:
            result.project
              .previousAllocatedQuantity,

          currentAllocatedQuantity:
            result.project
              .currentAllocatedQuantity,

          pendingQuantity:
            result.project
              .pendingQuantity,

          missingQuantity:
            result.project
              .missingQuantity,

          allocationQuantity:
            result.project
              .allocationQuantity,

          freeStockQuantity:
            result.project
              .freeStockQuantity,
        },
      },
    });
  } catch (error) {
    console.error(
      "Erro ao registrar entrada de estoque:",
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
        "PROJECT_EQUIPMENT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O projeto selecionado não utiliza este equipamento.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_NOT_ACTIVE"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Somente projetos em planejamento ou em andamento podem receber esta entrada.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ALREADY_FULFILLED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este projeto já possui toda a quantidade necessária deste equipamento atendida. Selecione outro projeto com necessidade pendente.",
        },
        {
          status: 400,
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
            "O estoque foi alterado simultaneamente. Tente registrar a entrada novamente.",
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
          "Não foi possível registrar a entrada de estoque.",
      },
      {
        status: 500,
      },
    );
  }
}