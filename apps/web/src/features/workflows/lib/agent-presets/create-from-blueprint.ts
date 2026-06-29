/**
 * Cria um workflow completo (nodes + connections + tags se necessário)
 * a partir de um blueprint declarativo. Centraliza a lógica que estava
 * duplicada em `apply-default-presets.ts` e nos scripts standalone.
 *
 * Usado por:
 *   1. `applyDefaultAgentPresets` — aplica os 4 presets padrão na criação
 *      de tracking novo. Aceita filtro por slug.
 *   2. `workflow.createFromBlueprint` (oRPC) — Astro IA gera blueprint
 *      via LLM e passa pro client criar com 1 chamada.
 *   3. Scripts `create-proposta-contrato-all.ts`, `create-boas-vindas-nasa-route.ts`
 *      — setup manual. Migration opcional.
 *
 * Suporta placeholders `{{TAG:slug:label}}` em `node.data.action.tagsIds[]`
 * (e similares) — o resolver substitui pelo ID real da tag após
 * `findOrCreateTags`. Sem necessidade de o caller resolver IDs antes.
 */
import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";

export interface BlueprintNode {
  /**
   * ID declarativo do blueprint (não vai pro banco) — usado pra resolver
   * as edges. Pode ser legível ("trg-trigger", "send-msg-d3") ou um cuid.
   */
  id: string;
  type: NodeType | string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  /** Nome opcional — default = String(type). */
  name?: string;
}

export interface BlueprintEdge {
  fromNodeId: string;
  toNodeId: string;
  fromOutput?: string;
  toInput?: string;
}

export interface Blueprint {
  name: string;
  description?: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

export interface CreateFromBlueprintParams {
  trackingId: string;
  userId: string;
  blueprint: Blueprint;
  /** Default: true — blueprints novos exigem o engine novo. */
  agentMode?: boolean;
  /** Default: false — nasce pausado pra user revisar. */
  isActive?: boolean;
  /** Default: 60 — limite anti-loop. */
  maxRunsPerHour?: number;
  /** Default: null — sem pasta. */
  folderId?: string | null;
  /**
   * Mapa opcional `{slug → realTagId}` que o resolver usa pra substituir
   * placeholders `{{TAG:slug}}` nos node.data. Já deve estar resolvido
   * pelo caller (via `findOrCreateTags` do helper irmão).
   */
  tagMap?: Record<string, string>;
}

export interface CreateFromBlueprintResult {
  workflowId: string;
  nodesCreated: number;
  edgesCreated: number;
}

/**
 * Cria workflow + nodes + edges em transação. Pode rodar dentro de uma
 * transação maior (passa `tx`) ou abrir uma própria (passa `prisma`).
 */
export async function createWorkflowFromBlueprint(
  client: PrismaClient | Prisma.TransactionClient,
  params: CreateFromBlueprintParams,
): Promise<CreateFromBlueprintResult> {
  const workflowId = createId();

  await client.workflow.create({
    data: {
      id: workflowId,
      name: params.blueprint.name,
      description: params.blueprint.description,
      trackingId: params.trackingId,
      userId: params.userId,
      agentMode: params.agentMode ?? true,
      maxRunsPerHour: params.maxRunsPerHour ?? 60,
      isActive: params.isActive ?? false,
      ...(params.folderId ? { folderId: params.folderId } : {}),
    },
  });

  // Mapa de tempIds (do blueprint) → cuids reais. Edges referenciam
  // tempIds, precisamos resolver pros IDs criados nos nodes.
  const idMap = new Map<string, string>();

  for (const n of params.blueprint.nodes) {
    const realId = createId();
    idMap.set(n.id, realId);
    await client.node.create({
      data: {
        id: realId,
        workflowId,
        name: n.name ?? String(n.type),
        type: n.type as NodeType,
        position: n.position,
        // Substitui placeholders {{TAG:slug}} antes de salvar
        data: resolvePlaceholders(n.data, params.tagMap ?? {}) as never,
      },
    });
  }

  for (const e of params.blueprint.edges) {
    const fromReal = idMap.get(e.fromNodeId);
    const toReal = idMap.get(e.toNodeId);
    if (!fromReal || !toReal) {
      // Skip edges com refs inválidas — caller deve validar antes mas
      // não derrubamos a criação inteira por causa de 1 edge orfã.
      console.warn(
        `[create-from-blueprint] edge ${e.fromNodeId} → ${e.toNodeId} ignorada (id não encontrado)`,
      );
      continue;
    }
    await client.connection.create({
      data: {
        id: createId(),
        workflowId,
        fromNodeId: fromReal,
        toNodeId: toReal,
        fromOutput: e.fromOutput ?? "main",
        toInput: e.toInput ?? "main",
      },
    });
  }

  return {
    workflowId,
    nodesCreated: params.blueprint.nodes.length,
    edgesCreated: params.blueprint.edges.length,
  };
}

/**
 * Recursivamente substitui placeholders `{{TAG:slug}}` ou `{{TAG:slug:label}}`
 * em qualquer string nested do node.data. Útil quando o blueprint vem do
 * LLM e referencia tags por slug — depois de `findOrCreateTags`, sabemos
 * o ID real e injetamos aqui.
 *
 * Padrão completo:
 *   "{{TAG:proposta-pendente}}" → "cmpshp7gr0000oyxb38ej1uey"
 *   "{{TAG:proposta-pendente:Proposta Pendente}}" → idem (label só ajuda
 *   o LLM a se lembrar que tag é qual).
 */
function resolvePlaceholders(
  value: unknown,
  tagMap: Record<string, string>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{TAG:([a-z0-9-]+)(?::[^}]*)?\}\}/gi, (_, slug) => {
      return tagMap[slug] ?? `<<TAG_NOT_RESOLVED:${slug}>>`;
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolvePlaceholders(v, tagMap));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolvePlaceholders(v, tagMap);
    }
    return out;
  }
  return value;
}
