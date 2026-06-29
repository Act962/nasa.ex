import type { FastifyPluginAsync } from "fastify";
import { serve } from "inngest/fastify";
import type {
  inngest as InngestClient,
  functions as InngestFunctions,
} from "@/inngest/registry";
import * as registryModule from "@/inngest/registry";

// Interop CJS (apps/web) × ESM (apps/api): o tsx não expõe os named exports do
// módulo CJS — só o `.default`. Tipos vêm via `import type` (o tsc lê a fonte).
// Mesmo padrão usado em rpc.ts/auth.ts.
const registry = (
  registryModule as unknown as {
    default: { inngest: typeof InngestClient; functions: typeof InngestFunctions };
  }
).default;

// Serve as funções Inngest (registro compartilhado com o apps/web) pelo Fastify.
// Endpoint server-to-server (Inngest dev/cloud) — sem CORS de browser. Usa o
// parser JSON default do app (não está no escopo encapsulado de auth/rpc).
export const inngestPlugin: FastifyPluginAsync = async (app) => {
  app.route({
    method: ["GET", "POST", "PUT"],
    url: "/api/inngest",
    handler: serve({ client: registry.inngest, functions: registry.functions }),
  });
};
