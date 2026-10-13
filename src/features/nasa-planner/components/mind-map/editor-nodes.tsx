"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeToolbar,
  Position,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { BotIcon, ChevronRightIcon, FileImageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { getMindMapEditorActions } from "../../lib/mind-map/editor-bridge";
import { BRANCH_COLORS } from "../../lib/mind-map/map-graph";
import { LinkNode, PostNode } from "./content-nodes";

/** Nós e ligações do editor de mapa mental (raiz, tópico, nota e card de ação). */

interface EditorNodeData {
  label?: string;
  title?: string;
  theme?: string;
  color?: string;
  depth?: number;
  editing?: boolean;
  isGenerating?: boolean;
  aiSuggested?: boolean;
  hasChildren?: boolean;
  collapsed?: boolean;
  collapsedCount?: number;
  status?: string;
  priority?: string;
  dueDate?: string | Date | null;
}

// ─── Inline Edit Input ────────────────────────────────────────────────────────
function InlineEdit({
  value,
  onDone,
  onCancel,
  style,
}: {
  value: string;
  onDone: (v: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); onDone(text); }
        if (e.key === "Escape") { onCancel(); }
      }}
      onBlur={() => onDone(text)}
      className="nodrag bg-transparent border-none outline-none text-inherit font-inherit text-center w-full"
      style={style}
    />
  );
}

// ─── Node Toolbar (contextual) ────────────────────────────────────────────────
function NodeContextToolbar({
  nodeId,
  color,
  onAddChild,
  onAddSibling,
  onDelete,
  onChangeColor,
  onGenerateAI,
  onCreatePost,
  isGenerating,
}: {
  nodeId: string;
  color: string;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onChangeColor: (c: string) => void;
  onGenerateAI: () => void;
  onCreatePost: () => void;
  isGenerating: boolean;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  return (
    <NodeToolbar isVisible position={Position.Top} offset={8}>
      <div className="flex items-center gap-1 bg-popover border rounded-xl shadow-lg px-2 py-1.5">
        <button
          title="Adicionar filho (Tab)"
          onClick={onAddChild}
          className="size-6 flex items-center justify-center rounded-full hover:bg-info/15 text-info transition-colors"
        >
          <PlusIcon className="size-3.5" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          title="Gerar com IA (Ctrl+G)"
          onClick={onGenerateAI}
          disabled={isGenerating}
          className="size-6 flex items-center justify-center rounded-full hover:bg-warning/15 text-warning transition-colors disabled:opacity-40"
        >
          {isGenerating ? <OrbitaSpinner className="size-3 " /> : <BotIcon className="size-3.5" />}
        </button>
        <button
          title="Criar Post"
          onClick={onCreatePost}
          className="size-6 flex items-center justify-center rounded-full hover:bg-info/15 text-info transition-colors"
        >
          <FileImageIcon className="size-3.5" />
        </button>
        <div className="w-px h-4 bg-border" />
        <div className="relative">
          <button
            title="Cor"
            onClick={() => setShowColorPicker((p) => !p)}
            className="size-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <div className="size-3.5 rounded-full border border-white/50" style={{ background: color }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-8 left-0 z-50 bg-popover border rounded-xl shadow-xl p-2 flex flex-wrap gap-1.5 w-[130px]">
              {BRANCH_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn("size-6 rounded-full border-2 transition-transform hover:scale-110", color === c ? "border-white scale-110 ring-2 ring-offset-1" : "border-transparent")}
                  style={{ background: c }}
                  onClick={() => { onChangeColor(c); setShowColorPicker(false); }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-4 bg-border" />
        <button
          title="Excluir (Delete)"
          onClick={onDelete}
          className="size-6 flex items-center justify-center rounded-full hover:bg-destructive/15 text-destructive transition-colors"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
    </NodeToolbar>
  );
}

// ─── Root Node ────────────────────────────────────────────────────────────────
function MindMapRootNode({ id, data, selected }: { id: string; data: EditorNodeData; selected?: boolean }) {
  const handleAddChild = useCallback(() => {
    getMindMapEditorActions()?.addChild(id);
  }, [id]);
  const handleDelete = useCallback(() => {
    getMindMapEditorActions()?.deleteNode(id);
  }, [id]);
  const handleChangeColor = useCallback((c: string) => {
    getMindMapEditorActions()?.changeColor(id, c);
  }, [id]);
  const handleGenerateAI = useCallback(() => {
    getMindMapEditorActions()?.generateAI(id);
  }, [id]);
  const handleCreatePost = useCallback(() => {
    getMindMapEditorActions()?.createPost(id, data.label ?? "");
  }, [id, data.label]);

  return (
    <>
      {selected && (
        <NodeContextToolbar
          nodeId={id}
          color={data.color ?? "#7C3AED"}
          onAddChild={handleAddChild}
          onAddSibling={() => {}}
          onDelete={handleDelete}
          onChangeColor={handleChangeColor}
          onGenerateAI={handleGenerateAI}
          onCreatePost={handleCreatePost}
          isGenerating={data.isGenerating ?? false}
        />
      )}
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div
        className={cn(
          "px-6 py-3.5 rounded-2xl text-white font-bold shadow-xl min-w-[140px] text-center select-none cursor-pointer",
          selected && "ring-2 ring-white/70 ring-offset-2 ring-offset-transparent",
        )}
        style={{
          background: `linear-gradient(135deg, ${data.color ?? "#7C3AED"}, ${data.color ?? "#7C3AED"}cc)`,
          fontSize: "15px",
          letterSpacing: "0.02em",
        }}
      >
        {data.editing ? (
          <InlineEdit
            value={data.label ?? ""}
            onDone={(v) => getMindMapEditorActions()?.finishEdit(id, v)}
            onCancel={() => getMindMapEditorActions()?.cancelEdit(id)}
          />
        ) : (
          <span>{data.label ?? "Ideia Central"}</span>
        )}
      </div>
    </>
  );
}

// ─── Topic Node ───────────────────────────────────────────────────────────────
function TopicNode({ id, data, selected }: { id: string; data: EditorNodeData; selected?: boolean }) {
  const depth = data.depth ?? 1;
  const fontSize = depth === 1 ? "14px" : depth === 2 ? "13px" : "12px";

  const handleAddChild = () => getMindMapEditorActions()?.addChild(id);
  const handleAddSibling = () => getMindMapEditorActions()?.addSibling(id);
  const handleDelete = () => getMindMapEditorActions()?.deleteNode(id);
  const handleChangeColor = (c: string) => getMindMapEditorActions()?.changeColor(id, c);
  const handleGenerateAI = () => getMindMapEditorActions()?.generateAI(id);
  const handleCreatePost = () => getMindMapEditorActions()?.createPost(id, data.label ?? "");
  const handleCollapse = () => getMindMapEditorActions()?.toggleCollapse(id);

  const hasChildren = data.hasChildren ?? false;
  const collapsed = data.collapsed ?? false;

  return (
    <>
      {selected && (
        <NodeContextToolbar
          nodeId={id}
          color={data.color ?? "#7C3AED"}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onDelete={handleDelete}
          onChangeColor={handleChangeColor}
          onGenerateAI={handleGenerateAI}
          onCreatePost={handleCreatePost}
          isGenerating={data.isGenerating ?? false}
        />
      )}
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      <div
        className={cn(
          "relative group px-4 py-2 rounded-xl text-white shadow-md min-w-[100px] max-w-[220px] text-center select-none cursor-pointer transition-all",
          selected && "ring-2 ring-white/70 ring-offset-1 ring-offset-transparent",
          data.aiSuggested && "opacity-70 border-2 border-dashed border-white/50",
        )}
        style={{
          background: `linear-gradient(135deg, ${data.color ?? "#7C3AED"}ee, ${data.color ?? "#7C3AED"}aa)`,
          fontSize,
        }}
      >
        {data.editing ? (
          <InlineEdit
            value={data.label ?? ""}
            onDone={(v) => getMindMapEditorActions()?.finishEdit(id, v)}
            onCancel={() => getMindMapEditorActions()?.cancelEdit(id)}
            style={{ fontSize }}
          />
        ) : (
          <>
            <span className="block leading-snug">{data.label ?? "Tópico"}</span>
            {data.theme && <span className="block truncate text-[10.5px] font-normal opacity-90">{data.theme}</span>}
            {/* Quick add on hover */}
            {!data.aiSuggested && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAddChild(); }}
                className="absolute -right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-card/90 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-card hover:scale-110 border border-line"
                title="Adicionar filho"
              >
                <PlusIcon className="size-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Collapse toggle */}
      {hasChildren && !data.editing && (
        <button
          onClick={(e) => { e.stopPropagation(); handleCollapse(); }}
          className={cn(
            "absolute -right-1.5 top-1/2 -translate-y-1/2 translate-x-full flex items-center justify-center rounded-full border-2 bg-card shadow-sm transition-colors hover:bg-muted z-10",
            collapsed ? "size-5 text-xs font-bold" : "size-4",
          )}
          style={{ borderColor: data.color ?? "#7C3AED", color: data.color ?? "#7C3AED" }}
        >
          {collapsed
            ? <span style={{ fontSize: "9px" }}>{data.collapsedCount ?? ""}</span>
            : <ChevronRightIcon className="size-2.5" />
          }
        </button>
      )}
    </>
  );
}

// ─── Sticky Note ──────────────────────────────────────────────────────────────
function StickyNoteNode({ id, data, selected }: { id: string; data: EditorNodeData; selected?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <div
        className={cn("px-3 py-2 rounded-lg text-sm shadow min-w-[120px] max-w-[200px] select-none cursor-pointer", selected && "ring-2 ring-info")}
        style={{ background: data.color ?? "#FEF08A", color: "#1F2937" }}
      >
        {data.editing ? (
          <InlineEdit
            value={data.label ?? ""}
            onDone={(v) => getMindMapEditorActions()?.finishEdit(id, v)}
            onCancel={() => getMindMapEditorActions()?.cancelEdit(id)}
          />
        ) : (
          <span>{data.label ?? "Nota"}</span>
        )}
      </div>
    </>
  );
}

// ─── Card Node ────────────────────────────────────────────────────────────────
function CardNode({ data, selected }: { data: EditorNodeData; selected?: boolean }) {
  const priorityColors: Record<string, string> = {
    LOW: "bg-temp-cold/15 text-temp-cold",
    MEDIUM: "bg-temp-warm/15 text-temp-warm",
    HIGH: "bg-temp-hot/15 text-temp-hot",
    URGENT: "bg-temp-very-hot/15 text-temp-very-hot",
  };
  const statusColors: Record<string, string> = {
    PENDING: "bg-muted text-muted-foreground",
    IN_PROGRESS: "bg-info/15 text-info",
    COMPLETED: "bg-success/15 text-success",
    CANCELLED: "bg-destructive/15 text-destructive",
  };
  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div
        className={cn("bg-card rounded-xl border shadow-md p-3 min-w-[180px] max-w-[240px] select-none cursor-pointer", selected && "ring-2 ring-info")}
      >
        <p className="text-sm font-semibold line-clamp-2 mb-2">{data.title ?? "Card"}</p>
        <div className="flex flex-wrap gap-1">
          {data.status && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusColors[data.status] ?? "bg-muted")}>
              {data.status === "PENDING" ? "Pendente" : data.status === "IN_PROGRESS" ? "Em andamento" : data.status === "COMPLETED" ? "Concluído" : "Cancelado"}
            </span>
          )}
          {data.priority && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", priorityColors[data.priority] ?? "bg-muted")}>{data.priority}</span>
          )}
          {data.dueDate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              📅 {new Date(data.dueDate).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export const mindMapNodeTypes: NodeTypes = {
  mindMapRoot: MindMapRootNode,
  topic: TopicNode,
  stickyNote: StickyNoteNode,
  cardNode: CardNode,
  postNode: PostNode,
  linkNode: LinkNode,
};

// ─── Custom Edge ──────────────────────────────────────────────────────────────
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = typeof data?.color === "string" ? data.color : undefined;
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: color, strokeWidth: style?.strokeWidth ?? 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all" }}
          className="nodrag nopan"
        >
          <button
            className="size-4 rounded-full bg-destructive text-white text-[8px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
          >×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const mindMapEdgeTypes: EdgeTypes = { custom: CustomEdge };
