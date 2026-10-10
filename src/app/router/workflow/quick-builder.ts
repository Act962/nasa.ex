// Construtor rápido de Gatilhos Automáticos (spec 0039): montar por frase,
// conferir duplicação e criar a partir dos passos lineares.

import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { BLUEPRINT_GENERATION_PROMPT } from "@/features/astro/server/tools/workflows/blueprint-system-prompt";
import { GeneratedBlueprintSchema } from "@/features/astro/server/tools/workflows";
import {
  createWorkflowFromBlueprint,
  type Blueprint,
} from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags, type TagRequest } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import {
  QUICK_TRIGGER_TYPES,
  blueprintToSteps,
  stepsToBlueprint,
  triggerKey,
  type QuickStep,
} from "@/features/workflows/lib/quick-builder/steps";

const QUICK_BUILDER_RULES = `
## CONSTRUTOR RÁPIDO
- Prefira fluxo LINEAR: 1 gatilho e ações em sequência, sem ramificação, a menos que o pedido exija.
- "Me lembra", "me avisa", "lembrar de retornar" = NOTIFY_TEAM com target "USER" (lembra quem pediu, não o lead).
- "Todo dia às 9h", "toda segunda", "dia 15 às 14h" = SCHEDULE_TRIGGER.
- Mensagem para o lead = SEND_MESSAGE.`;

const stepSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
});

const suggestedTagSchema = z.object({
  slug: z.string(),
  name: z.string(),
  color: z.string().optional(),
  reason: z.string().optional(),
  aiDescription: z.string().max(300).optional(),
});

async function findTrackingInOrg(trackingId: string, organizationId: string) {
  return prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
}

async function findLeadInTracking(leadId: string, trackingId: string) {
  return prisma.lead.findFirst({ where: { id: leadId, trackingId }, select: { id: true, name: true } });
}

export const quickDraftWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", path: "/workflow/quick/draft", summary: "Monta os passos de um gatilho a partir de uma frase" })
  .input(z.object({ trackingId: z.string(), prompt: z.string().trim().min(8).max(1000), leadId: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await findTrackingInOrg(input.trackingId, context.org.id))) throw errors.NOT_FOUND;
    const lead = input.leadId ? await findLeadInTracking(input.leadId, input.trackingId) : null;

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: GeneratedBlueprintSchema,
      system: `${BLUEPRINT_GENERATION_PROMPT}\n${QUICK_BUILDER_RULES}`,
      prompt: [
        `Intent do user: ${input.prompt}`,
        lead ? `O gatilho é só para o lead "${lead.name}" — não precisa filtrá-lo nos nós.` : "",
        "Gere o blueprint JSON correspondente.",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.2,
      // O blueprint tem campos opcionais e `data` livre por nó; o modo estrito
      // da OpenAI recusa esse schema.
      providerOptions: { openai: { strictJsonSchema: false } },
    });
    const blueprint = result.object;
    const { steps, isLinear } = blueprintToSteps(blueprint.nodes, blueprint.edges);
    return {
      name: blueprint.name,
      description: blueprint.description ?? null,
      steps,
      isLinear,
      branchedFlow: isLinear ? null : { nodes: blueprint.nodes, edges: blueprint.edges },
      suggestedTags: blueprint.suggestedTags,
      startsWithTrigger: steps.length > 0 && QUICK_TRIGGER_TYPES.has(steps[0].type),
    };
  });

export const quickCheckDuplicates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", path: "/workflow/quick/duplicates", summary: "Gatilhos ativos com a mesma lógica" })
  .input(z.object({ trackingId: z.string(), leadId: z.string().optional(), steps: z.array(stepSchema).min(1) }))
  .handler(async ({ input, context, errors }) => {
    if (!(await findTrackingInOrg(input.trackingId, context.org.id))) throw errors.NOT_FOUND;
    const [trigger, ...actions] = input.steps as QuickStep[];
    if (!QUICK_TRIGGER_TYPES.has(trigger.type)) return { duplicates: [] };
    const candidateKey = triggerKey(trigger);
    const candidateActions = new Set(actions.map((action) => action.type));

    const existing = await prisma.workflow.findMany({
      where: {
        trackingId: input.trackingId,
        isActive: true,
        // Mesmo lead ou o tracking todo: os dois disparariam juntos (RF-8).
        OR: [{ leadId: null }, ...(input.leadId ? [{ leadId: input.leadId }] : [])],
        nodes: { some: { type: trigger.type as never } },
      },
      select: { id: true, name: true, leadId: true, nodes: { select: { type: true, data: true } } },
    });

    const duplicates = existing.flatMap((workflow) => {
      const nodes = workflow.nodes.map((node) => ({ type: node.type, data: (node.data ?? {}) as Record<string, unknown> }));
      const hasSameTrigger = nodes.some((node) => node.type === trigger.type && triggerKey(node) === candidateKey);
      if (!hasSameTrigger) return [];
      const sharedActions = nodes.filter((node) => !QUICK_TRIGGER_TYPES.has(node.type) && candidateActions.has(node.type));
      if (candidateActions.size > 0 && sharedActions.length === 0) return [];
      return [
        {
          workflowId: workflow.id,
          name: workflow.name,
          scope: workflow.leadId ? ("lead" as const) : ("tracking" as const),
          sharedActionTypes: [...new Set(sharedActions.map((node) => node.type))],
        },
      ];
    });
    return { duplicates };
  });

export const quickCreateWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", path: "/workflow/quick/create", summary: "Cria o gatilho a partir dos passos lineares" })
  .input(
    z.object({
      trackingId: z.string(),
      leadId: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      steps: z.array(stepSchema).min(1).max(30),
      suggestedTags: z.array(suggestedTagSchema).default([]),
      activate: z.boolean(),
      /** Fluxo com ramificação vindo da frase: cria o grafo inteiro (modo avançado). */
      branchedFlow: z
        .object({
          nodes: z.array(stepSchema.extend({ id: z.string(), position: z.object({ x: z.number(), y: z.number() }) })),
          edges: z.array(
            z.object({ fromNodeId: z.string(), toNodeId: z.string(), fromOutput: z.string().optional(), toInput: z.string().optional() }),
          ),
        })
        .optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await findTrackingInOrg(input.trackingId, context.org.id))) throw errors.NOT_FOUND;
    if (input.leadId && !(await findLeadInTracking(input.leadId, input.trackingId))) throw errors.NOT_FOUND;
    if (!QUICK_TRIGGER_TYPES.has(input.steps[0].type)) {
      throw errors.BAD_REQUEST({ message: "O primeiro passo precisa ser um gatilho (\"Quando\")." });
    }

    const tagResult = input.suggestedTags.length
      ? await findOrCreateTags(prisma, context.org.id, input.suggestedTags as TagRequest[])
      : { tagMap: {} as Record<string, string> };
    const rawBlueprint = input.branchedFlow
      ? { name: input.name, nodes: input.branchedFlow.nodes, edges: input.branchedFlow.edges }
      : stepsToBlueprint(input.name, input.steps as QuickStep[]);
    // "Lembrar a mim" = quem está criando o gatilho (RF-6).
    const blueprint = {
      ...rawBlueprint,
      nodes: rawBlueprint.nodes.map((node) =>
        node.type === "NOTIFY_TEAM" && !node.data.userId ? { ...node, data: { ...node.data, userId: context.user.id } } : node,
      ),
    };
    // Nó marcado para revisão não pode rodar: nasce pausado (RF-1).
    const needsReview = blueprint.nodes.some((node) => node.data.needsReview === true);

    const created = await prisma.$transaction(async (tx) => {
      const result = await createWorkflowFromBlueprint(tx, {
        trackingId: input.trackingId,
        userId: context.user.id,
        blueprint: blueprint as unknown as Blueprint,
        agentMode: true,
        isActive: input.activate && !needsReview,
        tagMap: tagResult.tagMap,
      });
      if (input.leadId) {
        await tx.workflow.update({ where: { id: result.workflowId }, data: { leadId: input.leadId } });
      }
      return result;
    });

    return {
      workflowId: created.workflowId,
      isActive: input.activate && !needsReview,
      needsReview,
      editorUrl: `/tracking/${input.trackingId}/workflows/${created.workflowId}`,
    };
  });
