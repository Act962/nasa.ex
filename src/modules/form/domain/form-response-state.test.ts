import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveResponseState } from "./form-response-state";

const NOW = new Date("2026-06-10T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

const requiredField = (id: string) => ({ id, blockType: "TextField", attributes: { required: true } });
const userSignatureGate = (id: string) => ({
  id,
  blockType: "SignatureUser",
  attributes: { assigneeUserId: "user-1" },
});
const clientSignature = (id: string) => ({ id, blockType: "SignatureClient", attributes: {} });

describe("deriveResponseState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("empty", () => {
    it.each([
      ["resposta vazia", {}],
      ["resposta ausente", null],
      ["só campos de identificação do sistema", { user_name: "Ana", user_email: "a@b.co", user_phone: "11" }],
      ["só meta-campos com prefixo __", { __groupsReached: "2" }],
      ["valores só com espaços", { nome: "   ", empresa: { value: " " } }],
      ["valor que não é texto", { idade: { value: 30 } }],
      ["JSON inválido", "{não é json"],
    ])("%s", (_caso, jsonResponse) => {
      const state = deriveResponseState({
        jsonResponse,
        jsonBlock: [requiredField("nome")],
        createdAt: hoursAgo(48),
      });

      expect(state).toBe("empty");
    });
  });

  describe("complete", () => {
    it("todos os obrigatórios preenchidos e assinaturas feitas", () => {
      const state = deriveResponseState({
        jsonResponse: { nome: { value: "Ana" }, gate: { value: "assinado" }, cliente: "assinado" },
        jsonBlock: [requiredField("nome"), userSignatureGate("gate"), clientSignature("cliente")],
        createdAt: hoursAgo(48),
      });

      expect(state).toBe("complete");
    });

    it("considera obrigatórios dentro de blocos aninhados", () => {
      const jsonBlock = [{ id: "linha", blockType: "RowLayout", childblocks: [requiredField("nome")] }];

      expect(
        deriveResponseState({ jsonResponse: { nome: "Ana" }, jsonBlock, createdAt: hoursAgo(1) }),
      ).toBe("complete");
      expect(
        deriveResponseState({ jsonResponse: { outro: "x" }, jsonBlock, createdAt: hoursAgo(1) }),
      ).toBe("in_progress");
    });

    it("formulário sem obrigatórios fica completo com qualquer campo preenchido", () => {
      const state = deriveResponseState({
        jsonResponse: { observacao: "x" },
        jsonBlock: [{ id: "observacao", blockType: "TextField" }],
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("complete");
    });

    it("blocos ilegíveis são tratados como formulário sem obrigatórios", () => {
      const state = deriveResponseState({
        jsonResponse: { observacao: "x" },
        jsonBlock: "{não é json",
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("complete");
    });
  });

  describe("stale", () => {
    it("assinatura do responsável pendente, mesmo em resposta recente", () => {
      const state = deriveResponseState({
        jsonResponse: { nome: "Ana" },
        jsonBlock: [requiredField("nome"), userSignatureGate("gate")],
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("stale");
    });

    it("assinatura do responsável pendente vence a do cliente pendente", () => {
      const state = deriveResponseState({
        jsonResponse: { nome: "Ana" },
        jsonBlock: [requiredField("nome"), userSignatureGate("gate"), clientSignature("cliente")],
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("stale");
    });

    it("incompleta há mais de 24 horas", () => {
      const state = deriveResponseState({
        jsonResponse: { outro: "x" },
        jsonBlock: [requiredField("nome")],
        createdAt: hoursAgo(25).toISOString(),
      });

      expect(state).toBe("stale");
    });
  });

  describe("waiting_client_signature", () => {
    it("falta só a assinatura do cliente", () => {
      const state = deriveResponseState({
        jsonResponse: { nome: "Ana" },
        jsonBlock: [requiredField("nome"), clientSignature("cliente")],
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("waiting_client_signature");
    });

    it("vence a idade e os obrigatórios faltando", () => {
      const state = deriveResponseState({
        jsonResponse: { outro: "x" },
        jsonBlock: [requiredField("nome"), clientSignature("cliente")],
        createdAt: hoursAgo(72),
      });

      expect(state).toBe("waiting_client_signature");
    });
  });

  describe("in_progress", () => {
    it("incompleta e criada há menos de 24 horas", () => {
      const state = deriveResponseState({
        jsonResponse: { outro: "x" },
        jsonBlock: [requiredField("nome")],
        createdAt: hoursAgo(23),
      });

      expect(state).toBe("in_progress");
    });

    it("exatamente 24 horas ainda não é stale", () => {
      const state = deriveResponseState({
        jsonResponse: { outro: "x" },
        jsonBlock: [requiredField("nome")],
        createdAt: hoursAgo(24),
      });

      expect(state).toBe("in_progress");
    });

    it("assinatura do responsável sem responsável definido conta como campo obrigatório comum", () => {
      const state = deriveResponseState({
        jsonResponse: { nome: "Ana" },
        jsonBlock: [
          requiredField("nome"),
          { id: "assinatura", blockType: "SignatureUser", attributes: { required: true } },
        ],
        createdAt: hoursAgo(1),
      });

      expect(state).toBe("in_progress");
    });
  });
});
