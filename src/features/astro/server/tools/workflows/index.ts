/**
 * Tools de workflows do Astro — versão IA-generativa (gera workflow
 * inteiro a partir de intent natural). Compõem-se de 3 funções:
 *
 *  1. **generate_workflow_from_intent**: LLM gera blueprint estruturado
 *     (nodes + edges + tags sugeridas), chama `workflow.createFromBlueprint`
 *     e devolve link pro user revisar no canvas (nasce INATIVO).
 *
 *  2. **apply_workflow_preset**: aplica um dos 4 presets prontos por
 *     slug (proposta-contrato | boas-vindas-nasa-route | agendamento |
 *     closer-followup). Mais rápido que generate quando o user pede algo
 *     que casa com preset existente.
 *
 *  3. **list_workflow_presets**: retorna o catálogo pra o LLM saber quais
 *     presets existem antes de chamar apply.
 *
 * Usadas pelo orchestrator do Astro home (/home) E pelo ai-tracking
 * (chat lateral do canvas). Mesmo código, escopo `ctx.trackingId` vem
 * do caller.
 */
import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import prisma from "@/lib/prisma";
import {
  applyDefaultAgentPresets,
  PRESET_CATALOG,
  type PresetSlug,
} from "@/features/workflows/lib/agent-presets/apply-default-presets";
import {
  createWorkflowFromBlueprint,
  type Blueprint,
} from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import {
  findOrCreateTags,
  type TagRequest,
} from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { findFlowTracking, generateFlowBlueprint, predictBlueprintProblems } from "./generate-flow";

export { GeneratedBlueprintSchema } from "./generate-flow";


export function buildWorkflowTools(
  ctx: AgentContext & { trackingId?: string | null },
) {
  return {
    // ── 1. Lista presets disponíveis ────────────────────────────────
    list_workflow_presets: tool({
      description:
        "Retorna o catálogo de presets de workflow prontos. Use ANTES de `apply_workflow_preset` pra escolher o slug certo. Use quando o user pede algo que claramente casa com um preset (ex: 'crie boas-vindas pra alunos ÓRBITA Route').",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          presets: PRESET_CATALOG,
          tip: "Se nenhum preset bate exatamente, use `generate_workflow_from_intent` pra criar workflow custom.",
        };
      },
    }),

    // ── 2. Aplica preset por slug ──────────────────────────────────
    apply_workflow_preset: tool({
      description:
        "Aplica um dos 4 presets prontos no tracking informado. Workflow nasce com isActive=false. Use quando o user pede algo que JÁ existe como preset (lista via list_workflow_presets antes). Mais rápido e validado que generate.",
      inputSchema: z.object({
        slug: z.enum([
          "agendamento",
          "closer-followup",
          "proposta-contrato",
          "boas-vindas-nasa-route",
          "comprovante-pagamento",
        ]),
        trackingId: z
          .string()
          .describe(
            "Tracking onde o preset será aplicado. Use o trackingId do contexto se não especificado pelo user.",
          ),
      }),
      execute: async ({ slug, trackingId }) => {
        try {
          const created = await applyDefaultAgentPresets({
            prisma,
            organizationId: ctx.organizationId,
            trackingId,
            userId: ctx.userId,
            slug: slug as PresetSlug,
          });
          if (created.length === 0) {
            return { success: false, error: `Preset "${slug}" não encontrado` };
          }
          const wf = created[0]!;
          return {
            success: true,
            workflowId: wf.workflowId,
            workflowName: wf.name,
            editorUrl: `/tracking/${trackingId}/workflows/${wf.workflowId}`,
            message: `Preset "${slug}" aplicado. Workflow "${wf.name}" criado INATIVO — abra o canvas pra revisar placeholders <<...>> e ativar.`,
          };
        } catch (err) {
          console.error("[apply_workflow_preset]", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "apply_preset_failed",
          };
        }
      },
    }),

    // ── 3. Gera workflow inteiro a partir de intent natural ─────────
    generate_workflow_from_intent: tool({
      description:
        "Gera UM workflow customizado a partir de uma descrição em linguagem natural. LLM produz blueprint estruturado (nodes + edges + tags sugeridas + nós em vermelho onde falta decisão). Workflow nasce INATIVO no canvas pra user revisar. Use quando nenhum preset casa exatamente. Não use pra mudanças em workflow EXISTENTE (use addNode/connectNodes pra isso). " +
        "ATENDIMENTO DE UM TIPO DE NEGÓCIO (spec 0085): quando o usuário perguntar qual o melhor fluxo de atendimento para um ramo (clínica, centro automotivo, autônomo de ar condicionado…), NÃO chame esta ferramenta de imediato. Primeiro responda em texto com um roteiro curto: (1) os interesses do cliente a reconhecer, cada um com a tag e a frase de quando aplicar; (2) o que cada fluxo envia quando a tag entra (menu de serviços, caminho de agendamento, lista de parceiros, formulário); (3) o que ele vai precisar revisar (agenda, formulário, textos, contatos e códigos de parceiros). Pergunte em qual tracking criar e se pode criar. Só depois do sim, chame esta ferramenta UMA VEZ POR FLUXO, com o intent completo daquele fluxo. Tudo nasce desligado para revisão.",
      inputSchema: z.object({
        intent: z
          .string()
          .min(10)
          .describe(
            "Descrição completa em PT-BR do que o workflow deve fazer. Inclua: trigger, ações, condições, cadência. Quanto mais detalhe, melhor o blueprint. Ex: 'Quando lead recebe tag X, enviar proposta de Y, esperar 3 dias por resposta, se aceitou mandar contrato, se não cobrar D+3/D+7/D+15 e marcar Sem Interesse'.",
          ),
        trackingId: z
          .string()
          .describe("Tracking onde o workflow será criado."),
        name: z
          .string()
          .optional()
          .describe(
            "Nome desejado pro workflow (opcional — LLM inventa um bom se omitir).",
          ),
      }),
      execute: async ({ intent, trackingId, name }) => {
        try {
          // O id do funil vem do modelo: confere a empresa antes de qualquer escrita.
          const tracking = await findFlowTracking(trackingId, ctx.organizationId);
          if (!tracking) return { success: false, error: "Funil não encontrado nesta empresa." };
          const provider = tracking.provider;

          const blueprint = await generateFlowBlueprint({ intent, name, provider });

          // ── 2. Resolve tags (cria novas ou reusa similares) ───────
          const tagResult = await findOrCreateTags(
            prisma,
            ctx.organizationId,
            blueprint.suggestedTags as TagRequest[],
          );

          // ── 3. Cria workflow + nodes + edges em transação ────────
          const created = await prisma.$transaction(async (tx) => {
            return await createWorkflowFromBlueprint(tx, {
              trackingId,
              userId: ctx.userId,
              blueprint: blueprint as unknown as Blueprint,
              agentMode: true,
              isActive: false, // ← nasce pausado pra user revisar nós em vermelho
              maxRunsPerHour: 60,
              tagMap: tagResult.tagMap,
            });
          });

          // ── 4. Conta nós em vermelho pra mensagem do user ─────────
          const needsReviewCount = blueprint.nodes.filter(
            (n) => (n.data as { needsReview?: boolean })?.needsReview === true,
          ).length;

          // ── 5. Previsão de erros do canal sobre o que foi gerado (spec 0090, RF-24)
          const predictedProblems = predictBlueprintProblems(blueprint, provider).map((diagnostic) => ({
            severity: diagnostic.severity,
            title: diagnostic.title,
            message: diagnostic.message,
          }));

          return {
            success: true,
            predictedProblems,
            predictedProblemsHint:
              predictedProblems.length > 0
                ? "Conte ao usuário, em linguagem simples, cada problema previsto e que o quadro aparece em vermelho no editor até ser corrigido."
                : undefined,
            workflowId: created.workflowId,
            workflowName: blueprint.name,
            workflowDescription: blueprint.description,
            editorUrl: `/tracking/${trackingId}/workflows/${created.workflowId}`,
            nodesCount: created.nodesCreated,
            edgesCount: created.edgesCreated,
            tagsCreated: tagResult.created.map((t) => ({
              name: t.name,
              slug: t.slug,
              reason: t.reason,
              // Com descrição, a IA do atendimento aplica a tag sozinha e este fluxo dispara (spec 0085).
              aiDescription: t.aiDescription ?? null,
            })),
            tagsReused: tagResult.reused.map((t) => ({
              name: t.name,
              matchedBy: t.matchedBy,
            })),
            needsReviewCount,
            tagsHint:
              "No resumo ao usuário, liste cada tag criada e, quando houver, a regra (aiDescription) pela qual a IA do atendimento vai aplicá-la. Diga que ele pode ajustar o texto em Tags.",
            message:
              needsReviewCount > 0
                ? `Workflow "${blueprint.name}" criado com ${created.nodesCreated} nós e ${needsReviewCount} marcados em VERMELHO pra você revisar (faltam IDs concretos). Abra o canvas pra completar.`
                : `Workflow "${blueprint.name}" criado com ${created.nodesCreated} nós, pronto pra ativar. Abra o canvas pra confirmar.`,
          };
        } catch (err) {
          console.error("[generate_workflow_from_intent]", err);
          return {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : "generate_workflow_failed — tente refrasear o intent com mais detalhes",
          };
        }
      },
    }),
  };
}
