export type AiReplyRequest = {
  organizationId: string;
  prompt: string;
  incomingText: string;
};

export type AiReplyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "NO_BALANCE" | "EMPTY_OUTPUT" | "PROVIDER_ERROR"; detail?: string };

/**
 * Geração de resposta por IA. É port por dois motivos: manter a cobrança em
 * Stars fora do domínio (spec 0024 RF-16) e permitir testar o fluxo sem
 * chamar LLM nenhum.
 */
export interface AiReplyGenerator {
  generate(request: AiReplyRequest): Promise<AiReplyResult>;
}
