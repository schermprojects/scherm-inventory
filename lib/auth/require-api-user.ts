import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { Role } from "@/lib/auth/permissions";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: Role;
};

type AuthorizedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
};

type RequireApiUserResult =
  | {
      authorized: true;
      status: 200;
      user: AuthorizedUser;
    }
  | {
      authorized: false;
      status: 401 | 403;
      user: SessionUser | null;
      response: NextResponse;
    };

export async function requireApiUser(
  allowedRoles?: readonly Role[],
): Promise<RequireApiUserResult> {
  const session = await auth();

  const user = session?.user as SessionUser | undefined;

  if (!user?.id || !user.role) {
    return {
      authorized: false,
      status: 401,
      user: null,
      response: NextResponse.json(
        {
          error: "Não autenticado.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return {
      authorized: false,
      status: 403,
      user,
      response: NextResponse.json(
        {
          error:
            "Você não possui permissão para realizar esta ação.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return {
    authorized: true,
    status: 200,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
    },
  };
}