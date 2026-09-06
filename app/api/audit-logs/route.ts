import { auth } from "@/auth";
import {
  AuditAction,
  AuditEntity,
  UserRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: UserRole;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(
    value,
    10,
  );

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}

function parseDate(
  value: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isAuditAction(
  value: string | null,
): value is AuditAction {
  if (!value) {
    return false;
  }

  return Object.values(
    AuditAction,
  ).includes(value as AuditAction);
}

function isAuditEntity(
  value: string | null,
): value is AuditEntity {
  if (!value) {
    return false;
  }

  return Object.values(
    AuditEntity,
  ).includes(value as AuditEntity);
}

export async function GET(
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

  const sessionUser =
    session.user as SessionUser;

  /*
   * Logs de auditoria contêm informações administrativas e
   * potencialmente sensíveis sobre ações realizadas no sistema.
   * O acesso é restrito exclusivamente ao perfil ADMIN.
   */
  if (
    sessionUser.role !== UserRole.ADMIN
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para acessar os logs de auditoria.",
      },
      {
        status: 403,
      },
    );
  }

  const { searchParams } =
    new URL(request.url);

  const page = parsePositiveInteger(
    searchParams.get("page"),
    DEFAULT_PAGE,
  );

  const requestedPageSize =
    parsePositiveInteger(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
    );

  const pageSize = Math.min(
    requestedPageSize,
    MAX_PAGE_SIZE,
  );

  const userId =
    searchParams
      .get("userId")
      ?.trim() || null;

  const actionParam =
    searchParams
      .get("action")
      ?.trim() || null;

  const entityParam =
    searchParams
      .get("entity")
      ?.trim() || null;
  
  const query =
    searchParams.get("q")?.trim() ||
    null;

  const fromDate = parseDate(
    searchParams.get("from"),
  );

  const toDate = parseDate(
    searchParams.get("to"),
  );

  const action = isAuditAction(
    actionParam,
  )
    ? actionParam
    : null;

  const entity = isAuditEntity(
    entityParam,
  )
    ? entityParam
    : null;

  const skip =
    (page - 1) * pageSize;

  try {
    let matchingAuditLogIds:
  string[] | null = null;

if (query) {
      const searchPattern =
        `%${query}%`;

      /*
      * A pesquisa global também consulta os snapshots JSON da auditoria.
      * Isso permite localizar históricos por serial, equipamento, projeto
      * ou qualquer outro valor preservado em oldData/newData.
      *
      * Os valores são enviados como parâmetros da query, sem interpolação
      * manual de SQL.
      */
      const matches =
        await prisma.$queryRaw<
          { id: string }[]
        >`
          SELECT id
          FROM audit_logs
          WHERE
            description ILIKE ${searchPattern}
            OR COALESCE("entityId", '') ILIKE ${searchPattern}
            OR COALESCE("oldData"::text, '') ILIKE ${searchPattern}
            OR COALESCE("newData"::text, '') ILIKE ${searchPattern}
        `;

      matchingAuditLogIds =
        matches.map(
          (match) => match.id,
        );
    }
    const where = {
      ...(matchingAuditLogIds
        ? {
            id: {
              in: matchingAuditLogIds,
            },
          }
        : {}),
      ...(userId
        ? {
            userId,
          }
        : {}),

      ...(action
        ? {
            action,
          }
        : {}),

      ...(entity
        ? {
            entity,
          }
        : {}),

      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? {
                    gte: fromDate,
                  }
                : {}),

              ...(toDate
                ? {
                    lte: toDate,
                  }
                : {}),
            },
          }
        : {}),
    };

    /*
     * A consulta é paginada para evitar carregar todo o histórico
     * de auditoria em memória e manter a tela eficiente à medida
     * que o volume de logs crescer.
     */
     /*
      * Além dos registros paginados, carregamos os valores que realmente
      * existem no histórico. Assim os filtros não oferecem opções que ainda
      * não possuem nenhum evento registrado.
      */
      const [
        logs,
        total,
        auditUsers,
        auditActions,
        auditEntities,
      ] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: pageSize,
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            description: true,
            oldData: true,
            newData: true,
            createdAt: true,

            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        }),

        prisma.auditLog.count({
          where,
        }),

        prisma.user.findMany({
          where: {
            auditLogs: {
              some: {},
            },
          },
          orderBy: [
            {
              name: "asc",
            },
            {
              username: "asc",
            },
          ],
          select: {
            id: true,
            name: true,
            username: true,
          },
        }),

        prisma.auditLog.findMany({
          distinct: ["action"],
          orderBy: {
            action: "asc",
          },
          select: {
            action: true,
          },
        }),

        prisma.auditLog.findMany({
          distinct: ["entity"],
          orderBy: {
            entity: "asc",
          },
          select: {
            entity: true,
          },
        }),
      ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / pageSize,
          );

    return Response.json({
      success: true,
      data: logs,

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page < totalPages,
      },

      filters: {
        users: auditUsers,
        actions: auditActions.map(
          (item) => item.action,
        ),
        entities: auditEntities.map(
          (item) => item.entity,
        ),
      },
    });
  } catch (error) {
    console.error(
      "Erro ao consultar logs de auditoria:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os logs de auditoria.",
      },
      {
        status: 500,
      },
    );
  }
}