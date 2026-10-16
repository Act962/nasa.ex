import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkMetaWebhookSignature } from "./meta-webhook-signature";

const APP_SECRET = "app-secret-de-teste";
const RAW_BODY = JSON.stringify({ object: "page", entry: [{ id: "123" }] });

const signatureFor = (rawBody: string, appSecret: string = APP_SECRET) =>
  `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;

function check(overrides: Partial<Parameters<typeof checkMetaWebhookSignature>[0]> = {}) {
  return checkMetaWebhookSignature({
    rawBody: RAW_BODY,
    signatureHeader: signatureFor(RAW_BODY),
    appSecret: APP_SECRET,
    configuredMode: "enforce",
    ...overrides,
  });
}

describe("checkMetaWebhookSignature (S4)", () => {
  it("assinatura válida é aceita", () => {
    expect(check()).toEqual({ isSignatureValid: true, authMode: "enforce", shouldReject: false });
  });

  it("corpo adulterado depois de assinado é recusado", () => {
    const tamperedBody = RAW_BODY.replace("123", "999");

    expect(check({ rawBody: tamperedBody }).shouldReject).toBe(true);
  });

  it("assinatura de outro app é recusada", () => {
    expect(check({ signatureHeader: signatureFor(RAW_BODY, "outro-segredo") }).shouldReject).toBe(true);
  });

  it.each([null, "", "sha256=", "abc", "sha1=abcdef"])(
    "header ausente ou malformado (%j) é recusado",
    (signatureHeader) => {
      expect(check({ signatureHeader }).shouldReject).toBe(true);
    },
  );

  it("fail-closed: sem app secret configurado, nenhuma assinatura vale", () => {
    expect(check({ appSecret: undefined }).isSignatureValid).toBe(false);
    expect(check({ appSecret: "", signatureHeader: signatureFor(RAW_BODY, "") }).isSignatureValid).toBe(false);
  });

  it("no modo log-only, assinatura inválida é registrada mas não recusada", () => {
    const result = check({ signatureHeader: null, configuredMode: "log-only" });

    expect(result).toEqual({ isSignatureValid: false, authMode: "log-only", shouldReject: false });
  });

  it("sem modo configurado, o padrão destas rotas é log-only", () => {
    expect(check({ signatureHeader: null, configuredMode: undefined }).authMode).toBe("log-only");
  });
});
