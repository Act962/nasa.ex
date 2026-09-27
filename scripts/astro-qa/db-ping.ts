import "./load-env";
import prisma from "../../src/lib/prisma";

// Mede a latência do banco de dados que o app usa.
async function main() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    await prisma.$queryRawUnsafe("select 1");
    console.log(`select 1: ${Date.now() - started} ms`);
  }
  const rows = await prisma.$queryRawUnsafe<{ state: string | null; total: bigint }[]>(
    "select state, count(*) as total from pg_stat_activity where datname = current_database() group by state",
  );
  console.log(rows.map((row) => `${row.state ?? "null"}: ${row.total}`).join(" | "));
  process.exit(0);
}
main();
