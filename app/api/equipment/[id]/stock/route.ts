import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STOCK_ENTRY = 999999;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StockEntryBody = {
  quantity?: unknown;
  invoiceNumber?: unknown;
  notes?: unknown;
};

function parsePositiveInteger(
  value: unknown,
  label: string,
): number {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > MAX_STOCK_ENTRY
  ) {
    throw new Error(
      `O campo "${label}" deve ser um número inteiro entre 1 e ${MAX_STOCK_ENTRY}.`,
    );
  }

  return parsedValue;
}

function optionalText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue || null;
}

export async function PATCH(
  request: Request,
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

  const role = session.user.role;

  if (
    role !== "ADMIN" &&
    role !== "COMMERCIAL"
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não tem permissão para registrar entradas de estoque.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const { id } = await context.params;

    if (!id) {
      return Response.json(
        {
          success: false,
          message:
            "Equipamento não informado.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request.json()) as StockEntryBody;

    const entryQuantity =
      parsePositiveInteger(
        body.quantity,
        "Quantidade recebida",
      );

    const invoiceNumber =
      optionalText(
        body.invoiceNumber,
      );

    const notes =
      optionalText(body.notes);

    const existingEquipment =
      await prisma.equipment.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          quantity: true,
          invoiceNumber: true,
          notes: true,
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

    const equipment =
      await prisma.equipment.update({
        where: {
          id,
        },

        data: {
          quantity: {
            increment: entryQuantity,
          },

          invoiceNumber:
            invoiceNumber ??
            existingEquipment.invoiceNumber,

          notes:
            notes ??
            existingEquipment.notes,
        },

        select: {
          id: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          quantity: true,
          minimumStock: true,
          invoiceNumber: true,
          status: true,
          condition: true,
          notes: true,
          updatedAt: true,
        },
      });

    return Response.json({
      success: true,

      message: `Entrada de ${entryQuantity} unidade(s) registrada com sucesso.`,

      data: {
        ...equipment,

        previousQuantity:
          existingEquipment.quantity,

        entryQuantity,

        currentQuantity:
          equipment.quantity,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao registrar entrada de estoque:",
      error,
    );

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
          "Não foi possível registrar a entrada de estoque.",
      },
      {
        status: 500,
      },
    );
  }
}