"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { fetchBoardLeadsRealtimeToken } from "../realtime/actions";

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

  const lastSeenIdxRef = useRef<number>(0);
  const pendingStatusRef = useRef<Set<string>>(new Set());
  const pendingLeadDetailRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    debounceTimerRef.current = null;
    maxDelayTimerRef.current = null;

    const statusSnapshot = new Set(pendingStatusRef.current);
    const leadDetailSnapshot = new Set(pendingLeadDetailRef.current);
    pendingStatusRef.current = new Set();
    pendingLeadDetailRef.current = new Set();

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
  }, [queryClient, trackingId]);

  const refreshToken = useCallback(
    () => fetchBoardLeadsRealtimeToken(trackingId),
    [trackingId],
  );

  const { data } = useInngestSubscription({
    refreshToken,
    enabled: !!trackingId && isVisible,
  });

  useEffect(() => {
    if (!isVisible) return;
    queryClient.invalidateQueries({
      queryKey: orpc.status.getMany.queryKey({ input: { trackingId } }),
    });
  }, [isVisible, queryClient, trackingId]);

  useEffect(() => {
    if (!data.length) return;
    if (data.length <= lastSeenIdxRef.current) return;

    const slice = data.slice(lastSeenIdxRef.current);
    lastSeenIdxRef.current = data.length;

    let added = false;
    for (const m of slice) {
      if (m.kind !== "data") continue;

      if (m.topic === "lead-moved") {
        const d = m.data as {
          fromStatusId: string | null;
          toStatusId: string;
          leadId: string;
        };
        if (d.fromStatusId) pendingStatusRef.current.add(d.fromStatusId);
        pendingStatusRef.current.add(d.toStatusId);
        pendingLeadDetailRef.current.add(d.leadId);
        added = true;
      } else if (m.topic === "lead-changed" || m.topic === "lead-closed") {
        const d = m.data as { statusId: string; leadId: string };
        pendingStatusRef.current.add(d.statusId);
        pendingLeadDetailRef.current.add(d.leadId);
        added = true;
      }
    }
    if (!added) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, COALESCE_MS);
    if (!maxDelayTimerRef.current) {
      maxDelayTimerRef.current = setTimeout(flush, MAX_DELAY_MS);
    }
  }, [data, flush]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    };
  }, []);
}
