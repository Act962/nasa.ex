import type { FastifyPluginAsync } from "fastify";
import type { handleStarsWebhook as StarsHandler } from "@/app/api/stars/webhook/handle";
import * as starsModule from "@/app/api/stars/webhook/handle";
import type { handleAsaasWebhook as AsaasHandler } from "@/app/api/payments/asaas/webhook/handle";
import * as asaasModule from "@/app/api/payments/asaas/webhook/handle";

// Interop CJS (apps/web) × ESM (apps/api): tsx só expõe o `.default` do módulo
// CJS. Tipos via `import type`. Mesmo padrão de rpc.ts/auth.ts/stripe-webhook.ts.
const handleStarsWebhook = (
  starsModule as unknown as {
    default: { handleStarsWebhook: typeof StarsHandler };
  }
).default.handleStarsWebhook;

const handleAsaasWebhook = (
  asaasModule as unknown as {
    default: { handleAsaasWebhook: typeof AsaasHandler };
  }
).default.handleAsaasWebhook;

// Webhooks de pagamento. Corpo CRU preservado (parser encapsulado parseAs
// string): o Stars valida assinatura Stripe no raw; o Asaas não assina, mas
// recebe o cru e parseia no handler — uniforme.
export const paymentsWebhooksPlugin: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => done(null, body),
  );

  app.post("/api/stars/webhook", async (request, reply) => {
    const signatureHeader = request.headers["stripe-signature"];
    const signature =
      typeof signatureHeader === "string" ? signatureHeader : "";
    const rawBody = typeof request.body === "string" ? request.body : "";
    const { status, body } = await handleStarsWebhook(rawBody, signature);
    return reply.status(status).send(body);
  });

  app.post("/api/payments/asaas/webhook", async (request, reply) => {
    const rawBody = typeof request.body === "string" ? request.body : "";
    const { status, body } = await handleAsaasWebhook(rawBody);
    return reply.status(status).send(body);
  });
};
