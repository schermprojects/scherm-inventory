import {
  ProjectPriority,
  ProjectStatus,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

const statusWeight: Record<ProjectStatus, number> = {
  IN_PROGRESS: 0,
  PLANNING: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const priorityWeight: Record<ProjectPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

async function main(): Promise<void> {
  const equipmentList =
    await prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
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
            id: true,
            quantity: true,
            allocatedQuantity: true,

            project: {
              select: {
                id: true,
                name: true,
                status: true,
                priority: true,
                dueDate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

  for (const equipment of equipmentList) {
    const orderedRequirements = [
      ...equipment.projects,
    ].sort((left, right) => {
      const statusDifference =
        statusWeight[left.project.status] -
        statusWeight[right.project.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const priorityDifference =
        priorityWeight[left.project.priority] -
        priorityWeight[right.project.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const leftDueDate =
        left.project.dueDate?.getTime() ??
        Number.MAX_SAFE_INTEGER;

      const rightDueDate =
        right.project.dueDate?.getTime() ??
        Number.MAX_SAFE_INTEGER;

      if (leftDueDate !== rightDueDate) {
        return leftDueDate - rightDueDate;
      }

      return (
        left.project.createdAt.getTime() -
        right.project.createdAt.getTime()
      );
    });

    let availableQuantity = Math.max(
      equipment.quantity,
      0,
    );

    console.log(
      `\n${equipment.name}: ${availableQuantity} unidade(s) disponíveis`,
    );

    for (const requirement of orderedRequirements) {
      const requiredQuantity = Math.max(
        requirement.quantity,
        0,
      );

      const allocatedQuantity = Math.min(
        requiredQuantity,
        availableQuantity,
      );

      await prisma.projectEquipment.update({
        where: {
          id: requirement.id,
        },

        data: {
          allocatedQuantity,
        },
      });

      availableQuantity -= allocatedQuantity;

      console.log(
        [
          `  ${requirement.project.name}`,
          `necessário=${requiredQuantity}`,
          `alocado=${allocatedQuantity}`,
          `faltando=${Math.max(
            requiredQuantity - allocatedQuantity,
            0,
          )}`,
        ].join(" | "),
      );
    }

    console.log(
      `  Estoque livre restante: ${availableQuantity}`,
    );
  }

  console.log(
    "\nRateio inicial concluído com sucesso.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Erro ao executar o rateio inicial:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });