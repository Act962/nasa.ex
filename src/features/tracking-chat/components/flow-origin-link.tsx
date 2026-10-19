"use client";

import Link from "next/link";
import { PencilLineIcon } from "lucide-react";
import { readFlowOrigin } from "@/features/workflows/lib/flow-origin";
import { ATTENDANCE_FIXED_MESSAGE_KINDS } from "@/features/org-defaults/lib/attendance/labels";

// "Editar gatilho" (spec 0113, RF-20): mensagem de um passo de fluxo abre o passo no editor; a mensagem fixa
// do atendimento abre a configuração de atendimento do funil.
const FIXED_MESSAGE_KINDS: readonly string[] = ATTENDANCE_FIXED_MESSAGE_KINDS;

function editTargetOf(
  metadata: unknown,
  trackingId: string,
  canOpenAutomations: boolean,
): { href: string; label: string } | null {
  const origin = readFlowOrigin(metadata);
  if (origin) {
    // Sem permissão de Automações, o editor abriria proibido: o link nem aparece.
    if (!canOpenAutomations) return null;
    return {
      href: `/tracking/${trackingId}/workflows/${encodeURIComponent(origin.workflowId)}?node=${encodeURIComponent(origin.nodeId)}`,
      label: "Editar gatilho",
    };
  }
  const kind = metadata && typeof metadata === "object" ? (metadata as { kind?: unknown }).kind : null;
  if (typeof kind === "string" && FIXED_MESSAGE_KINDS.includes(kind)) {
    return { href: `/tracking/${trackingId}/settings?tab=chatbot-ia&iaTab=capabilities`, label: "Editar mensagem" };
  }
  return null;
}

export function FlowOriginLink({
  metadata,
  trackingId,
  canOpenAutomations,
}: {
  metadata: unknown;
  trackingId?: string;
  canOpenAutomations: boolean;
}) {
  const editTarget = trackingId ? editTargetOf(metadata, trackingId, canOpenAutomations) : null;
  if (!editTarget) return null;
  return (
    // Sem prefetch: abre em outra aba, e cada bolha visível buscaria a rota do editor à toa.
    <Link
      href={editTarget.href}
      prefetch={false}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
    >
      <PencilLineIcon className="size-3" />
      {editTarget.label}
    </Link>
  );
}
