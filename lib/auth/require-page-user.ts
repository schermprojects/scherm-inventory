import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Role } from "@/lib/auth/permissions";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: Role;
};

export type PageUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
};

export async function requirePageUser(
  allowedRoles?: readonly Role[],
): Promise<PageUser> {
  const session = await auth();

  const user =
    session?.user as
      | SessionUser
      | undefined;

  if (!user?.id || !user.role) {
    redirect("/login");
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    redirect("/dashboard");
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.role,
  };
}