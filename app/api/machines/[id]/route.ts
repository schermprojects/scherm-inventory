import { auth } from "@/auth";
import {
  AuditAction,
  AuditEntity,
  EquipmentRmaStatus,
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

/*
 * A área de gestão de Máquinas é restrita a ADMIN e BACKOFFICE.
 * COMMERCIAL e VIEWER consultam máquinas e componentes
 * exclusivamente pelas rotas do Inventário.
 */
function canManageMachines(
  role: unknown,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const session =
      await auth();

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
      session.user.role;

    if (!canManageMachines(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para excluir máquinas.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } =
      await context.params;

    const machine =
      await prisma.machine.findUnique({
        where: {
          id,
        },

        include: {
          components: {
            select: {
              id: true,
              equipmentId: true,
            },
          },
        },
      });

    if (!machine) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Máquina não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Se já houve remoção/movimentação de
     * componentes, preservamos a máquina
     * para manter a rastreabilidade.
     */
    const componentMovementCount =
      await prisma.machineComponentMovement.count(
        {
          where: {
            machineComponent: {
              machineId:
                machine.id,
            },
          },
        },
      );

    if (
      componentMovementCount > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Esta máquina possui histórico de movimentações e não pode ser excluída. O cadastro deve ser preservado para manter a rastreabilidade.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Equipamentos vinculados à máquina:
     *
     * - equipamento principal da máquina;
     * - equipamentos físicos dos componentes.
     */
    const equipmentIds = [
      ...new Set(
        [
          machine.equipmentId,

          ...machine.components.map(
            (component) =>
              component.equipmentId,
          ),
        ].filter(
          (
            equipmentId,
          ): equipmentId is string =>
            Boolean(equipmentId),
        ),
      ),
    ];

    /*
    * Uma máquina não pode excluir equipamentos preservados
    * como histórico de RMA. Mesmo que não existam projetos
    * ou movimentações, o registro REPLACED deve permanecer
    * para manter a rastreabilidade da substituição.
    */
    if (equipmentIds.length > 0) {
      const historicalRmaEquipmentCount =
        await prisma.equipment.count({
          where: {
            id: {
              in: equipmentIds,
            },

            rmaStatus:
              EquipmentRmaStatus.REPLACED,
          },
        });

      if (
        historicalRmaEquipmentCount > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Esta máquina possui equipamento preservado como histórico de RMA e não pode ser excluída.",
          },
          {
            status: 409,
          },
        );
      }
    }

    /*
     * Uma máquina que já foi utilizada ou
     * vinculada a Projeto não deve desaparecer
     * do histórico.
     */
    if (
      equipmentIds.length > 0
    ) {
      const [
        projectLinkCount,
        equipmentMovementCount,
      ] =
        await Promise.all([
          prisma.projectEquipment.count({
            where: {
              equipmentId: {
                in: equipmentIds,
              },
            },
          }),

          prisma.equipmentMovement.count({
            where: {
              equipmentId: {
                in: equipmentIds,
              },
            },
          }),
        ]);

      if (
        projectLinkCount > 0 ||
        equipmentMovementCount > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Esta máquina ou um de seus componentes possui vínculo com estoque/projeto e não pode ser excluído. O cadastro deve ser preservado para manter a rastreabilidade.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const oldData = {
      id:
        machine.id,

      equipmentId:
        machine.equipmentId,

      name:
        machine.name,

      category:
        machine.category,

      manufacturer:
        machine.manufacturer,

      model:
        machine.model,

      assetTag:
        machine.assetTag,

      serialNumber:
        machine.serialNumber,

      invoiceNumber:
        machine.invoiceNumber,

      receivedAt:
        machine.receivedAt,

      componentCount:
        machine.components.length,

      componentEquipmentIds:
        machine.components
          .map(
            (component) =>
              component.equipmentId,
          )
          .filter(Boolean),
    };

    /*
     * Primeiro apagamos a máquina.
     *
     * Machine -> MachineComponent usa Cascade,
     * então os componentes são removidos junto.
     *
     * Depois disso removemos os Equipment
     * físicos que pertenciam a esse cadastro.
     */
    await prisma.$transaction(
      async (tx) => {
        await tx.machine.delete({
          where: {
            id:
              machine.id,
          },
        });

        if (
          equipmentIds.length > 0
        ) {
          await tx.equipment.deleteMany({
            where: {
              id: {
                in: equipmentIds,
              },

              /*
               * Segurança adicional:
               * não removemos um Equipment se,
               * por algum motivo, ainda existir
               * outra referência de máquina ou
               * componente para ele.
               */
              machines: {
                none: {},
              },

              machineComponents: {
                none: {},
              },

              projects: {
                none: {},
              },

              movements: {
                none: {},
              },
            },
          });
        }
      },
    );

    /*
     * O cadastro já foi excluído.
     * Caso o audit tenha problema, não devemos
     * devolver erro dizendo que a exclusão
     * falhou quando ela realmente aconteceu.
     */
    try {
      await logAudit({
        action:
          AuditAction.DELETE,

        entity:
          AuditEntity.MACHINE,

        entityId:
          machine.id,

        userId:
          session.user.id ??
          null,

        description:
          `Máquina "${machine.name}" excluída.`,

        oldData,
      });
    } catch (auditError) {
      console.error(
        "Máquina excluída, mas ocorreu erro ao registrar auditoria:",
        auditError,
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "Máquina excluída com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao excluir máquina:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Não foi possível excluir a máquina.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const role =
      session.user.role;

    if (!canManageMachines(role)) {
      return NextResponse.json(
      {
      success: false,
      message:
        "Você não possui permissão para acessar Máquinas.",
      },
      {
      status: 403,
      },
    );
    }

    const { id } = await context.params;

    const machine =
      await prisma.machine.findUnique({
        where: {
          id,
        },

        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },

          components: {
            orderBy: [
              {
                removedAt: "asc",
              },
              {
                installedAt: "asc",
              },
            ],

            include: {
              movements: {
                orderBy: {
                  createdAt: "desc",
                },

                include: {
                  createdBy: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!machine) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Máquina não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    const currentComponents =
      machine.components.filter(
        (component) =>
          component.removedAt === null,
      );

    const removedComponents =
      machine.components.filter(
        (component) =>
          component.removedAt !== null,
      );

    const history =
      machine.components
        .flatMap((component) =>
          component.movements.map(
            (movement) => ({
              id: movement.id,

              type: movement.type,
              reason: movement.reason,
              notes: movement.notes,

              createdAt:
                movement.createdAt,

              createdBy:
                movement.createdBy,

              component: {
                id: component.id,
                name: component.name,
                category:
                  component.category,
                manufacturer:
                  component.manufacturer,
                model:
                  component.model,
                serialNumber:
                  component.serialNumber,
              },
            }),
          ),
        )
        .sort(
          (first, second) =>
            second.createdAt.getTime() -
            first.createdAt.getTime(),
        );

    return NextResponse.json({
      success: true,

      data: {
        ...machine,

        components:
          currentComponents,

        removedComponents,

        history,

        totalCurrentComponents:
          currentComponents.length,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao carregar máquina:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível carregar a máquina.",
      },
      {
        status: 500,
      },
    );
  }
}
type MachineUpdateBody = {
  name?: unknown;
  category?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  assetTag?: unknown;
  invoiceNumber?: unknown;
  receivedAt?: unknown;
  notes?: unknown;
};

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function requiredText(
  value: unknown,
  label: string,
) {
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

function optionalText(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function parseRequiredDate(
  value: unknown,
  label: string,
): Date {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      `O campo "${label}" é obrigatório.`,
    );
  }

  const normalizedValue =
    value.trim();
  
  /*
 * O formulário envia apenas YYYY-MM-DD.
 * Usamos meio-dia para evitar que conversões de timezone
 * façam a data aparecer como o dia anterior.
 */

  const date = new Date(
    `${normalizedValue}T12:00:00`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
   throw new ValidationError(
      `O campo "${label}" possui uma data inválida.`,
    );
  }

  return date;
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
          message: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const role =
      session.user.role;

    if (!canManageMachines(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para editar máquinas.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } =
      await context.params;

    const body =
      (await request.json()) as MachineUpdateBody;

    const currentMachine =
      await prisma.machine.findUnique({
        where: {
          id,
        },

        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (!currentMachine) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Máquina não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    /*
    * O Equipment principal pode permanecer vinculado à máquina
    * apenas para preservar o histórico. Se ele foi substituído
    * por RMA, os dados cadastrais históricos não podem mais ser
    * sincronizados por uma edição da máquina.
    */
    if (currentMachine.equipmentId) {
      const machineEquipment =
        await prisma.equipment.findUnique({
          where: {
            id:
              currentMachine.equipmentId,
          },

          select: {
            rmaStatus: true,
          },
        });

      if (
        machineEquipment?.rmaStatus ===
        EquipmentRmaStatus.REPLACED
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "O equipamento principal desta máquina foi substituído por RMA e está preservado somente para histórico.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const name =
      requiredText(
        body.name,
        "Nome da máquina",
      );

    const receivedAt =
      parseRequiredDate(
        body.receivedAt,
        "Data de recebimento",
      );

    const category =
      optionalText(
        body.category,
      );

    const manufacturer =
      optionalText(
        body.manufacturer,
      );

    const model =
      optionalText(
        body.model,
      );

    const assetTag =
      optionalText(
        body.assetTag,
      )?.toUpperCase() ??
      null;

    const invoiceNumber =
      optionalText(
        body.invoiceNumber,
      );

    const notes =
      optionalText(
        body.notes,
      );

    if (
      assetTag &&
      assetTag !==
        currentMachine.assetTag
    ) {
      const existingAssetTag =
        await prisma.machine.findFirst({
          where: {
            assetTag,

            id: {
              not: id,
            },
          },

          select: {
            id: true,
          },
        });

      if (
        existingAssetTag
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Já existe uma máquina utilizando este patrimônio.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const updatedMachine =
  await prisma.$transaction(
    async (tx) => {
      const updated =
        await tx.machine.update({
          where: {
            id,
          },

          data: {
            name,
            category,
            manufacturer,
            model,
            assetTag,
            invoiceNumber,
            receivedAt,
            notes,
          },

          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },

            components: {
              orderBy: [
                {
                  removedAt:
                    "asc",
                },
                {
                  installedAt:
                    "asc",
                },
              ],

              include: {
                movements: {
                  orderBy: {
                    createdAt:
                      "desc",
                  },

                  include: {
                    createdBy: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      /*
       * Mantém o Equipment que representa a
       * máquina sincronizado com os dados
       * cadastrais editáveis.
       *
       * O serial não é alterado aqui.
       */
      if (
        currentMachine.equipmentId
      ) {
        await tx.equipment.update({
          where: {
            id:
              currentMachine.equipmentId,
          },

          data: {
            name,

            category:
              category ??
              "Máquina",

            manufacturer,

            model,

            invoiceNumber,

            notes,
          },
        });
      }

      return updated;
    },
  );
  try {
    await logAudit({
      action:
        AuditAction.UPDATE,

      entity:
        AuditEntity.MACHINE,

      entityId:
        updatedMachine.id,

      userId:
        session.user.id ??
        null,

      description:
        `Dados da máquina "${updatedMachine.name}" atualizados.`,

      oldData: {
        name:
          currentMachine.name,

        category:
          currentMachine.category,

        manufacturer:
          currentMachine.manufacturer,

        model:
          currentMachine.model,

        assetTag:
          currentMachine.assetTag,

        invoiceNumber:
          currentMachine.invoiceNumber,

        receivedAt:
          currentMachine.receivedAt,

        notes:
          currentMachine.notes,
      },

      newData: {
        name:
          updatedMachine.name,

        category:
          updatedMachine.category,

        manufacturer:
          updatedMachine.manufacturer,

        model:
          updatedMachine.model,

        assetTag:
          updatedMachine.assetTag,

        invoiceNumber:
          updatedMachine.invoiceNumber,

        receivedAt:
          updatedMachine.receivedAt,

        notes:
          updatedMachine.notes,
      },
    });
  }  catch (auditError) {
  /*
   * A atualização já foi concluída neste ponto.
   * Uma falha de auditoria não deve transformar
   * uma operação bem-sucedida em erro para o usuário.
   */
  console.error(
    "Máquina atualizada, mas ocorreu erro ao registrar auditoria:",
    auditError,
  );
}

    return NextResponse.json({
      success: true,

      message:
        "Dados da máquina atualizados com sucesso.",

      data: updatedMachine,
    });
} catch (error) {
  console.error(
    "Erro ao atualizar máquina:",
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

  if (error instanceof ValidationError) {
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
   * Erros inesperados permanecem internos e são
   * retornados ao cliente como falha do servidor.
   */
  return NextResponse.json(
    {
      success: false,
      message:
        "Não foi possível atualizar a máquina.",
    },
    {
      status: 500,
    },
  );
}
}