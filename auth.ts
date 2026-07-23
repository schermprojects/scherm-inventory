import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

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
      name: "Administrador",

      credentials: {
        email: {
          label: "E-mail",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        const adminEmail = process.env.ADMIN_EMAIL
          ?.trim()
          .toLowerCase();

        const adminPasswordHash =
          process.env.ADMIN_PASSWORD_HASH?.trim();

        console.log("AUTH DEBUG:", {
          emailRecebido: email,
          emailConfigurado: adminEmail,
          possuiSenha: password.length > 0,
          possuiHash: Boolean(adminPasswordHash),
          tamanhoHash: adminPasswordHash?.length,
        });

        if (!email || !password || !adminEmail || !adminPasswordHash) {
          console.error("AUTH: configuração ou credenciais ausentes");
          return null;
        }

        if (email !== adminEmail) {
          console.error("AUTH: e-mail não corresponde");
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          password,
          adminPasswordHash,
        );

        console.log("AUTH: senha corresponde:", passwordMatches);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: "admin",
          name: process.env.ADMIN_NAME?.trim() || "Administrador",
          email: adminEmail,
          role: "admin",
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = "admin";
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "admin");
      }

      return session;
    },
  },
});