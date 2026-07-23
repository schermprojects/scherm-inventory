import {
  EquipmentCondition,
  EquipmentStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EquipmentRequestBody = {
  patrimony?: unknown;
  name?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  category?: unknown;
  status?: unknown;
  condition?: unknown;
  client?: unknown;
  location?: unknown;
  responsible?: unknown;
  acquisitionDate?: unknown;
  warrantyEndDate?: unknown;
  value?: unknown;
  supplier?: unknown;
  invoiceNumber?: unknown;
  notes?: unknown;
};

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo "${label}" é obrigatório.`);
  }

  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue || null;
}

function requiredDate(value: unknown, label: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo "${label}" é obrigatório.`);
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`O campo "${label}" possui uma data inválida.`);
  }

  return date;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`O campo "${label}" possui uma data inválida.`);
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`O campo "${label}" possui uma data inválida.`);
  }

  return date;
}

function optionalDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("O valor do equipamento é inválido.");
    }

    return new Prisma.Decimal(value);
  }

  if (typeof value !== "string") {
    throw new Error("O valor do equipamento é inválido.");
  }

  const cleanedValue = value.trim().replace(/[^\d,.-]/g, "");

  if (!cleanedValue) {
    return null;
  }

  const normalizedValue = cleanedValue.includes(",")
    ? cleanedValue.replace(/\./g, "").replace(",", ".")
    : cleanedValue;

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("O valor do equipamento é inválido.");
  }

  return new Prisma.Decimal(numericValue);
}

function parseStatus(value: unknown): EquipmentStatus {
  if (
    typeof value === "string" &&
    Object.values(EquipmentStatus).includes(
      value as EquipmentStatus,
    )
  ) {
    return value as EquipmentStatus;
  }

  throw new Error("O status informado é inválido.");
}

function parseCondition(value: unknown): EquipmentCondition {
  if (
    typeof value === "string" &&
    Object.values(EquipmentCondition).includes(
      value as EquipmentCondition,
    )
  ) {
    return value as EquipmentCondition;
  }

  throw new Error("A condição informada é inválida.");
}

function duplicateResponse(error: Prisma.PrismaClientKnownRequestError) {
  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? "");

  if (target.includes("patrimony")) {
    return Response.json(
      {
        success: false,
        field: "patrimony",
        message: "Esse patrimônio já está cadastrado.",
      },
      {
        status: 409,
      },
    );
  }

  if (target.includes("serialNumber")) {
    return Response.json(
      {
        success: false,
        field: "serialNumber",
        message: "Esse número de série já está cadastrado.",
      },
      {
        status: 409,
      },
    );
  }

  return Response.json(
    {
      success: false,
      message: "Já existe um equipamento com esses dados.",
    },
    {
      status: 409,
    },
  );
}

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

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const equipment = await prisma.equipment.findUnique({
      where: {
        id,
      },
    });

    if (!equipment) {
      return Response.json(
        {
          success: false,
          message: "Equipamento não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error("Erro ao carregar equipamento:", error);

    return Response.json(
      {
        success: false,
        message: "Não foi possível carregar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}
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

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as EquipmentRequestBody;

    const existingEquipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      });

    if (!existingEquipment) {
      return Response.json(
        {
          success: false,
          message: "Equipamento não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const equipment = await prisma.equipment.update({
      where: {
        id,
      },
      data: {
        patrimony: requiredText(
          body.patrimony,
          "Patrimônio",
        ).toUpperCase(),

        name: requiredText(
          body.name,
          "Nome do equipamento",
        ),

        manufacturer: requiredText(
          body.manufacturer,
          "Fabricante",
        ),

        model: requiredText(body.model, "Modelo"),

        serialNumber: requiredText(
          body.serialNumber,
          "Número de série",
        ).toUpperCase(),

        category: requiredText(body.category, "Categoria"),

        status: parseStatus(body.status),

        condition: parseCondition(body.condition),

        client: requiredText(body.client, "Cliente"),

        location: requiredText(
          body.location,
          "Localização",
        ),

        responsible: requiredText(
          body.responsible,
          "Responsável",
        ),

        acquisitionDate: requiredDate(
          body.acquisitionDate,
          "Data de aquisição",
        ),

        warrantyEndDate: optionalDate(
          body.warrantyEndDate,
          "Fim da garantia",
        ),

        value: optionalDecimal(body.value),

        supplier: optionalText(body.supplier),

        invoiceNumber: optionalText(body.invoiceNumber),

        notes: optionalText(body.notes),
      },
    });

    return Response.json({
      success: true,
      message: "Equipamento atualizado com sucesso.",
      data: equipment,
    });
  } catch (error) {
    console.error("Erro ao atualizar equipamento:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateResponse(error);
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          success: false,
          message: "O conteúdo enviado não é válido.",
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
        message: "Não foi possível atualizar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}

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

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const existingEquipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          patrimony: true,
        },
      });

    if (!existingEquipment) {
      return Response.json(
        {
          success: false,
          message: "Equipamento não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    await prisma.equipment.delete({
      where: {
        id,
      },
    });

    return Response.json({
      success: true,
      message: "Equipamento excluído com sucesso.",
      data: existingEquipment,
    });
  } catch (error) {
    console.error("Erro ao excluir equipamento:", error);

    return Response.json(
      {
        success: false,
        message: "Não foi possível excluir o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}