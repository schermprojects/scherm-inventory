import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const records =
      await prisma.equipment.findMany({
        select: {
          category: true,
        },

        distinct: [
          "category",
        ],

        orderBy: {
          category: "asc",
        },
      });

    const categories =
      records
        .map(
          (record) =>
            record.category.trim(),
        )
        .filter(Boolean)
        .sort((first, second) =>
          first.localeCompare(
            second,
            "pt-BR",
          ),
        );

    return Response.json({
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (error) {
    console.error(
      "Erro ao listar categorias:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar as categorias.",
      },
      {
        status: 500,
      },
    );
  }
}