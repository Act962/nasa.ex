"use client";

import { BaseEdge, Handle, Position, getSmoothStepPath, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { ListIcon } from "lucide-react";
import { ATTENDANCE_LAYOUT, type MapMenuOption } from "@/features/workflows/lib/operation-map-attendance";
import { cn } from "@/lib/utils";
import { straightPathThrough } from "./straight-path";

// O menu do atendimento e os blocos em volta dele no mapa da operação (spec 0092): o menu com uma saída
// por opção, o agendamento por botões e a assistente. São só leitura; o clique leva à tela de cada um.

export type MenuGroupData = { name: string; href: string; options: MapMenuOption[] };
export type InfoBlockData = { title: string; lines: string[]; tone: "booking" | "assistant"; href: string };
export type TagLinkKind = "menu" | "booking" | "tag";
export type TagLinkEdgeType = Edge<{ kind: TagLinkKind; channelX?: number; endsOnChannel?: boolean }, "tagLink">;

/** Cada opção do menu tem uma saída de cada lado: o fluxo dela pode estar à esquerda ou à direita. */
export function menuHandleId(optionId: string, side: "left" | "right"): string {
  return `${side}:${optionId}`;
}

/** Entrada extra do retângulo do fluxo, pela direita, para os fluxos que ficam à esquerda do menu. */
export const FLOW_RIGHT_ENTRY_HANDLE = "entrada-direita";

const HIDDEN_HANDLE = "!size-2 !border-0 !bg-transparent";

export function MenuGroupNode({ data }: NodeProps<Node<MenuGroupData, "menuGroup">>) {
  return (
    <div className="relative size-full cursor-pointer rounded-3xl border-[2.5px] border-success bg-success/5" title="Abrir os menus do atendimento">
      <div className="px-5 pt-4">
        <p className="flex items-center gap-2 text-base font-bold">
          <ListIcon className="size-4 text-success" />
          <span className="truncate">{data.name}</span>
        </p>
        <p className="text-xs text-muted-foreground">Menu do atendimento. Cada opção leva a um fluxo.</p>
      </div>
      {data.options.map((option) => (
        <div
          key={option.id}
          className={cn(
            "absolute flex items-center rounded-xl border bg-card px-3 text-sm",
            option.kind === "booking" && "border-dashed border-success",
            option.kind === "plain" && "text-muted-foreground",
          )}
          style={{ left: ATTENDANCE_LAYOUT.padding, right: ATTENDANCE_LAYOUT.padding, top: option.centerY - ATTENDANCE_LAYOUT.rowHeight / 2, height: ATTENDANCE_LAYOUT.rowHeight }}
        >
          <span className="truncate">{option.title}</span>
        </div>
      ))}
      {data.options.flatMap((option) => [
        <Handle key={`right:${option.id}`} id={menuHandleId(option.id, "right")} type="source" position={Position.Right} isConnectable={false} className={HIDDEN_HANDLE} style={{ top: option.centerY }} />,
        <Handle key={`left:${option.id}`} id={menuHandleId(option.id, "left")} type="source" position={Position.Left} isConnectable={false} className={HIDDEN_HANDLE} style={{ top: option.centerY }} />,
      ])}
    </div>
  );
}

export function InfoBlockNode({ data }: NodeProps<Node<InfoBlockData, "infoBlock">>) {
  return (
    <div
      className={cn("size-full cursor-pointer rounded-3xl border-2 border-dashed bg-card px-5 py-4", data.tone === "booking" ? "border-success bg-success/5" : "border-border")}
      title="Abrir a configuração"
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className={HIDDEN_HANDLE} />
      <p className="text-sm font-bold">{data.title}</p>
      {data.lines.map((line) => (
        <p key={line} className="text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

const LINK_STYLE: Record<TagLinkKind, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  menu: { stroke: "var(--info)", strokeWidth: 2.5 },
  tag: { stroke: "var(--info)", strokeWidth: 2.5, strokeDasharray: "2 6" },
  booking: { stroke: "var(--success)", strokeWidth: 2.5, strokeDasharray: "8 6" },
};

/** Ligação que existe por causa de uma tag (ou do menu de agendamento): não é criada nem desfeita no mapa. */
export function TagLinkEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<TagLinkEdgeType>) {
  // Com corredor definido, a linha faz o caminho reto por ele. Sem corredor (fluxo → fluxo), o caminho
  // em ângulo reto é calculado pelas posições dos dois retângulos.
  const [fallbackPath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 0 });
  const edgePath =
    data?.channelX === undefined
      ? fallbackPath
      : data.endsOnChannel
        ? `M ${sourceX} ${sourceY} L ${data.channelX} ${sourceY} L ${data.channelX} ${targetY}`
        : straightPathThrough({ sourceX, sourceY, targetX, targetY, channelX: data.channelX });
  return <BaseEdge id={id} path={edgePath} style={{ ...LINK_STYLE[data?.kind ?? "menu"], strokeLinejoin: "round", fill: "none" }} />;
}
