import type { FastifyPluginAsync } from "fastify";
import type { handleStripeCourseWebhook as HandlerType } from "@/app/api/stripe/webhook/handle";
import * as handleModule from "@/app/api/stripe/webhook/handle";

// Interop CJS (apps/web) × ESM (apps/api): tsx só expõe o `.default` do módulo
// CJS. Tipo vem via `import type`. Mesmo padrão de rpc.ts/auth.ts/inngest.ts.
const handleStripeCourseWebhook = (
  handleModule as unknown as {
    default: { handleStripeCourseWebhook: typeof HandlerType };
  }
).default.handleStripeCourseWebhook;

export const stripeWebhookPlugin: FastifyPluginAsync = async (app) => {
  // Stripe valida assinatura no corpo CRU — preserva o body como string, sem
  // parse JSON. O parser é encapsulado neste plugin (não afeta health/inngest,
  // que usam o JSON parser default do app).
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => done(null, body),
  );

  app.post("/api/stripe/webhook", async (request, reply) => {
    const signatureHeader = request.headers["stripe-signature"];
    const signature =
      typeof signatureHeader === "string" ? signatureHeader : "";
    const rawBody = typeof request.body === "string" ? request.body : "";
    const { status, body } = await handleStripeCourseWebhook(rawBody, signature);
    return reply.status(status).send(body);
  });
};
