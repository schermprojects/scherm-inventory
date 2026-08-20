import type { DefaultSession } from "next-auth";

type UserRole =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

declare module "next-auth" {
  interface User {
    username: string;
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: UserRole;
  }
}