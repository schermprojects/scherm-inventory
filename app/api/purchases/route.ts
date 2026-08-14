import {
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

/*
 * Mesma regra utilizada na listagem
 * dos projetos.
 *
 * Quanto menor o peso, maior a
 * prioridade na disputa do estoque.
 */
const PROJECT_STATUS_WEIGHT: Record<
  ProjectStatus,
  number
> = {
  [ProjectStatus.IN_PROGRESS]: 0,
  [ProjectStatus.PLANNING]: 1,
  [ProjectStatus.COMPLETED]: 2,
  [ProjectStatus.CANCELLED]: 3,
};

const PROJECT_PRIORITY_WEIGHT: Record<
  ProjectPriority,
  number
> = {
  [ProjectPriority.URGENT]: 0,
  [ProjectPriority.HIGH]: 1,
  [ProjectPriority.NORMAL]: 2,
  [ProjectPriority.LOW]: 3,
};

type PurchaseProject = {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;

  /*
   * Necessidade total registrada
   * no projeto.
   */
  requiredQuantity: number;

  /*
   * Quantidade que já teve
   * baixa física.
   */
  allocatedQuantity: number;

  /*
   * Necessidade ainda pendente,
   * antes de considerar o estoque
   * operacional existente.
   */
  pendingQuantity: number;

  /*
   * Quantidade do estoque atual
   * que consegue atender este projeto.
   */
  coveredByStock: number;

  /*
   * Quantidade que realmente
   * precisa ser comprada para
   * este projeto.
   */
  purchaseQuantity: number;

  /*
   * Mantido por compatibilidade
   * com PurchasesView.
   *
   * A tela atual utiliza
   * project.quantity no campo
   * "Necessário".
   *
   * Em Compras, esse valor passa
   * a representar exatamente a
   * necessidade DE COMPRA deste
   * projeto.
   */
  quantity: number;
};

type PurchaseItem = {
  equipmentId: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;

  physicalStock: number;
  minimumStock: number;

  /*
   * Necessidade pendente total
   * dos projetos ativos.
   */
  totalNeeded: number;

  /*
   * Quantidade do estoque atual
   * comprometida com as demandas.
   */
  inUse: number;

  /*
   * Estoque que sobra depois de
   * atender as demandas ativas.
   */
  availableStock: number;

  availableAfterDemand: number;

  /*
   * Déficit real a comprar.
   */
  purchaseQuantity: number;

  /*
   * Aqui contamos somente projetos
   * que possuem déficit de compra.
   */
  projectCount: number;

  /*
   * Também retornamos somente os
   * projetos que efetivamente têm
   * algo a comprar.
   */
  projects: PurchaseProject[];

  isOutOfStock: boolean;
  isBelowMinimum: boolean;
  hasShortage: boolean;
};

export async function GET() {
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

  try {
    const equipmentRecords =
      await prisma.equipment.findMany({
        include: {
          projects: {
            where: {
              project: {
                status: {
                  in:
                    ACTIVE_PROJECT_STATUSES,
                },
              },
            },

            select: {
              quantity: true,

              allocatedQuantity:
                true,

              project: {
                select: {
                  id: true,
                  name: true,
                  clientName: true,
                  status: true,
                  priority: true,
                  dueDate: true,
                  createdAt: true,
                },
              },
            },
          },
        },

        orderBy: {
          name: "asc",
        },
      });

    const items: PurchaseItem[] =
      equipmentRecords.map(
        (equipment) => {
          /*
           * Estoque operacional atual.
           *
           * Importante:
           *
           * allocatedQuantity NÃO deve
           * ser subtraído novamente daqui.
           *
           * Quando houve baixa física,
           * equipment.quantity já foi
           * reduzido naquela operação.
           */
          const physicalStock =
            Math.max(
              equipment.quantity,
              0,
            );

          /*
           * Primeiro normalizamos todas
           * as demandas ainda pendentes.
           */
          const pendingProjects =
            equipment.projects
              .map(
                (
                  projectEquipment,
                ) => {
                  const requiredQuantity =
                    Math.max(
                      projectEquipment.quantity,
                      0,
                    );

                  const allocatedQuantity =
                    Math.max(
                      projectEquipment
                        .allocatedQuantity,
                      0,
                    );

                  /*
                   * Somente aquilo que
                   * ainda não teve baixa
                   * física disputa o
                   * estoque atual.
                   */
                  const pendingQuantity =
                    Math.max(
                      requiredQuantity -
                        allocatedQuantity,
                      0,
                    );

                  return {
                    id:
                      projectEquipment
                        .project.id,

                    name:
                      projectEquipment
                        .project.name,

                    clientName:
                      projectEquipment
                        .project
                        .clientName,

                    status:
                      projectEquipment
                        .project.status,

                    priority:
                      projectEquipment
                        .project.priority,

                    dueDate:
                      projectEquipment
                        .project.dueDate,

                    createdAt:
                      projectEquipment
                        .project.createdAt,

                    requiredQuantity,

                    allocatedQuantity,

                    pendingQuantity,
                  };
                },
              )
              /*
               * Se não existe mais nada
               * pendente, o projeto não
               * participa da disputa.
               */
              .filter(
                (project) =>
                  project.pendingQuantity >
                  0,
              );

          /*
           * Ordem determinística para
           * distribuir o estoque.
           *
           * 1. Em andamento
           * 2. Planejamento
           * 3. Prioridade
           * 4. Prazo mais próximo
           * 5. Projeto mais antigo
           * 6. ID
           *
           * É a mesma política utilizada
           * na API de projetos.
           */
          const orderedProjects =
            [...pendingProjects].sort(
              (
                first,
                second,
              ) => {
                const statusDifference =
                  PROJECT_STATUS_WEIGHT[
                    first.status
                  ] -
                  PROJECT_STATUS_WEIGHT[
                    second.status
                  ];

                if (
                  statusDifference !==
                  0
                ) {
                  return statusDifference;
                }

                const priorityDifference =
                  PROJECT_PRIORITY_WEIGHT[
                    first.priority
                  ] -
                  PROJECT_PRIORITY_WEIGHT[
                    second.priority
                  ];

                if (
                  priorityDifference !==
                  0
                ) {
                  return priorityDifference;
                }

                const firstDueDate =
                  first.dueDate
                    ?.getTime() ??
                  Number.MAX_SAFE_INTEGER;

                const secondDueDate =
                  second.dueDate
                    ?.getTime() ??
                  Number.MAX_SAFE_INTEGER;

                if (
                  firstDueDate !==
                  secondDueDate
                ) {
                  return (
                    firstDueDate -
                    secondDueDate
                  );
                }

                const createdAtDifference =
                  first.createdAt.getTime() -
                  second.createdAt.getTime();

                if (
                  createdAtDifference !==
                  0
                ) {
                  return createdAtDifference;
                }

                return first.id.localeCompare(
                  second.id,
                );
              },
            );

          /*
           * A partir daqui o estoque é
           * consumido virtualmente UMA
           * única vez.
           *
           * Isso NÃO altera banco.
           *
           * É somente o cálculo de quem
           * está coberto e quem gera compra.
           */
          let remainingStock =
            physicalStock;

          let totalNeeded = 0;
          let inUse = 0;

          const projectsWithShortage:
            PurchaseProject[] = [];

          for (
            const project of
            orderedProjects
          ) {
            totalNeeded +=
              project.pendingQuantity;

            const availableBeforeProject =
              Math.max(
                remainingStock,
                0,
              );

            const coveredByStock =
              Math.min(
                project.pendingQuantity,
                availableBeforeProject,
              );

            const purchaseQuantity =
              Math.max(
                project.pendingQuantity -
                  coveredByStock,
                0,
              );

            remainingStock =
              Math.max(
                availableBeforeProject -
                  coveredByStock,
                0,
              );

            inUse +=
              coveredByStock;

            /*
             * Compras só precisa exibir
             * projetos que realmente
             * possuem algo faltando.
             */
            if (
              purchaseQuantity >
              0
            ) {
              projectsWithShortage.push(
                {
                  id:
                    project.id,

                  name:
                    project.name,

                  clientName:
                    project.clientName,

                  status:
                    project.status,

                  requiredQuantity:
                    project.requiredQuantity,

                  allocatedQuantity:
                    project.allocatedQuantity,

                  pendingQuantity:
                    project.pendingQuantity,

                  coveredByStock,

                  purchaseQuantity,

                  /*
                   * Compatibilidade com
                   * a tela atual.
                   */
                  quantity:
                    purchaseQuantity,
                },
              );
            }
          }

          const availableStock =
            Math.max(
              remainingStock,
              0,
            );

          const purchaseQuantity =
            projectsWithShortage.reduce(
              (
                total,
                project,
              ) =>
                total +
                project.purchaseQuantity,
              0,
            );

          const minimumStock =
            Math.max(
              equipment.minimumStock,
              0,
            );

          return {
            equipmentId:
              equipment.id,

            name:
              equipment.name,

            category:
              equipment.category,

            manufacturer:
              equipment.manufacturer,

            model:
              equipment.model,

            serialNumber:
              equipment.serialNumber,

            physicalStock,

            minimumStock,

            /*
             * Continua mostrando a
             * necessidade pendente total.
             *
             * Exemplo:
             *
             * Projeto A = 5
             * Projeto B = 5
             *
             * totalNeeded = 10
             */
            totalNeeded,

            /*
             * Quantidade do estoque
             * utilizada virtualmente
             * para cobrir os projetos.
             */
            inUse,

            availableStock,

            availableAfterDemand:
              availableStock,

            /*
             * Soma dos déficits
             * individuais.
             */
            purchaseQuantity,

            /*
             * Agora representa quantos
             * projetos realmente possuem
             * necessidade de compra.
             */
            projectCount:
              projectsWithShortage.length,

            projects:
              projectsWithShortage,

            isOutOfStock:
              physicalStock === 0,

            isBelowMinimum:
              availableStock <=
              minimumStock,

            hasShortage:
              purchaseQuantity > 0,
          };
        },
      );

    /*
     * Categorias apresentadas em
     * Compras.
     *
     * Somente itens realmente
     * deficitários entram aqui.
     */
    const purchaseCategories =
      Array.from(
        new Set(
          items
            .filter(
              (item) =>
                item.hasShortage,
            )
            .map(
              (item) =>
                item.category.trim(),
            )
            .filter(Boolean),
        ),
      ).sort(
        (
          first,
          second,
        ) =>
          first.localeCompare(
            second,
            "pt-BR",
            {
              sensitivity:
                "base",
            },
          ),
      );

    /*
     * Agora affectedProjects contém
     * somente projetos que realmente
     * possuem compra pendente.
     */
    const affectedProjectIds =
      new Set<string>();

    const summary =
      items.reduce(
        (
          accumulator,
          item,
        ) => {
          accumulator.totalEquipment +=
            1;

          accumulator.totalPhysicalStock +=
            item.physicalStock;

          accumulator.totalNeeded +=
            item.totalNeeded;

          accumulator.totalToPurchase +=
            item.purchaseQuantity;

          if (
            item.hasShortage
          ) {
            accumulator.equipmentWithShortage +=
              1;

            for (
              const project of
              item.projects
            ) {
              affectedProjectIds.add(
                project.id,
              );
            }
          }

          if (
            item.isOutOfStock
          ) {
            accumulator.outOfStock +=
              1;
          }

          if (
            item.isBelowMinimum
          ) {
            accumulator.belowMinimum +=
              1;
          }

          return accumulator;
        },
        {
          totalEquipment: 0,

          equipmentWithShortage:
            0,

          totalPhysicalStock: 0,

          totalNeeded: 0,

          totalToPurchase: 0,

          outOfStock: 0,

          belowMinimum: 0,

          affectedProjects: 0,
        },
      );

    summary.affectedProjects =
      affectedProjectIds.size;

    return Response.json({
      success: true,

      data:
        items,

      categories:
        purchaseCategories,

      summary,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar lista de compras:",
      error,
    );

    return Response.json(
      {
        success: false,

        message:
          "Não foi possível carregar a lista de compras.",
      },
      {
        status: 500,
      },
    );
  }
}