import { auth } from "@/auth";
import {
  EquipmentCondition,
  EquipmentRmaStatus,
  EquipmentStatus,
  MachineComponentMovementReason,
  MachineComponentMovementType,
  MachineComponentStatus,
  MachineStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    componentId: string;
  }>;
};

type RequestBody = {
  reason?: string;
  notes?: string;
};

/*
 * A gestão de Máquinas é restrita a ADMIN e BACKOFFICE.
 * COMMERCIAL e VIEWER consultam máquinas/componentes
 * somente através do Inventário.
 */
function canManageMachines(
  role: unknown,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}

/*
 * Motivos permitidos na remoção.
 *
 * REALLOCATION:
 * componente volta para o estoque disponível.
 *
 * HARDWARE_FAILURE:
 * componente sai da máquina e vai para
 * estoque danificado.
 *
 * OTHER:
 * componente volta para estoque disponível,
 * mas a justificativa explica o motivo real.
 */
const ALLOWED_REASONS =
  new Set<MachineComponentMovementReason>([
    MachineComponentMovementReason.HARDWARE_FAILURE,
    MachineComponentMovementReason.REALLOCATION,
    MachineComponentMovementReason.OTHER,
  ]);

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const session = await auth();

    const sessionUser =
      session?.user as
        | {
            id?: string;
            role?: string;
          }
        | undefined;

    /*
     * Somente usuário autenticado pode
     * registrar uma remoção.
     */
    if (!sessionUser?.id) {
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

    /*
    * A remoção altera simultaneamente a composição da máquina,
    * o estoque físico e o histórico de movimentações.
    * Por isso exige permissão operacional.
    */
    if (!canManageMachines(sessionUser.role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para remover componentes.",
        },
        {
          status: 403,
        },
      );
    }

    const {
      id: machineId,
      componentId,
    } = await context.params;

    const body =
      (await request.json()) as RequestBody;

    const reason =
      body.reason?.trim();

    const notes =
      body.notes?.trim();

    /*
     * Motivo é obrigatório.
     */
    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Informe o motivo da remoção.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Além de validar se o valor pertence
     * ao enum, validamos também se ele faz
     * parte dos motivos permitidos por esta rota.
     */
    if (
      !Object.values(
        MachineComponentMovementReason,
      ).includes(
        reason as MachineComponentMovementReason,
      ) ||
      !ALLOWED_REASONS.has(
        reason as MachineComponentMovementReason,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Motivo de remoção inválido.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * A justificativa escrita é obrigatória
     * para preservar a rastreabilidade.
     */
    if (!notes) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Informe uma justificativa para a remoção.",
        },
        {
          status: 400,
        },
      );
    }

    if (notes.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A justificativa deve possuir pelo menos 3 caracteres.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Carregamos somente o componente que
     * pertence à máquina informada.
     *
     * Isso evita remover um componente usando
     * o ID de outra máquina.
     */
    const component =
      await prisma.machineComponent.findFirst(
        {
          where: {
            id: componentId,
            machineId,
          },

          select: {
            id: true,
            machineId: true,
            equipmentId: true,
            name: true,
            serialNumber: true,
            quantity: true,
            status: true,
            removedAt: true,

            machine: {
              select: {
                equipmentId: true,
                status: true,
              },
            },
          },
        },
      );

    if (!component) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Componente não encontrado nesta máquina.",
        },
        {
          status: 404,
        },
      );
    }

    /*
    * Uma máquina em IN_USE saiu fisicamente pelo projeto.
    * Enquanto a unidade principal não retornar ao estoque,
    * sua composição atual permanece bloqueada e não pode
    * sofrer remoções operacionais pela gestão de Máquinas.
    */
    if (
      component.machine.status ===
      MachineStatus.IN_USE
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Esta máquina está em uso em um projeto. Seus componentes permanecem bloqueados até o retorno físico da máquina ou até uma devolução parcial registrada pelo fluxo do projeto.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Evita uma segunda remoção do mesmo
     * componente.
     */
    if (
      component.removedAt !== null ||
      component.status ===
        MachineComponentStatus.REMOVED
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este componente já foi removido.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Na arquitetura atual cada componente
     * físico da máquina deve possuir seu
     * próprio Equipment.
     *
     * Sem esse vínculo não conseguimos mover
     * corretamente a unidade de "instalada"
     * para "disponível" ou "danificada".
     */
    if (!component.equipmentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este componente não possui vínculo com o inventário e não pode ser removido automaticamente.",
        },
        {
          status: 409,
        },
      );
    }

    /*
    * A partir daqui o vínculo com Equipment
    * já foi validado.
    *
    * Guardamos o ID em uma constante para que
    * o TypeScript saiba definitivamente que
    * estamos trabalhando com uma string,
    * e não com string | null.
    */
    const equipmentId =
      component.equipmentId;

    const movementReason =
      reason as MachineComponentMovementReason;

    const now = new Date();

    /*
     * Tudo ocorre na mesma transação:
     *
     * 1. remove uma unidade do estoque instalado;
     * 2. define o novo destino físico;
     * 3. marca MachineComponent como removido;
     * 4. registra o histórico da remoção.
     *
     * Se qualquer etapa falhar, nenhuma
     * alteração é persistida parcialmente.
     */
    const result =
      await prisma.$transaction(
        async (transaction) => {
          /*
          * Um componente substituído por RMA permanece vinculado
          * ao sistema apenas como registro histórico. Mesmo que
          * ainda exista uma inconsistência antiga em installedQuantity,
          * nenhuma remoção ou movimentação física pode alterá-lo.
          */
          const equipmentRmaState =
            await transaction.equipment.findUnique({
              where: {
                id: equipmentId,
              },

              select: {
                rmaStatus: true,
              },
            });

          if (!equipmentRmaState) {
            throw new Error(
              "EQUIPMENT_NOT_FOUND",
            );
          }

          if (
              equipmentRmaState.rmaStatus ===
              EquipmentRmaStatus.REPLACED
          ) {
            throw new Error(
              "HISTORICAL_RMA_EQUIPMENT",
            );
          }
          /*
           * Primeiro retiramos a unidade do bucket
           * "installedQuantity".
           *
           * O updateMany com installedQuantity >= 1
           * também funciona como proteção contra
           * duas requisições concorrentes tentando
           * remover a mesma unidade.
           */
          const installedStockUpdate =
            await transaction.equipment.updateMany(
              {
                where: {
                  id:
                    equipmentId,

                  installedQuantity: {
                    gte: 1,
                  },
                },

                data: {
                  installedQuantity: {
                    decrement: 1,
                  },
                },
              },
            );

          if (
            installedStockUpdate.count !==
            1
          ) {
            throw new Error(
              "COMPONENT_NOT_INSTALLED_IN_STOCK",
            );
          }

          /*
           * HARDWARE_FAILURE:
           *
           * A peça continua existindo fisicamente,
           * mas passa para estoque danificado.
           *
           * quantity = 0
           * installedQuantity = 0
           * damagedQuantity = 1
           *
           * Portanto ela NÃO fica disponível
           * para projetos.
           */
          if (
            movementReason ===
            MachineComponentMovementReason.HARDWARE_FAILURE
          ) {
            await transaction.equipment.update(
              {
                where: {
                  id:
                    equipmentId,
                },

                data: {
                  damagedQuantity: {
                    increment: 1,
                  },

                  status:
                    EquipmentStatus.UNAVAILABLE,

                  condition:
                    EquipmentCondition.DAMAGED,
                },
              },
            );
          } else {
            /*
             * REALLOCATION e OTHER:
             *
             * O componente sai fisicamente da
             * máquina e volta para o estoque
             * operacional disponível.
             *
             * quantity = 1
             * installedQuantity = 0
             *
             * A justificativa registrada no
             * movimento explica o motivo real
             * quando a opção OTHER é utilizada.
             */
            await transaction.equipment.update(
              {
                where: {
                  id:
                    equipmentId,
                },

                data: {
                  quantity: {
                    increment: 1,
                  },

                  status:
                    EquipmentStatus.AVAILABLE,
                },
              },
            );
          }

          /*
           * Agora marcamos o componente como
           * fisicamente removido da máquina.
           */
          const updatedComponent =
            await transaction.machineComponent.update(
              {
                where: {
                  id:
                    component.id,
                },

                data: {
                  status:
                    MachineComponentStatus.REMOVED,

                  removedAt:
                    now,
                },
              },
            );

              /*
              * Preserva a rastreabilidade:
              *
              * - quem removeu;
              * - quando;
              * - motivo;
              * - justificativa;
              * - componente afetado.
              */
              const movement =
                await transaction.machineComponentMovement.create(
                  {
                    data: {
                      type:
                        MachineComponentMovementType.REMOVE,

                      reason:
                        movementReason,

                      notes,

                      machineComponentId:
                        component.id,

                      createdById:
                        sessionUser.id,
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
                );

                /*
                * Retornamos também o Equipment atualizado
                * para que a interface possa refletir
                * imediatamente o novo estado do estoque.
                */
              const equipment =
                await transaction.equipment.findUniqueOrThrow(
                  {
                    where: {
                      id:
                        equipmentId,
                    },

                    select: {
                      id: true,
                      name: true,
                      serialNumber: true,
                      quantity: true,
                      installedQuantity:
                        true,
                      damagedQuantity:
                        true,
                      status: true,
                      condition: true,
                    },
                  },
                );

          return {
            component:
              updatedComponent,

            movement,

            equipment,
          };
        },
      );

    /*
     * Mensagem específica para facilitar
     * o entendimento do resultado pelo usuário.
     */
    const message =
      movementReason ===
      MachineComponentMovementReason.HARDWARE_FAILURE
        ? "Componente removido e registrado como danificado com sucesso."
        : "Componente removido e disponibilizado no estoque com sucesso.";

    return NextResponse.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error(
      "Erro ao remover componente da máquina:",
      error,
    );

     if (
              error instanceof Error &&
              error.message ===
                "EQUIPMENT_NOT_FOUND"
            ) {
              return NextResponse.json(
                {
                  success: false,
                  message:
                    "O equipamento vinculado a este componente não foi encontrado.",
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
            return NextResponse.json(
              {
                success: false,
                message:
                  "Este componente foi substituído por RMA e está preservado somente para histórico. Novas movimentações não são permitidas.",
              },
              {
                status: 409,
              },
            );
          }


    /*
     * Esta situação normalmente indica:
     *
     * - componente já movimentado;
     * - inconsistência antiga de estoque;
     * - requisições concorrentes.
     */
    if (
      error instanceof Error &&
      error.message ===
        "COMPONENT_NOT_INSTALLED_IN_STOCK"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O componente não possui uma unidade instalada disponível para remoção.",
        },
        {
          status: 409,
        },
      );
    }

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

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível remover o componente.",
      },
      {
        status: 500,
      },
    );
  }
}