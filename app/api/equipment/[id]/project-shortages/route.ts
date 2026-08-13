import { auth } from "@/auth";
import {
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const statusWeight: Record<
  ProjectStatus,
  number
> = {
  IN_PROGRESS: 0,
  PLANNING: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const priorityWeight: Record<
  ProjectPriority,
  number
> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

type PendingProject = {
  id: string;
  name: string;

  clientId: string | null;
  clientName: string | null;

  status: ProjectStatus;
  priority: ProjectPriority;

  dueDate: Date | null;
  createdAt: Date;

  requiredQuantity: number;
  allocatedQuantity: number;

  /**
   * Quantidade do projeto que ainda
   * não teve baixa física.
   */
  pendingQuantity: number;

  /**
   * Parte da necessidade pendente
   * coberta pelo estoque operacional
   * existente.
   */
  coveredByStock: number;

  /**
   * Quantidade que ainda precisa
   * ser comprada.
   */
  missingQuantity: number;
};

function compareProjects(
  left: PendingProject,
  right: PendingProject,
): number {
  const statusDifference =
    statusWeight[left.status] -
    statusWeight[right.status];

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const priorityDifference =
    priorityWeight[left.priority] -
    priorityWeight[right.priority];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const leftDueDate =
    left.dueDate?.getTime() ??
    Number.MAX_SAFE_INTEGER;

  const rightDueDate =
    right.dueDate?.getTime() ??
    Number.MAX_SAFE_INTEGER;

  if (leftDueDate !== rightDueDate) {
    return leftDueDate - rightDueDate;
  }

  return (
    left.createdAt.getTime() -
    right.createdAt.getTime()
  );
}

export async function GET(
  _request: Request,
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

  try {
    const { id } =
      await context.params;

    const equipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,

          /**
           * quantity representa o
           * estoque operacional atual.
           */
          quantity: true,

          projects: {
            where: {
              project: {
                status: {
                  in: [
                    ProjectStatus.PLANNING,
                    ProjectStatus.IN_PROGRESS,
                  ],
                },
              },
            },

            select: {
              quantity: true,
              allocatedQuantity: true,

              project: {
                select: {
                  id: true,
                  name: true,
                  clientName: true,
                  status: true,
                  priority: true,
                  dueDate: true,
                  createdAt: true,

                  client: {
                    select: {
                      id: true,
                      name: true,
                      shortName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!equipment) {
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

    /**
     * Primeiro calculamos apenas a
     * necessidade ainda pendente de
     * baixa para cada projeto.
     *
     * allocatedQuantity representa
     * unidades que já saíram fisicamente
     * do estoque.
     */
    const pendingProjects: PendingProject[] =
      equipment.projects
        .map((item) => {
          const requiredQuantity =
            Math.max(
              item.quantity,
              0,
            );

          const allocatedQuantity =
            Math.max(
              item.allocatedQuantity,
              0,
            );

          const pendingQuantity =
            Math.max(
              requiredQuantity -
                allocatedQuantity,
              0,
            );

          return {
            id: item.project.id,
            name: item.project.name,

            clientId:
              item.project.client
                ?.id ?? null,

            clientName:
              item.project.client
                ?.shortName ??
              item.project.client
                ?.name ??
              item.project.clientName ??
              null,

            status:
              item.project.status,

            priority:
              item.project.priority,

            dueDate:
              item.project.dueDate,

            createdAt:
              item.project.createdAt,

            requiredQuantity,
            allocatedQuantity,

            pendingQuantity,

            coveredByStock: 0,
            missingQuantity:
              pendingQuantity,
          };
        })
        .filter(
          (project) =>
            project.pendingQuantity >
            0,
        )
        .sort(compareProjects);

    /**
     * O estoque operacional existente
     * é utilizado para atender as
     * necessidades dos projetos ativos.
     *
     * A distribuição segue a mesma
     * prioridade utilizada na listagem:
     *
     * 1. Em andamento;
     * 2. Planejamento;
     * 3. Prioridade do projeto;
     * 4. Prazo;
     * 5. Data de criação.
     */
    let remainingOperationalStock =
      Math.max(
        equipment.quantity,
        0,
      );

    const projects =
      pendingProjects.map(
        (project) => {
          const coveredByStock =
            Math.min(
              project.pendingQuantity,
              remainingOperationalStock,
            );

          remainingOperationalStock =
            Math.max(
              remainingOperationalStock -
                coveredByStock,
              0,
            );

          const missingQuantity =
            Math.max(
              project.pendingQuantity -
                coveredByStock,
              0,
            );

          return {
            ...project,

            coveredByStock,
            missingQuantity,
          };
        },
      );

    /**
     * O modal de entrada precisa mostrar
     * somente projetos que ainda possuem
     * déficit real.
     *
     * Se o estoque atual já cobre a
     * necessidade, o projeto não precisa
     * aparecer como pendente para compra.
     */
    const projectsWithShortage =
      projects.filter(
        (project) =>
          project.missingQuantity >
          0,
      );

    const totalPendingQuantity =
      projects.reduce(
        (total, project) =>
          total +
          project.pendingQuantity,
        0,
      );

    const totalCoveredByStock =
      projects.reduce(
        (total, project) =>
          total +
          project.coveredByStock,
        0,
      );

    const totalMissingQuantity =
      projectsWithShortage.reduce(
        (total, project) =>
          total +
          project.missingQuantity,
        0,
      );

    return Response.json({
      success: true,

      data: {
        equipment: {
          id: equipment.id,
          name: equipment.name,

          operationalStock:
            Math.max(
              equipment.quantity,
              0,
            ),

          availableAfterDemand:
            remainingOperationalStock,
        },

        projects:
          projectsWithShortage,

        totalPendingQuantity,
        totalCoveredByStock,
        totalMissingQuantity,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao carregar projetos com pendência:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os projetos que precisam deste equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}