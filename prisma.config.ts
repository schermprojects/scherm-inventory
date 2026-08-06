import { config } from "dotenv";
import {
  defineConfig,
  env,
} from "prisma/config";

const isProduction =
  process.env.NODE_ENV === "production";

config({
  path: isProduction
    ? ".env"
    : ".env.development.local",
});

console.log(
  `\n🔹 Prisma Environment: ${
    isProduction
      ? "PRODUÇÃO"
      : "DESENVOLVIMENTO"
  }`,
);

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: env("DIRECT_URL"),
  },
});