"use client";

import { useMemo } from "react";
import { ViewportPortal, useEdges, useNodes } from "@xyflow/react";
import { useParams } from "next/navigation";
import { StageChip } from "@/features/workflows/components/operation-map/stage-chip";
import { splitFlowIntoStageSections } from "@/features/workflows/lib/flow-stage-sections";

// Retângulos de fundo do editor (spec 0092): cada trecho do fluxo em que o lead está numa mesma
// etapa do funil, com a etiqueta "Tracking > Status". Calculado a partir do desenho da tela, então
// um "Mover Lead" recém-configurado já abre o retângulo novo. É só desenho: nada é gravado.

const FRAME_PADDING = 28;
const LABEL_SPACE = 30;
/** Nome do quadro e avisos, escritos embaixo de cada quadro. */
const NAME_SPACE = 56;
const FALLBACK_SIZE = 70;

export function StageSectionsLayer() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const nodes = useNodes();
  const edges = useEdges();

  const frames = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return splitFlowIntoStageSections(
      nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
      edges.map((edge) => ({ source: edge.source, target: edge.target })),
    ).map((section) => {
      const boxes = section.nodeIds.map((nodeId) => {
        const node = nodeById.get(nodeId)!;
        return {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + (node.measured?.width ?? FALLBACK_SIZE),
          bottom: node.position.y + (node.measured?.height ?? FALLBACK_SIZE),
        };
      });
      const left = Math.min(...boxes.map((box) => box.left)) - FRAME_PADDING;
      const top = Math.min(...boxes.map((box) => box.top)) - FRAME_PADDING - LABEL_SPACE;
      return {
        key: section.key,
        trackingId: section.trackingId,
        statusId: section.statusId,
        left,
        top,
        width: Math.max(...boxes.map((box) => box.right)) + FRAME_PADDING - left,
        height: Math.max(...boxes.map((box) => box.bottom)) + FRAME_PADDING + NAME_SPACE - top,
      };
    });
  }, [nodes, edges]);

  if (!trackingId || frames.length === 0) return null;
  return (
    <ViewportPortal>
      {frames.map((frame) => (
        <div
          key={frame.key}
          className="pointer-events-none absolute rounded-3xl border-2 border-dashed border-info/40 bg-info/[0.04]"
          // Sem z-index negativo: atrás do fundo pontilhado do canvas o retângulo sumia. Fica por cima, mas é
          // transparente e não recebe clique, então não atrapalha os quadros.
          style={{ transform: `translate(${frame.left}px, ${frame.top}px)`, width: frame.width, height: frame.height }}
        >
          <StageChip ownTrackingId={trackingId} trackingId={frame.trackingId} statusId={frame.statusId} className="absolute -top-3 left-4" />
        </div>
      ))}
    </ViewportPortal>
  );
}
