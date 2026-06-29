"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  boardLeadsChannelName,
  type BoardLeadsEvents,
} from "@/features/leads/realtime/board-leads-channel";
import { useRealtimeChannel } from "@/lib/realtime/use-realtime-channel";
import { orpc } from "@/lib/orpc";

const COALESCE_MS = 250;
const MAX_DELAY_MS = 2000;

export function useBoardRealtimeSync({ trackingId }: { trackingId: string }) {
  const queryClient = useQueryClient();

  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );
  useEffect(() => {
    const onVis = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const pendingStatusRef = useRef<Set<string>>(new Set());
  const pendingLeadDetailRef = useRef<Set<string>>(new Set());
  // Leads cujas tags mudaram — o badge de tags do card vem de uma query
  // própria (`tags.getTagByLead`, keyed por leadId), não de listLeadsByStatus.
  const pendingTagLeadRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    debounceTimerRef.current = null;
    maxDelayTimerRef.current = null;

    const statusSnapshot = new Set(pendingStatusRef.current);
    const leadDetailSnapshot = new Set(pendingLeadDetailRef.current);
    const tagLeadSnapshot = new Set(pendingTagLeadRef.current);
    pendingStatusRef.current = new Set();
    pendingLeadDetailRef.current = new Set();
    pendingTagLeadRef.current = new Set();

    if (statusSnapshot.size) {
      queryClient.invalidateQueries({
        queryKey: orpc.status.getMany.queryKey({ input: { trackingId } }),
      });

      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "leads.listLeadsByStatus" &&
          q.queryKey[2] === trackingId &&
          statusSnapshot.has(q.queryKey[1] as string),
      });
    }

    for (const leadId of leadDetailSnapshot) {
      queryClient.invalidateQueries({
        queryKey: orpc.leads.get.queryKey({ input: { id: leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.leads.listHistoric.queryKey({ input: { leadId } }),
      });
    }

    for (const leadId of tagLeadSnapshot) {
      queryClient.invalidateQueries({
        queryKey: orpc.tags.getTagByLead.queryKey({ input: { leadId } }),
      });
    }
  }, [queryClient, trackingId]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, COALESCE_MS);
    if (!maxDelayTimerRef.current) {
      maxDelayTimerRef.current = setTimeout(flush, MAX_DELAY_MS);
    }
  }, [flush]);

  // Handlers estáveis: só acumulam nos refs e agendam o flush coalescido.
  // Mantêm a mesma semântica do loop sobre `data` da versão Inngest.
  const handlers = useMemo(
    () => ({
      "lead-created": (raw: unknown) => {
        const data = raw as BoardLeadsEvents["lead-created"];
        pendingStatusRef.current.add(data.statusId);
        scheduleFlush();
      },
      "lead-moved": (raw: unknown) => {
        const data = raw as BoardLeadsEvents["lead-moved"];
        if (data.fromStatusId) pendingStatusRef.current.add(data.fromStatusId);
        pendingStatusRef.current.add(data.toStatusId);
        pendingLeadDetailRef.current.add(data.leadId);
        scheduleFlush();
      },
      "lead-changed": (raw: unknown) => {
        const data = raw as BoardLeadsEvents["lead-changed"];
        pendingStatusRef.current.add(data.statusId);
        pendingLeadDetailRef.current.add(data.leadId);
        if (data.fields.includes("tag")) {
          pendingTagLeadRef.current.add(data.leadId);
        }
        scheduleFlush();
      },
      "lead-closed": (raw: unknown) => {
        const data = raw as BoardLeadsEvents["lead-closed"];
        pendingStatusRef.current.add(data.statusId);
        pendingLeadDetailRef.current.add(data.leadId);
        scheduleFlush();
      },
    }),
    [scheduleFlush],
  );

  useRealtimeChannel(
    trackingId ? boardLeadsChannelName(trackingId) : null,
    handlers,
    { enabled: !!trackingId && isVisible },
  );

  // Ao voltar a aba a ficar visível, revalida o board (perdemos eventos
  // enquanto a subscription estava desligada).
  useEffect(() => {
    if (!isVisible) return;
    queryClient.invalidateQueries({
      queryKey: orpc.status.getMany.queryKey({ input: { trackingId } }),
    });
  }, [isVisible, queryClient, trackingId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    };
  }, []);
}
