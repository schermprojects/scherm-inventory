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
    const { id } = await context.params;

    const equipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,

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

    const projects = equipment.projects
      .map((item) => {
        const requiredQuantity = Math.max(
          item.quantity,
          0,
        );

        const allocatedQuantity = Math.max(
          item.allocatedQuantity,
          0,
        );

        const missingQuantity = Math.max(
          requiredQuantity -
            allocatedQuantity,
          0,
        );

        return {
          id: item.project.id,
          name: item.project.name,

          clientId:
            item.project.client?.id ??
            null,

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
          missingQuantity,
        };
      })
      .filter(
        (project) =>
          project.missingQuantity > 0,
      )
      .sort((left, right) => {
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
          left.dueDate
            ? new Date(
                left.dueDate,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        const rightDueDate =
          right.dueDate
            ? new Date(
                right.dueDate,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        if (
          leftDueDate !== rightDueDate
        ) {
          return (
            leftDueDate -
            rightDueDate
          );
        }

        return (
          new Date(
            left.createdAt,
          ).getTime() -
          new Date(
            right.createdAt,
          ).getTime()
        );
      });

    return Response.json({
      success: true,

      data: {
        equipment: {
          id: equipment.id,
          name: equipment.name,
        },

        projects,

        totalMissingQuantity:
          projects.reduce(
            (total, project) =>
              total +
              project.missingQuantity,
            0,
          ),
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