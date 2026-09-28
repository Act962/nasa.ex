import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string;
};

// Schema version hash — bump this string whenever `prisma generate` runs to
// force a new client instance and avoid stale model issues in hot-reload.
// We derive it from a known model that may or may not exist in the old client.
const SCHEMA_VERSION = "v96-mass-send-self-service";

// Em dev uma página dispara ~20 RPCs em paralelo contra o Neon remoto; com 5
// conexões elas enfileiravam e passavam de 10 s. Produção mantém 5, salvo
// `DATABASE_POOL_MAX`.
const POOL_MAX_CONNECTIONS =
  Number(process.env.DATABASE_POOL_MAX) || (process.env.NODE_ENV === "development" ? 15 : 5);

const createClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
  });
  return new PrismaClient({
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

export default prisma;
