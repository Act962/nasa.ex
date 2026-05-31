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
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
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
import { BLUEPRINT_GENERATION_PROMPT } from "./blueprint-system-prompt";

// ── Schema do blueprint gerado pelo LLM ────────────────────────────
// Compatível com o do `create-from-blueprint.ts` mas declarado aqui pra
// usar com generateObject (que faz validação estrita do output do LLM).

const BlueprintNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
});

const BlueprintEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  fromOutput: z.string().optional(),
  toInput: z.string().optional(),
});

const SuggestedTagSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  reason: z.string().optional(),
});

const GeneratedBlueprintSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  suggestedTags: z.array(SuggestedTagSchema).default([]),
  nodes: z.array(BlueprintNodeSchema),
  edges: z.array(BlueprintEdgeSchema),
});

export function buildWorkflowTools(
  ctx: AgentContext & { trackingId?: string | null },
) {
  return {
    // ── 1. Lista presets disponíveis ────────────────────────────────
    list_workflow_presets: tool({
      description:
        "Retorna o catálogo de presets de workflow prontos. Use ANTES de `apply_workflow_preset` pra escolher o slug certo. Use quando o user pede algo que claramente casa com um preset (ex: 'crie boas-vindas pra alunos NASA Route').",
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
        "Gera UM workflow customizado a partir de uma descrição em linguagem natural. LLM produz blueprint estruturado (nodes + edges + tags sugeridas + nós em vermelho onde falta decisão). Workflow nasce INATIVO no canvas pra user revisar. Use quando nenhum preset casa exatamente. Não use pra mudanças em workflow EXISTENTE (use addNode/connectNodes pra isso).",
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
          // ── 1. LLM gera o blueprint (gpt-4o — modelo grande pra
          // estrutura complexa). Schema strict via generateObject.
          const result = await generateObject({
            model: openai("gpt-4o"),
            schema: GeneratedBlueprintSchema,
            system: BLUEPRINT_GENERATION_PROMPT,
            prompt: [
              `Intent do user: ${intent}`,
              name ? `Nome desejado: "${name}"` : "",
              "",
              "Gere o blueprint JSON correspondente.",
            ]
              .filter(Boolean)
              .join("\n"),
            temperature: 0.4,
          });

          const blueprint = result.object;

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

          return {
            success: true,
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
            })),
            tagsReused: tagResult.reused.map((t) => ({
              name: t.name,
              matchedBy: t.matchedBy,
            })),
            needsReviewCount,
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
