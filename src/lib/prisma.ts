import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string;
};

// Schema version hash — bump this string whenever `prisma generate` runs to
// force a new client instance and avoid stale model issues in hot-reload.
// We derive it from a known model that may or may not exist in the old client.
const SCHEMA_VERSION = "v23-insights-layout";

const createClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,
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
