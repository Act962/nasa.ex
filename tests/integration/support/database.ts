// Acesso ao banco de teste. É o mesmo cliente que o código sob teste usa.

import prisma from "@/lib/prisma";
import { assertIsTestDatabase } from "./test-database-url";

export const testPrisma = prisma;

let cachedTableNames: string[] | null = null;

async function listTableNames(): Promise<string[]> {
  if (cachedTableNames) return cachedTableNames;
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  cachedTableNames = rows.map((row) => row.tablename);
  return cachedTableNames;
}

/**
 * Truncate entre casos, não transação por teste: o código sob teste abre as
 * próprias transações, e aninhá-las mudaria o comportamento observado.
 */
export async function truncateAllTables(): Promise<void> {
  assertIsTestDatabase(process.env.DATABASE_URL);
  const tableNames = await listTableNames();
  if (tableNames.length === 0) return;
  const quotedNames = tableNames.map((tableName) => `"${tableName}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedNames} RESTART IDENTITY CASCADE`);
}
