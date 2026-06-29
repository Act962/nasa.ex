import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Transitório: o env (DATABASE_URL) ainda mora no app web até o rebalanceamento
// da Fase 6. cwd aqui é packages/db quando rodado via `pnpm --filter @nasa/db`.
config({ path: resolve(process.cwd(), "../../apps/web/.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
