import { config } from "dotenv";
import { resolve } from "node:path";

// Transitório (Passo 1 do split): a API ainda lê o env do app web, que segue
// dono das secrets até o rebalanceamento da Fase 6. Precisa rodar ANTES de
// qualquer import que avalie process.env no load (ex.: @/lib/prisma cria o
// client no module-eval) — por isso é o primeiro import do server.ts.
const webEnvDir = resolve(import.meta.dirname, "../../web");

config({ path: resolve(webEnvDir, ".env") });
config({ path: resolve(webEnvDir, ".env.local"), override: true });
