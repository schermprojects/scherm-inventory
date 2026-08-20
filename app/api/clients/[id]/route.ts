import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
  UserRole,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import {
  generateShortNameFromName,
  generateUniqueClientCode,
  normalizeClientShortName,
} from "@/lib/client-code";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: UserRole;
};

type ClientBody = {
  name?: unknown;
  contactName?: unknown;
  shortName?: unknown;
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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const clientInclude = {
  projects: {
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      {
        createdAt: "desc" as const,
      },
      {
        name: "asc" as const,
      },
    ],
  },
  _count: {
    select: {
      projects: true,
    },
  },
} satisfies Prisma.ClientInclude;

type ClientWithRelations = Prisma.ClientGetPayload<{
  include: typeof clientInclude;
}>;

const clientAuditSelect = {
  id: true,
  clientCode: true,
  shortName: true,
  name: true,
  contactName: true,
  position: true,
  city: true,
  state: true,
  active: true,
} satisfies Prisma.ClientSelect;

type ClientAuditData = Prisma.ClientGetPayload<{
  select: typeof clientAuditSelect;
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

function requiredBoolean(
  value: unknown,
  label: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      `O campo "${label}" deve ser verdadeiro ou falso.`,
    );
  }

  return value;
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
    role === UserRole.BACKOFFICE ||
    role === UserRole.COMMERCIAL
  );
}

function canViewSensitiveData(
  role: UserRole | undefined,
): boolean {
  return canManageClients(role);
}

function isPrismaNotFoundError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
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

    projectCount:
      client._count.projects,

    projects: client.projects,
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

function serializeClientForAudit(
  client: ClientAuditData,
) {
  return {
    id: client.id,
    clientCode: client.clientCode,
    shortName: client.shortName,
    name: client.name,
    contactName: client.contactName,
    position: client.position,
    city: client.city,
    state: client.state,
    active: client.active,
  };
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
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

    if (
  !canManageClients(sessionUser.role)
) {
  return Response.json(
    {
      success: false,
      message:
        "Você não possui permissão para acessar os detalhes deste cliente.",
    },
    {
      status: 403,
    },
  );
}

  const { id } = await params;

  try {
    const client =
      await prisma.client.findUnique({
        where: {
          id,
        },
        include: clientInclude,
      });

    if (!client) {
      return Response.json(
        {
          success: false,
          message:
            "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      success: true,
      data: serializeClient(
        client,
        sessionUser.role,
      ),
    });
  } catch (error) {
    console.error(
      "Erro ao carregar cliente:",
      error,
    );

    return Response.json(
      {
        success: false,
        message:
          "Não foi possível carregar o cliente.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext,
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

  if (
    !canManageClients(sessionUser.role)
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para editar clientes.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  try {
    const body =
      (await request.json()) as ClientBody;

    const currentClient =
      await prisma.client.findUnique({
        where: {
          id,
        },
        select: clientAuditSelect,
      });

    if (!currentClient) {
      return Response.json(
        {
          success: false,
          message:
            "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const name = requiredText(
      body.name,
      "Nome",
    );

    const contactName = requiredText(
      body.contactName,
      "Contato",
    );

    const active = requiredBoolean(
      body.active,
      "Ativo",
    );

    const receivedShortName =
      typeof body.shortName === "string"
        ? normalizeClientShortName(
            body.shortName,
          )
        : "";

    const shortName =
      receivedShortName ||
      currentClient.shortName ||
      generateShortNameFromName(name);

    const shortNameChanged =
      shortName !==
      currentClient.shortName;

    const clientCode =
      shortNameChanged
        ? await generateUniqueClientCode(
            prisma,
            shortName,
          )
        : currentClient.clientCode;

    const client =
      await prisma.client.update({
        where: {
          id,
        },
        data: {
          shortName,
          clientCode,

          name,
          contactName,

          position: optionalText(
            body.position,
          ),

          phone: optionalText(
            body.phone,
          ),

          mobile: optionalText(
            body.mobile,
          ),

          email: optionalEmail(
            body.email,
          ),

          website: optionalWebsite(
            body.website,
          ),

          document: optionalText(
            body.document,
          ),

          zipcode: optionalText(
            body.zipcode,
          ),

          address: optionalText(
            body.address,
          ),

          number: optionalText(
            body.number,
          ),

          complement: optionalText(
            body.complement,
          ),

          district: optionalText(
            body.district,
          ),

          city: optionalText(
            body.city,
          ),

          state: normalizeState(
            body.state,
          ),

          notes: optionalText(
            body.notes,
          ),

          active,
        },
        include: clientInclude,
      });

    await logAudit({
      action: AuditAction.UPDATE,
      entity: AuditEntity.CLIENT,
      entityId: client.id,
      userId: sessionUser.id ?? null,
      description:
        currentClient.active !==
        client.active
          ? client.active
            ? `Cliente "${client.name}" reativado e atualizado.`
            : `Cliente "${client.name}" inativado e atualizado.`
          : `Cliente "${client.name}" atualizado.`,
      oldData:
        serializeClientForAudit(
          currentClient,
        ),
      newData: {
        id: client.id,
        clientCode: client.clientCode,
        shortName: client.shortName,
        name: client.name,
        contactName:
          client.contactName,
        position: client.position,
        city: client.city,
        state: client.state,
        active: client.active,
      },
    });

    return Response.json({
      success: true,
      message:
        "Cliente atualizado com sucesso.",
      data: serializeClient(
        client,
        sessionUser.role,
      ),
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar cliente:",
      error,
    );

    if (isPrismaNotFoundError(error)) {
      return Response.json(
        {
          success: false,
          message:
            "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

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
            "Os dados enviados não são um JSON válido.",
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
          "Não foi possível atualizar o cliente.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
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

  if (
    !canManageClients(sessionUser.role)
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Você não possui permissão para remover ou inativar clientes.",
      },
      {
        status: 403,
      },
    );
  }

  const { id } = await params;

  try {
    const client =
      await prisma.client.findUnique({
        where: {
          id,
        },
        select: {
          ...clientAuditSelect,

          _count: {
            select: {
              projects: true,
            },
          },
        },
      });

    if (!client) {
      return Response.json(
        {
          success: false,
          message:
            "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

const canPermanentlyDelete =
  sessionUser.role === UserRole.ADMIN ||
  sessionUser.role === UserRole.BACKOFFICE;

const mustDeactivate =
  !canPermanentlyDelete ||
  client._count.projects > 0;

    if (mustDeactivate) {
      if (!client.active) {
        return Response.json({
          success: true,
          message:
            "O cliente já está inativo.",
          action: "already_inactive",
        });
      }

      const deactivatedClient =
        await prisma.client.update({
          where: {
            id,
          },
          data: {
            active: false,
          },
          select: clientAuditSelect,
        });

      await logAudit({
        action: AuditAction.UPDATE,
        entity: AuditEntity.CLIENT,
        entityId:
          deactivatedClient.id,
        userId:
          sessionUser.id ?? null,
        description:
          `Cliente "${deactivatedClient.name}" inativado.`,
        oldData:
          serializeClientForAudit(
            client,
          ),
        newData:
          serializeClientForAudit(
            deactivatedClient,
          ),
      });

      return Response.json({
        success: true,
        message:
          client._count.projects > 0
            ? "O cliente possui projetos vinculados e foi inativado para preservar o histórico."
            : "Cliente inativado com sucesso.",
        action: "deactivated",
      });
    }

    const deletedClient =
      await prisma.client.delete({
        where: {
          id,
        },
        select: clientAuditSelect,
      });

    await logAudit({
      action: AuditAction.DELETE,
      entity: AuditEntity.CLIENT,
      entityId: deletedClient.id,
      userId: sessionUser.id ?? null,
      description:
        `Cliente "${deletedClient.name}" removido.`,
      oldData:
        serializeClientForAudit(
          deletedClient,
        ),
    });

    return Response.json({
      success: true,
      message:
        "Cliente removido com sucesso.",
      action: "deleted",
    });
  } catch (error) {
    console.error(
      "Erro ao remover cliente:",
      error,
    );

    if (isPrismaNotFoundError(error)) {
      return Response.json(
        {
          success: false,
          message:
            "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "O cliente possui registros vinculados e não pode ser removido.",
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
          "Não foi possível remover ou inativar o cliente.",
      },
      {
        status: 500,
      },
    );
  }
}