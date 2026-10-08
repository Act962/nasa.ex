"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";

/** Desfazer/refazer do editor de mapa mental: guarda cópias do grafo a cada mudança. */

const MAX_HISTORY_ENTRIES = 50;

type HistoryEntry = { nodes: Node[]; edges: Edge[] };

const cloneEntry = (nodes: Node[], edges: Edge[]): HistoryEntry => ({
  nodes: JSON.parse(JSON.stringify(nodes)),
  edges: JSON.parse(JSON.stringify(edges)),
});

export function useMindMapHistory(
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
) {
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const pushHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(cloneEntry(nodes, edges));
    if (historyRef.current.length > MAX_HISTORY_ENTRIES) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const resetHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    historyRef.current = [cloneEntry(nodes, edges)];
    historyIndexRef.current = 0;
  }, []);

  const restoreEntry = useCallback(
    (entryIndex: number) => {
      const entry = historyRef.current[entryIndex];
      if (!entry) return;
      setNodes(entry.nodes);
      setEdges(entry.edges);
    },
    [setNodes, setEdges],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    restoreEntry(historyIndexRef.current);
  }, [restoreEntry]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    restoreEntry(historyIndexRef.current);
  }, [restoreEntry]);

  return {
    pushHistory,
    resetHistory,
    undo,
    redo,
    canUndo: () => historyIndexRef.current > 0,
    canRedo: () => historyIndexRef.current < historyRef.current.length - 1,
  };
}
