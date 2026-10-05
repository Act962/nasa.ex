"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  KeyboardEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Panel,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
  MarkerType,
  Handle,
  Position,
  NodeToolbar,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  ZapIcon,
  ChevronRightIcon,
  SearchIcon,
  DownloadIcon,
  Undo2Icon,
  Redo2Icon,
  BotIcon,
  MaximizeIcon,
  XIcon,
  FileJsonIcon,
  ImageIcon,
  FileImageIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import {
  useNasaPlannerMindMap,
  useUpdateMindMap,
  useCreateCard,
  useNasaPlannerCards,
} from "../hooks/use-nasa-planner";
import { Spinner } from "@/components/spinner";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { MindMapToPostDialog } from "./mind-map-to-post-dialog";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { ArrowLeftIcon, LayoutListIcon, Link2Icon, ListTreeIcon, MoreHorizontalIcon, NetworkIcon, RefreshCwIcon, SparklesIcon, StickyNoteIcon, WorkflowIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHideOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { usePlannerCalendarPosts } from "../hooks/use-planner-calendar";
import { usePlannerWeekdayThemes } from "../hooks/use-planner-weekly-script";
import { BRANCH_COLORS, ROOT_NODE_ID, findDayTopic, layoutTree, type MapEdge } from "../lib/mind-map/map-graph";
import { listPendingContents, mergeWeeklyPosts } from "../lib/mind-map/weekly-map";
import { LinkNode, MindMapPostsContext, PostNode, type MapPostInfo } from "./mind-map/content-nodes";
import { MapItemDialog, type MapItemKind, type MapItemRequest, type MapItemValues } from "./mind-map/item-dialog";
import { MindMapOutlineView } from "./mind-map/outline-view";
import { WeeklyContentsDialog } from "./mind-map/weekly-contents-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNodeDepth(nodeId: string, nodes: Node[], edges: Edge[]): number {
  if (nodeId === "root") return 0;
  let depth = 0;
  let current = nodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentEdge = edges.find((e) => e.target === current);
    if (!parentEdge) break;
    current = parentEdge.source;
    depth++;
    if (depth > 20) break;
  }
  return depth;
}

function getBranchColor(nodeId: string, nodes: Node[], edges: Edge[]): string {
  // Walk up to find the first-level child of root
  let current = nodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentEdge = edges.find((e) => e.target === current);
    if (!parentEdge) break;
    if (parentEdge.source === "root") {
      // current is a first-level child
      const node = nodes.find((n) => n.id === current);
      return (node?.data as any)?.color ?? BRANCH_COLORS[0];
    }
    current = parentEdge.source;
  }
  const node = nodes.find((n) => n.id === nodeId);
  return (node?.data as any)?.color ?? BRANCH_COLORS[0];
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
function MindMapRootNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const handleAddChild = useCallback(() => {
    (window as any).__mmAddChild?.(id);
  }, [id]);
  const handleDelete = useCallback(() => {
    (window as any).__mmDeleteNode?.(id);
  }, [id]);
  const handleChangeColor = useCallback((c: string) => {
    (window as any).__mmChangeColor?.(id, c);
  }, [id]);
  const handleGenerateAI = useCallback(() => {
    (window as any).__mmGenerateAI?.(id);
  }, [id]);
  const handleCreatePost = useCallback(() => {
    (window as any).__mmCreatePost?.(id, data.label ?? "");
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
            onDone={(v) => (window as any).__mmFinishEdit?.(id, v)}
            onCancel={() => (window as any).__mmCancelEdit?.(id)}
          />
        ) : (
          <span>{data.label ?? "Ideia Central"}</span>
        )}
      </div>
    </>
  );
}

// ─── Topic Node ───────────────────────────────────────────────────────────────
function TopicNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const depth = data.depth ?? 1;
  const fontSize = depth === 1 ? "14px" : depth === 2 ? "13px" : "12px";

  const handleAddChild = () => (window as any).__mmAddChild?.(id);
  const handleAddSibling = () => (window as any).__mmAddSibling?.(id);
  const handleDelete = () => (window as any).__mmDeleteNode?.(id);
  const handleChangeColor = (c: string) => (window as any).__mmChangeColor?.(id, c);
  const handleGenerateAI = () => (window as any).__mmGenerateAI?.(id);
  const handleCreatePost = () => (window as any).__mmCreatePost?.(id, data.label ?? "");
  const handleCollapse = () => (window as any).__mmToggleCollapse?.(id);

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
            onDone={(v) => (window as any).__mmFinishEdit?.(id, v)}
            onCancel={() => (window as any).__mmCancelEdit?.(id)}
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
function StickyNoteNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
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
            onDone={(v) => (window as any).__mmFinishEdit?.(id, v)}
            onCancel={() => (window as any).__mmCancelEdit?.(id)}
          />
        ) : (
          <span>{data.label ?? "Nota"}</span>
        )}
      </div>
    </>
  );
}

// ─── Card Node ────────────────────────────────────────────────────────────────
function CardNode({ data, selected }: { data: any; selected?: boolean }) {
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

const nodeTypes: NodeTypes = {
  mindMapRoot: MindMapRootNode as any,
  topic: TopicNode as any,
  stickyNote: StickyNoteNode as any,
  cardNode: CardNode as any,
  postNode: PostNode as any,
  linkNode: LinkNode as any,
};

// ─── Custom Edge ──────────────────────────────────────────────────────────────
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps & { data?: any }) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = (data as any)?.color;
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

const edgeTypes: EdgeTypes = { custom: CustomEdge };

// ─── History ──────────────────────────────────────────────────────────────────
type HistoryEntry = { nodes: Node[]; edges: Edge[] };

// ─── Main Editor ──────────────────────────────────────────────────────────────
function MindMapEditorInner({ plannerId, mindMapId }: { plannerId: string; mindMapId: string }) {
  const { mindMap, isLoading } = useNasaPlannerMindMap(mindMapId);
  const updateMindMap = useUpdateMindMap();
  const createCard = useCreateCard();
  const { cards } = useNasaPlannerCards({ mindMapId });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ title: "", description: "", priority: "MEDIUM" as const, dueDate: "" });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [aiSuggestionDialog, setAiSuggestionDialog] = useState<{ nodeId: string; label: string; suggestions: string[] } | null>(null);
  const [mmPostDialog, setMmPostDialog] = useState<{ open: boolean; title: string }>({ open: false, title: "" });

  // Undo/Redo
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const skipHistoryRef = useRef(false);

  const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reactFlowRef = useRef<HTMLDivElement>(null);

  // Push history snapshot
  const pushHistory = useCallback((ns: Node[], es: Edge[]) => {
    if (skipHistoryRef.current) return;
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push({ nodes: JSON.parse(JSON.stringify(ns)), edges: JSON.parse(JSON.stringify(es)) });
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const entry = historyRef.current[historyIndexRef.current];
    if (!entry) return;
    skipHistoryRef.current = true;
    setNodes(entry.nodes);
    setEdges(entry.edges);
    skipHistoryRef.current = false;
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const entry = historyRef.current[historyIndexRef.current];
    if (!entry) return;
    skipHistoryRef.current = true;
    setNodes(entry.nodes);
    setEdges(entry.edges);
    skipHistoryRef.current = false;
  }, [setNodes, setEdges]);

  // Load mind map data
  useEffect(() => {
    if (!mindMap) return;
    const rawNodes = (mindMap.nodes as any[]) ?? [];
    const rawEdges = (mindMap.edges as any[]) ?? [];

    const cardNodes: Node[] = cards.map((card: any) => {
      const nodeId = `card-${card.id}`;
      return {
        id: nodeId,
        type: "cardNode",
        position: rawNodes.find((n: any) => n.id === nodeId)?.position ?? { x: 600, y: Math.random() * 400 },
        data: { title: card.title, status: card.status, priority: card.priority, dueDate: card.dueDate, cardId: card.id },
      };
    });

    const nonCardNodes = rawNodes.filter((n: any) => !n.id.startsWith("card-"));
    const allNodes = [...nonCardNodes, ...cardNodes];
    const allEdges = rawEdges;

    skipHistoryRef.current = true;
    setNodes(allNodes);
    setEdges(allEdges);
    skipHistoryRef.current = false;
    // init history
    historyRef.current = [{ nodes: JSON.parse(JSON.stringify(allNodes)), edges: JSON.parse(JSON.stringify(allEdges)) }];
    historyIndexRef.current = 0;
  }, [mindMap, cards]);

  // Auto-save
  const triggerSave = useCallback((ns: Node[], es: Edge[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateMindMap.mutateAsync({
          mindMapId,
          nodes: ns.filter((n) => !n.id.startsWith("card-")) as any,
          edges: es as any,
        });
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  }, [mindMapId, updateMindMap]);

  const handleSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    setIsSaving(true);
    try {
      await updateMindMap.mutateAsync({
        mindMapId,
        nodes: nodes.filter((n) => !n.id.startsWith("card-")) as any,
        edges: edges as any,
      });
      toast.success("Mapa salvo!");
    } finally {
      setIsSaving(false);
    }
  }, [mindMapId, nodes, edges, updateMindMap]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, type: "custom", animated: false }, edges);
      setEdges(newEdges);
      pushHistory(nodes, newEdges);
      triggerSave(nodes, newEdges);
    },
    [setEdges, edges, nodes, pushHistory, triggerSave],
  );

  // ── Node manipulation helpers ─────────────────────────────────────────────

  const getNextBranchColor = useCallback((currentNodes: Node[]) => {
    const usedColors = new Set(currentNodes.filter((n) => n.type === "topic" || n.type === "mindMapRoot").map((n) => (n.data as any).color).filter(Boolean));
    for (const c of BRANCH_COLORS) {
      if (!usedColors.has(c)) return c;
    }
    return BRANCH_COLORS[Math.floor(Math.random() * BRANCH_COLORS.length)];
  }, []);

  const addChildNode = useCallback(
    (parentId: string) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const parent = currentNodes.find((n) => n.id === parentId);
      if (!parent) return;

      const parentDepth = getNodeDepth(parentId, currentNodes, currentEdges);
      const parentColor = parentId === "root"
        ? getNextBranchColor(currentNodes)
        : getBranchColor(parentId, currentNodes, currentEdges);

      const id = `node-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "topic",
        position: {
          x: parent.position.x + 220,
          y: parent.position.y + (Math.random() - 0.5) * 80,
        },
        data: { label: "Novo tópico", color: parentColor, depth: parentDepth + 1 },
      };
      const newEdge: Edge = {
        id: `e-${parentId}-${id}`,
        source: parentId,
        target: id,
        type: "custom",
        data: { color: parentColor },
      };

      const newNodes = [...currentNodes, newNode];
      const newEdges = [...currentEdges, newEdge];
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      triggerSave(newNodes, newEdges);

      // Immediately start editing
      setTimeout(() => {
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, editing: true } } : n));
      }, 50);
    },
    [getNodes, getEdges, setNodes, setEdges, pushHistory, triggerSave, getNextBranchColor],
  );

  const addSiblingNode = useCallback(
    (nodeId: string) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const parentEdge = currentEdges.find((e) => e.target === nodeId);
      if (!parentEdge) return addChildNode("root");

      const parentId = parentEdge.source;
      const parent = currentNodes.find((n) => n.id === parentId);
      const sibling = currentNodes.find((n) => n.id === nodeId);
      if (!parent || !sibling) return;

      const siblingColor = getBranchColor(nodeId, currentNodes, currentEdges);
      const depth = getNodeDepth(nodeId, currentNodes, currentEdges);

      const id = `node-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "topic",
        position: { x: sibling.position.x, y: sibling.position.y + 80 },
        data: { label: "Novo tópico", color: siblingColor, depth },
      };
      const newEdge: Edge = {
        id: `e-${parentId}-${id}`,
        source: parentId,
        target: id,
        type: "custom",
        data: { color: siblingColor },
      };

      const newNodes = [...currentNodes, newNode];
      const newEdges = [...currentEdges, newEdge];
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      triggerSave(newNodes, newEdges);

      setTimeout(() => {
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, editing: true } } : n));
      }, 50);
    },
    [getNodes, getEdges, setNodes, setEdges, pushHistory, triggerSave, addChildNode],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === "root") return;
      const currentNodes = getNodes();
      const currentEdges = getEdges();

      // Collect all descendants
      const toDelete = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of currentEdges) {
          if (toDelete.has(e.source) && !toDelete.has(e.target)) {
            toDelete.add(e.target);
            changed = true;
          }
        }
      }

      const newNodes = currentNodes.filter((n) => !toDelete.has(n.id));
      const newEdges = currentEdges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      triggerSave(newNodes, newEdges);
    },
    [getNodes, getEdges, setNodes, setEdges, pushHistory, triggerSave],
  );

  const changeColor = useCallback(
    (nodeId: string, color: string) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();

      // Collect all descendants to also update edge colors
      const subtree = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of currentEdges) {
          if (subtree.has(e.source) && !subtree.has(e.target)) {
            subtree.add(e.target);
            changed = true;
          }
        }
      }

      const newNodes = currentNodes.map((n) =>
        subtree.has(n.id) ? { ...n, data: { ...n.data, color } } : n
      );
      const newEdges = currentEdges.map((e) =>
        subtree.has(e.source) ? { ...e, data: { ...(e.data ?? {}), color } } : e
      );
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      triggerSave(newNodes, newEdges);
    },
    [getNodes, getEdges, setNodes, setEdges, pushHistory, triggerSave],
  );

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const node = currentNodes.find((n) => n.id === nodeId);
      const isCollapsed = (node?.data as any)?.collapsed ?? false;

      // Find direct children
      const directChildren = currentEdges.filter((e) => e.source === nodeId).map((e) => e.target);

      // Collect all descendants
      const descendants = new Set<string>(directChildren);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of currentEdges) {
          if (descendants.has(e.source) && !descendants.has(e.target)) {
            descendants.add(e.target);
            changed = true;
          }
        }
      }

      const collapsedCount = descendants.size;

      const newNodes = currentNodes.map((n) => {
        if (n.id === nodeId) return { ...n, data: { ...n.data, collapsed: !isCollapsed, collapsedCount, hasChildren: directChildren.length > 0 } };
        if (descendants.has(n.id)) return { ...n, hidden: !isCollapsed };
        return n;
      });
      const newEdges = currentEdges.map((e) => {
        if (descendants.has(e.target) || descendants.has(e.source)) return { ...e, hidden: !isCollapsed };
        return e;
      });

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [getNodes, getEdges, setNodes, setEdges],
  );

  const startEdit = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, editing: true } } : { ...n, data: { ...(n.data ?? {}), editing: false } }));
    },
    [setNodes],
  );

  const finishEdit = useCallback(
    (nodeId: string, label: string) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const newNodes = currentNodes.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label, editing: false } } : n);
      setNodes(newNodes);
      pushHistory(newNodes, currentEdges);
      triggerSave(newNodes, currentEdges);
    },
    [getNodes, getEdges, setNodes, pushHistory, triggerSave],
  );

  const cancelEdit = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, editing: false } } : n));
    },
    [setNodes],
  );

  // Expose to node components via window globals
  useEffect(() => {
    (window as any).__mmAddChild = addChildNode;
    (window as any).__mmAddSibling = addSiblingNode;
    (window as any).__mmDeleteNode = deleteNode;
    (window as any).__mmChangeColor = changeColor;
    (window as any).__mmToggleCollapse = toggleCollapse;
    (window as any).__mmFinishEdit = finishEdit;
    (window as any).__mmCancelEdit = cancelEdit;
    (window as any).__mmGenerateAI = generateAI;
    (window as any).__mmCreatePost = (_nodeId: string, label: string) =>
      setMmPostDialog({ open: true, title: label });
    return () => {
      delete (window as any).__mmAddChild;
      delete (window as any).__mmAddSibling;
      delete (window as any).__mmDeleteNode;
      delete (window as any).__mmChangeColor;
      delete (window as any).__mmToggleCollapse;
      delete (window as any).__mmFinishEdit;
      delete (window as any).__mmCancelEdit;
      delete (window as any).__mmGenerateAI;
      delete (window as any).__mmCreatePost;
    };
  });

  // ── AI Generation ─────────────────────────────────────────────────────────
  const generateAI = useCallback(async (nodeId: string) => {
    const currentNodes = getNodes();
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const label = (node.data as any).label ?? "";
    if (!label) return;

    setIsGeneratingAI(nodeId);
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isGenerating: true } } : n));

    try {
      const res = await fetch("/api/ai/mind-map-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label }),
      });
      if (!res.ok) throw new Error("Erro na API");
      const data = await res.json();
      setAiSuggestionDialog({ nodeId, label, suggestions: data.suggestions ?? [] });
    } catch {
      // Fallback: generate locally if API not available
      const fallback = [
        `${label} - Conceito 1`,
        `${label} - Conceito 2`,
        `${label} - Conceito 3`,
        `${label} - Conceito 4`,
        `${label} - Conceito 5`,
      ];
      setAiSuggestionDialog({ nodeId, label, suggestions: fallback });
    } finally {
      setIsGeneratingAI(null);
      setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isGenerating: false } } : n));
    }
  }, [getNodes, setNodes]);

  const applyAISuggestions = useCallback((nodeId: string, suggestions: string[]) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const parent = currentNodes.find((n) => n.id === nodeId);
    if (!parent) return;

    const parentColor = getBranchColor(nodeId, currentNodes, currentEdges);
    const parentDepth = getNodeDepth(nodeId, currentNodes, currentEdges);
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    suggestions.forEach((label, i) => {
      const id = `node-ai-${Date.now()}-${i}`;
      newNodes.push({
        id,
        type: "topic",
        position: { x: parent.position.x + 220, y: parent.position.y + (i - suggestions.length / 2) * 70 },
        data: { label, color: parentColor, depth: parentDepth + 1, aiSuggested: false },
      });
      newEdges.push({
        id: `e-${nodeId}-${id}`,
        source: nodeId,
        target: id,
        type: "custom",
        data: { color: parentColor },
      });
    });

    const finalNodes = [...currentNodes, ...newNodes];
    const finalEdges = [...currentEdges, ...newEdges];
    setNodes(finalNodes);
    setEdges(finalEdges);
    pushHistory(finalNodes, finalEdges);
    triggerSave(finalNodes, finalEdges);
    setAiSuggestionDialog(null);
  }, [getNodes, getEdges, setNodes, setEdges, pushHistory, triggerSave]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      // Don't intercept when editing
      const activeTag = document.activeElement?.tagName;
      const isEditing = activeTag === "INPUT" || activeTag === "TEXTAREA";

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); return; }
        if (e.key === "f") { e.preventDefault(); setSearchOpen((p) => !p); return; }
        if (e.shiftKey && e.key === "H") { e.preventDefault(); fitView({ padding: 0.1 }); return; }
        if (e.key === "s") { e.preventDefault(); handleSave(); return; }
      }

      if (isEditing) return;

      const selected = getNodes().find((n) => n.selected);
      if (!selected) return;

      if (e.key === "Tab") { e.preventDefault(); addChildNode(selected.id); }
      else if (e.key === "Enter") { e.preventDefault(); addSiblingNode(selected.id); }
      else if (e.key === "F2") { e.preventDefault(); startEdit(selected.id); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected.id !== "root") {
        e.preventDefault();
        deleteNode(selected.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, fitView, handleSave, getNodes, addChildNode, addSiblingNode, startEdit, deleteNode]);

  // ── Update hasChildren for all nodes ─────────────────────────────────────
  useEffect(() => {
    const childSet = new Set(edges.map((e) => e.source));
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, hasChildren: childSet.has(n.id) },
    })));
  }, [edges.length]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportPNG = useCallback(async () => {
    const el = reactFlowRef.current?.querySelector(".react-flow__viewport") as HTMLElement;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindmap-${Date.now()}.png`;
      a.click();
      toast.success("PNG exportado!");
    } catch {
      toast.error("Erro ao exportar PNG");
    }
  }, []);

  const exportJSON = useCallback(() => {
    const data = { nodes: nodes.filter((n) => !n.id.startsWith("card-")), edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindmap-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado!");
  }, [nodes, edges]);

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResults = searchQuery
    ? nodes.filter((n) => {
        const label = ((n.data as any).label ?? (n.data as any).title ?? "").toLowerCase();
        return label.includes(searchQuery.toLowerCase());
      })
    : [];

  const highlightSearchNodes = useCallback(() => {
    if (!searchQuery) {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, searchHighlight: false } })));
      return;
    }
    setNodes((nds) =>
      nds.map((n) => {
        const label = ((n.data as any).label ?? (n.data as any).title ?? "").toLowerCase();
        return { ...n, data: { ...n.data, searchHighlight: label.includes(searchQuery.toLowerCase()) } };
      })
    );
  }, [searchQuery, setNodes]);

  useEffect(() => { highlightSearchNodes(); }, [searchQuery]);

  // Double click to edit
  const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: Node) => {
    if (node.type === "cardNode") return;
    startEdit(node.id);
  }, [startEdit]);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    // track position changes for history
    const hasMoved = changes.some((c: any) => c.type === "position" && c.dragging === false);
    if (hasMoved) {
      const ns = getNodes();
      const es = getEdges();
      pushHistory(ns, es);
      triggerSave(ns, es);
    }
  }, [onNodesChange, getNodes, getEdges, pushHistory, triggerSave]);

  // ── Planejamento semanal, Lista e itens de conteúdo (spec 0068) ─────────────
  const router = useRouter();
  const isMobile = useIsMobile();
  // O editor tem o próprio menu de baixo no celular; o menu em órbita sairia por cima dele.
  useHideOrbitDock();
  const [chosenView, setChosenView] = useState<"map" | "list" | null>(null);
  const view = chosenView ?? (isMobile ? "list" : "map");
  const [itemRequest, setItemRequest] = useState<MapItemRequest | null>(null);
  const [isContentsOpen, setIsContentsOpen] = useState(false);

  const rootData = nodes.find((node) => node.id === ROOT_NODE_ID)?.data as Record<string, unknown> | undefined;
  const weekStartIso = typeof rootData?.weekStartIso === "string" ? rootData.weekStartIso : null;
  const weeklyOrganizationId = typeof rootData?.organizationId === "string" ? rootData.organizationId : null;
  const isWeekly = Boolean(weekStartIso && weeklyOrganizationId);
  const weekRange = useMemo(() => {
    const from = weekStartIso ? new Date(weekStartIso) : new Date(0);
    return { from, to: addDays(from, 7) };
  }, [weekStartIso]);
  const { posts: weekPosts } = usePlannerCalendarPosts({ organizationIds: weeklyOrganizationId ? [weeklyOrganizationId] : undefined, ...weekRange }, { enabled: isWeekly });
  const { themes: allWeekdayThemes } = usePlannerWeekdayThemes(weeklyOrganizationId ? [weeklyOrganizationId] : undefined);
  const weekThemes = useMemo(() => allWeekdayThemes.filter((theme) => theme.organizationId === weeklyOrganizationId), [allWeekdayThemes, weeklyOrganizationId]);
  const postsById = useMemo(() => new Map<string, MapPostInfo>(weekPosts.map((post) => [post.id, { status: post.status, scheduledAt: post.scheduledAt, title: post.title }])), [weekPosts]);
  const pendingContents = useMemo(() => (isWeekly ? listPendingContents(nodes as never, edges as MapEdge[]) : []), [isWeekly, nodes, edges]);

  const applyGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      pushHistory(nextNodes, nextEdges);
      triggerSave(nextNodes, nextEdges);
    },
    [setNodes, setEdges, pushHistory, triggerSave],
  );

  const organizeMap = useCallback(() => {
    applyGraph(layoutTree(getNodes(), getEdges() as MapEdge[]), getEdges());
    setTimeout(() => fitView({ padding: 0.1 }), 60);
  }, [applyGraph, getNodes, getEdges, fitView]);

  const addMapItem = useCallback(
    (kind: MapItemKind, parentId: string, values: MapItemValues) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const parent = currentNodes.find((node) => node.id === parentId);
      if (!parent) return;
      const color = parentId === ROOT_NODE_ID ? getNextBranchColor(currentNodes) : getBranchColor(parentId, currentNodes, currentEdges);
      const nodeId = `node-${Date.now()}`;
      const siblingCount = currentEdges.filter((edge) => edge.source === parentId).length;
      const nodeByKind: Record<MapItemKind, Pick<Node, "type" | "data">> = {
        post: { type: "postNode", data: { title: values.title, format: values.format } },
        link: { type: "linkNode", data: { label: values.title || values.url, url: values.url } },
        note: { type: "stickyNote", data: { label: values.title } },
        topic: { type: "topic", data: { label: values.title, color, depth: getNodeDepth(parentId, currentNodes, currentEdges) + 1 } },
      };
      const newNode: Node = { id: nodeId, position: { x: parent.position.x + 290, y: parent.position.y + siblingCount * 70 }, ...nodeByKind[kind] };
      const newEdge: Edge = { id: `e-${parentId}-${nodeId}`, source: parentId, target: nodeId, type: "custom", data: { color } };
      const nextEdges = [...currentEdges, newEdge];
      // No planejamento semanal o mapa se mantém organizado sozinho; nos outros, o item entra ao lado do pai.
      const nextNodes = isWeekly ? layoutTree([...currentNodes, newNode], nextEdges as MapEdge[]) : [...currentNodes, newNode];
      applyGraph(nextNodes, nextEdges);
    },
    [getNodes, getEdges, getNextBranchColor, applyGraph, isWeekly],
  );

  const updateMapItem = useCallback(
    (nodeId: string, kind: MapItemKind, values: MapItemValues) => {
      const patchByKind: Record<MapItemKind, Record<string, unknown>> = {
        post: { title: values.title, format: values.format },
        link: { label: values.title || values.url, url: values.url },
        note: { label: values.title },
        topic: { label: values.title },
      };
      applyGraph(
        getNodes().map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patchByKind[kind] } } : node)),
        getEdges(),
      );
    },
    [applyGraph, getNodes, getEdges],
  );

  const openMapItem = useCallback(
    (nodeId: string) => {
      const node = getNodes().find((candidate) => candidate.id === nodeId);
      if (!node) return;
      const data = node.data as Record<string, unknown>;
      const kindByType: Record<string, MapItemKind> = { postNode: "post", linkNode: "link", stickyNote: "note", topic: "topic" };
      const kind = kindByType[node.type ?? ""];
      if (!kind) return;
      setItemRequest({
        mode: "edit",
        kind,
        nodeId,
        postId: typeof data.postId === "string" ? data.postId : undefined,
        initial: { title: String(data.title ?? data.label ?? ""), url: typeof data.url === "string" ? data.url : "", format: data.format as MapItemValues["format"] | undefined },
      });
    },
    [getNodes],
  );

  const requestAddItem = useCallback(
    (kind: MapItemKind, parentId?: string) => {
      const currentNodes = getNodes();
      const targetId = parentId ?? currentNodes.find((node) => node.selected)?.id ?? ROOT_NODE_ID;
      const target = currentNodes.find((node) => node.id === targetId);
      if (kind === "post") {
        const dayTopic = findDayTopic(targetId, currentNodes as never, getEdges() as MapEdge[]);
        if (!dayTopic) {
          toast.info("Escolha um dia primeiro: toque no dia no mapa ou use a Lista.");
          return;
        }
        setItemRequest({ mode: "create", kind, parentId: dayTopic.id, parentLabel: String(dayTopic.data.label ?? "") });
        return;
      }
      setItemRequest({ mode: "create", kind, parentId: targetId, parentLabel: String((target?.data as Record<string, unknown> | undefined)?.label ?? (target?.data as Record<string, unknown> | undefined)?.title ?? "") });
    },
    [getNodes, getEdges],
  );

  const syncWithScript = useCallback(() => {
    const merged = mergeWeeklyPosts(getNodes() as never, getEdges() as MapEdge[], weekPosts, weekThemes);
    applyGraph(layoutTree(merged.nodes as Node[], merged.edges) as Node[], merged.edges as Edge[]);
    toast.success(merged.addedCount > 0 ? `${merged.addedCount} conteúdo${merged.addedCount > 1 ? "s" : ""} do roteiro entr${merged.addedCount > 1 ? "aram" : "ou"} no mapa.` : "O mapa já está em dia com o roteiro.");
  }, [applyGraph, getNodes, getEdges, weekPosts, weekThemes]);

  const linkCreatedPost = useCallback(
    (nodeId: string, postId: string) => {
      const nextNodes = getNodes().map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, postId } } : node));
      setNodes(nextNodes);
      triggerSave(nextNodes, getEdges());
    },
    [getNodes, getEdges, setNodes, triggerSave],
  );

  const onNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (node.type === "postNode" || node.type === "linkNode") openMapItem(node.id);
    },
    [openMapItem],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return (
    <MindMapPostsContext.Provider value={postsById}>
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="z-10 flex shrink-0 items-center gap-1.5 bg-background px-3 py-2">
        <Link href="/nasa-planner?tab=mindmaps" aria-label="Voltar aos mapas" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted">
          <ArrowLeftIcon className="size-4" />
        </Link>
        <span className="min-w-0 truncate text-sm font-semibold">{(mindMap as any)?.name ?? "Mapa Mental"}</span>
        <div className="ml-1 inline-flex shrink-0 rounded-full bg-muted p-[3px]">
          {(["map", "list"] as const).map((viewOption) => (
            <button
              key={viewOption}
              type="button"
              onClick={() => setChosenView(viewOption)}
              className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs", view === viewOption ? "bg-foreground font-semibold text-background" : "text-muted-foreground")}
            >
              {viewOption === "map" ? <NetworkIcon className="size-3.5" /> : <ListTreeIcon className="size-3.5" />}
              {viewOption === "map" ? "Mapa" : "Lista"}
            </button>
          ))}
        </div>
        <div className="flex-1" />

        {isSaving && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <OrbitaSpinner className="size-3" /> <span className="max-sm:hidden">Salvando</span>
          </span>
        )}

        {/* Computador: ações na barra. No celular elas ficam no menu de baixo. */}
        <div className="flex items-center gap-1.5 max-md:hidden">
          <Button size="icon" variant="ghost" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="size-8 rounded-full">
            <Undo2Icon className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)" className="size-8 rounded-full">
            <Redo2Icon className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setSearchOpen((isOpen) => !isOpen)} title="Buscar (Ctrl+F)" className="size-8 rounded-full">
            <SearchIcon className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => requestAddItem("topic")}>
            <PlusIcon className="size-3.5" /> Tópico
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => (isWeekly ? requestAddItem("post") : setCardDialogOpen(true))}>
            <ZapIcon className="size-3.5" /> Card
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => requestAddItem("link")}>
            <Link2Icon className="size-3.5" /> Link
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => requestAddItem("note")}>
            <StickyNoteIcon className="size-3.5" /> Nota
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={organizeMap}>
            <WorkflowIcon className="size-3.5" /> Organizar
          </Button>
          {isWeekly && (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={syncWithScript}>
                <RefreshCwIcon className="size-3.5" /> Atualizar com o roteiro
              </Button>
              <Button size="sm" className="h-8 gap-1.5 rounded-full" onClick={() => setIsContentsOpen(true)}>
                <SparklesIcon className="size-3.5" /> Criar conteúdos{pendingContents.length > 0 && ` (${pendingContents.length})`}
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title="Exportar" className="size-8 rounded-full">
                <DownloadIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportPNG}>
                <ImageIcon className="mr-2 size-3.5" /> PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON}>
                <FileJsonIcon className="mr-2 size-3.5" /> JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="icon" variant="ghost" onClick={handleSave} disabled={isSaving} title="Salvar agora" className="size-8 rounded-full">
            <SaveIcon className="size-3.5" />
          </Button>
          <FullscreenControls />
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur z-10">
          <SearchIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Buscar nós..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-sm border-none shadow-none focus-visible:ring-0"
          />
          {searchResults.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{searchResults.length} resultado(s)</span>
          )}
          <Button size="icon" variant="ghost" className="size-7" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
            <XIcon className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className={cn("flex items-center gap-3 px-4 py-1 text-[10px] text-muted-foreground bg-muted/30 shrink-0 overflow-x-auto max-md:hidden", view === "list" && "hidden")}>
        <span><kbd className="font-mono bg-muted px-1 rounded">Tab</kbd> filho</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Enter</kbd> irmão</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">F2</kbd> editar</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Del</kbd> excluir</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Ctrl+Z</kbd> desfazer</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Ctrl+G</kbd> IA</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Ctrl+F</kbd> buscar</span>
        <span>clique duplo = editar</span>
      </div>

      {view === "list" && (
        <div className="min-h-0 flex-1">
          <MindMapOutlineView nodes={nodes} edges={edges} canAddContentCards={isWeekly} onOpenItem={openMapItem} onAdd={requestAddItem} />
        </div>
      )}

      {/* Canvas */}
      <div className={cn("flex-1 min-h-0", view === "list" && "hidden")} ref={reactFlowRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          deleteKeyCode={null}
          defaultEdgeOptions={{ type: "custom" }}
          minZoom={0.1}
          maxZoom={2.5}
          panOnScroll={false}
          zoomOnScroll={true}
        >
          <Background gap={24} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              if ((n.data as any)?.searchHighlight === false && searchQuery) return "#e5e7eb";
              return (n.data as any).color ?? "#7C3AED";
            }}
            className="!bottom-4 !right-4 max-md:!hidden"
          />
        </ReactFlow>
      </div>

      {/* Celular: ações no menu de baixo, com toque de 44px. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-card p-1.5 shadow-xl">
          <button type="button" aria-label="Desfazer" onClick={undo} disabled={!canUndo} className="grid size-11 place-items-center rounded-full disabled:opacity-30">
            <Undo2Icon className="size-4" />
          </button>
          <button type="button" aria-label="Organizar" onClick={organizeMap} className="grid size-11 place-items-center rounded-full">
            <WorkflowIcon className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background">
                <PlusIcon className="size-4" /> Adicionar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-56 rounded-[18px] p-1.5">
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => requestAddItem("topic")}>
                <WorkflowIcon className="size-4" /> Tópico
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => (isWeekly ? requestAddItem("post") : setCardDialogOpen(true))}>
                <LayoutListIcon className="size-4" /> Card
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => requestAddItem("link")}>
                <Link2Icon className="size-4" /> Link
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => requestAddItem("note")}>
                <StickyNoteIcon className="size-4" /> Nota
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isWeekly && (
            <button type="button" aria-label="Criar conteúdos" onClick={() => setIsContentsOpen(true)} className="relative grid size-11 place-items-center rounded-full">
              <SparklesIcon className="size-4" />
              {pendingContents.length > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white">{pendingContents.length}</span>}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Mais ações" className="grid size-11 place-items-center rounded-full">
                <MoreHorizontalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60 rounded-[18px] p-1.5">
              {isWeekly && (
                <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={syncWithScript}>
                  <RefreshCwIcon className="size-4" /> Atualizar com o roteiro
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={redo} disabled={!canRedo}>
                <Redo2Icon className="size-4" /> Refazer
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => { setChosenView("map"); setSearchOpen(true); }}>
                <SearchIcon className="size-4" /> Buscar no mapa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={exportPNG}>
                <ImageIcon className="size-4" /> Exportar PNG
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={exportJSON}>
                <FileJsonIcon className="size-4" /> Exportar JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MapItemDialog
        request={itemRequest}
        onSave={(values) => {
          if (!itemRequest) return;
          if (itemRequest.mode === "create") addMapItem(itemRequest.kind, itemRequest.parentId, values);
          else updateMapItem(itemRequest.nodeId, itemRequest.kind, values);
        }}
        onDelete={itemRequest?.mode === "edit" && itemRequest.nodeId !== ROOT_NODE_ID ? () => deleteNode(itemRequest.nodeId) : undefined}
        onOpenPost={(postId) => router.push(`/nasa-planner?tab=calendar&post=${postId}`)}
        onClose={() => setItemRequest(null)}
      />
      {weeklyOrganizationId && (
        <WeeklyContentsDialog isOpen={isContentsOpen} organizationId={weeklyOrganizationId} pendingContents={pendingContents} onCreated={linkCreatedPost} onClose={() => setIsContentsOpen(false)} />
      )}

      {/* Card Creation Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Card de Ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="O que precisa ser feito?"
                value={cardForm.title}
                onChange={(e) => setCardForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                placeholder="Detalhes..."
                value={cardForm.description}
                onChange={(e) => setCardForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={cardForm.priority} onValueChange={(v) => setCardForm((f) => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baixa</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data limite</Label>
                <Input type="date" value={cardForm.dueDate} onChange={(e) => setCardForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!cardForm.title.trim()) return;
                await createCard.mutateAsync({ mindMapId, plannerId, title: cardForm.title, description: cardForm.description, priority: cardForm.priority, dueDate: cardForm.dueDate || undefined });
                setCardDialogOpen(false);
                setCardForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
              }}
              disabled={!cardForm.title.trim() || createCard.isPending}
            >
              {createCard.isPending ? "Criando..." : "Criar Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggestion Dialog */}
      {aiSuggestionDialog && (
        <Dialog open onOpenChange={() => setAiSuggestionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BotIcon className="size-4 text-warning" />
                Sugestões de IA para “{aiSuggestionDialog.label}”
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selecione as sugestões que deseja adicionar como filhos:</p>
              <ul className="space-y-1.5">
                {aiSuggestionDialog.suggestions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted/50">
                    <span className="size-5 rounded-full bg-warning/15 text-warning flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAiSuggestionDialog(null)}>Cancelar</Button>
              <Button onClick={() => applyAISuggestions(aiSuggestionDialog.nodeId, aiSuggestionDialog.suggestions)}>
                Adicionar todos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mind Map → Post Dialog */}
      <MindMapToPostDialog
        open={mmPostDialog.open}
        onOpenChange={(open) => setMmPostDialog((s) => ({ ...s, open }))}
        plannerId={plannerId}
        initialTitle={mmPostDialog.title}
      />
    </div>
    </MindMapPostsContext.Provider>
  );
}

// ─── Exported wrapper ─────────────────────────────────────────────────────────
export function NasaPlannerMindMapEditor({ plannerId, mindMapId }: { plannerId: string; mindMapId: string }) {
  return (
    <ReactFlowProvider>
      <MindMapEditorInner plannerId={plannerId} mindMapId={mindMapId} />
    </ReactFlowProvider>
  );
}
