import "./load-env";
import prisma from "../../src/lib/prisma";

// Retrato do banco agora: conexões por aplicação/estado e consultas longas.
async function main() {
  const byState = await prisma.$queryRawUnsafe<{ application_name: string; state: string | null; total: bigint }[]>(
    "select coalesce(application_name,'') as application_name, state, count(*) as total from pg_stat_activity group by 1,2 order by 3 desc",
  );
  console.log("CONEXOES:");
  for (const row of byState) console.log(`  ${row.total}  ${row.state ?? "-"}  ${row.application_name}`);
  const slow = await prisma.$queryRawUnsafe<{ seconds: number; state: string; query: string }[]>(
    "select extract(epoch from now()-query_start)::int as seconds, state, left(regexp_replace(query,'\\s+',' ','g'),140) as query from pg_stat_activity where state <> 'idle' and query_start < now() - interval '2 seconds' order by 1 desc limit 10",
  );
  console.log("CONSULTAS LONGAS:");
  for (const row of slow) console.log(`  ${row.seconds}s ${row.state} ${row.query}`);
  const settings = await prisma.$queryRawUnsafe<{ name: string; setting: string }[]>(
    "select name, setting from pg_settings where name in ('max_connections')",
  );
  console.log(settings.map((row) => `${row.name}=${row.setting}`).join(" "));
  process.exit(0);
}
main();
