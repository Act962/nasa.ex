import type { FastifyPluginAsync } from "fastify";
import type { handleUazapiWebhook as UazapiHandler } from "@/app/api/chat/webhook/handle";
import * as uazapiModule from "@/app/api/chat/webhook/handle";
import type { handleDomainProviderWebhook as DomainHandler } from "@/app/api/domain-providers/[provider]/webhook/handle";
import * as domainModule from "@/app/api/domain-providers/[provider]/webhook/handle";

// Interop CJS (apps/web) × ESM (apps/api): tsx só expõe o `.default`. Tipos via
// `import type`. Mesmo padrão de rpc.ts/auth.ts/stripe-webhook.ts.
const handleUazapiWebhook = (
  uazapiModule as unknown as {
    default: { handleUazapiWebhook: typeof UazapiHandler };
  }
).default.handleUazapiWebhook;

const handleDomainProviderWebhook = (
  domainModule as unknown as {
    default: { handleDomainProviderWebhook: typeof DomainHandler };
  }
).default.handleDomainProviderWebhook;

// Webhooks sem assinatura: Uazapi (inbound WhatsApp principal, trackingId na
// query, handler devolve `Response` Web-standard que replicamos) e domain-
// providers (param `:provider` na rota). Parser raw encapsulado.
export const miscWebhooksPlugin: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => done(null, body),
  );

  app.post("/api/chat/webhook", async (request, replyTo) => {
    const query = request.query as Record<string, unknown>;
    const trackingId =
      typeof query.trackingId === "string" ? query.trackingId : null;
    const rawBody = typeof request.body === "string" ? request.body : "";
    const response = await handleUazapiWebhook(trackingId, rawBody);
    const text = await response.text();
    replyTo.status(response.status);
    response.headers.forEach((value, key) => replyTo.header(key, value));
    return replyTo.send(text);
  });

  app.post("/api/domain-providers/:provider/webhook", async (request, replyTo) => {
    const provider = (request.params as { provider: string }).provider;
    const rawBody = typeof request.body === "string" ? request.body : "";
    const { status, body } = await handleDomainProviderWebhook(provider, rawBody);
    return replyTo.status(status).send(body);
  });
};
