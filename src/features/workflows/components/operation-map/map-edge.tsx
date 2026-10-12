"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { DASH_GAP, DASH_LENGTH, outlineToneColor, type OutlineTone } from "@/features/editor/components/rich/animated-outline";

// Ligação entre passos no mapa: tracejada, parada, na cor do passo de onde sai.

export type MapEdgeType = Edge<{ tone: OutlineTone }, "mapEdge">;

export function MapEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<MapEdgeType>) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: outlineToneColor(data?.tone ?? "ok"), strokeWidth: 3, strokeDasharray: `${DASH_LENGTH} ${DASH_GAP}`, strokeLinecap: "round" }}
    />
  );
}
