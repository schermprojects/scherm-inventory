import {
  EquipmentCondition,
  EquipmentStatus,
  Prisma,
  ProjectStatus,
} from "@/generated/prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateStock } from "@/lib/inventory/calculateStock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MINIMUM_STOCK = 3;
const MAX_QUANTITY = 999999;

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
];

type UserRole =
  | "ADMIN"
  | "COMMERCIAL"
  | "VIEWER";

type EquipmentBody = {
  name?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  quantity?: unknown;
  minimumStock?: unknown;
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
    Object.values(EquipmentStatus).includes(
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
    role === "COMMERCIAL"
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
      equipmentRecords.map(
        (item) => {
          const requested = item.projects.reduce(
  (total, projectEquipment) =>
    total + projectEquipment.quantity,
  0,
);

const {
  physicalStock,
  inUse,
  availableStock,
  shortage,
} = calculateStock(
  item.quantity,
  requested,
);

const isOutOfStock =
  availableStock === 0;

const isBelowMinimum =
  availableStock <= item.minimumStock;
  

          const hasShortage =
            shortage > 0;

          const projectsUsing =
            new Set(
              item.projects.map(
                (
                  projectEquipment,
                ) =>
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

 quantity: physicalStock,
physicalStock,

minimumStock:
  item.minimumStock,

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
                (
                  projectEquipment,
                ) => ({
                  projectId:
                    projectEquipment
                      .project.id,

                  projectName:
                    projectEquipment
                      .project.name,

                  projectStatus:
                    projectEquipment
                      .project.status,

                  quantity:
                    projectEquipment
                      .quantity,
                }),
              ),

            createdAt:
              item.createdAt,

            updatedAt:
              item.updatedAt,
          };
        },
      );

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

          if (item.isOutOfStock) {
            accumulator.outOfStock +=
              1;
          }

          if (item.isBelowMinimum) {
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

  const isAdministrator =
    role === "ADMIN";

  try {
    const body =
      (await request.json()) as EquipmentBody;

    const requestedQuantity =
      parseNonNegativeInteger(
        body.quantity,
        "Quantidade",
        0,
      );

    const minimumStock =
      parseNonNegativeInteger(
        body.minimumStock,
        "Estoque mínimo",
        DEFAULT_MINIMUM_STOCK,
      );

    /*
     * ADMIN pode definir o estoque inicial.
     *
     * COMMERCIAL pode cadastrar um novo item
     * de catálogo para utilizar em projetos,
     * mas o item sempre nasce com estoque físico 0.
     */
    const quantity =
      isAdministrator
        ? requestedQuantity
        : 0;

    /*
     * O comercial não confirma entrada física,
     * nota fiscal, estado ou condição operacional.
     *
     * Esses campos são controlados pelo administrador.
     */
    const invoiceNumber =
      isAdministrator
        ? optionalText(
            body.invoiceNumber,
          )
        : null;

    const status =
      isAdministrator
        ? parseStatus(body.status)
        : EquipmentStatus.AVAILABLE;

    const condition =
      isAdministrator
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

          manufacturer: optionalText(
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

          minimumStock,

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

    return Response.json(
      {
        success: true,

        message:
          role === "COMMERCIAL"
            ? "Equipamento cadastrado com estoque inicial zerado."
            : "Equipamento cadastrado com sucesso.",

        data: {
          ...equipment,

          quantity:
            equipment.quantity,

          physicalStock:
            equipment.quantity,

 inUse: 0,

availableStock:
  equipment.quantity,

          shortage: 0,

          projectsUsing: 0,

          isOutOfStock:
            equipment.quantity === 0,

          isBelowMinimum:
            equipment.quantity <=
            equipment.minimumStock,

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