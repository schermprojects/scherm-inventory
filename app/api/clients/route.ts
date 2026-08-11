import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  UserRole,
} from "@/generated/prisma/enums";
import { generateShortNameFromName, generateUniqueClientCode, normalizeClientShortName } from "@/lib/client-code";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: UserRole;
};

type ClientBody = {
  name?: unknown;
  shortName?: unknown;
  contactName?: unknown;
  position?: unknown;
  phone?: unknown;
  mobile?: unknown;
  email?: unknown;
  website?: unknown;
  document?: unknown;
  zipcode?: unknown;
  address?: unknown;
  number?: unknown;
  complement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  notes?: unknown;
  active?: unknown;
};

const clientInclude = {
  _count: {
    select: {
      projects: true,
    },
  },
} satisfies Prisma.ClientInclude;

type ClientWithRelations =
  Prisma.ClientGetPayload<{
    include: typeof clientInclude;
  }>;

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

function optionalEmail(
  value: unknown,
): string | null {
  const email = optionalText(value);

  if (!email) {
    return null;
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error(
      "Informe um e-mail válido.",
    );
  }

  return email.toLowerCase();
}

function optionalWebsite(
  value: unknown,
): string | null {
  const website = optionalText(value);

  if (!website) {
    return null;
  }

  const normalizedWebsite =
    /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;

  try {
    const url = new URL(
      normalizedWebsite,
    );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error();
    }

    return normalizedWebsite;
  } catch {
    throw new Error(
      "Informe um website válido.",
    );
  }
}

function optionalBoolean(
  value: unknown,
  defaultValue: boolean,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return defaultValue;
}

function normalizeState(
  value: unknown,
): string | null {
  const state = optionalText(value);

  if (!state) {
    return null;
  }

  if (state.length !== 2) {
    throw new Error(
      "O estado deve possuir 2 caracteres.",
    );
  }

  return state.toUpperCase();
}

function canManageClients(
  role: UserRole | undefined,
): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.COMMERCIAL
  );
}

function canViewSensitiveData(
  role: UserRole | undefined,
): boolean {
  return canManageClients(role);
}

function serializeClient(
  client: ClientWithRelations,
  role: UserRole | undefined,
) {
  const baseData = {
    id: client.id,

    clientCode: client.clientCode,
    shortName: client.shortName,

    name: client.name,
    contactName: client.contactName,
    position: client.position,

    city: client.city,
    state: client.state,

    active: client.active,

    createdAt: client.createdAt,
    updatedAt: client.updatedAt,

    projectCount: client._count.projects,

  };

  if (!canViewSensitiveData(role)) {
    return baseData;
  }

  return {
    ...baseData,

    phone: client.phone,
    mobile: client.mobile,
    email: client.email,
    website: client.website,
    document: client.document,

    zipcode: client.zipcode,
    address: client.address,
    number: client.number,
    complement: client.complement,
    district: client.district,

    notes: client.notes,
  };
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

  try {
    const { searchParams } = new URL(
      request.url,
    );

    const search =
      searchParams
        .get("search")
        ?.trim() ?? "";

    const activeFilter =
      searchParams.get("active");

    const sensitiveSearch =
      canViewSensitiveData(
        sessionUser.role,
      )
        ? [
            {
              phone: {
                contains: search,
                mode:
                  Prisma.QueryMode
                    .insensitive,
              },
            },
            {
              mobile: {
                contains: search,
                mode:
                  Prisma.QueryMode
                    .insensitive,
              },
            },
            {
              email: {
                contains: search,
                mode:
                  Prisma.QueryMode
                    .insensitive,
              },
            },
            {
              document: {
                contains: search,
                mode:
                  Prisma.QueryMode
                    .insensitive,
              },
            },
          ]
        : [];

    const where: Prisma.ClientWhereInput = {
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode:
                    Prisma.QueryMode
                      .insensitive,
                },
              },

              {
  clientCode: {
    contains: search,
    mode: Prisma.QueryMode.insensitive,
  },
},
{
  shortName: {
    contains: search,
    mode: Prisma.QueryMode.insensitive,
  },
},

              {
                contactName: {
                  contains: search,
                  mode:
                    Prisma.QueryMode
                      .insensitive,
                },
              },
              {
                position: {
                  contains: search,
                  mode:
                    Prisma.QueryMode
                      .insensitive,
                },
              },
              {
                city: {
                  contains: search,
                  mode:
                    Prisma.QueryMode
                      .insensitive,
                },
              },
              {
                state: {
                  contains: search,
                  mode:
                    Prisma.QueryMode
                      .insensitive,
                },
              },
              ...sensitiveSearch,
            ],
          }
        : {}),

      ...(activeFilter === "true"
        ? {
            active: true,
          }
        : {}),

      ...(activeFilter === "false"
        ? {
            active: false,
          }
        : {}),
    };

    const [
      clients,
      total,
      activeClients,
      inactiveClients,
    ] = await Promise.all([
      prisma.client.findMany({
        where,
        include: clientInclude,

        orderBy: [
          {
            active: "desc",
          },
          {
            name: "asc",
          },
        ],
      }),

      prisma.client.count(),

      prisma.client.count({
        where: {
          active: true,
        },
      }),

      prisma.client.count({
        where: {
          active: false,
        },
      }),
    ]);

    const data = clients.map(
      (client) =>
        serializeClient(
          client,
          sessionUser.role,
        ),
    );

    return Response.json({
      success: true,
      data,
      total: data.length,

      summary: {
        total,
        active: activeClients,
        inactive: inactiveClients,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao listar clientes:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar os clientes.",
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

  const sessionUser = session.user as SessionUser;

  if (!canManageClients(sessionUser.role)) {
    return Response.json(
      {
        success: false,
        message: "Você não possui permissão para cadastrar clientes.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const body = (await request.json()) as ClientBody;

    const name = requiredText(body.name, "Nome");
    const contactName = requiredText(body.contactName, "Contato");

    const shortName =
      normalizeClientShortName(
        typeof body.shortName === "string" ? body.shortName : "",
      ) || generateShortNameFromName(name);

    const position = optionalText(body.position);
    const phone = optionalText(body.phone);
    const mobile = optionalText(body.mobile);
    const email = optionalEmail(body.email);
    const website = optionalWebsite(body.website);
    const document = optionalText(body.document);
    const zipcode = optionalText(body.zipcode);
    const address = optionalText(body.address);
    const number = optionalText(body.number);
    const complement = optionalText(body.complement);
    const district = optionalText(body.district);
    const city = optionalText(body.city);
    const state = normalizeState(body.state);
    const notes = optionalText(body.notes);
    const active = optionalBoolean(body.active, true);

    const clientCode = await generateUniqueClientCode(
      prisma,
      shortName,
    );

    const client = await prisma.client.create({
      data: {
        shortName,
        clientCode,
        name,
        contactName,
        position,
        phone,
        mobile,
        email,
        website,
        document,
        zipcode,
        address,
        number,
        complement,
        district,
        city,
        state,
        notes,
        active,
      },

      include: clientInclude,
    });

    await logAudit({
      action: AuditAction.CREATE,
      entity: AuditEntity.CLIENT,
      entityId: client.id,
      userId: sessionUser.id ?? null,
      description: `Cliente "${client.name}" cadastrado.`,
      newData: {
        id: client.id,
        clientCode: client.clientCode,
        shortName: client.shortName,
        name: client.name,
        contactName: client.contactName,
        position: client.position,
        city: client.city,
        state: client.state,
        active: client.active,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Cliente cadastrado com sucesso.",
        data: serializeClient(
          client,
          sessionUser.role,
        ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao cadastrar cliente:",
      error,
    );

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        return Response.json(
          {
            success: false,
            message:
              "Já existe um cliente utilizando um campo que deve ser exclusivo.",
          },
          {
            status: 409,
          },
        );
      }
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
          "Não foi possível cadastrar o cliente.",
      },
      {
        status: 500,
      },
    );
  }
}