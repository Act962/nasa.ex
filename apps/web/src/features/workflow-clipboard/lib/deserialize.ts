/**
 * Import: BlueprintV2 + RefMapping + targetTrackingId → Workflow real no
 * banco.
 *
 * Pipeline (transação):
 *   1. Pra cada decisão "create" no mapping, cria a entidade na org
 *      destino (tags via findOrCreateTags, statuses inline, etc) e
 *      substitui a decisão pra "reuse" com o id criado. Isso simplifica
 *      o resolver.
 *   2. Roda `resolvePlaceholdersV2` em cada node.data pra trocar
 *      placeholders por IDs.
 *   3. Cria Workflow + Nodes + Connections com IDs novos. Para "node-
 *      selection" (sem workflow metadata), o caller passa um workflowId
 *      alvo OU um wrapper que cria workflow temporário.
 */
import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import { findOrCreateTags } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { resolvePlaceholdersV2 } from "./ref-resolver";
import type {
  BlueprintV2,
  RefMapping,
  RefMappingDecision,
  RefType,
} from "./types";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface ImportFullWorkflowParams {
  organizationId: string;
  targetTrackingId: string;
  userId: string;
  blueprint: BlueprintV2;
  mapping: RefMapping;
  /** Default: false — nasce pausado pro user revisar. */
  isActive?: boolean;
  /** Default: workflow.name do blueprint. */
  nameOverride?: string;
  /** Pasta de destino (opcional). */
  folderId?: string | null;
}

export interface ImportNodeSelectionParams {
  organizationId: string;
  targetWorkflowId: string;
  /** Offset em pixels pra reposicionar os nodes colados (default x+40, y+40). */
  offset?: { x: number; y: number };
  blueprint: BlueprintV2;
  mapping: RefMapping;
}

export interface ImportResult {
  workflowId: string;
  nodesCreated: number;
  edgesCreated: number;
  refsCreated: Array<{ type: RefType; slug: string; createdId: string }>;
  refsReused: Array<{ type: RefType; slug: string; targetId: string }>;
  refsSkipped: Array<{ type: RefType; slug: string }>;
}

/** Import workflow completo: cria Workflow novo + Nodes + Connections. */
export async function importFullWorkflow(
  client: PrismaLike,
  params: ImportFullWorkflowParams,
): Promise<ImportResult> {
  if (params.blueprint.kind !== "full-workflow") {
    throw new Error("blueprint_kind_mismatch: expected full-workflow");
  }
  if (!params.blueprint.workflow) {
    throw new Error("blueprint_workflow_metadata_missing");
  }

  const { resolvedMapping, audit } = await resolveCreations(
    client,
    params.organizationId,
    params.targetTrackingId,
    params.blueprint,
    params.mapping,
  );

  const workflowId = createId();
  await client.workflow.create({
    data: {
      id: workflowId,
      name: params.nameOverride ?? params.blueprint.workflow.name,
      description: params.blueprint.workflow.description ?? undefined,
      trackingId: params.targetTrackingId,
      userId: params.userId,
      agentMode: params.blueprint.workflow.agentMode,
      maxRunsPerHour: params.blueprint.workflow.maxRunsPerHour ?? 60,
      isActive: params.isActive ?? false,
      ...(params.folderId ? { folderId: params.folderId } : {}),
    },
  });

  const result = await persistNodesAndEdges(client, {
    workflowId,
    blueprint: params.blueprint,
    mapping: resolvedMapping,
  });

  return {
    workflowId,
    nodesCreated: result.nodesCreated,
    edgesCreated: result.edgesCreated,
    refsCreated: audit.created,
    refsReused: audit.reused,
    refsSkipped: audit.skipped,
  };
}

/** Import seleção parcial: anexa nodes a um workflow existente. */
export async function importNodeSelection(
  client: PrismaLike,
  params: ImportNodeSelectionParams,
): Promise<ImportResult> {
  if (params.blueprint.kind !== "node-selection") {
    throw new Error("blueprint_kind_mismatch: expected node-selection");
  }

  const target = await client.workflow.findUnique({
    where: { id: params.targetWorkflowId },
    select: { id: true, trackingId: true },
  });
  if (!target) throw new Error("target_workflow_not_found");
  if (!target.trackingId) {
    // Workflow sem tracking não tem como resolver refs por escopo de
    // tracking/org. Bloqueia o import antes de tentar usar id null.
    throw new Error("target_workflow_has_no_tracking");
  }
  const targetTrackingId = target.trackingId;

  const org = await client.tracking.findUnique({
    where: { id: targetTrackingId },
    select: { organizationId: true },
  });
  if (!org) throw new Error("target_org_resolution_failed");

  const { resolvedMapping, audit } = await resolveCreations(
    client,
    org.organizationId,
    targetTrackingId,
    params.blueprint,
    params.mapping,
  );

  // Aplica offset pra nodes colados não ficarem em cima dos originais.
  const offset = params.offset ?? { x: 40, y: 40 };
  const blueprintOffset: BlueprintV2 = {
    ...params.blueprint,
    nodes: params.blueprint.nodes.map((n) => ({
      ...n,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
    })),
  };

  const result = await persistNodesAndEdges(client, {
    workflowId: params.targetWorkflowId,
    blueprint: blueprintOffset,
    mapping: resolvedMapping,
  });

  return {
    workflowId: params.targetWorkflowId,
    nodesCreated: result.nodesCreated,
    edgesCreated: result.edgesCreated,
    refsCreated: audit.created,
    refsReused: audit.reused,
    refsSkipped: audit.skipped,
  };
}

/**
 * Cria entidades pedidas (`kind: "create"`) e atualiza o mapping pra
 * "reuse" com o ID criado. Hoje cria só TAGs (via findOrCreateTags).
 * Outros tipos vão pra "skip" automático — UI já avisa.
 */
async function resolveCreations(
  client: PrismaLike,
  organizationId: string,
  targetTrackingId: string,
  blueprint: BlueprintV2,
  mapping: RefMapping,
): Promise<{
  resolvedMapping: RefMapping;
  audit: {
    created: ImportResult["refsCreated"];
    reused: ImportResult["refsReused"];
    skipped: ImportResult["refsSkipped"];
  };
}> {
  const resolved: RefMapping = { ...mapping };
  const created: ImportResult["refsCreated"] = [];
  const reused: ImportResult["refsReused"] = [];
  const skipped: ImportResult["refsSkipped"] = [];

  // ── Tags ────────────────────────────────────────────────────────
  const tagCreates = blueprint.refs.filter(
    (r) => r.type === "tag" && mapping[`tag:${r.slug}`]?.kind === "create",
  );
  if (tagCreates.length > 0) {
    const result = await findOrCreateTags(
      client,
      organizationId,
      tagCreates.map((r) => ({
        slug: r.slug,
        name: r.label,
        color: r.color ?? undefined,
      })),
    );
    for (const ref of tagCreates) {
      const newId = result.tagMap[ref.slug];
      if (newId) {
        resolved[`tag:${ref.slug}`] = { kind: "reuse", targetId: newId };
        created.push({ type: "tag", slug: ref.slug, createdId: newId });
      } else {
        resolved[`tag:${ref.slug}`] = { kind: "skip" };
        skipped.push({ type: "tag", slug: ref.slug });
      }
    }
  }

  // ── Statuses — cria inline no tracking de destino ──────────────
  const statusCreates = blueprint.refs.filter(
    (r) => r.type === "status" && mapping[`status:${r.slug}`]?.kind === "create",
  );
  for (const ref of statusCreates) {
    // Reusa por nome se já existe no tracking
    const existing = await client.status.findFirst({
      where: { trackingId: targetTrackingId, name: ref.label },
      select: { id: true },
    });
    if (existing) {
      resolved[`status:${ref.slug}`] = { kind: "reuse", targetId: existing.id };
      reused.push({ type: "status", slug: ref.slug, targetId: existing.id });
      continue;
    }
    try {
      const newStatus = await client.status.create({
        data: {
          name: ref.label,
          color: ref.color ?? "#94A3B8",
          trackingId: targetTrackingId,
        },
        select: { id: true },
      });
      resolved[`status:${ref.slug}`] = { kind: "reuse", targetId: newStatus.id };
      created.push({ type: "status", slug: ref.slug, createdId: newStatus.id });
    } catch (err) {
      console.warn("[import] failed to create status:", ref, err);
      resolved[`status:${ref.slug}`] = { kind: "skip" };
      skipped.push({ type: "status", slug: ref.slug });
    }
  }

  // ── Tag groups ──────────────────────────────────────────────────
  const tagGroupCreates = blueprint.refs.filter(
    (r) =>
      r.type === "tag-group" &&
      mapping[`tag-group:${r.slug}`]?.kind === "create",
  );
  for (const ref of tagGroupCreates) {
    try {
      const newGroup = await client.tagGroup.create({
        data: {
          organizationId,
          name: ref.label,
          color: ref.color ?? "#94A3B8",
        },
        select: { id: true },
      });
      resolved[`tag-group:${ref.slug}`] = {
        kind: "reuse",
        targetId: newGroup.id,
      };
      created.push({ type: "tag-group", slug: ref.slug, createdId: newGroup.id });
    } catch (err) {
      console.warn("[import] failed to create tag-group:", ref, err);
      resolved[`tag-group:${ref.slug}`] = { kind: "skip" };
      skipped.push({ type: "tag-group", slug: ref.slug });
    }
  }

  // ── Audit dos "reuse" e "skip" originais ─────────────────────────
  for (const ref of blueprint.refs) {
    const key = `${ref.type}:${ref.slug}`;
    const orig = mapping[key];
    if (!orig) continue;
    if (orig.kind === "reuse") {
      // Não duplica se já registrado em "created"
      if (!created.some((c) => c.type === ref.type && c.slug === ref.slug)) {
        reused.push({ type: ref.type, slug: ref.slug, targetId: orig.targetId });
      }
    } else if (orig.kind === "skip") {
      if (!skipped.some((s) => s.type === ref.type && s.slug === ref.slug)) {
        skipped.push({ type: ref.type, slug: ref.slug });
      }
    }
  }

  return { resolvedMapping: resolved, audit: { created, reused, skipped } };
}

/**
 * Persistência efetiva: cria nodes + edges com cuids novos. Resolver de
 * placeholders aplicado por node.
 */
async function persistNodesAndEdges(
  client: PrismaLike,
  args: {
    workflowId: string;
    blueprint: BlueprintV2;
    mapping: RefMapping;
  },
): Promise<{ nodesCreated: number; edgesCreated: number }> {
  const tempIdToReal = new Map<string, string>();

  for (const n of args.blueprint.nodes) {
    const realId = createId();
    tempIdToReal.set(n.id, realId);
    const resolvedData = resolvePlaceholdersV2(n.data, args.mapping) as Record<
      string,
      unknown
    >;
    await client.node.create({
      data: {
        id: realId,
        workflowId: args.workflowId,
        name: n.name ?? String(n.type),
        type: n.type as NodeType,
        position: n.position,
        data: resolvedData as never,
      },
    });
  }

  let edgesCreated = 0;
  for (const e of args.blueprint.edges) {
    const fromReal = tempIdToReal.get(e.fromNodeId);
    const toReal = tempIdToReal.get(e.toNodeId);
    if (!fromReal || !toReal) {
      console.warn(
        `[import] edge ${e.fromNodeId} → ${e.toNodeId} ignorada (ref node inválido)`,
      );
      continue;
    }
    try {
      await client.connection.create({
        data: {
          id: createId(),
          workflowId: args.workflowId,
          fromNodeId: fromReal,
          toNodeId: toReal,
          fromOutput: e.fromOutput ?? "main",
          toInput: e.toInput ?? "main",
        },
      });
      edgesCreated++;
    } catch (err) {
      console.warn("[import] failed to create connection:", e, err);
    }
  }

  return { nodesCreated: args.blueprint.nodes.length, edgesCreated };
}

/**
 * Helper exposto: dado um BlueprintV2 + lista de candidatos no destino,
 * gera o RefMapping inicial com auto-suggestions onde possível.
 * Usado tanto no preview (server) quanto pra inicializar o dialog.
 */
export type { RefMappingDecision };
