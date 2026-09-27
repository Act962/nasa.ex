import "./load-env";
import prisma from "../../src/lib/prisma";

// Migrations aplicadas recentemente no banco compartilhado.
async function main() {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
    "select migration_name, finished_at from _prisma_migrations where started_at > now() - interval '2 days' order by started_at desc",
  );
  for (const row of rows) console.log(`${row.finished_at?.toISOString() ?? "NÃO TERMINOU"}  ${row.migration_name}`);
  process.exit(0);
}
main();
