import { auth } from "@/auth";
import { requireAdmin } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  AuditEntity,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
type UserRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const allowedRoles = [
  "ADMIN",
  "COMMERCIAL",
  "VIEWER",
] as const;

type AllowedRole = (typeof allowedRoles)[number];

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string) {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

function isAllowedRole(role: string): role is AllowedRole {
  return allowedRoles.includes(role as AllowedRole);
}

function serializeUserForAudit(
  user: {
    id: string;
    name: string;
    username: string;
    role: AllowedRole;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  },
): Prisma.InputJsonValue {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,

    createdAt:
      user.createdAt?.toISOString() ??
      null,

    updatedAt:
      user.updatedAt?.toISOString() ??
      null,
  };
}

export async function PATCH(
  request: Request,
  { params }: UserRouteProps,
) {
  const authorization = await requireAdmin();

  if (!authorization.authorized) {
    return Response.json(
      {
        error:
          authorization.status === 401
            ? "Não autenticado."
            : "Você não possui permissão para editar usuários.",
      },
      {
        status: authorization.status,
      },
    );
  }

  const { id } = await params;

  try {
    const currentUser =
  await prisma.user.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

    if (!currentUser) {
      return Response.json(
        {
          error: "Usuário não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const body = (await request.json()) as {
      name?: unknown;
      username?: unknown;
      role?: unknown;
      active?: unknown;
      password?: unknown;
    };

    const data: {
      name?: string;
      username?: string;
      role?: AllowedRole;
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return Response.json(
          {
            error: "Nome inválido.",
          },
          {
            status: 400,
          },
        );
      }

      const name = body.name.trim();

      if (name.length < 3 || name.length > 100) {
        return Response.json(
          {
            error:
              "O nome deve possuir entre 3 e 100 caracteres.",
          },
          {
            status: 400,
          },
        );
      }

      data.name = name;
    }

    if (body.username !== undefined) {
      if (typeof body.username !== "string") {
        return Response.json(
          {
            error: "Nome de usuário inválido.",
          },
          {
            status: 400,
          },
        );
      }

      const username = normalizeUsername(
        body.username,
      );

      if (!isValidUsername(username)) {
        return Response.json(
          {
            error:
              "O usuário deve possuir entre 3 e 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado.",
          },
          {
            status: 400,
          },
        );
      }

      const usernameOwner =
        await prisma.user.findFirst({
          where: {
            username,
            id: {
              not: id,
            },
          },
          select: {
            id: true,
          },
        });

      if (usernameOwner) {
        return Response.json(
          {
            error:
              "Esse nome de usuário já está em uso.",
          },
          {
            status: 409,
          },
        );
      }

      data.username = username;
    }

    if (body.role !== undefined) {
      if (
        typeof body.role !== "string" ||
        !isAllowedRole(body.role)
      ) {
        return Response.json(
          {
            error: "Perfil de usuário inválido.",
          },
          {
            status: 400,
          },
        );
      }

      data.role = body.role;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") {
        return Response.json(
          {
            error: "Status de usuário inválido.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        id === authorization.user.id &&
        !body.active
      ) {
        return Response.json(
          {
            error:
              "Você não pode desativar seu próprio usuário.",
          },
          {
            status: 400,
          },
        );
      }

      data.active = body.active;
    }

    if (body.password !== undefined) {
      if (
        typeof body.password !== "string" ||
        body.password.length < 8
      ) {
        return Response.json(
          {
            error:
              "A nova senha deve possuir pelo menos 8 caracteres.",
          },
          {
            status: 400,
          },
        );
      }

      data.passwordHash = await hash(
        body.password,
        12,
      );
    }

    const removesAdministrator =
      currentUser.role === "ADMIN" &&
      (data.role !== undefined
        ? data.role !== "ADMIN"
        : false);

    const deactivatesAdministrator =
      currentUser.role === "ADMIN" &&
      data.active === false;

    if (
      removesAdministrator ||
      deactivatesAdministrator
    ) {
      const activeAdministratorCount =
        await prisma.user.count({
          where: {
            role: "ADMIN",
            active: true,
          },
        });

      if (activeAdministratorCount <= 1) {
        return Response.json(
          {
            error:
              "O sistema deve possuir pelo menos um administrador ativo.",
          },
          {
            status: 400,
          },
        );
      }
    }

const user = await prisma.user.update({
  where: {
    id,
  },
  data,
  select: {
    id: true,
    name: true,
    username: true,
    role: true,
    active: true,
    createdAt: true,
    updatedAt: true,
  },
});

await logAudit({
  action: AuditAction.UPDATE,
  entity: AuditEntity.USER,
  entityId: user.id,
  userId: authorization.user.id,
  description: body.password
    ? `Senha do usuário "${user.name}" redefinida.`
    : `Usuário "${user.name}" atualizado.`,
  oldData: serializeUserForAudit(currentUser),
  newData: serializeUserForAudit(user),
});

return Response.json({
  message: body.password
    ? "Senha redefinida com sucesso."
    : "Usuário atualizado com sucesso.",
  user,
});
  } catch (error) {
    console.error("Erro ao editar usuário:", error);

    return Response.json(
      {
        error:
          "Não foi possível atualizar o usuário.",
      },
      {
        status: 500,
      },
    );
  }
}