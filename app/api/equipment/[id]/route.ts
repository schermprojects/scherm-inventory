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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

  // restante do GET
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

  // restante do PATCH
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

  // restante do DELETE
}