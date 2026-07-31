import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import {
  AuditAction,
  AuditEntity,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
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
    createdAt: Date;
    updatedAt: Date;
  },
): Prisma.InputJsonValue {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const authorization = await requireAdmin();

  if (!authorization.authorized) {
    return NextResponse.json(
      {
        error:
          authorization.status === 401
            ? "Não autenticado."
            : "Você não possui permissão para acessar usuários.",
      },
      {
        status: authorization.status,
      },
    );
  }

  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search")?.trim() ?? "";
  const role = searchParams.get("role")?.trim() ?? "";
  const active = searchParams.get("active")?.trim() ?? "";

  try {
    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  username: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(isAllowedRole(role)
          ? {
              role,
            }
          : {}),
        ...(active === "true" || active === "false"
          ? {
              active: active === "true",
            }
          : {}),
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
      orderBy: [
        {
          active: "desc",
        },
        {
          name: "asc",
        },
      ],
    });

    const totals = await prisma.user.groupBy({
      by: ["role", "active"],
      _count: {
        _all: true,
      },
    });

    const totalUsers = totals.reduce(
      (total, item) => total + item._count._all,
      0,
    );

    const activeUsers = totals
      .filter((item) => item.active)
      .reduce(
        (total, item) => total + item._count._all,
        0,
      );

    const inactiveUsers = totalUsers - activeUsers;

    const administrators = totals
      .filter((item) => item.role === "ADMIN")
      .reduce(
        (total, item) => total + item._count._all,
        0,
      );

    return NextResponse.json({
      users,
      summary: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        administrators,
      },
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);

    return NextResponse.json(
      {
        error: "Não foi possível carregar os usuários.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await requireAdmin();

  if (!authorization.authorized) {
    return NextResponse.json(
      {
        error:
          authorization.status === 401
            ? "Não autenticado."
            : "Você não possui permissão para criar usuários.",
      },
      {
        status: authorization.status,
      },
    );
  }

  try {
    const body = (await request.json()) as {
      name?: unknown;
      username?: unknown;
      password?: unknown;
      role?: unknown;
      active?: unknown;
    };

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const username =
      typeof body.username === "string"
        ? normalizeUsername(body.username)
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role =
      typeof body.role === "string"
        ? body.role
        : "";

    const active =
      typeof body.active === "boolean"
        ? body.active
        : true;

    if (name.length < 3 || name.length > 100) {
      return NextResponse.json(
        {
          error:
            "O nome deve possuir entre 3 e 100 caracteres.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "O usuário deve possuir entre 3 e 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado.",
        },
        {
          status: 400,
        },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "A senha deve possuir pelo menos 8 caracteres.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isAllowedRole(role)) {
      return NextResponse.json(
        {
          error: "Perfil de usuário inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          username,
        },
        select: {
          id: true,
        },
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "Esse nome de usuário já está em uso.",
        },
        {
          status: 409,
        },
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role,
        active,
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

    await logAudit({
  action: AuditAction.CREATE,
  entity: AuditEntity.USER,
  entityId: user.id,
  userId: authorization.user.id,
  description: `Usuário "${user.username}" cadastro.`,
  newData: serializeUserForAudit(user),
});

    return NextResponse.json(
      {
        message: "Usuário criado com sucesso.",
        user,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro ao criar usuário:", error);

    return NextResponse.json(
      {
        error: "Não foi possível criar o usuário.",
      },
      {
        status: 500,
      },
    );
  }
}