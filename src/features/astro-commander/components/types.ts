import type { InferRouterOutputs } from "@orpc/server";
import type { astroCommanderRouter } from "@/app/router/astro-commander";

/**
 * Forma do comando que a página de detalhe recebe. Vem do contrato oRPC, então
 * mudar o `select` da procedure quebra o build em vez de quebrar a tela.
 */
type CommanderOutputs = InferRouterOutputs<typeof astroCommanderRouter>;

export type CommandDetailData = CommanderOutputs["commands"]["get"]["command"];
