"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import { XIcon } from "lucide-react";

// Ligação entre dois fluxos no mapa: "terminou um, roda o outro". Mais grossa que a ligação entre
// passos, com o botão de desfazer no meio.

export type FlowLinkEdgeType = Edge<{ onUnlink?: () => void }, "flowLink">;

export function FlowLinkEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<FlowLinkEdgeType>) {
  // Linha reta, em ângulo reto: no mapa nenhuma ligação entre retângulos é curva.
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 0 });
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "var(--info)", strokeWidth: 5, strokeLinejoin: "round" }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1 rounded-full border bg-background py-0.5 pl-2.5 pr-1 text-[11px] font-medium shadow-sm"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
        >
          depois segue para
          {data?.onUnlink && (
            <button
              type="button"
              title="Desfazer a ligação entre os fluxos"
              aria-label="Desfazer a ligação entre os fluxos"
              className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={data.onUnlink}
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
