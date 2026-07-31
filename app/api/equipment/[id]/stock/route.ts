import { Prisma } from "@/generated/prisma/client";
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

  const normalizedValue = value.trim();

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
    const { id } = await context.params;

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

    const projectId = optionalText(
  body.projectId,
  191,
  "Projeto",
);

const invoiceNumber = optionalText(
  body.invoiceNumber,
  150,
  "Número da nota fiscal",
);

const notes = optionalText(
  body.notes,
  1000,
  "Observações",
);
    const result =
      await prisma.$transaction(
        async (transaction) => {
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

          let selectedProject:
  | {
      id: string;
      name: string;
      requiredQuantity: number;
      previousAllocatedQuantity: number;
      currentAllocatedQuantity: number;
      missingQuantity: number;
      allocationQuantity: number;
      freeStockQuantity: number;
    }
  | null = null;

          if (projectId) {
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
                    allocatedQuantity: true,

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

            if (
              projectEquipment.project.status !==
                ProjectStatus.PLANNING &&
              projectEquipment.project.status !==
                ProjectStatus.IN_PROGRESS
            ) {
              throw new Error(
                "PROJECT_NOT_ACTIVE",
              );
            }

            const missingQuantity = Math.max(
              projectEquipment.quantity -
                projectEquipment.allocatedQuantity,
              0,
            );

            const allocationQuantity = Math.min(
  entryQuantity,
  missingQuantity,
);

const freeStockQuantity =
  entryQuantity - allocationQuantity;

            if (missingQuantity === 0) {
              throw new Error(
                "PROJECT_ALREADY_FULFILLED",
              );
            }

            const updatedProjectEquipment =
              await transaction.projectEquipment.update(
                {
                  where: {
                    id: projectEquipment.id,
                  },

                  data: {
  allocatedQuantity: {
    increment:
      allocationQuantity,
  },
},

                  select: {
                    quantity: true,
                    allocatedQuantity: true,
                  },
                },
              );

            selectedProject = {
  id:
    projectEquipment.project.id,

  name:
    projectEquipment.project.name,

  requiredQuantity:
    updatedProjectEquipment.quantity,

  previousAllocatedQuantity:
    projectEquipment.allocatedQuantity,

  currentAllocatedQuantity:
    updatedProjectEquipment.allocatedQuantity,

  missingQuantity: Math.max(
    updatedProjectEquipment.quantity -
      updatedProjectEquipment.allocatedQuantity,
    0,
  ),

  allocationQuantity,

  freeStockQuantity,
};
          }

          const previousQuantity =
            existingEquipment.quantity;

          const currentQuantity =
            previousQuantity +
            entryQuantity;

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
                    selectedProject?.id ??
                    null,

                  createdById:
                    sessionUser.id ??
                    null,
                },

                select: {
                  id: true,
                  type: true,
                  quantity: true,
                  previousQuantity: true,
                  currentQuantity: true,
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
  project: selectedProject,
  previousQuantity,
  currentQuantity,
  previousEquipment: existingEquipment,
};
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

    const projectMessage = result.project
  ? result.project.freeStockQuantity > 0
    ? ` ${result.project.allocationQuantity} unidade(s) foram alocadas ao projeto "${result.project.name}" e ${result.project.freeStockQuantity} unidade(s) ficaram no estoque livre.`
    : ` ${result.project.allocationQuantity} unidade(s) foram alocadas ao projeto "${result.project.name}".`
  : " As unidades foram adicionadas ao estoque livre.";

  await logAudit({
  action: AuditAction.STOCK_ENTRY,
  entity: AuditEntity.EQUIPMENT,
  entityId: result.equipment.id,
  userId: sessionUser.id ?? null,
  description: `Entrada de ${entryQuantity} unidade(s) no equipamento "${result.equipment.name}".`,
  newData: {
    equipmentId: result.equipment.id,
    equipmentName: result.equipment.name,

    previousQuantity: result.previousQuantity,
    entryQuantity,
    currentQuantity: result.currentQuantity,

    invoiceNumber,
    notes,

    movementId: result.movement.id,
  },
});

if (
  result.project &&
  result.project.allocationQuantity > 0
) {
  await logAudit({
    action: AuditAction.ALLOCATE,
    entity: AuditEntity.PROJECT,
    entityId: result.project.id,
    userId: sessionUser.id ?? null,
    description:
      `${result.project.allocationQuantity} unidade(s) do equipamento "${result.equipment.name}" foram alocadas ao projeto "${result.project.name}".`,
    newData: {
      projectId: result.project.id,
      projectName: result.project.name,

      equipmentId: result.equipment.id,
      equipmentName: result.equipment.name,

      allocatedQuantity:
        result.project.allocationQuantity,

      requiredQuantity:
        result.project.requiredQuantity,

      currentAllocatedQuantity:
        result.project.currentAllocatedQuantity,

      missingQuantity:
        result.project.missingQuantity,
    },
  });
}
    return Response.json({
      success: true,

message: `Entrada de ${entryQuantity} unidade(s) registrada com sucesso.${projectMessage}`,
      data: {
        ...result.equipment,

        previousQuantity:
          result.previousQuantity,

        entryQuantity,

        currentQuantity:
          result.currentQuantity,

        projectId:
          result.project?.id ??
          null,

        projectName:
          result.project?.name ??
          null,

        projectAllocation:
  result.project
    ? {
        requiredQuantity:
          result.project
            .requiredQuantity,

        previousAllocatedQuantity:
          result.project
            .previousAllocatedQuantity,

        currentAllocatedQuantity:
          result.project
            .currentAllocatedQuantity,

        missingQuantity:
          result.project
            .missingQuantity,

        allocationQuantity:
          result.project
            .allocationQuantity,

        freeStockQuantity:
          result.project
            .freeStockQuantity,
      }
    : null,
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
    ) 
    {
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
            "Somente projetos em planejamento ou em andamento podem receber equipamentos.",
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
            "Este projeto já recebeu toda a quantidade necessária deste equipamento.",
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
          "Não foi possível registrar a entrada de estoque.",
      },
      {
        status: 500,
      },
    );
  }
}