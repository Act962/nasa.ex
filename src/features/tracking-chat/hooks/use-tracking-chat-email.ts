import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Hooks do canal E-mail do Tracking Chat (spec 0030). */

export function useLeadEmailThreads(trackingId: string | null, enabled = true) {
  const query = useQuery({
    ...orpc.trackingChatEmail.threads.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: enabled && Boolean(trackingId),
    // Lido direto do Gmail (D-1): sem polling agressivo, atualiza ao focar.
    staleTime: 60_000,
    retry: false,
  });
  return {
    threads: query.data?.threads ?? [],
    isPartial: query.data?.isPartial ?? false,
    unansweredLeadCount: query.data?.unansweredLeadCount ?? 0,
    hasLeadEmails: query.data?.hasLeadEmails ?? true,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Se a organização tem Gmail conectado — cor e contador do ícone E-mail. */
export function useGmailStatus() {
  const query = useQuery({
    ...orpc.trackingChatEmail.status.queryOptions({ input: {} }),
    staleTime: 5 * 60_000,
  });
  return {
    isConnected: query.data?.connected ?? false,
    canSend: query.data?.canSend ?? false,
    mailboxEmail: query.data?.mailboxEmail ?? null,
    isLoading: query.isLoading,
  };
}

export function useLeadEmailThread(trackingId: string | null, threadId: string | null) {
  const query = useQuery({
    ...orpc.trackingChatEmail.thread.queryOptions({
      input: { trackingId: trackingId ?? "", threadId: threadId ?? "" },
    }),
    enabled: Boolean(trackingId && threadId),
    retry: false,
  });
  return { thread: query.data ?? null, isLoading: query.isLoading, error: query.error };
}

export function useTrackingLeadsWithEmail(trackingId: string | null, enabled = true) {
  const query = useQuery({
    ...orpc.trackingChatEmail.leads.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: enabled && Boolean(trackingId),
  });
  return { leads: query.data ?? [], isLoading: query.isLoading };
}

export function useSendLeadEmail() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trackingChatEmail.send.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.trackingChatEmail.key() });
      },
    }),
  );
}
