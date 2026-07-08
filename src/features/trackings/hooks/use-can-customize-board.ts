"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";

/**
 * Quem pode personalizar o board: Owner/Admin da organização OU Owner do
 * tracking (TrackingParticipant.role = "OWNER"). Espelha o gate do procedure
 * `updateCardConfig` — aqui só decide a visibilidade do botão (o servidor é a
 * fronteira de segurança).
 */
export function useCanCustomizeBoard(trackingId: string | null | undefined) {
  const { isMaster, isAdmin } = useOrgRole();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const isOrgAdmin = isMaster || isAdmin;

  const { data: participants } = useQuery({
    ...orpc.tracking.listParticipants.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    // Só busca participantes quando precisa desempatar (não é org admin).
    enabled: !!trackingId && !isOrgAdmin && !!userId,
    staleTime: 5 * 60_000,
  });

  const isTrackingOwner = !!participants?.participants?.some(
    (participant) => participant.userId === userId && participant.role === "OWNER",
  );

  return isOrgAdmin || isTrackingOwner;
}
