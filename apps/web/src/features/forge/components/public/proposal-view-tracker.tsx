"use client";

import { useEffect, useRef } from "react";
import { useTrackProposalView } from "../../hooks/use-forge";
import { authClient } from "@/lib/auth-client";

interface ProposalViewTrackerProps {
  token: string;
  responsibleId: string;
  createdById: string;
}

export function ProposalViewTracker({
  token,
  responsibleId,
  createdById,
}: ProposalViewTrackerProps) {
  const { mutate: trackView } = useTrackProposalView();
  const { data: session, isPending } = authClient.useSession();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Aguardar autenticação carregar para evitar rastreamento falso do proprietário
    if (isPending) return;

    // Evitar execução duplicada no StrictMode ou múltiplos renders
    if (hasTracked.current) return;

    // Verificar se já foi rastreado nesta sessão
    const sessionKey = `pv_${token}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey))
      return;

    // Verificar se o usuário atual é o criador ou responsável
    const currentUserId = session?.user?.id;
    const isOwner =
      !!currentUserId &&
      (currentUserId === responsibleId || currentUserId === createdById);

    if (!isOwner) {
      trackView({ token });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(sessionKey, "true");
      }
      hasTracked.current = true;
    }
  }, [token, responsibleId, createdById, session, trackView, isPending]);

  return null;
}
