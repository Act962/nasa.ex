"use client";

import { useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  boardLeadsChannelName,
  type BoardLeadsEvents,
} from "@/features/leads/realtime/board-leads-channel";
import { useRealtimeChannel } from "@/lib/realtime/use-realtime-channel";
import { orpc } from "@/lib/orpc";

const COALESCE_MS = 250;
const MAX_DELAY_MS = 2000;

/**
 * Mantém os badges de tag da lista de conversas (lead-box) em sincronia com
 * o board. Assina o canal do board do tracking selecionado e, quando uma tag
 * é adicionada/removida (por automação ou pelo webhook do botão Uazapi),
 * invalida `tags.getTagByLead` — a query que o lead-box usa pra renderizar as
 * tags (com staleTime longo, por isso o invalidate explícito).
 */
export function useTrackingChatRealtimeSync({
  trackingId,
}: {
  trackingId: string;
}) {
  const queryClient = useQueryClient();

  const pendingTagLeadRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    debounceTimerRef.current = null;
    maxDelayTimerRef.current = null;

    const tagLeadSnapshot = new Set(pendingTagLeadRef.current);
    pendingTagLeadRef.current = new Set();

    for (const leadId of tagLeadSnapshot) {
      queryClient.invalidateQueries({
        queryKey: orpc.tags.getTagByLead.queryKey({ input: { leadId } }),
      });
    }
  }, [queryClient]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, COALESCE_MS);
    if (!maxDelayTimerRef.current) {
      maxDelayTimerRef.current = setTimeout(flush, MAX_DELAY_MS);
    }
  }, [flush]);

  const handlers = useMemo(
    () => ({
      "lead-changed": (raw: unknown) => {
        const data = raw as BoardLeadsEvents["lead-changed"];
        if (!data.fields.includes("tag")) return;
        pendingTagLeadRef.current.add(data.leadId);
        scheduleFlush();
      },
    }),
    [scheduleFlush],
  );

  useRealtimeChannel(
    trackingId ? boardLeadsChannelName(trackingId) : null,
    handlers,
    { enabled: !!trackingId },
  );
}
