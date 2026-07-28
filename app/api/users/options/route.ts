import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRole = "ADMIN" | "COMMERCIAL" | "VIEWER";

type SessionUser = {
  id?: string;
  role?: UserRole;
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        message: "Não autenticado.",
        users: [],
      },
      {
        status: 401,
      },
    );
  }

  const sessionUser = session.user as SessionUser;

  if (
    sessionUser.role !== "ADMIN" &&
    sessionUser.role !== "COMMERCIAL"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Você não possui permissão para carregar as opções de usuários.",
        users: [],
      },
      {
        status: 403,
      },
    );
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          username: "asc",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "Erro ao carregar opções de usuários:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível carregar os usuários.",
        users: [],
      },
      {
        status: 500,
      },
    );
  }
}