"use client";

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { StageChip } from "./stage-chip";

// Moldura de um trecho do fluxo no mapa: os passos em que o lead está numa mesma etapa do funil.

export interface StageFrameData extends Record<string, unknown> {
  ownTrackingId: string;
  trackingId: string | null;
  statusId: string | null;
}

export type StageFrameNodeType = Node<StageFrameData, "stageFrame">;

export const StageFrameNode = memo(function StageFrameNode({ data }: NodeProps<StageFrameNodeType>) {
  return (
    <div className="pointer-events-none size-full rounded-2xl border-2 border-dashed border-info/35 bg-info/[0.04]">
      <StageChip ownTrackingId={data.ownTrackingId} trackingId={data.trackingId} statusId={data.statusId} className="absolute -top-2.5 left-3" />
    </div>
  );
});
