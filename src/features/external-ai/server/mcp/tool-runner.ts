import "server-only";
import { takeRateLimit } from "@/lib/rate-limit";
import type { ExternalAiCaller } from "../access-tokens";

// Guarda comum das ferramentas do MCP: escopo da chave, limite de chamadas e erro em texto para a IA.

export type ToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
};

export const asResult = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

export const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

const DEFAULT_RATE_LIMIT = { max: 300, windowMs: 60 * 60 * 1000 };

/**
 * Executa a ferramenta só se a chave tem o escopo do app e a pessoa não passou do limite. No OAuth o tokenId é o
 * client_id da IA, igual para todos que usam o mesmo app: o limite é por pessoa e credencial.
 */
export function createScopedToolRunner(config: { scope: string; appName: string; rateLimitKey: string; rateLimit?: { max: number; windowMs: number } }) {
  return async function runScopedTool(caller: ExternalAiCaller, work: () => Promise<unknown>): Promise<ToolResult> {
    try {
      if (!caller.scopes.includes(config.scope)) {
        return asError(`Esta chave não tem acesso ${config.appName}. Gere uma chave nova em Satélites › IA externa ou conecte pelo OAuth.`);
      }
      const limit = takeRateLimit(config.rateLimitKey, `${caller.userId}:${caller.tokenId}`, config.rateLimit ?? DEFAULT_RATE_LIMIT);
      if (!limit.allowed) return asError(`Muitas chamadas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
      return asResult(await work());
    } catch (error) {
      return asError(error instanceof Error ? error.message : "Erro inesperado.");
    }
  };
}
