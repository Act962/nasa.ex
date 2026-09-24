import "server-only";
import { tool, type ToolSet } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { ASTRO_ACTIONS } from "./registry";
import type { AstroActionResult } from "./types";

// Adaptador registro → ferramentas do orquestrador (spec 0023, RF-2).

/**
 * O que o modelo lê de volta. Mantém os dois links separados para ele não
 * confundir o que se manda ao cliente com o que se abre na plataforma, e
 * instrui a não soletrar URL — RF-13 vale no texto também.
 */
function describeForModel(result: AstroActionResult) {
  if (result.status !== "done") return result;
  return {
    ...result,
    hint: "Diga que o link está no cartão. Não repita a URL inteira na resposta.",
  };
}

export function buildActionRegistryTools(ctx: AgentContext): ToolSet {
  const tools: ToolSet = {};
  for (const action of ASTRO_ACTIONS) {
    tools[action.toolName] = tool({
      description: action.description,
      inputSchema: action.input,
      execute: async (input) =>
        describeForModel(await action.execute({ ctx, input })),
    });
  }
  return tools;
}
