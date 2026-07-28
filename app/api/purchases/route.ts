import { ProjectStatus } from "@/generated/prisma/client";

import { auth } from "@/auth";
import { calculateStock } from "@/lib/inventory/calculateStock";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

type PurchaseProject = {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
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
  totalNeeded: number;
  inUse: number;
  availableStock: number;
  availableAfterDemand: number;
  purchaseQuantity: number;

  projectCount: number;
  projects: PurchaseProject[];

  isOutOfStock: boolean;
  isBelowMinimum: boolean;
  hasShortage: boolean;
};

export async function GET() {
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
    const equipmentRecords =
      await prisma.equipment.findMany({
        include: {
          projects: {
            where: {
              project: {
                status: {
                  in: ACTIVE_PROJECT_STATUSES,
                },
              },
            },

            select: {
              quantity: true,

              project: {
                select: {
                  id: true,
                  name: true,
                  clientName: true,
                  status: true,
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
      equipmentRecords.map((equipment) => {
        const projects: PurchaseProject[] =
          equipment.projects
            .map((projectEquipment) => ({
              id: projectEquipment.project.id,
              name: projectEquipment.project.name,
              clientName:
                projectEquipment.project.clientName,
              status:
                projectEquipment.project.status,
              quantity: Math.max(
                projectEquipment.quantity,
                0,
              ),
            }))
            .sort((first, second) =>
              first.name.localeCompare(
                second.name,
                "pt-BR",
                {
                  sensitivity: "base",
                },
              ),
            );

        const totalNeeded = projects.reduce(
          (total, project) =>
            total + project.quantity,
          0,
        );

        const {
          physicalStock,
          inUse,
          availableStock,
          shortage,
        } = calculateStock(
          equipment.quantity,
          totalNeeded,
        );

        return {
          equipmentId: equipment.id,
          name: equipment.name,
          category: equipment.category,
          manufacturer:
            equipment.manufacturer,
          model: equipment.model,
          serialNumber:
            equipment.serialNumber,

          physicalStock,
          minimumStock: Math.max(
            equipment.minimumStock,
            0,
          ),

          totalNeeded,
          inUse,
          availableStock,

          availableAfterDemand:
            availableStock,

          purchaseQuantity: shortage,

          projectCount: projects.length,
          projects,

          isOutOfStock:
            physicalStock === 0,

          isBelowMinimum:
            availableStock <=
            Math.max(
              equipment.minimumStock,
              0,
            ),

          hasShortage: shortage > 0,
        };
      });

    const purchaseCategories =
      Array.from(
        new Set(
          items
            .filter(
              (item) =>
                item.hasShortage,
            )
            .map((item) =>
              item.category.trim(),
            )
            .filter(Boolean),
        ),
      ).sort((first, second) =>
        first.localeCompare(
          second,
          "pt-BR",
          {
            sensitivity: "base",
          },
        ),
      );

    const affectedProjectIds =
      new Set<string>();

    const summary = items.reduce(
      (accumulator, item) => {
        accumulator.totalEquipment +=
          1;

        accumulator.totalPhysicalStock +=
          item.physicalStock;

        accumulator.totalNeeded +=
          item.totalNeeded;

        accumulator.totalToPurchase +=
          item.purchaseQuantity;

        if (item.hasShortage) {
          accumulator.equipmentWithShortage +=
            1;

          for (const project of item.projects) {
            affectedProjectIds.add(
              project.id,
            );
          }
        }

        if (item.isOutOfStock) {
          accumulator.outOfStock +=
            1;
        }

        if (item.isBelowMinimum) {
          accumulator.belowMinimum +=
            1;
        }

        return accumulator;
      },
      {
        totalEquipment: 0,
        equipmentWithShortage: 0,
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
      data: items,
      categories: purchaseCategories,
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