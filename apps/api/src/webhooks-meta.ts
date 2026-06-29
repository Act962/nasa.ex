import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  handleMetaOfficialVerify as OfficialVerify,
  handleMetaOfficialEvent as OfficialEvent,
} from "@/app/api/chat/webhook/official/handle";
import * as officialModule from "@/app/api/chat/webhook/official/handle";
import type {
  handleFacebookVerify as FacebookVerify,
  handleFacebookEvent as FacebookEvent,
} from "@/app/api/integrations/facebook/webhook/handle";
import * as facebookModule from "@/app/api/integrations/facebook/webhook/handle";
import type {
  handleInstagramVerify as InstagramVerify,
  handleInstagramEvent as InstagramEvent,
} from "@/app/api/integrations/instagram/webhook/handle";
import * as instagramModule from "@/app/api/integrations/instagram/webhook/handle";

// Interop CJS (apps/web) × ESM (apps/api): tsx só expõe o `.default`. Tipos via
// `import type`. Mesmo padrão de rpc.ts/auth.ts/stripe-webhook.ts.
const official = (
  officialModule as unknown as {
    default: {
      handleMetaOfficialVerify: typeof OfficialVerify;
      handleMetaOfficialEvent: typeof OfficialEvent;
    };
  }
).default;
const facebook = (
  facebookModule as unknown as {
    default: {
      handleFacebookVerify: typeof FacebookVerify;
      handleFacebookEvent: typeof FacebookEvent;
    };
  }
).default;
const instagram = (
  instagramModule as unknown as {
    default: {
      handleInstagramVerify: typeof InstagramVerify;
      handleInstagramEvent: typeof InstagramEvent;
    };
  }
).default;

type WebhookResult = { status: number; body: unknown; text?: boolean };

function reply(replyTo: FastifyReply, result: WebhookResult) {
  if (result.text) {
    return replyTo
      .status(result.status)
      .type("text/plain")
      .send(String(result.body));
  }
  return replyTo.status(result.status).send(result.body);
}

function queryParam(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// Webhooks Meta (verificação GET text/plain + POST). O `official` (WhatsApp)
// valida HMAC no corpo CRU; fb/ig não assinam mas recebem o cru e parseiam.
// Parser raw encapsulado neste plugin.
export const metaWebhooksPlugin: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => done(null, body),
  );

  // ── WhatsApp oficial (Meta Cloud API) ──
  app.get("/api/chat/webhook/official", async (request, replyTo) => {
    const query = request.query as Record<string, unknown>;
    return reply(
      replyTo,
      await official.handleMetaOfficialVerify({
        mode: queryParam(query["hub.mode"]),
        verifyToken: queryParam(query["hub.verify_token"]),
        challenge: queryParam(query["hub.challenge"]),
      }),
    );
  });
  app.post("/api/chat/webhook/official", async (request, replyTo) => {
    const rawBody = typeof request.body === "string" ? request.body : "";
    const signatureHeader = request.headers["x-hub-signature-256"];
    const signature =
      typeof signatureHeader === "string" ? signatureHeader : null;
    return reply(
      replyTo,
      await official.handleMetaOfficialEvent(rawBody, signature),
    );
  });

  // ── Facebook Messenger ──
  app.get("/api/integrations/facebook/webhook", async (request, replyTo) => {
    const query = request.query as Record<string, unknown>;
    return reply(
      replyTo,
      await facebook.handleFacebookVerify({
        mode: queryParam(query["hub.mode"]),
        token: queryParam(query["hub.verify_token"]),
        challenge: queryParam(query["hub.challenge"]),
      }),
    );
  });
  app.post("/api/integrations/facebook/webhook", async (request, replyTo) => {
    const rawBody = typeof request.body === "string" ? request.body : "";
    return reply(replyTo, await facebook.handleFacebookEvent(rawBody));
  });

  // ── Instagram DM ──
  app.get("/api/integrations/instagram/webhook", async (request, replyTo) => {
    const query = request.query as Record<string, unknown>;
    return reply(
      replyTo,
      await instagram.handleInstagramVerify({
        mode: queryParam(query["hub.mode"]),
        token: queryParam(query["hub.verify_token"]),
        challenge: queryParam(query["hub.challenge"]),
      }),
    );
  });
  app.post("/api/integrations/instagram/webhook", async (request, replyTo) => {
    const rawBody = typeof request.body === "string" ? request.body : "";
    return reply(replyTo, await instagram.handleInstagramEvent(rawBody));
  });
};
