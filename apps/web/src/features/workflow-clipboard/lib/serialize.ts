/**
 * Serializa Workflow + Nodes + Connections num BlueprintV2 portável.
 *
 * Pipeline:
 *   1. Carrega nodes (+ connections) do DB.
 *   2. Roda `extractRefs` pra coletar todos os IDs referenciados por tipo.
 *   3. Carrega labels/slugs/colors via prisma pra cada tipo (batch).
 *   4. Constrói `RefLookup` { [type]: { [id]: BlueprintRef } }.
 *   5. Roda `injectPlaceholders` em cada node — substitui IDs por
 *      `{{TYPE:slug:label}}` no data.
 *   6. Retorna BlueprintV2 com metadata + refs lista.
 */
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { extractRefs, type ExtractedNode } from "./ref-extractor";
import { injectPlaceholders, type RefLookup } from "./ref-injector";
import type {
  BlueprintRef,
  BlueprintV2,
  BlueprintV2Edge,
  BlueprintV2Node,
  RefType,
} from "./types";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface SerializeFullWorkflowParams {
  workflowId: string;
  organizationId: string;
}

export interface SerializeNodeSelectionParams {
  workflowId: string;
  nodeIds: string[];
  organizationId: string;
}

export interface SerializeResult {
  blueprint: BlueprintV2;
  /** Refs que apontaram pra IDs que não existem mais no DB. UI pode avisar. */
  brokenRefs: Array<{ refType: RefType; id: string }>;
}

/**
 * Serializa workflow completo: metadata + todos os nodes + todas as
 * connections.
 */
export async function serializeFullWorkflow(
  client: PrismaLike,
  params: SerializeFullWorkflowParams,
): Promise<SerializeResult> {
  const workflow = await client.workflow.findUnique({
    where: { id: params.workflowId },
    select: {
      id: true,
      name: true,
      description: true,
      agentMode: true,
      maxRunsPerHour: true,
      tracking: { select: { id: true, name: true } },
      nodes: {
        select: { id: true, type: true, name: true, position: true, data: true },
      },
      connections: {
        select: {
          fromNodeId: true,
          toNodeId: true,
          fromOutput: true,
          toInput: true,
        },
      },
    },
  });
  if (!workflow) throw new Error("workflow_not_found");

  const organization = await client.organization.findUnique({
    where: { id: params.organizationId },
    select: { name: true },
  });

  const extractInput: ExtractedNode[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data ?? {}) as Record<string, unknown>,
  }));

  const { lookup, broken } = await buildLookup(client, params.organizationId, extractInput);
  const refs = lookupToRefsList(lookup);

  const nodesOut: BlueprintV2Node[] = workflow.nodes.map((n) => ({
    id: n.id, // mantém o cuid original como tempId no blueprint
    type: n.type,
    name: n.name,
    position: n.position as { x: number; y: number },
    data: injectPlaceholders(
      n.type,
      (n.data ?? {}) as Record<string, unknown>,
      lookup,
    ),
  }));

  const edgesOut: BlueprintV2Edge[] = workflow.connections.map((c) => ({
    fromNodeId: c.fromNodeId,
    toNodeId: c.toNodeId,
    ...(c.fromOutput && c.fromOutput !== "main" && { fromOutput: c.fromOutput }),
    ...(c.toInput && c.toInput !== "main" && { toInput: c.toInput }),
  }));

  const blueprint: BlueprintV2 = {
    formatVersion: 1,
    kind: "full-workflow",
    workflow: {
      name: workflow.name,
      description: workflow.description ?? undefined,
      agentMode: workflow.agentMode,
      maxRunsPerHour: workflow.maxRunsPerHour ?? undefined,
    },
    source: {
      organizationName: organization?.name,
      trackingName: workflow.tracking?.name,
      workflowName: workflow.name,
      exportedAt: new Date().toISOString(),
    },
    nodes: nodesOut,
    edges: edgesOut,
    refs,
  };

  return { blueprint, brokenRefs: broken };
}

/**
 * Serializa seleção parcial — só os nodes pedidos + edges que ligam dois
 * desses nodes (edges "pra fora" são descartadas).
 */
export async function serializeNodeSelection(
  client: PrismaLike,
  params: SerializeNodeSelectionParams,
): Promise<SerializeResult> {
  if (params.nodeIds.length === 0) {
    throw new Error("nodeIds vazio");
  }

  const workflow = await client.workflow.findUnique({
    where: { id: params.workflowId },
    select: {
      id: true,
      name: true,
      tracking: { select: { id: true, name: true } },
      nodes: {
        where: { id: { in: params.nodeIds } },
        select: { id: true, type: true, name: true, position: true, data: true },
      },
      connections: {
        where: {
          AND: [
            { fromNodeId: { in: params.nodeIds } },
            { toNodeId: { in: params.nodeIds } },
          ],
        },
        select: {
          fromNodeId: true,
          toNodeId: true,
          fromOutput: true,
          toInput: true,
        },
      },
    },
  });
  if (!workflow) throw new Error("workflow_not_found");
  if (workflow.nodes.length === 0) throw new Error("nodes_not_found");

  const organization = await client.organization.findUnique({
    where: { id: params.organizationId },
    select: { name: true },
  });

  const extractInput: ExtractedNode[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data ?? {}) as Record<string, unknown>,
  }));

  const { lookup, broken } = await buildLookup(client, params.organizationId, extractInput);
  const refs = lookupToRefsList(lookup);

  const nodesOut: BlueprintV2Node[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    name: n.name,
    position: n.position as { x: number; y: number },
    data: injectPlaceholders(
      n.type,
      (n.data ?? {}) as Record<string, unknown>,
      lookup,
    ),
  }));

  const edgesOut: BlueprintV2Edge[] = workflow.connections.map((c) => ({
    fromNodeId: c.fromNodeId,
    toNodeId: c.toNodeId,
    ...(c.fromOutput && c.fromOutput !== "main" && { fromOutput: c.fromOutput }),
    ...(c.toInput && c.toInput !== "main" && { toInput: c.toInput }),
  }));

  const blueprint: BlueprintV2 = {
    formatVersion: 1,
    kind: "node-selection",
    source: {
      organizationName: organization?.name,
      trackingName: workflow.tracking?.name,
      workflowName: workflow.name,
      exportedAt: new Date().toISOString(),
    },
    nodes: nodesOut,
    edges: edgesOut,
    refs,
  };

  return { blueprint, brokenRefs: broken };
}

/**
 * Resolve labels para cada ID referenciado, organizados por tipo.
 * Devolve também a lista de refs que não existem mais (broken).
 */
async function buildLookup(
  client: PrismaLike,
  organizationId: string,
  nodes: ExtractedNode[],
): Promise<{
  lookup: RefLookup;
  broken: Array<{ refType: RefType; id: string }>;
}> {
  const { byType } = extractRefs(nodes);
  const lookup: RefLookup = {};
  const broken: Array<{ refType: RefType; id: string }> = [];

  // Helper pra anotar broken IDs depois de cada batch.
  const markBroken = (refType: RefType, expected: Set<string>, found: Set<string>) => {
    for (const id of expected) {
      if (!found.has(id)) broken.push({ refType, id });
    }
  };

  // ── Tags ────────────────────────────────────────────────────────
  if (byType.tag.size > 0) {
    const rows = await client.tag.findMany({
      where: { id: { in: [...byType.tag] }, organizationId },
      select: { id: true, slug: true, name: true, color: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "tag",
        slug: r.slug ?? slugify(r.name),
        label: r.name,
        color: r.color,
        originalId: r.id,
      };
    }
    lookup.tag = map;
    markBroken("tag", byType.tag, new Set(rows.map((r) => r.id)));
  }

  // ── TagGroups ───────────────────────────────────────────────────
  if (byType["tag-group"].size > 0) {
    const rows = await client.tagGroup.findMany({
      where: { id: { in: [...byType["tag-group"]] }, organizationId },
      select: { id: true, name: true, color: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "tag-group",
        slug: slugify(r.name),
        label: r.name,
        color: r.color,
        originalId: r.id,
      };
    }
    lookup["tag-group"] = map;
    markBroken("tag-group", byType["tag-group"], new Set(rows.map((r) => r.id)));
  }

  // ── Statuses (do tracking — não tem organizationId direto) ──────
  if (byType.status.size > 0) {
    const rows = await client.status.findMany({
      where: { id: { in: [...byType.status] } },
      select: { id: true, name: true, color: true, trackingId: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "status",
        slug: slugify(r.name),
        label: r.name,
        color: r.color,
        originalId: r.id,
        meta: { trackingId: r.trackingId },
      };
    }
    lookup.status = map;
    markBroken("status", byType.status, new Set(rows.map((r) => r.id)));
  }

  // ── Columns ─────────────────────────────────────────────────────
  // "column" no DSL do workflow-clipboard é o mesmo que "status" no schema
  // (kanban column = Status com trackingId). Mantemos o ref type "column"
  // pra compat com placeholders legados, mas resolvemos contra prisma.status.
  if (byType.column.size > 0) {
    const rows = await client.status.findMany({
      where: { id: { in: [...byType.column] } },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "column",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup.column = map;
    markBroken("column", byType.column, new Set(rows.map((r) => r.id)));
  }

  // ── Users (membros da org) ──────────────────────────────────────
  if (byType.user.size > 0) {
    const rows = await client.user.findMany({
      where: { id: { in: [...byType.user] } },
      select: { id: true, name: true, email: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "user",
        slug: slugify(r.email),
        label: r.name,
        originalId: r.id,
        meta: { email: r.email },
      };
    }
    lookup.user = map;
    markBroken("user", byType.user, new Set(rows.map((r) => r.id)));
  }

  // ── Trackings (alvo do MOVE_LEAD) ───────────────────────────────
  if (byType.tracking.size > 0) {
    const rows = await client.tracking.findMany({
      where: { id: { in: [...byType.tracking] }, organizationId },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "tracking",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup.tracking = map;
    markBroken("tracking", byType.tracking, new Set(rows.map((r) => r.id)));
  }

  // ── Forms ───────────────────────────────────────────────────────
  if (byType.form.size > 0) {
    const rows = await client.form.findMany({
      where: { id: { in: [...byType.form] }, organizationId },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "form",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup.form = map;
    markBroken("form", byType.form, new Set(rows.map((r) => r.id)));
  }

  // ── Agendas ─────────────────────────────────────────────────────
  if (byType.agenda.size > 0) {
    const rows = await client.agenda.findMany({
      where: { id: { in: [...byType.agenda] }, organizationId },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "agenda",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup.agenda = map;
    markBroken("agenda", byType.agenda, new Set(rows.map((r) => r.id)));
  }

  // ── Forge products (produtos vendáveis) ─────────────────────────
  if (byType["forge-product"].size > 0) {
    const rows = await client.forgeProduct.findMany({
      where: { id: { in: [...byType["forge-product"]] }, organizationId },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "forge-product",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup["forge-product"] = map;
    markBroken("forge-product", byType["forge-product"], new Set(rows.map((r) => r.id)));
  }

  // ── Forge contract templates ────────────────────────────────────
  if (byType["forge-contract-template"].size > 0) {
    const rows = await client.forgeContractTemplate.findMany({
      where: { id: { in: [...byType["forge-contract-template"]] }, organizationId },
      select: { id: true, name: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "forge-contract-template",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
      };
    }
    lookup["forge-contract-template"] = map;
    markBroken(
      "forge-contract-template",
      byType["forge-contract-template"],
      new Set(rows.map((r) => r.id)),
    );
  }

  // ── Linnker pages ───────────────────────────────────────────────
  if (byType["linnker-page"].size > 0) {
    const rows = await (client as any).linnker?.findMany?.({
      where: { id: { in: [...byType["linnker-page"]] }, organizationId },
      select: { id: true, name: true },
    });
    if (Array.isArray(rows)) {
      const map: Record<string, BlueprintRef> = {};
      for (const r of rows as Array<{ id: string; name: string }>) {
        map[r.id] = {
          type: "linnker-page",
          slug: slugify(r.name),
          label: r.name,
          originalId: r.id,
        };
      }
      lookup["linnker-page"] = map;
      markBroken(
        "linnker-page",
        byType["linnker-page"],
        new Set(rows.map((r: { id: string }) => r.id)),
      );
    }
  }

  // ── Nbox files ──────────────────────────────────────────────────
  if (byType["nbox-file"].size > 0) {
    const rows = await (client as any).nboxFile?.findMany?.({
      where: { id: { in: [...byType["nbox-file"]] }, organizationId },
      select: { id: true, name: true },
    });
    if (Array.isArray(rows)) {
      const map: Record<string, BlueprintRef> = {};
      for (const r of rows as Array<{ id: string; name: string }>) {
        map[r.id] = {
          type: "nbox-file",
          slug: slugify(r.name),
          label: r.name,
          originalId: r.id,
        };
      }
      lookup["nbox-file"] = map;
      markBroken(
        "nbox-file",
        byType["nbox-file"],
        new Set(rows.map((r: { id: string }) => r.id)),
      );
    }
  }

  // ── NASA Route courses ──────────────────────────────────────────
  if (byType["nasa-route-course"].size > 0) {
    const rows = await (client as any).nasaRouteCourse?.findMany?.({
      where: { id: { in: [...byType["nasa-route-course"]] }, organizationId },
      select: { id: true, title: true },
    });
    if (Array.isArray(rows)) {
      const map: Record<string, BlueprintRef> = {};
      for (const r of rows as Array<{ id: string; title: string }>) {
        map[r.id] = {
          type: "nasa-route-course",
          slug: slugify(r.title),
          label: r.title,
          originalId: r.id,
        };
      }
      lookup["nasa-route-course"] = map;
      markBroken(
        "nasa-route-course",
        byType["nasa-route-course"],
        new Set(rows.map((r: { id: string }) => r.id)),
      );
    }
  }

  // ── Workflows (CALL_WORKFLOW) ───────────────────────────────────
  if (byType.workflow.size > 0) {
    const rows = await client.workflow.findMany({
      where: { id: { in: [...byType.workflow] } },
      select: { id: true, name: true, trackingId: true },
    });
    const map: Record<string, BlueprintRef> = {};
    for (const r of rows) {
      map[r.id] = {
        type: "workflow",
        slug: slugify(r.name),
        label: r.name,
        originalId: r.id,
        meta: { trackingId: r.trackingId },
      };
    }
    lookup.workflow = map;
    markBroken("workflow", byType.workflow, new Set(rows.map((r) => r.id)));
  }

  return { lookup, broken };
}

/** Achata o RefLookup numa lista única (dedup por slug+type). */
function lookupToRefsList(lookup: RefLookup): BlueprintRef[] {
  const seen = new Set<string>();
  const out: BlueprintRef[] = [];
  for (const refType of Object.keys(lookup) as RefType[]) {
    const map = lookup[refType] ?? {};
    for (const ref of Object.values(map)) {
      const key = `${ref.type}:${ref.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  // Ordena pra output estável: por tipo, depois por slug.
  out.sort((a, b) =>
    a.type === b.type ? a.slug.localeCompare(b.slug) : a.type.localeCompare(b.type),
  );
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
