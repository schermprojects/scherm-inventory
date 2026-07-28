import { auth } from "@/auth";

import type { Role } from "@/lib/auth/permissions";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: Role;
};

export async function requireRole(
  allowedRoles?: readonly Role[],
) {
  const session = await auth();

  const user =
    session?.user as
      | SessionUser
      | undefined;

  if (!user?.id || !user.role) {
    return {
      authorized: false as const,
      status: 401 as const,
      user: null,
    };
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return {
      authorized: false as const,
      status: 403 as const,
      user,
    };
  }

  return {
    authorized: true as const,
    status: 200 as const,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
    },
  };
}