import type { Session } from "next-auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  EquipmentCondition,
  EquipmentRmaStatus,
  EquipmentStatus,
} from "@/generated/prisma/enums";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EquipmentRequestBody = {
  name?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  serialNumbers?: unknown;
  quantity?: unknown;
  damagedQuantity?: unknown;
  category?: unknown;
  status?: unknown;
  condition?: unknown;
  invoiceNumber?: unknown;
  notes?: unknown;
};

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]>;
};

class ValidationError extends Error {
  field?: keyof EquipmentRequestBody;

  constructor(
    message: string,
    field?: keyof EquipmentRequestBody,
  ) {
    super(message);

    this.name = "ValidationError";
    this.field = field;
  }
}

function requiredText(
  value: unknown,
  label: string,
  field: keyof EquipmentRequestBody,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new ValidationError(
      `O campo "${label}" é obrigatório.`,
      field,
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

  const normalizedValue =
    value.trim();

  return normalizedValue || null;
}

function optionalUppercaseText(
  value: unknown,
): string | null {
  const normalizedValue =
    optionalText(value);

  return normalizedValue
    ? normalizedValue.toUpperCase()
    : null;
}

function parseSerialNumbers(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      "Os números de série informados são inválidos.",
      "serialNumbers",
    );
  }

  if (
    value.some(
      (serialNumber) =>
        typeof serialNumber !== "string",
    )
  ) {
    throw new ValidationError(
      "Os números de série informados são inválidos.",
      "serialNumbers",
    );
  }

  const serialNumbers = value
    .map((serialNumber) =>
      serialNumber.trim().toUpperCase(),
    )
    .filter(Boolean);

  if (
    new Set(serialNumbers).size !==
    serialNumbers.length
  ) {
    throw new ValidationError(
      "Existem números de série duplicados.",
      "serialNumbers",
    );
  }

  return serialNumbers;
}

function requiredNonNegativeInteger(
  value: unknown,
  label: string,
  field: keyof EquipmentRequestBody,
): number {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > 999999
  ) {
    throw new ValidationError(
      `O campo "${label}" deve ser um número inteiro entre 0 e 999999.`,
      field,
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

  throw new ValidationError(
    "O status informado é inválido.",
    "status",
  );
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

  throw new ValidationError(
    "A condição informada é inválida.",
    "condition",
  );
}

function duplicateResponse(
  error: Prisma.PrismaClientKnownRequestError,
) {
  const target = Array.isArray(
    error.meta?.target,
  )
    ? error.meta.target.join(",")
    : String(
        error.meta?.target ?? "",
      );

  if (
    target.includes("serialNumber")
  ) {
    return Response.json(
      {
        success: false,
        field: "serialNumber",
        message:
          "Esse número de série já está cadastrado.",
      },
      {
        status: 409,
      },
    );
  }

  return Response.json(
    {
      success: false,
      message:
        "Já existe um equipamento com esses dados.",
    },
    {
      status: 409,
    },
  );
}

async function requireAuthentication(): Promise<
  AuthenticatedSession | null
> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session as AuthenticatedSession;
}

function canUpdateEquipment(
  role: Session["user"]["role"],
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}

function canDeleteEquipment(
  role: Session["user"]["role"],
): boolean {
  return role === "ADMIN";
}

function serializeEquipmentForAudit(
  equipment: {
    id: string;
    name: string;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    equipmentUnits: {
      serialNumber: string;
    }[];
    quantity: number;
    damagedQuantity: number;
    category: string;
    status: EquipmentStatus;
    condition: EquipmentCondition;
    invoiceNumber: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  return {
    id: equipment.id,
    name: equipment.name,
    manufacturer:
      equipment.manufacturer,
    model: equipment.model,
    serialNumbers:
  equipment.equipmentUnits.length > 0
    ? equipment.equipmentUnits.map(
        (unit) => unit.serialNumber,
      )
    : equipment.serialNumber
      ? [equipment.serialNumber]
      : [],
    quantity: equipment.quantity,
    damagedQuantity:
      equipment.damagedQuantity,
    physicalStock:
      equipment.quantity +
      equipment.damagedQuantity,
    category: equipment.category,
    status: equipment.status,
    condition:
      equipment.condition,
    invoiceNumber:
      equipment.invoiceNumber,
    notes: equipment.notes,
    createdAt:
      equipment.createdAt,
    updatedAt:
      equipment.updatedAt,
  };
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const session =
    await requireAuthentication();

  if (!session) {
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

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "O identificador do equipamento é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    const equipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        include: {
          images: {
            orderBy: {
              position: "asc",
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

    return Response.json({
  success: true,

  data: {
    ...equipment,

    operationalStock:
      equipment.quantity,

    damagedQuantity:
      equipment.damagedQuantity,

    physicalStock:
      equipment.quantity +
      equipment.damagedQuantity,

    hasDamagedUnits:
      equipment.damagedQuantity > 0,
  },
});

  } catch (error) {
    console.error(
      "Erro ao buscar equipamento:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const session =
    await requireAuthentication();


  if (!session) {
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

  if (
  !canUpdateEquipment(
    session.user.role,
  )
) {
  return Response.json(
    {
      success: false,
      message:
        "Você não possui permissão para editar equipamentos.",
    },
    {
      status: 403,
    },
  );
}

  try {
    const { id } =
      await context.params;

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "O identificador do equipamento é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request.json()) as EquipmentRequestBody;

    const existingEquipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

select: {
  id: true,
  name: true,
  manufacturer: true,
  model: true,
  serialNumber: true,
  quantity: true,
  damagedQuantity: true,
  category: true,
  status: true,
  condition: true,
  rmaStatus: true,
  invoiceNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
equipmentUnits: {
  select: {
    id: true,
    serialNumber: true,
    movements: {
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
      select: {
        type: true,
      },
    },
    projectAssignment: {
      select: {
        id: true,
      },
    },
    _count: {
      select: {
        movements: true,
      },
    },
  },
  orderBy: {
    createdAt: "asc",
  },
},
},
});

    if (!existingEquipment) {
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

    /*
    * Uma peça substituída por RMA não está mais fisicamente
    * no estoque. O Equipment original permanece somente como
    * registro histórico e não pode sofrer novas alterações
    * ou movimentações operacionais.
    */
    if (
      existingEquipment.rmaStatus ===
      EquipmentRmaStatus.REPLACED
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento foi substituído por RMA e está preservado somente para histórico.",
        },
        {
          status: 409,
        },
      );
    }

    const quantity =
      requiredNonNegativeInteger(
      body.quantity,
      "Quantidade operacional",
      "quantity",
      );

    const damagedQuantity =
      requiredNonNegativeInteger(
      body.damagedQuantity ?? 0,
      "Quantidade danificada",
      "damagedQuantity",
      );

    const serialNumbers =
      parseSerialNumbers(
        body.serialNumbers,
      );

const existingUnits = existingEquipment.equipmentUnits.map((unit) => ({
  id: unit.id,
  serialNumber: unit.serialNumber,
  movementCount: unit._count.movements,
  hasProjectAssignment: Boolean(unit.projectAssignment),
  isInStock: unit.movements[0]?.type !== "EXIT",
}));

const existingSerialNumbers = existingUnits
  .map((unit) => unit.serialNumber)
  .filter((value): value is string => Boolean(value));

const serialNumbersToCreate = serialNumbers.filter(
  (serialNumber) => !existingSerialNumbers.includes(serialNumber)
);

const serialNumbersToDelete = existingUnits.filter(
  (unit) =>
    unit.serialNumber &&
    !serialNumbers.includes(unit.serialNumber)
);

const blockedSerialNumbers = serialNumbersToDelete.filter(
  (unit) =>
    unit.movementCount > 0 ||
    unit.hasProjectAssignment
);

if (blockedSerialNumbers.length > 0) {
  return Response.json(
    {
      success: false,
      message:
        "Não é possível alterar ou remover S/N que possuem movimentações ou histórico.",
      serialNumbers: blockedSerialNumbers.map(
        (unit) => unit.serialNumber,
      ),
    },
    { status: 409 },
  );
}

const physicalQuantity = quantity + damagedQuantity;

const retainedSerialNumbersCount = existingUnits.filter(
  (unit) =>
    unit.isInStock &&
    serialNumbers.includes(unit.serialNumber),
).length;

if (retainedSerialNumbersCount > physicalQuantity) {
  return Response.json(
    {
      success: false,
      message:
        "Não é possível reduzir o estoque físico abaixo da quantidade de unidades identificadas por S/N.",
    },
    { status: 409 },
  );
}

const availableIdentificationSlots = Math.max(
  0,
  physicalQuantity - retainedSerialNumbersCount,
);

if (serialNumbersToCreate.length > availableIdentificationSlots) {
  return Response.json(
    {
      error: `Quantidade de S/N informados excede a quantidade física disponível (${physicalQuantity}).`,
    },
    { status: 400 }
  );
}

    const equipment =
      await prisma.equipment.update({
        where: {
          id,
        },

        data: {
          name: requiredText(
            body.name,
            "Nome",
            "name",
          ),

          category: requiredText(
            body.category,
            "Categoria",
            "category",
          ),

          manufacturer:
            optionalText(
              body.manufacturer,
            ),

          model: optionalText(
            body.model,
          ),

          quantity,
          damagedQuantity,

          invoiceNumber:
            optionalText(
              body.invoiceNumber,
            ),

          status: parseStatus(
            body.status,
          ),

          condition:
            parseCondition(
              body.condition,
            ),

          notes: optionalText(
            body.notes,
          ),

          equipmentUnits: {
            deleteMany:
              serialNumbersToDelete.length > 0
                ? {
                    serialNumber: {
                      in: serialNumbersToDelete.map(
                        (unit) => unit.serialNumber
                      ),
                    },
                  }
                : undefined,

            create: serialNumbersToCreate.map(
              (serialNumber) => ({
                serialNumber,
              }),
            ),
          },
        },

        include: {
          equipmentUnits: {
            orderBy: {
              createdAt: "asc",
            },
          },
          images: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

    await logAudit({
      action:
        AuditAction.UPDATE,
      entity:
        AuditEntity.EQUIPMENT,
      entityId: equipment.id,
      userId:
        session.user.id ?? null,
      description:
        `Equipamento "${equipment.name}" atualizado.`,
      oldData:
        serializeEquipmentForAudit(
          existingEquipment,
        ),
      newData:
        serializeEquipmentForAudit(
          equipment,
        ),
    });

    return Response.json({
      success: true,
      message:
        "Equipamento atualizado com sucesso.",
      data: equipment,
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar equipamento:",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateResponse(error);
    }

    if (
      error instanceof SyntaxError
    ) {
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

    if (
      error instanceof
      ValidationError
    ) {
      return Response.json(
        {
          success: false,
          field: error.field,
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
          "Não foi possível atualizar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const session =
    await requireAuthentication();

  if (!session) {
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

  if (
  !canDeleteEquipment(
    session.user.role,
  )
) {
  return Response.json(
    {
      success: false,
      message:
        "Você não possui permissão para excluir equipamentos.",
    },
    {
      status: 403,
    },
  );
}

  try {
    const { id } =
      await context.params;

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "O identificador do equipamento é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    const existingEquipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          quantity: true,
          damagedQuantity: true,
          category: true,
          status: true,
          condition: true,
          rmaStatus: true,
          invoiceNumber: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          equipmentUnits: {
            select: {
              serialNumber: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },  
          images: {
            select: {
              pathname: true,
            },
          },
        },
      });

    if (!existingEquipment) {
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

    /*
    * Equipamentos substituídos por RMA são registros
    * históricos permanentes. A exclusão apagaria a ligação
    * entre a peça defeituosa e a unidade que a substituiu.
    */
    if (
      existingEquipment.rmaStatus ===
      EquipmentRmaStatus.REPLACED
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Este equipamento foi substituído por RMA e não pode ser excluído porque faz parte do histórico.",
        },
        {
          status: 409,
        },
      );
    }

    const imagePathnames =
      existingEquipment.images
        .map(
          (image) =>
            image.pathname,
        )
        .filter(
          (
            pathname,
          ): pathname is string =>
            Boolean(pathname),
        );

    const deletedEquipment =
      await prisma.equipment.delete({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          quantity: true,
          damagedQuantity: true,
          category: true,
          status: true,
          condition: true,
          invoiceNumber: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          equipmentUnits: {
            select: {
              serialNumber: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

    await logAudit({
      action:
        AuditAction.DELETE,
      entity:
        AuditEntity.EQUIPMENT,
      entityId:
        deletedEquipment.id,
      userId:
        session.user.id ?? null,
      description:
        `Equipamento "${deletedEquipment.name}" excluído.`,
      oldData:
        serializeEquipmentForAudit(
          deletedEquipment,
        ),
    });

    if (
      imagePathnames.length > 0
    ) {
      try {
        await del(
          imagePathnames,
        );
      } catch (blobError) {
        console.error(
          "Equipamento excluído, mas houve erro ao remover imagens do Blob:",
          blobError,
        );
      }
    }

    return Response.json({
      success: true,
      message:
        "Equipamento excluído com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao excluir equipamento:",
      error,
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "Não é possível excluir este equipamento porque ele possui vínculos com projetos, movimentações ou outros registros.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
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

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível excluir o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}