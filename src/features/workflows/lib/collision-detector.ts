/**
 * Detector de colisão entre workflows. Antes de ativar um workflow no
 * Modo Agente IA, verifica se há outros workflows ATIVOS na mesma org
 * que escutam o MESMO trigger e mexem no MESMO recurso (tag, status, lead).
 *
 * Não bloqueia ativação — só alerta o user. Se ele confirmar consciente,
 * deixa rodar (cenário válido: 2 workflows que fazem tarefas independentes
 * no mesmo trigger).
 *
 * Heurística (Fase 1):
 *  - Mesmo trigger NodeType
 *  - Pra LEAD_TAGGED: mesma tag em `data.action.tagIds`
 *  - Pra MOVE_LEAD_STATUS: mesmo statusId
 *  - Pra qualquer trigger: trackingId igual (ou ambos org-wide)
 *
 * Fase 5 vai refinar com análise dos ACTIONS também (2 workflows que
 * escrevem no mesmo lead.tag = colisão real).
 */
import prisma from "@/lib/prisma";

export type CollisionWarning = {
  workflowId: string;
  workflowName: string;
  conflictType:
    | "same-trigger"
    | "same-trigger-same-tag"
    | "same-trigger-same-status"
    | "same-trigger-same-tracking";
  description: string;
};

type TriggerNodeData = {
  type: string;
  data: Record<string, unknown> | null;
};

function unwrapAction(data: Record<string, unknown> | null | undefined) {
  const d = data ?? {};
  if (d.action && typeof d.action === "object" && !Array.isArray(d.action)) {
    return d.action as Record<string, unknown>;
  }
  return d;
}

/**
 * Roda detecção de colisão pra um workflow específico contra os demais ativos
 * na mesma org. Retorna lista de warnings (vazio = seguro pra ativar).
 */
export async function detectCollisions(input: {
  workflowId: string;
  organizationId: string;
  trackingId: string | null;
  triggers: TriggerNodeData[];
}): Promise<CollisionWarning[]> {
  const { workflowId, organizationId, trackingId, triggers } = input;
  if (triggers.length === 0) return [];

  const triggerTypes = Array.from(new Set(triggers.map((t) => t.type)));

  // Busca workflows ativos da org que escutam algum dos mesmos triggers
  const candidates = await prisma.workflow.findMany({
    where: {
      id: { not: workflowId },
      isActive: true,
      tracking: { organizationId },
      // Limita o scan: mesmo tracking ou ambos org-wide
      trackingId: trackingId,
      nodes: {
        some: {
          type: {
            in: triggerTypes as never[],
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      nodes: {
        where: { type: { in: triggerTypes as never[] } },
        select: { type: true, data: true },
      },
    },
  });

  const warnings: CollisionWarning[] = [];

  for (const cand of candidates) {
    for (const myTrigger of triggers) {
      for (const otherTrigger of cand.nodes) {
        if (otherTrigger.type !== myTrigger.type) continue;

        const myData = unwrapAction(myTrigger.data);
        const otherData = unwrapAction(
          otherTrigger.data as Record<string, unknown> | null,
        );

        if (myTrigger.type === "LEAD_TAGGED") {
          const myTags = Array.isArray(myData.tagIds) ? myData.tagIds : [];
          const otherTags = Array.isArray(otherData.tagIds) ? otherData.tagIds : [];
          const overlap = (myTags as unknown[]).filter((t) =>
            (otherTags as unknown[]).includes(t),
          );
          if (overlap.length > 0) {
            warnings.push({
              workflowId: cand.id,
              workflowName: cand.name,
              conflictType: "same-trigger-same-tag",
              description: `"${cand.name}" também escuta tag(s) ${overlap.join(", ")} e pode disparar junto.`,
            });
          }
        } else if (myTrigger.type === "MOVE_LEAD_STATUS") {
          if (
            typeof myData.statusId === "string" &&
            myData.statusId === otherData.statusId
          ) {
            warnings.push({
              workflowId: cand.id,
              workflowName: cand.name,
              conflictType: "same-trigger-same-status",
              description: `"${cand.name}" também escuta movimentação para o mesmo status.`,
            });
          }
        } else {
          // Mesmo trigger sem critério granular — warning genérico
          warnings.push({
            workflowId: cand.id,
            workflowName: cand.name,
            conflictType: trackingId
              ? "same-trigger-same-tracking"
              : "same-trigger",
            description: `"${cand.name}" usa o mesmo gatilho (${myTrigger.type}) no mesmo escopo.`,
          });
        }
      }
    }
  }

  // Dedupe por (workflowId, conflictType)
  const dedup = new Map<string, CollisionWarning>();
  for (const w of warnings) {
    const k = `${w.workflowId}:${w.conflictType}`;
    if (!dedup.has(k)) dedup.set(k, w);
  }
  return Array.from(dedup.values());
}
