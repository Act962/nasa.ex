"use client";

import Image from "next/image";
import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Handle, type Node, type NodeProps } from "@xyflow/react";
import { outlineToneColor, type OutlineTone } from "@/features/editor/components/rich/animated-outline";
import { IconNodeCaption, IconNodeGlyph, hasIconCaption, hasIconGlyph } from "@/features/editor/components/rich/icon-node-hint";
import { RichNodePreview } from "@/features/editor/components/rich/rich-node-preview";
import { hasRichPreview } from "@/features/editor/components/rich/rich-node-types";
import { readNodeSides, toPosition } from "@/features/editor/lib/node-sides";
import { formatWaitLabel } from "@/features/editor/lib/wait-label";
import { agentModeNodes, executionNodes, triggerNodes, type NodeTypeOption } from "@/features/tracking-executions/lib/node-options";

// Um passo no mapa da operação (spec 0092): o mesmo desenho do editor, sem barra de botões nem
// janela de configuração. Para editar, a pessoa abre o fluxo.

export interface MapStepData extends Record<string, unknown> {
  nodeType: string;
  nodeData: unknown;
  tone: OutlineTone;
  isRichView: boolean;
}

export type MapStepNodeType = Node<MapStepData, "mapStep">;

// Mais de uma opção do painel usa o mesmo tipo (Enviar Mensagem e Menu de Botões): vale a primeira.
const OPTION_BY_TYPE = new Map<string, NodeTypeOption>();
for (const option of [...triggerNodes, ...executionNodes, ...agentModeNodes]) {
  if (!OPTION_BY_TYPE.has(String(option.type))) OPTION_BY_TYPE.set(String(option.type), option);
}

export const MapStepNode = memo(function MapStepNode({ data }: NodeProps<MapStepNodeType>) {
  const option = OPTION_BY_TYPE.get(data.nodeType);
  const label = option?.label ?? data.nodeType;
  const Icon = option?.icon;
  const { inputSide, outputSide } = readNodeSides(data.nodeData);
  const showsRichPreview = data.isRichView && hasRichPreview(data.nodeType);
  const waitLabel = data.nodeType === "WAIT" ? formatWaitLabel(data.nodeData) : null;

  return (
    <div
      className="relative grid size-full place-items-center rounded-2xl border-[3px] border-dashed bg-card"
      style={{ borderColor: outlineToneColor(data.tone) }}
    >
      <Handle type="target" position={toPosition(inputSide)} isConnectable={false} className="!size-1.5 !border-0 !bg-muted-foreground/50" />
      <Handle type="source" position={toPosition(outputSide)} isConnectable={false} className="!size-1.5 !border-0 !bg-muted-foreground/50" />
      {showsRichPreview ? (
        <RichNodePreview nodeType={data.nodeType} data={data.nodeData} name={label} icon={Icon as LucideIcon | string | undefined} />
      ) : (
        <span className="flex flex-col items-center gap-0.5">
          {hasIconGlyph(data.nodeType) ? (
            <IconNodeGlyph nodeType={data.nodeType} data={data.nodeData} />
          ) : typeof Icon === "string" ? (
            <Image src={Icon} alt="" width={16} height={16} />
          ) : Icon ? (
            <Icon className="size-4 text-muted-foreground" />
          ) : null}
          {waitLabel && <span className="whitespace-nowrap text-[9px] font-semibold leading-none text-muted-foreground">{waitLabel}</span>}
        </span>
      )}
      <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-max max-w-56 -translate-x-1/2 text-center text-xs font-medium">
        {label}
        {!data.isRichView && hasIconCaption(data.nodeType) && <IconNodeCaption nodeType={data.nodeType} data={data.nodeData} />}
      </span>
    </div>
  );
});
