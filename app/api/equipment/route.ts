import {
  EquipmentCondition,
  EquipmentStatus,
  Prisma,
} from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EquipmentBody = {
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

  const text = value.trim();

  return text || null;
}

function requiredDate(value: unknown, label: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo "${label}" é obrigatório.`);
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`O campo "${label}" contém uma data inválida.`);
  }

  return date;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`O campo "${label}" contém uma data inválida.`);
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`O campo "${label}" contém uma data inválida.`);
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
    Object.values(EquipmentStatus).includes(value as EquipmentStatus)
  ) {
    return value as EquipmentStatus;
  }

  return EquipmentStatus.AVAILABLE;
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

  return EquipmentCondition.NEW;
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
    const equipment = await prisma.equipment.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json({
      success: true,
      data: equipment,
      total: equipment.length,
    });
  } catch (error) {
    console.error("Erro ao listar equipamentos:", error);

    return Response.json(
      {
        success: false,
        message: "Não foi possível carregar os equipamentos.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
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
    const body = (await request.json()) as EquipmentBody;

    const equipment = await prisma.equipment.create({
      data: {
        patrimony: requiredText(
          body.patrimony,
          "Patrimônio",
        ).toUpperCase(),

        name: requiredText(body.name, "Nome"),

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

        location: requiredText(body.location, "Localização"),

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

    return Response.json(
      {
        success: true,
        message: "Equipamento cadastrado com sucesso.",
        data: equipment,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro ao cadastrar equipamento:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
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

    if (error instanceof SyntaxError) {
      return Response.json(
        {
          success: false,
          message: "O conteúdo enviado não é um JSON válido.",
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
        message: "Não foi possível cadastrar o equipamento.",
      },
      {
        status: 500,
      },
    );
  }
}