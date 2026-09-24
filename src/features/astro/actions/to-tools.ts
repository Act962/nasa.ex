import "server-only";
import { tool, type ToolSet } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { ASTRO_ACTIONS } from "./registry";
import { proposeAction } from "./confirmation";
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
    // O balão do chat renderiza texto puro, sem markdown: um "[aqui](url)"
    // escrito pelo modelo aparece literal e estoura a largura. O link vive no
    // cartão, que tem botão de copiar e prévia da página.
    hint:
      "NÃO escreva a URL nem markdown de link na sua resposta. " +
      "O cartão acima já mostra a prévia e o botão de copiar. " +
      "Responda em uma frase curta, ex: 'Proposta criada — o link está no cartão.'",
  };
}

export function buildActionRegistryTools(ctx: AgentContext): ToolSet {
  const tools: ToolSet = {};
  for (const action of ASTRO_ACTIONS) {
    tools[action.toolName] = tool({
      description: action.description,
      inputSchema: action.input,
      execute: async (input) => {
        // RF-8: escrita que pede confirmação devolve o cartão e para aqui.
        // Quem grava é `confirm_action`, depois do "sim" do usuário.
        if (action.requiresConfirmation) {
          return proposeAction({
            ctx,
            action,
            input: input as Record<string, unknown>,
            warnings: action.confirmWarnings,
          });
        }
        return describeForModel(await action.execute({ ctx, input }));
      },
    });
  }
  return tools;
}
