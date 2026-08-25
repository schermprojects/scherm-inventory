import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentCondition,
  EquipmentStatus,
  ProjectStatus,
} from "@/generated/prisma/enums";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { calculateStock } from "@/lib/inventory/calculateStock";
import {
  getStockAlertLevel,
  LOW_STOCK_THRESHOLD,
} from "@/lib/inventory/stockAlert";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUANTITY = 999999;

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

type EquipmentBody = {
  name?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  quantity?: unknown;
  damagedQuantity?: unknown;
  invoiceNumber?: unknown;
  category?: unknown;
  status?: unknown;
  condition?: unknown;
  notes?: unknown;
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
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text || null;
}

function parseNonNegativeInteger(
  value: unknown,
  label: string,
  fallback?: number,
): number {
  if (
    (value === undefined ||
      value === null ||
      value === "") &&
    fallback !== undefined
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > MAX_QUANTITY
  ) {
    throw new Error(
      `O campo "${label}" deve ser um número inteiro entre 0 e ${MAX_QUANTITY}.`,
    );
  }

  return parsedValue;
}

function parseStatus(
  value: unknown,
): EquipmentStatus {
  if (
    typeof value === "string" &&
    Object.values(
      EquipmentStatus,
    ).includes(
      value as EquipmentStatus,
    )
  ) {
    return value as EquipmentStatus;
  }

  return EquipmentStatus.AVAILABLE;
}

function parseCondition(
  value: unknown,
): EquipmentCondition {
  if (
    typeof value === "string" &&
    Object.values(
      EquipmentCondition,
    ).includes(
      value as EquipmentCondition,
    )
  ) {
    return value as EquipmentCondition;
  }

  return EquipmentCondition.NEW;
}

function getUserRole(
  role: unknown,
): UserRole | null {
  if (
    role === "ADMIN" ||
    role === "BACKOFFICE" ||
    role === "COMMERCIAL" ||
    role === "VIEWER"
  ) {
    return role;
  }

  return null;
}

function canCreateEquipment(
  role: UserRole | null,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}

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
          images: {
            orderBy: {
              position: "asc",
            },
            take: 1,
          },

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
              allocatedQuantity: true,
              projectId: true,

              project: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            name: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    const equipment =
      equipmentRecords.map((item) => {
        const requested =
  item.projects.reduce(
    (
      total,
      projectEquipment,
    ) =>
      total +
      Math.max(
        projectEquipment.quantity,
        0,
      ),
    0,
  );

        const {
  physicalStock,
  operationalStock,
  inUse,
  availableStock,
  shortage,
} = calculateStock(
  item.quantity,
  requested,
  item.damagedQuantity,
);

        const stockAlertLevel =
          getStockAlertLevel(
            availableStock,
          );

        const isOutOfStock =
          stockAlertLevel ===
          "OUT_OF_STOCK";

        const isBelowMinimum =
          stockAlertLevel ===
          "LOW_STOCK";

        const hasShortage =
          shortage > 0;

        const projectsUsing =
          new Set(
            item.projects.map(
              (projectEquipment) =>
                projectEquipment.projectId,
            ),
          ).size;

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          manufacturer:
            item.manufacturer,
          model: item.model,
          serialNumber:
            item.serialNumber,

          quantity: operationalStock,
          physicalStock,

damagedQuantity:
  item.damagedQuantity,

hasDamagedUnits:
  item.damagedQuantity > 0,

minimumStock:
  LOW_STOCK_THRESHOLD,

          inUse,
          availableStock,
          shortage,
          projectsUsing,

          isOutOfStock,
          isBelowMinimum,
          hasShortage,

          invoiceNumber:
            item.invoiceNumber,

          status: item.status,
          condition: item.condition,
          notes: item.notes,

          images: item.images,

          activeProjects:
  item.projects.map(
    (projectEquipment) => {
      const pendingQuantity =
        Math.max(
          projectEquipment.quantity -
            projectEquipment.allocatedQuantity,
          0,
        );

      return {
        projectId:
          projectEquipment.project.id,

        projectName:
          projectEquipment.project.name,

        projectStatus:
          projectEquipment.project.status,

        quantity:
          projectEquipment.quantity,

        allocatedQuantity:
          projectEquipment.allocatedQuantity,

        pendingQuantity,
      };
    },
  ),

          createdAt:
            item.createdAt,

          updatedAt:
            item.updatedAt,
        };
      });

    const summary =
      equipment.reduce(
        (
          accumulator,
          item,
        ) => {
          accumulator.totalEquipment +=
            1;

          accumulator.totalPhysicalStock +=
            item.physicalStock;

          accumulator.totalInUse +=
            item.inUse;

          accumulator.totalAvailable +=
            item.availableStock;

          accumulator.totalShortage +=
            item.shortage;
          
          accumulator.totalDamaged +=
            item.damagedQuantity;

        if (item.hasDamagedUnits) {
            accumulator.equipmentWithDamage +=
            1;
          }

          if (item.isOutOfStock) {
            accumulator.outOfStock +=
              1;
          } else if (
            item.isBelowMinimum
          ) {
            accumulator.belowMinimum +=
              1;
          }

          if (item.hasShortage) {
            accumulator.equipmentWithShortage +=
              1;
          }

          return accumulator;
        },
        {
          totalEquipment: 0,
          totalPhysicalStock: 0,
          totalInUse: 0,
          totalAvailable: 0,
          totalShortage: 0,
          totalDamaged: 0,
          equipmentWithDamage: 0,
          outOfStock: 0,
          belowMinimum: 0,
          equipmentWithShortage: 0,
        },
      );

    return Response.json({
      success: true,
      data: equipment,
      total: equipment.length,
      summary,
    });
  } catch (error) {
    console.error(
      "Erro ao listar equipamentos:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os equipamentos.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
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

  const role = getUserRole(
    session.user.role,
  );

  if (!canCreateEquipment(role)) {
    return Response.json(
      {
        success: false,
        message:
          "Você não tem permissão para cadastrar equipamentos.",
      },
      {
        status: 403,
      },
    );
  }

const canSetInitialStock =
  role === "ADMIN" ||
  role === "BACKOFFICE";

  try {
    const body =
      (await request.json()) as EquipmentBody;

    const requestedQuantity =
  parseNonNegativeInteger(
    body.quantity,
    "Quantidade operacional",
    0,
  );

const requestedDamagedQuantity =
  parseNonNegativeInteger(
    body.damagedQuantity,
    "Quantidade danificada",
    0,
  );

/*
 * ADMIN e BACKOFFICE podem cadastrar
 * equipamentos diretamente no estoque
 * e definir o estoque inicial.
 *
 * O COMMERCIAL utiliza o fluxo específico
 * de cadastro rápido dentro de projetos.
 */
    const quantity =
  canSetInitialStock
    ? requestedQuantity
    : 0;

const damagedQuantity =
  canSetInitialStock
    ? requestedDamagedQuantity
    : 0;

/*
 * Estoque inicial, nota fiscal, status
 * e condição operacional são controlados
 * por ADMIN e BACKOFFICE neste fluxo.
 */
const invoiceNumber =
  canSetInitialStock
    ? optionalText(
        body.invoiceNumber,
      )
    : null;

const status =
  canSetInitialStock
    ? parseStatus(
        body.status,
      )
    : EquipmentStatus.AVAILABLE;

const condition =
  canSetInitialStock
    ? parseCondition(
        body.condition,
      )
    : EquipmentCondition.NEW;

    const equipment =
      await prisma.equipment.create({
        data: {
          name: requiredText(
            body.name,
            "Nome",
          ),

          manufacturer:
            optionalText(
              body.manufacturer,
            ),

          model: optionalText(
            body.model,
          ),

          serialNumber:
            optionalText(
              body.serialNumber,
            )?.toUpperCase() ?? null,

          quantity,
          damagedQuantity,

          /*
           * Regra fixa do sistema:
           * 0 = sem estoque
           * 1 a 3 = baixo estoque
           * 4 ou mais = estoque normal
           */
          minimumStock:
            LOW_STOCK_THRESHOLD,

          invoiceNumber,

          category: requiredText(
            body.category,
            "Categoria",
          ),

          status,

          condition,

          notes: optionalText(
            body.notes,
          ),
        },

        include: {
          images: {
            orderBy: {
              position: "asc",
            },
            take: 1,
          },
        },
      });

    await logAudit({
      action: AuditAction.CREATE,
      entity: AuditEntity.EQUIPMENT,
      entityId: equipment.id,
      userId:
        session.user.id ?? null,
      description:
        `Equipamento "${equipment.name}" cadastrado.`,
      newData: {
        id: equipment.id,
        name: equipment.name,
        manufacturer:
          equipment.manufacturer,
        model: equipment.model,
        serialNumber:
          equipment.serialNumber,
        quantity:
          equipment.quantity,
        damagedQuantity:
          equipment.damagedQuantity,
        minimumStock:
          LOW_STOCK_THRESHOLD,
        invoiceNumber:
          equipment.invoiceNumber,
        category:
          equipment.category,
        status:
          equipment.status,
        condition:
          equipment.condition,
        notes:
          equipment.notes,
        createdAt:
          equipment.createdAt,
      },
    });

    const createdStockAlertLevel =
      getStockAlertLevel(
        equipment.quantity,
      );

    return Response.json(
      {
        success: true,

        message:
  "Equipamento cadastrado com sucesso.",

        data: {
          ...equipment,

          quantity:
            equipment.quantity,

          physicalStock:
            equipment.quantity +
            equipment.damagedQuantity,

          damagedQuantity:
            equipment.damagedQuantity,

          hasDamagedUnits:
            equipment.damagedQuantity > 0,

          minimumStock:
            LOW_STOCK_THRESHOLD,

          inUse: 0,

          availableStock:
            equipment.quantity,

          shortage: 0,

          projectsUsing: 0,

          isOutOfStock:
            createdStockAlertLevel ===
            "OUT_OF_STOCK",

          isBelowMinimum:
            createdStockAlertLevel ===
            "LOW_STOCK",

          hasShortage: false,

          activeProjects: [],
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao cadastrar equipamento:",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Já existe um equipamento utilizando um campo que deve ser exclusivo, como o número de série.",
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof SyntaxError) {
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
          "Não foi possível cadastrar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}