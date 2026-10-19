"use client";

import Link from "next/link";
import { PencilLineIcon } from "lucide-react";
import { readFlowOrigin } from "@/features/workflows/lib/flow-origin";

// "Editar gatilho" (spec 0113, RF-20): mensagem de um passo de fluxo abre o passo no editor; a mensagem fixa
// do atendimento abre a configuração de atendimento do funil.
const ATTENDANCE_FIXED_MESSAGE_KINDS = ["attendance_holding", "attendance_handoff"];

function editHrefOf(metadata: unknown, trackingId: string): { href: string; label: string } | null {
  const origin = readFlowOrigin(metadata);
  if (origin) {
    return {
      href: `/tracking/${trackingId}/workflows/${origin.workflowId}?node=${encodeURIComponent(origin.nodeId)}`,
      label: "Editar gatilho",
    };
  }
  const kind = metadata && typeof metadata === "object" ? (metadata as { kind?: unknown }).kind : null;
  if (typeof kind === "string" && ATTENDANCE_FIXED_MESSAGE_KINDS.includes(kind)) {
    return { href: `/tracking/${trackingId}/settings?tab=chatbot-ia&iaTab=capabilities`, label: "Editar mensagem" };
  }
  return null;
}

export function FlowOriginLink({ metadata, trackingId }: { metadata: unknown; trackingId?: string }) {
  const edit = trackingId ? editHrefOf(metadata, trackingId) : null;
  if (!edit) return null;
  return (
    <Link
      href={edit.href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
    >
      <PencilLineIcon className="size-3" />
      {edit.label}
    </Link>
  );
}
