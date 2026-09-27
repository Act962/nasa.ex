"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";

/**
 * Mantém as telas do Forge em dia quando a escrita veio de fora delas — hoje,
 * do ASTRO (spec 0032, RF-11 e D-5). A proposta criada pelo widget só aparecia
 * depois de recarregar a página.
 */

const PROPOSALS_CHANGED_EVENT = "forge:proposals-changed";

export function useForgeRealtime(): void {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const organizationId = session?.session.activeOrganizationId;

  useEffect(() => {
    if (!organizationId) return;
    const channel = pusherClient.subscribe(`private-org-${organizationId}`);
    const invalidateProposals = () => {
      queryClient.invalidateQueries({ queryKey: orpc.forge.proposals.key() });
      queryClient.invalidateQueries({ queryKey: orpc.forge.dashboard.key() });
    };
    channel.bind(PROPOSALS_CHANGED_EVENT, invalidateProposals);
    return () => {
      channel.unbind(PROPOSALS_CHANGED_EVENT, invalidateProposals);
      pusherClient.unsubscribe(`private-org-${organizationId}`);
    };
  }, [organizationId, queryClient]);
}
