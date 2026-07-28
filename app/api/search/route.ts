import { prisma } from "@/lib/prisma";
import {
  type NextRequest,
  NextResponse,
} from "next/server";

const MIN_QUERY_LENGTH = 2;
const RESULTS_PER_TYPE = 5;

type SearchResult = {
  id: string;
  type: "equipment" | "project" | "user";
  title: string;
  description: string;
  href: string;
};

export async function GET(
  request: NextRequest,
) {
  const query =
    request.nextUrl.searchParams
      .get("q")
      ?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      success: true,
      results: [],
    });
  }

  try {
    const [equipment, projects, users] =
      await Promise.all([
        prisma.equipment.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: query,
                },
              },
              {
                serialNumber: {
                  contains: query,
                },
              },
              {
                manufacturer: {
                  contains: query,
                },
              },
              {
                model: {
                  contains: query,
                },
              },
              {
                category: {
                  contains: query,
                },
              },
            ],
          },

          select: {
            id: true,
            name: true,
            category: true,
            manufacturer: true,
            model: true,
            serialNumber: true,
          },

          orderBy: {
            name: "asc",
          },

          take: RESULTS_PER_TYPE,
        }),

        prisma.project.findMany({
          where: {
            name: {
              contains: query,
            },
          },

          select: {
            id: true,
            name: true,
            status: true,
          },

          orderBy: {
            name: "asc",
          },

          take: RESULTS_PER_TYPE,
        }),

        prisma.user.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: query,
                },
              },
              {
                username: {
                  contains: query,
                },
              },
            ],
          },

          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },

          orderBy: {
            name: "asc",
          },

          take: RESULTS_PER_TYPE,
        }),
      ]);

    const equipmentResults: SearchResult[] =
      equipment.map((item) => {
        const manufacturerAndModel = [
          item.manufacturer,
          item.model,
        ]
          .filter(Boolean)
          .join(" ");

        const details = [
          item.category,
          manufacturerAndModel || null,
          item.serialNumber
            ? `Série: ${item.serialNumber}`
            : null,
        ].filter(Boolean);

        return {
          id: item.id,
          type: "equipment",
          title: item.name,
          description:
            details.join(" · ") ||
            "Equipamento cadastrado",
          href: `/inventory/${item.id}`,
        };
      });

    const projectResults: SearchResult[] =
      projects.map((project) => ({
        id: project.id,
        type: "project",
        title: project.name,
        description: formatProjectStatus(
          project.status,
        ),
        href: `/projects/${project.id}`,
      }));

    const userResults: SearchResult[] =
      users.map((user) => ({
        id: user.id,
        type: "user",
        title: user.name,
        description: [
          `@${user.username}`,
          formatUserRole(user.role),
        ].join(" · "),
        href: `/users/${user.id}`,
      }));

    return NextResponse.json({
      success: true,
      results: [
        ...equipmentResults,
        ...projectResults,
        ...userResults,
      ],
    });
  } catch (error) {
    console.error(
      "Erro na pesquisa global:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível realizar a pesquisa.",
        results: [],
      },
      {
        status: 500,
      },
    );
  }
}

function formatProjectStatus(
  status: string,
): string {
  const labels: Record<string, string> = {
    PLANNING: "Planejamento",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

  return labels[status] ?? status;
}

function formatUserRole(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    COMMERCIAL: "Comercial",
    VIEWER: "Consulta",
  };

  return labels[role] ?? role;
}