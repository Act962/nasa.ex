import { describe, expect, it } from "vitest";
import { isSecretTokenValid, resolveWebhookAuthMode } from "./webhook-auth";

describe("isSecretTokenValid", () => {
  it("aceita o token igual ao configurado", () => {
    expect(isSecretTokenValid("segredo-123", "segredo-123")).toBe(true);
  });

  it("recusa token diferente, inclusive de outro tamanho", () => {
    expect(isSecretTokenValid("segredo-124", "segredo-123")).toBe(false);
    expect(isSecretTokenValid("segredo", "segredo-123")).toBe(false);
    expect(isSecretTokenValid("segredo-123 ", "segredo-123")).toBe(false);
  });

  it.each([
    [null, "segredo-123"],
    [undefined, "segredo-123"],
    ["", "segredo-123"],
    ["segredo-123", null],
    ["segredo-123", undefined],
    ["segredo-123", ""],
    ["", ""],
    [null, null],
  ])("fail-closed: recebido %j e configurado %j são recusados", (receivedToken, expectedToken) => {
    expect(isSecretTokenValid(receivedToken, expectedToken)).toBe(false);
  });
});

describe("resolveWebhookAuthMode", () => {
  it("usa o modo configurado, ignorando caixa e espaços", () => {
    expect(resolveWebhookAuthMode("log-only", "enforce")).toBe("log-only");
    expect(resolveWebhookAuthMode(" ENFORCE ", "log-only")).toBe("enforce");
  });

  it.each([undefined, "", "off", "false", "disabled"])(
    "valor ausente ou desconhecido (%j) cai no padrão da rota",
    (configuredMode) => {
      expect(resolveWebhookAuthMode(configuredMode, "enforce")).toBe("enforce");
      expect(resolveWebhookAuthMode(configuredMode, "log-only")).toBe("log-only");
    },
  );
});
