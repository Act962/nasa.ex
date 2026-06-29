/**
 * Procedure: cria workflow + nodes + edges + tags em batch a partir de
 * um blueprint estruturado. Usado por:
 *
 *  1. **Tool IA `generate_workflow_from_intent`** — o Astro (canvas chat
 *     OU NASA Explorer home) gera o blueprint via LLM e chama esta
 *     procedure pra materializar. User vê o workflow já criado com tags
 *     novas, nós em vermelho onde precisa decidir.
 *
 *  2. **Tool IA `apply_workflow_preset`** — preset por slug. Resolve via
 *     `applyDefaultAgentPresets({slug})` em vez de blueprint direto.
 *
 * O blueprint é o mesmo formato dos builders (`agent-presets/*.ts`).
 * Tags são processadas via `findOrCreateTags` ANTES de criar nodes —
 * placeholders `{{TAG:slug}}` em `node.data` são substituídos por IDs
 * reais via `resolvePlaceholders` no helper de criação.
 *
 * Workflow nasce com `isActive: false` e `agentMode: true` (default) pra
 * o user revisar antes de ligar.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NodeType } from "@/generated/prisma/enums";
import {
  createWorkflowFromBlueprint,
  type Blueprint,
} from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import {
  findOrCreateTags,
  type TagRequest,
} from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { logActivity } from "@/features/admin/lib/activity-logger";

// ── Schemas Zod ─────────────────────────────────────────────────────

const BlueprintNodeSchema = z.object({
  id: z.string(),
  type: z.string(), // NodeType — validado em runtime no helper
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
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug deve ser kebab-case (a-z, 0-9, -)"),
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  reason: z.string().optional(),
});

const BlueprintSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  /**
   * Tags que o blueprint REFERENCIA via placeholder `{{TAG:slug}}` em
   * algum `node.data.action.tagsIds[]`. Cada uma é criada ou reutilizada
   * (por similaridade Jaccard >= 0.7) antes da resolução de placeholders.
   */
  suggestedTags: z.array(SuggestedTagSchema).default([]),
  nodes: z.array(BlueprintNodeSchema),
  edges: z.array(BlueprintEdgeSchema),
});

export type GeneratedBlueprint = z.infer<typeof BlueprintSchema>;

// ── Procedure ───────────────────────────────────────────────────────

export const createWorkflowFromBlueprintProc = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      blueprint: BlueprintSchema,
      /**
       * Default true — workflows gerados pela IA usam agent-mode (engine
       * novo com WAIT_FOR_EVENT/AI_DECISION/etc).
       */
      agentMode: z.boolean().default(true),
      /** Default false — nasce pausado pra user revisar nós em vermelho. */
      isActive: z.boolean().default(false),
      /** Default 60 — limite anti-loop. */
      maxRunsPerHour: z.number().int().min(1).max(1000).default(60),
      folderId: z.string().nullish(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: { id: true, organizationId: true, name: true },
    });
    if (!tracking) {
      throw errors.BAD_REQUEST({ message: "Tracking não encontrado" });
    }
    if (tracking.organizationId !== context.org.id) {
      throw errors.BAD_REQUEST({
        message: "Tracking pertence a outra organização",
      });
    }

    // 1. Resolve tags ANTES da transação principal (idempotente, lê e
    // escreve em `tags`/`tag_org_index` mas não no workflow).
    const tagResult = await findOrCreateTags(
      prisma,
      tracking.organizationId,
      input.blueprint.suggestedTags as TagRequest[],
    );

    // 2. Cria workflow + nodes + edges com tagMap injetado pra resolver
    // placeholders `{{TAG:slug}}` nos node.data.
    const result = await prisma.$transaction(async (tx) => {
      return await createWorkflowFromBlueprint(tx, {
        trackingId: input.trackingId,
        userId: context.user.id,
        blueprint: input.blueprint as Blueprint,
        agentMode: input.agentMode,
        isActive: input.isActive,
        maxRunsPerHour: input.maxRunsPerHour,
        folderId: input.folderId ?? null,
        tagMap: tagResult.tagMap,
      });
    });

    // 3. Audit log (best-effort)
    await logActivity({
      organizationId: tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: null,
      appSlug: "tracking",
      action: "workflow.generated_by_ai",
      actionLabel: `Astro gerou automação "${input.blueprint.name}" no tracking "${tracking.name}"`,
      resource: input.blueprint.name,
      resourceId: result.workflowId,
      metadata: {
        nodesCount: result.nodesCreated,
        edgesCount: result.edgesCreated,
        tagsCreated: tagResult.created.length,
        tagsReused: tagResult.reused.length,
      },
    }).catch((e) =>
      console.warn("[workflow/createFromBlueprint] logActivity failed", e),
    );

    // Conta nós em vermelho (needsReview no data) — caller mostra count
    // no toast pra o user saber que precisa revisar.
    const needsReviewCount = input.blueprint.nodes.filter(
      (n) => (n.data as { needsReview?: boolean })?.needsReview === true,
    ).length;

    return {
      workflowId: result.workflowId,
      workflowName: input.blueprint.name,
      trackingId: input.trackingId,
      nodesCreated: result.nodesCreated,
      edgesCreated: result.edgesCreated,
      tagsCreated: tagResult.created,
      tagsReused: tagResult.reused,
      needsReviewCount,
      editorUrl: `/tracking/${input.trackingId}/workflows/${result.workflowId}`,
    };
  });

/**
 * Re-exporta os tipos pra que tools LLM e clients possam reusar o schema
 * sem duplicar a definição. NodeType enum também re-exportado pro caller
 * gerador validar tipos antes de submeter.
 */
export { NodeType };
