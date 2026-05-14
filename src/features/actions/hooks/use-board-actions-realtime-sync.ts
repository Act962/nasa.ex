"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { fetchBoardActionsRealtimeToken } from "../realtime/actions";

const COALESCE_MS = 250;
const MAX_DELAY_MS = 2000;

export function useBoardActionsRealtimeSync({
  workspaceId,
}: {
  workspaceId: string;
}) {
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
  const pendingColumnRef = useRef<Set<string>>(new Set());
  const pendingActionDetailRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (maxDelayTimerRef.current) clearTimeout(maxDelayTimerRef.current);
    debounceTimerRef.current = null;
    maxDelayTimerRef.current = null;

    const columnSnapshot = new Set(pendingColumnRef.current);
    const actionDetailSnapshot = new Set(pendingActionDetailRef.current);
    pendingColumnRef.current = new Set();
    pendingActionDetailRef.current = new Set();

    if (columnSnapshot.size) {
      queryClient.invalidateQueries({
        queryKey: orpc.workspace.getColumnsByWorkspace.queryKey({
          input: { workspaceId },
        }),
      });

      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "action.listByColumn" &&
          columnSnapshot.has(q.queryKey[1] as string),
      });
    }

    for (const actionId of actionDetailSnapshot) {
      queryClient.invalidateQueries({
        queryKey: orpc.action.get.queryKey({ input: { actionId } }),
      });
    }
  }, [queryClient, workspaceId]);

  const refreshToken = useCallback(
    () => fetchBoardActionsRealtimeToken(workspaceId),
    [workspaceId],
  );

  const { data } = useInngestSubscription({
    refreshToken,
    enabled: !!workspaceId && isVisible,
  });

  useEffect(() => {
    if (!isVisible) return;
    queryClient.invalidateQueries({
      queryKey: orpc.workspace.getColumnsByWorkspace.queryKey({
        input: { workspaceId },
      }),
    });
  }, [isVisible, queryClient, workspaceId]);

  useEffect(() => {
    if (!data.length) return;
    if (data.length <= lastSeenIdxRef.current) return;

    const slice = data.slice(lastSeenIdxRef.current);
    lastSeenIdxRef.current = data.length;

    let added = false;
    for (const m of slice) {
      if (m.kind !== "data") continue;

      if (m.topic === "action-moved") {
        const d = m.data as {
          fromColumnId: string | null;
          toColumnId: string;
          actionId: string;
        };
        if (d.fromColumnId) pendingColumnRef.current.add(d.fromColumnId);
        pendingColumnRef.current.add(d.toColumnId);
        pendingActionDetailRef.current.add(d.actionId);
        added = true;
      } else if (
        m.topic === "action-changed" ||
        m.topic === "action-archived"
      ) {
        const d = m.data as { columnId: string; actionId: string };
        pendingColumnRef.current.add(d.columnId);
        pendingActionDetailRef.current.add(d.actionId);
        added = true;
      } else if (m.topic === "sub-action-created") {
        const d = m.data as { actionId: string };
        // Sub-action criada não muda composição da coluna; só refresca o
        // detalhe da action pai (sheet aberta).
        pendingActionDetailRef.current.add(d.actionId);
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
