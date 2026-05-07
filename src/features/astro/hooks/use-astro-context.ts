"use client";

import { usePathname, useParams } from "next/navigation";
import { useMemo } from "react";
import type { AstroRouteContext } from "@/features/astro/schemas/chat-message";

/**
 * Lê a rota atual e devolve o snapshot que vai como `context` no body do
 * `useChat`. Mantemos isso intencionalmente burrinho — só pega IDs visíveis
 * em params/segments. Nada de ler o banco aqui.
 *
 * Convenções de rota inferidas:
 *   - `/tracking-chat/:conversationId` → conversationId
 *   - `/leads/:leadId` ou rotas com leadId em params
 *   - `/workspace/:workspaceId` (se houver no app)
 *   - `/agendas/:agendaId`
 *   - `/insights/:trackingId` etc — nem todos batem com algo do dominio,
 *     mas no MVP o ASTRO usa só pathname + IDs como dica.
 */
export function useAstroContext(): AstroRouteContext {
  const pathname = usePathname();
  const params = useParams();

  return useMemo<AstroRouteContext>(() => {
    const ctx: AstroRouteContext = { pathname };

    const pick = (k: string) => {
      const v = (params as Record<string, unknown>)[k];
      return typeof v === "string" ? v : undefined;
    };

    const conv = pick("conversationId");
    const lead = pick("leadId");
    const tracking = pick("trackingId");
    const workspace = pick("workspaceId");
    const action = pick("actionId");

    if (conv) ctx.conversationId = conv;
    if (lead) ctx.leadId = lead;
    if (tracking) ctx.trackingId = tracking;
    if (workspace) ctx.workspaceId = workspace;
    if (action) ctx.actionId = action;

    return ctx;
  }, [pathname, params]);
}
