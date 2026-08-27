import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load local environment variables for Prisma CLI.
config({
  path: ".env.local",
});

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    // Direct Neon connection for Prisma migrations/CLI operations.
    url: env("DIRECT_URL"),
  },
});