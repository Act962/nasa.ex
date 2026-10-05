"use client";

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Link2, Plus, StickyNote, Workflow, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRANCH_COLORS, buildOutline, type MapEdge, type OutlineItem } from "../../lib/mind-map/map-graph";
import { LinkPill, PostCardBody, type LinkNodeData, type PostNodeData } from "./content-nodes";
import type { MapItemKind } from "./item-dialog";

/** Visão "Lista" do mapa mental: cada tópico é um bloco com seus cards, links e notas. É a padrão no celular. */

interface OutlineViewProps {
  nodes: Node[];
  edges: Edge[];
  canAddContentCards: boolean;
  onOpenItem: (nodeId: string) => void;
  onAdd: (kind: MapItemKind, parentId: string) => void;
}

function AddButtons({ parentId, canAddContentCards, onAdd }: { parentId: string; canAddContentCards: boolean; onAdd: OutlineViewProps["onAdd"] }) {
  const options: Array<{ kind: MapItemKind; label: string; icon: typeof Plus }> = [
    ...(canAddContentCards ? [{ kind: "post" as const, label: "Card", icon: LayoutList }] : []),
    { kind: "link", label: "Link", icon: Link2 },
    { kind: "note", label: "Nota", icon: StickyNote },
    { kind: "topic", label: "Tópico", icon: Workflow },
  ];
  return (
    <div className="scroll-hidden-x mt-2 flex gap-1.5 overflow-x-auto">
      {options.map((option) => (
        <button key={option.kind} type="button" onClick={() => onAdd(option.kind, parentId)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-knob/60 px-3 text-xs">
          <Plus className="size-3" /> {option.label}
        </button>
      ))}
    </div>
  );
}

function OutlineEntry({ item, props }: { item: OutlineItem<Node>; props: OutlineViewProps }) {
  const { node, children } = item;
  const data = node.data as Record<string, unknown>;
  const openItem = () => props.onOpenItem(node.id);

  if (node.type === "topic") {
    const color = typeof data.color === "string" ? data.color : BRANCH_COLORS[0];
    return (
      <section className="rounded-[18px] border-l-4 bg-panel p-3" style={{ borderLeftColor: color }}>
        <button type="button" onClick={openItem} className="flex w-full items-center gap-2 text-left">
          <span className="text-sm font-bold">{String(data.label ?? "Tópico")}</span>
          {typeof data.theme === "string" && data.theme && (
            <span className="ml-auto max-w-[60%] truncate text-[11px] font-semibold" style={{ color }}>
              {data.theme}
            </span>
          )}
        </button>
        {children.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {children.map((child) => (
              <OutlineEntry key={child.node.id} item={child} props={props} />
            ))}
          </div>
        )}
        <AddButtons parentId={node.id} canAddContentCards={props.canAddContentCards} onAdd={props.onAdd} />
      </section>
    );
  }

  const nested = children.length > 0 && (
    <div className="mt-1.5 ml-3 space-y-1.5 border-l border-line pl-2.5">
      {children.map((child) => (
        <OutlineEntry key={child.node.id} item={child} props={props} />
      ))}
    </div>
  );

  if (node.type === "postNode") {
    return (
      <div>
        <button type="button" onClick={openItem} className="block w-full">
          <PostCardBody data={data as PostNodeData} />
        </button>
        {nested}
        <div className="ml-3">
          <AddButtons parentId={node.id} canAddContentCards={false} onAdd={(kind, parentId) => props.onAdd(kind === "topic" ? "note" : kind, parentId)} />
        </div>
      </div>
    );
  }
  if (node.type === "linkNode") {
    return (
      <div>
        <button type="button" onClick={openItem} className="block w-full">
          <LinkPill data={data as LinkNodeData} className="w-full py-2" />
        </button>
        {nested}
      </div>
    );
  }
  if (node.type === "stickyNote") {
    return (
      <div>
        <button type="button" onClick={openItem} className="block w-full rounded-[14px] bg-warning/20 px-3 py-2 text-left text-[13px]">
          {String(data.label ?? "Nota")}
        </button>
        {nested}
      </div>
    );
  }
  return (
    <div>
      <div className="rounded-[14px] border border-line bg-card px-3 py-2 text-[13px] font-medium">{String(data.title ?? data.label ?? "Item")}</div>
      {nested}
    </div>
  );
}

export function MindMapOutlineView(props: OutlineViewProps) {
  const outline = useMemo(() => buildOutline(props.nodes, props.edges as MapEdge[]), [props.nodes, props.edges]);
  if (!outline.root) return <p className="py-10 text-center text-sm text-muted-foreground">Este mapa está vazio.</p>;
  const rootData = outline.root.node.data as Record<string, unknown>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-2 p-3 pb-28">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-base font-bold">{String(rootData.label ?? "Mapa")}</h2>
          <span className="text-xs text-muted-foreground">{outline.root.children.length} tópicos</span>
        </div>
        {outline.root.children.map((child) => (
          <OutlineEntry key={child.node.id} item={child} props={props} />
        ))}
        {outline.loose.length > 0 && (
          <div className={cn("space-y-1.5 rounded-[18px] border border-dashed border-line p-3")}>
            <p className="text-xs text-muted-foreground">Itens soltos (sem ligação)</p>
            {outline.loose.map((looseNode) => (
              <OutlineEntry key={looseNode.id} item={{ node: looseNode, children: [] }} props={props} />
            ))}
          </div>
        )}
        <AddButtons parentId={outline.root.node.id} canAddContentCards={false} onAdd={(kind, parentId) => props.onAdd(kind === "post" ? "topic" : kind, parentId)} />
      </div>
    </div>
  );
}
