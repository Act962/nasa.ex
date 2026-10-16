import { describe, expect, it } from "vitest";
import { isAsaasStarsWebhookAuthorized, isPaidValueSufficient } from "./asaas-webhook-guard";

describe("isAsaasStarsWebhookAuthorized (S1)", () => {
  it("aceita o token de qualquer gateway Asaas ativo", () => {
    expect(isAsaasStarsWebhookAuthorized("token-b", ["token-a", "token-b"])).toBe(true);
  });

  it("recusa token que não é de nenhum gateway", () => {
    expect(isAsaasStarsWebhookAuthorized("token-x", ["token-a", "token-b"])).toBe(false);
  });

  it("recusa chamada sem header", () => {
    expect(isAsaasStarsWebhookAuthorized(null, ["token-a"])).toBe(false);
    expect(isAsaasStarsWebhookAuthorized("", ["token-a"])).toBe(false);
  });

  it("fail-closed: sem gateway ou sem segredo configurado, recusa tudo", () => {
    expect(isAsaasStarsWebhookAuthorized("qualquer", [])).toBe(false);
    expect(isAsaasStarsWebhookAuthorized("qualquer", [null, null])).toBe(false);
    expect(isAsaasStarsWebhookAuthorized("", [""])).toBe(false);
  });
});

describe("isPaidValueSufficient (S1)", () => {
  it("aceita valor igual ou maior que o do pacote", () => {
    expect(isPaidValueSufficient(49.9, 49.9)).toBe(true);
    expect(isPaidValueSufficient(50, 49.9)).toBe(true);
  });

  it("tolera diferença de um centavo de arredondamento", () => {
    expect(isPaidValueSufficient(49.89, 49.9)).toBe(true);
  });

  it("recusa valor menor que o do pacote", () => {
    expect(isPaidValueSufficient(49.88, 49.9)).toBe(false);
    expect(isPaidValueSufficient(1, 49.9)).toBe(false);
    expect(isPaidValueSufficient(0, 49.9)).toBe(false);
  });

  it.each([undefined, null, "49.90", Number.NaN, Number.POSITIVE_INFINITY])(
    "recusa valor que não é número finito (%j)",
    (paidValue) => {
      expect(isPaidValueSufficient(paidValue, 49.9)).toBe(false);
    },
  );
});
