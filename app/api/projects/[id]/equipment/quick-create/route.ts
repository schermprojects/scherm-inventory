import { auth } from "@/auth";
import {
  AuditAction,
  AuditEntity,
  EquipmentCondition,
  EquipmentStatus,
  ProjectStatus,
} from "@/generated/prisma/enums";
import {
  LOW_STOCK_THRESHOLD,
} from "@/lib/inventory/stockAlert";
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

type QuickEquipmentBody = {
  name?: unknown;
  category?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  quantity?: unknown;
  notes?: unknown;
};

type SessionUser = {
  id?: string;
  role?: string;
};

function requiredText(
  value: unknown,
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

  return value.trim();
}

function optionalText(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function parseProjectQuantity(
  value: unknown,
): number {
  const quantity =
    Number(value);

  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1 ||
    quantity >
      MAX_QUANTITY
  ) {
    throw new Error(
      `A quantidade deve ser um número inteiro entre 1 e ${MAX_QUANTITY}.`,
    );
  }

  return quantity;
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const session =
    await auth();

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

  /*
   * O cadastro rápido faz parte
   * exclusivamente do fluxo de Projetos.
   *
   * COMMERCIAL pode criar a necessidade
   * de equipamento aqui, mas não pelo
   * módulo Estoque.
   */
  if (
    sessionUser.role !==
      "ADMIN" &&
    sessionUser.role !==
      "COMMERCIAL"
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para cadastrar equipamentos neste projeto.",
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
    const { id: projectId } =
      await context.params;

    if (!projectId) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não informado.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request.json()) as QuickEquipmentBody;

    const name =
      requiredText(
        body.name,
        "Nome",
      );

    const category =
      requiredText(
        body.category,
        "Categoria",
      );

    const projectQuantity =
      parseProjectQuantity(
        body.quantity,
      );

    const manufacturer =
      optionalText(
        body.manufacturer,
      );

    const model =
      optionalText(
        body.model,
      );

    const serialNumber =
      optionalText(
        body.serialNumber,
      )?.toUpperCase() ??
      null;

    const notes =
      optionalText(
        body.notes,
      );

    const result =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const project =
            await transaction.project.findUnique(
              {
                where: {
                  id:
                    projectId,
                },

                select: {
                  id: true,
                  name: true,
                  status:
                    true,
                },
              },
            );

          if (!project) {
            throw new Error(
              "PROJECT_NOT_FOUND",
            );
          }

          if (
            project.status ===
              ProjectStatus.COMPLETED ||
            project.status ===
              ProjectStatus.CANCELLED
          ) {
            throw new Error(
              "PROJECT_LOCKED",
            );
          }

          /*
           * Cadastro rápido gera apenas
           * uma necessidade de projeto.
           *
           * Por isso o equipamento nasce
           * sem estoque físico disponível.
           */
          const equipment =
            await transaction.equipment.create(
              {
                data: {
                  name,

                  category,

                  manufacturer,

                  model,

                  serialNumber,

                  quantity:
                    0,

                  damagedQuantity:
                    0,

                  minimumStock:
                    LOW_STOCK_THRESHOLD,

                  invoiceNumber:
                    null,

                  status:
                    EquipmentStatus.AVAILABLE,

                  condition:
                    EquipmentCondition.NEW,

                  notes,
                },
              },
            );

          const projectEquipment =
            await transaction.projectEquipment.create(
              {
                data: {
                  projectId:
                    project.id,

                  equipmentId:
                    equipment.id,

                  quantity:
                    projectQuantity,

                  allocatedQuantity:
                    0,

                  notes,
                },
              },
            );

          return {
            project,
            equipment,
            projectEquipment,
          };
        },
      );

    /*
     * Auditoria do cadastro.
     */
    await logAudit({
      action:
        AuditAction.CREATE,

      entity:
        AuditEntity.EQUIPMENT,

      entityId:
        result.equipment.id,

      userId:
        sessionUser.id,

      description:
        `Equipamento "${result.equipment.name}" cadastrado pelo fluxo rápido do projeto "${result.project.name}".`,

      newData: {
        source:
          "PROJECT_QUICK_CREATE",

        projectId:
          result.project.id,

        projectName:
          result.project.name,

        equipmentId:
          result.equipment.id,

        name:
          result.equipment.name,

        category:
          result.equipment.category,

        manufacturer:
          result.equipment.manufacturer,

        model:
          result.equipment.model,

        serialNumber:
          result.equipment.serialNumber,

        operationalStock:
          0,

        damagedQuantity:
          0,

        projectQuantity:
          result.projectEquipment.quantity,

        allocatedQuantity:
          0,

        notes:
          result.equipment.notes,
      },
    });

    /*
     * Também registramos que o equipamento
     * foi vinculado ao projeto.
     */
    await logAudit({
      action:
        AuditAction.ALLOCATE,

      entity:
        AuditEntity.PROJECT,

      entityId:
        result.project.id,

      userId:
        sessionUser.id,

      description:
        `${result.projectEquipment.quantity} unidade(s) do equipamento "${result.equipment.name}" adicionada(s) à necessidade do projeto "${result.project.name}".`,

      newData: {
        source:
          "PROJECT_QUICK_CREATE",

        projectEquipmentId:
          result.projectEquipment.id,

        projectId:
          result.project.id,

        equipmentId:
          result.equipment.id,

        equipmentName:
          result.equipment.name,

        quantity:
          result.projectEquipment.quantity,

        allocatedQuantity:
          0,
      },
    });

    return Response.json(
      {
        success: true,

        message:
          "Equipamento cadastrado e adicionado ao projeto com sucesso.",

        data: {
          equipment: {
            id:
              result.equipment.id,

            name:
              result.equipment.name,

            category:
              result.equipment.category,

            manufacturer:
              result.equipment.manufacturer,

            model:
              result.equipment.model,

            serialNumber:
              result.equipment.serialNumber,

            quantity:
              result.equipment.quantity,

            damagedQuantity:
              result.equipment.damagedQuantity,
          },

          projectEquipment: {
            id:
              result.projectEquipment.id,

            quantity:
              result.projectEquipment.quantity,

            allocatedQuantity:
              result.projectEquipment.allocatedQuantity,
          },
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro no cadastro rápido de equipamento:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_NOT_FOUND"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_LOCKED"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Não é possível adicionar equipamentos a um projeto concluído ou cancelado.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
      SyntaxError
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
          "Não foi possível cadastrar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}