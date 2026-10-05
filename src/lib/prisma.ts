import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma?: AppPrismaClient;
  prismaSchemaVersion: string;
};

// Schema version hash — bump this string whenever `prisma generate` runs to
// force a new client instance and avoid stale model issues in hot-reload.
// We derive it from a known model that may or may not exist in the old client.
const SCHEMA_VERSION = "v112-brand-kits";

// Em dev uma página dispara ~20 RPCs em paralelo contra o Neon remoto; com 5
// conexões elas enfileiravam e passavam de 10 s. Produção mantém 5, salvo
// `DATABASE_POOL_MAX`.
const POOL_MAX_CONNECTIONS =
  Number(process.env.DATABASE_POOL_MAX) || (process.env.NODE_ENV === "development" ? 15 : 5);

// Os genéricos explícitos deixam o cliente global com o mesmo tipo do `tx` de `$transaction`
// (`Prisma.TransactionClient`). Inferidos, divergem (`log`, `omit`) e o TypeScript passa a comparar
// os ~300 models estruturalmente a cada encontro dos dois — era o que levava a checagem a 12 GB.
const createClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
  });
  return new PrismaClient<Prisma.PrismaClientOptions, never, undefined>({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
};

const shouldCreateNew =
  !globalForPrisma.prisma ||
  globalForPrisma.prismaSchemaVersion !== SCHEMA_VERSION;

const prisma = shouldCreateNew ? createClient() : globalForPrisma.prisma!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION;
}

// Tipo do cliente global, para quem precisa de `$transaction`. Sem `$transaction`, use `Prisma.TransactionClient`.
export type AppPrismaClient = ReturnType<typeof createClient>;

export default prisma;
