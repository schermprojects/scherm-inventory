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

function formatDateTime(
  value: Date,
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    },
  ).format(value);
}

function escapeCsvValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  let text =
    typeof value === "string"
      ? value
      : JSON.stringify(value);

  /*
   * Evita que valores exportados sejam interpretados como fórmulas
   * ao abrir o CSV em aplicativos de planilha.
   */
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll(
    '"',
    '""',
  )}"`;
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
   * A exportação contém o histórico administrativo completo dos
   * registros filtrados e permanece restrita exclusivamente ao ADMIN.
   */
  if (
    sessionUser.role !== UserRole.ADMIN
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para exportar os logs de auditoria.",
      },
      {
        status: 403,
      },
    );
  }

  const { searchParams } =
    new URL(request.url);

  const query =
    searchParams.get("q")?.trim() ||
    null;

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

  try {
    let matchingAuditLogIds:
      string[] | null = null;

    if (query) {
      const searchPattern =
        `%${query}%`;

      /*
       * A exportação usa a mesma pesquisa global da listagem, inclusive
       * dentro dos snapshots JSON, para que o arquivo represente exatamente
       * o conjunto filtrado visualizado pelo administrador.
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
     * A exportação não utiliza a paginação da tela: todos os registros
     * correspondentes aos filtros atuais são incluídos no arquivo.
     */
    const logs =
      await prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
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
              name: true,
              username: true,
            },
          },
        },
      });

    const header = [
      "Data / Hora",
      "Usuário",
      "Username",
      "Ação",
      "Módulo",
      "ID do registro",
      "Descrição",
      "Dados anteriores",
      "Dados posteriores",
    ];

    const rows = logs.map(
      (log) => [
        formatDateTime(
          log.createdAt,
        ),
        log.user?.name ??
          "Usuário removido",
        log.user?.username ?? "",
        log.action,
        log.entity,
        log.entityId ?? "",
        log.description,
        log.oldData ?? "",
        log.newData ?? "",
      ],
    );

    const csv = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escapeCsvValue)
          .join(";"),
      )
      .join("\r\n");

    /*
     * O BOM UTF-8 melhora a abertura direta do arquivo no Excel,
     * preservando corretamente acentos e caracteres em português.
     */
    const csvWithBom =
      `\uFEFF${csv}`;

    const datePart =
      new Date()
        .toISOString()
        .slice(0, 10);

    return new Response(
      csvWithBom,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/csv; charset=utf-8",
          "Content-Disposition":
            `attachment; filename="audit-logs-${datePart}.csv"`,
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Erro ao exportar logs de auditoria:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível exportar os logs de auditoria.",
      },
      {
        status: 500,
      },
    );
  }
}