"use client";

import { MessageSquare, Tag, Users, Workflow } from "lucide-react";

/** Mensagem inicial, funil, tags e leads que chegaram no Órbita por este anúncio (spec 0128, RF-16). */

interface AdLeadOriginView {
  leadsCount: number;
  trackings: { name: string; count: number }[];
  tags: { name: string; count: number }[];
}

export function AdOriginLine({
  initialMessage,
  leadOrigin,
  conversations,
}: {
  initialMessage: string | null;
  leadOrigin: AdLeadOriginView | null;
  conversations: number;
}) {
  if (!initialMessage && !leadOrigin && conversations === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
      {initialMessage && (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1" title={`Mensagem inicial: ${initialMessage}`}>
          <MessageSquare className="size-3 shrink-0" />
          <span className="truncate">&ldquo;{initialMessage}&rdquo;</span>
        </span>
      )}
      {leadOrigin?.trackings.length ? (
        <span className="inline-flex items-center gap-1" title="Funil do Órbita onde os leads deste anúncio caíram">
          <Workflow className="size-3" />
          {leadOrigin.trackings.map((tracking) => tracking.name).join(", ")}
        </span>
      ) : null}
      {leadOrigin?.tags.length ? (
        <span className="inline-flex items-center gap-1" title="Tags mais comuns dos leads deste anúncio">
          <Tag className="size-3" />
          {leadOrigin.tags.map((tag) => tag.name).join(", ")}
        </span>
      ) : null}
      <span
        className="inline-flex items-center gap-1"
        title="Leads que chegaram no Órbita por este anúncio, comparado com as conversas que a Meta contou"
      >
        <Users className="size-3" />
        {leadOrigin?.leadsCount ?? 0} {leadOrigin?.leadsCount === 1 ? "lead" : "leads"} no Órbita
        {conversations > 0 ? ` de ${conversations} conversas` : ""}
      </span>
    </div>
  );
}
