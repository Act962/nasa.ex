import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postDomainWebhook } from "@/app/api/domain-providers/[provider]/webhook/route";
import { POST as postFacebookWebhook } from "@/app/api/integrations/facebook/webhook/route";
import { POST as postInstagramWebhook } from "@/app/api/integrations/instagram/webhook/route";

const DOMAIN_TOKEN = "token-do-registrador";
const APP_SECRET = "app-secret-de-teste";
// Objeto que as duas rotas ignoram: o teste observa só a decisão de autenticação.
const IGNORED_BODY = JSON.stringify({ object: "outro", entry: [] });

const signatureFor = (rawBody: string) =>
  `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;

function domainRequest(token?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("x-webhook-token", token);
  return new NextRequest("http://localhost:3000/api/domain-providers/mock/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify({ externalOrderId: "pedido-inexistente", status: "paid" }),
  });
}

const domainParams = { params: Promise.resolve({ provider: "mock" }) };

function metaRequest(path: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("x-hub-signature-256", signature);
  return new NextRequest(`http://localhost:3000/api/integrations/${path}/webhook`, {
    method: "POST",
    headers,
    body: IGNORED_BODY,
  });
}

describe("spec 0091 — webhook de compra de domínio (S4)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("RF-7: sem a variável de ambiente, recusa tudo", async () => {
    vi.stubEnv("DOMAIN_PROVIDER_WEBHOOK_TOKEN", "");

    expect((await postDomainWebhook(domainRequest(DOMAIN_TOKEN), domainParams)).status).toBe(401);
    expect((await postDomainWebhook(domainRequest(), domainParams)).status).toBe(401);
  });

  it("RF-7: token ausente ou errado é recusado", async () => {
    vi.stubEnv("DOMAIN_PROVIDER_WEBHOOK_TOKEN", DOMAIN_TOKEN);

    expect((await postDomainWebhook(domainRequest(), domainParams)).status).toBe(401);
    expect((await postDomainWebhook(domainRequest("errado"), domainParams)).status).toBe(401);
  });

  it("RF-7: com o token certo, a chamada chega à busca da compra", async () => {
    vi.stubEnv("DOMAIN_PROVIDER_WEBHOOK_TOKEN", DOMAIN_TOKEN);

    const response = await postDomainWebhook(domainRequest(DOMAIN_TOKEN), domainParams);

    expect(response.status).toBe(404);
  });
});

describe.each([
  ["Messenger", "facebook", postFacebookWebhook],
  ["Instagram", "instagram", postInstagramWebhook],
])("spec 0091 — webhook antigo do %s (S4)", (_nome, path, postWebhook) => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CA-5: no modo enforce, sem assinatura válida recusa com 401", async () => {
    vi.stubEnv("META_APP_SECRET", APP_SECRET);
    vi.stubEnv("META_MESSAGING_WEBHOOK_AUTH_MODE", "enforce");

    expect((await postWebhook(metaRequest(path))).status).toBe(401);
    expect((await postWebhook(metaRequest(path, "sha256=00ff"))).status).toBe(401);
  });

  it("CA-5: no modo enforce, assinatura válida é aceita", async () => {
    vi.stubEnv("META_APP_SECRET", APP_SECRET);
    vi.stubEnv("META_MESSAGING_WEBHOOK_AUTH_MODE", "enforce");

    const response = await postWebhook(metaRequest(path, signatureFor(IGNORED_BODY)));

    expect(response.status).toBe(200);
  });

  it("CA-6: no padrão (log-only), chamada sem assinatura ainda é aceita", async () => {
    vi.stubEnv("META_APP_SECRET", APP_SECRET);
    vi.stubEnv("META_MESSAGING_WEBHOOK_AUTH_MODE", "");

    expect((await postWebhook(metaRequest(path))).status).toBe(200);
  });

  it("CB-7: no modo enforce, sem META_APP_SECRET recusa até assinatura bem formada", async () => {
    vi.stubEnv("META_APP_SECRET", "");
    vi.stubEnv("META_MESSAGING_WEBHOOK_AUTH_MODE", "enforce");

    const response = await postWebhook(metaRequest(path, signatureFor(IGNORED_BODY)));

    expect(response.status).toBe(401);
  });
});
