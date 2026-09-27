// Importado antes de tudo: módulos ESM sobem para o topo, e o Prisma lê
// DATABASE_URL no import.
import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

const localEnvPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) config({ path: localEnvPath });
config();
