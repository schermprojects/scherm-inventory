import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth/require-api-user";
import { prisma } from "@/lib/prisma";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
};

function normalizePassword(
  value: unknown,
): string {
  return typeof value === "string"
    ? value
    : "";
}

function validateNewPassword(
  password: string,
): string | null {
  if (password.length < 8) {
    return "A nova senha deve possuir pelo menos 8 caracteres.";
  }

  if (!/[A-Z]/.test(password)) {
    return "A nova senha deve possuir pelo menos uma letra maiúscula.";
  }

  if (!/[a-z]/.test(password)) {
    return "A nova senha deve possuir pelo menos uma letra minúscula.";
  }

  if (!/[0-9]/.test(password)) {
    return "A nova senha deve possuir pelo menos um número.";
  }

  return null;
}

export async function PATCH(
  request: Request,
) {
  const permission =
    await requireApiUser();

  if (!permission.authorized) {
    return permission.response;
  }

  try {
    const body =
      (await request.json()) as ChangePasswordBody;

    const currentPassword =
      normalizePassword(
        body.currentPassword,
      );

    const newPassword =
      normalizePassword(
        body.newPassword,
      );

    const confirmPassword =
      normalizePassword(
        body.confirmPassword,
      );

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          error:
            "Preencha a senha atual, a nova senha e a confirmação.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return NextResponse.json(
        {
          error:
            "A confirmação da nova senha não confere.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return NextResponse.json(
        {
          error:
            "A nova senha deve ser diferente da senha atual.",
        },
        {
          status: 400,
        },
      );
    }

    const passwordError =
      validateNewPassword(
        newPassword,
      );

    if (passwordError) {
      return NextResponse.json(
        {
          error: passwordError,
        },
        {
          status: 400,
        },
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: permission.user.id,
        },

        select: {
          id: true,
          passwordHash: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Usuário não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Este usuário não possui uma senha local cadastrada.",
        },
        {
          status: 400,
        },
      );
    }

    const currentPasswordMatches =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );

    if (
      !currentPasswordMatches
    ) {
      return NextResponse.json(
        {
          error:
            "A senha atual está incorreta.",
        },
        {
          status: 400,
        },
      );
    }

    const newPasswordMatchesCurrent =
      await bcrypt.compare(
        newPassword,
        user.passwordHash,
      );

    if (
      newPasswordMatchesCurrent
    ) {
      return NextResponse.json(
        {
          error:
            "A nova senha deve ser diferente da senha atual.",
        },
        {
          status: 400,
        },
      );
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        passwordHash: passwordHash,
      },
    });

    return NextResponse.json({
      message:
        "Senha alterada com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro ao alterar a própria senha:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível alterar a senha.",
      },
      {
        status: 500,
      },
    );
  }
}