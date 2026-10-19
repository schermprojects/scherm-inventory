import {
  ProjectPriority,
  ProjectStatus,
  PurchaseStatus,
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
  purchaseStatus:
  "REQUESTED" | "ACQUIRED" | null;

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

type UpdatePurchaseStatusBody = {
  projectId?: unknown;
  equipmentId?: unknown;
  status?: unknown;
};

function parsePurchaseStatus(
  value: unknown,
): PurchaseStatus | null {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !Object.values(PurchaseStatus).includes(
      value as PurchaseStatus,
    )
  ) {
    throw new Error(
      "PURCHASE_STATUS_INVALID",
    );
  }

  return value as PurchaseStatus;
}

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

              reservedQuantity:
                true,

              allocatedQuantity:
                true,
              
              purchaseStatus:
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
          const projectsWithShortage:
  PurchaseProject[] = [];

let totalNeeded = 0;
let inUse = 0;

for (
  const projectEquipment of
  equipment.projects
) {
  const requiredQuantity =
    Math.max(
      projectEquipment.quantity,
      0,
    );

  const reservedQuantity =
    Math.max(
      projectEquipment.reservedQuantity,
      0,
    );

  const allocatedQuantity =
    Math.max(
      projectEquipment.allocatedQuantity,
      0,
    );

  const pendingQuantity =
    Math.max(
      requiredQuantity -
        allocatedQuantity,
      0,
    );

  const coveredByStock =
    Math.min(
      reservedQuantity,
      pendingQuantity,
    );

  const purchaseQuantity =
    Math.max(
      requiredQuantity -
        reservedQuantity -
        allocatedQuantity,
      0,
    );

  totalNeeded +=
    pendingQuantity;

  inUse +=
    reservedQuantity;

  if (
    purchaseQuantity > 0
  ) {
    projectsWithShortage.push(
      {
        id:
          projectEquipment.project.id,

        name:
          projectEquipment.project.name,

        clientName:
          projectEquipment.project
            .clientName,

        status:
          projectEquipment.project.status,
        
        purchaseStatus:
          projectEquipment.purchaseStatus,

        requiredQuantity,

        allocatedQuantity,

        pendingQuantity,

        coveredByStock,

        purchaseQuantity,

        quantity:
          purchaseQuantity,
      },
    );
  }
}

const totalReserved =
  equipment.projects.reduce(
    (
      total,
      projectEquipment,
    ) =>
      total +
      Math.max(
        projectEquipment.reservedQuantity,
        0,
      ),
    0,
  );

const availableStock =
  Math.max(
    physicalStock -
      totalReserved,
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

export async function PATCH(
  request: Request,
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

  try {
    const body =
      (await request.json()) as UpdatePurchaseStatusBody;

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId.trim()
        : "";

    const equipmentId =
      typeof body.equipmentId === "string"
        ? body.equipmentId.trim()
        : "";

    if (!projectId || !equipmentId) {
      return Response.json(
        {
          success: false,
          message:
            "Projeto e equipamento são obrigatórios.",
        },
        {
          status: 400,
        },
      );
    }

    const status =
      parsePurchaseStatus(
        body.status,
      );

    const projectEquipment =
      await prisma.projectEquipment.findUnique(
        {
          where: {
            projectId_equipmentId: {
              projectId,
              equipmentId,
            },
          },

          select: {
            id: true,
            quantity: true,
            reservedQuantity: true,
            allocatedQuantity: true,
            purchaseStatus: true,

            project: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      );

    if (!projectEquipment) {
      return Response.json(
        {
          success: false,
          message:
            "Necessidade de compra não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    if (
  projectEquipment.purchaseStatus ===
    PurchaseStatus.ACQUIRED &&
  status !== PurchaseStatus.ACQUIRED
) {
  return Response.json(
    {
      success: false,
      message:
        "Uma compra adquirida não pode voltar para solicitado ou não solicitado.",
    },
    {
      status: 409,
    },
  );
}

    const purchaseQuantity =
      Math.max(
        projectEquipment.quantity -
          projectEquipment.reservedQuantity -
          projectEquipment.allocatedQuantity,
        0,
      );

    if (purchaseQuantity <= 0) {
      return Response.json(
        {
          success: false,
          message:
            "Este item não possui déficit de compra.",
        },
        {
          status: 400,
        },
      );
    }

    const updated =
      await prisma.projectEquipment.update(
        {
          where: {
            id:
              projectEquipment.id,
          },

          data: {
            purchaseStatus:
              status,
          },

          select: {
            id: true,
            projectId: true,
            equipmentId: true,
            purchaseStatus: true,
          },
        },
      );

    return Response.json({
      success: true,
      message:
  status === null
    ? "Compra marcada como não solicitada."
    : status === PurchaseStatus.REQUESTED
      ? "Compra marcada como solicitada."
      : "Compra marcada como adquirida.",
      data: updated,
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar status da compra:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "PURCHASE_STATUS_INVALID"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Status de compra inválido.",
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
          "Não foi possível atualizar o status da compra.",
      },
      {
        status: 500,
      },
    );
  }
}