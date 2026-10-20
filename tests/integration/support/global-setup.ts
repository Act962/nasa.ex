// Roda uma vez antes da suíte de integração: aplica as migrations no banco de
// teste. É `migrate deploy`, não `db push`: a suíte também valida as migrations.

import { execSync } from "node:child_process";
import { assertIsTestDatabase, resolveTestDatabaseUrl } from "./test-database-url";

export default function setup() {
  const databaseUrl = resolveTestDatabaseUrl();
  assertIsTestDatabase(databaseUrl);

  try {
    execSync("pnpm exec prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
      stdio: "pipe",
    });
  } catch (error) {
    const output = error instanceof Error && "stdout" in error ? String(error.stdout) : "";
    throw new Error(
      "Não foi possível aplicar as migrations no banco de teste. " +
        "O container está de pé? `docker compose -f docker-compose.test.yml up -d --wait`\n" +
        output,
    );
  }
}
