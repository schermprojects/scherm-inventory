import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

type UserRole = "ADMIN" | "COMMERCIAL" | "VIEWER";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "ADMIN" ||
    value === "COMMERCIAL" ||
    value === "VIEWER"
  );
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Scherm Inventory",

      credentials: {
        username: {
          label: "Usuário",
          type: "text",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(credentials) {
        const username = normalizeUsername(
          credentials?.username,
        );

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!username || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            username,
          },
          select: {
            id: true,
            name: true,
            username: true,
            passwordHash: true,
            role: true,
            active: true,
          },
        });

        console.log(
          "USER:",
          user
            ? {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                active: user.active,
              }
            : null,
        );

        if (!user) {
          console.log("LOGIN BLOQUEADO: usuário não encontrado");
          return null;
        }

        if (!user.active) {
          console.log("LOGIN BLOQUEADO: usuário inativo");
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        console.log("PASSWORD:", passwordMatches);

        if (!passwordMatches) {
          console.log("LOGIN BLOQUEADO: senha incorreta");
          return null;
        }

        console.log("LOGIN AUTORIZADO:", user.username);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id =
        typeof token.id === "string" ? token.id : "";

      session.user.username =
        typeof token.username === "string"
          ? token.username
          : "";

      session.user.role = isUserRole(token.role)
        ? token.role
        : "VIEWER";

      return session;
    },
  },
});