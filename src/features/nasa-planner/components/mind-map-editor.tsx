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
  type NodeChange,
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
import { getBranchColor, getNodeDepth, isNodeCollapsed, parseStoredEdges, parseStoredNodes, readNodeColor, readNodeText } from "../lib/mind-map/editor-graph";
import { registerMindMapEditorActions } from "../lib/mind-map/editor-bridge";
import { useMindMapHistory } from "../hooks/use-mind-map-history";
import { MindMapPostsContext, type MapPostInfo } from "./mind-map/content-nodes";
import { ActionCardDialog, AiSuggestionsDialog, type AiSuggestionRequest } from "./mind-map/editor-dialogs";
import { mindMapEdgeTypes, mindMapNodeTypes } from "./mind-map/editor-nodes";
import { MindMapDesktopActions, MindMapMobileMenu, type MindMapToolbarActions, type MindMapToolbarState } from "./mind-map/editor-toolbar";
import { MapItemDialog, type MapItemKind, type MapItemRequest, type MapItemValues } from "./mind-map/item-dialog";
import { MindMapOutlineView } from "./mind-map/outline-view";
import { WeeklyContentsDialog } from "./mind-map/weekly-contents-dialog";

// ─── Main Editor ──────────────────────────────────────────────────────────────
function MindMapEditorInner({ plannerId, mindMapId }: { plannerId: string; mindMapId: string }) {
  const { mindMap, isLoading } = useNasaPlannerMindMap(mindMapId);
  const updateMindMap = useUpdateMindMap();
  const { cards } = useNasaPlannerCards({ mindMapId });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [aiSuggestionDialog, setAiSuggestionDialog] = useState<AiSuggestionRequest | null>(null);
  const [mmPostDialog, setMmPostDialog] = useState<{ open: boolean; title: string }>({ open: false, title: "" });

  const { pushHistory, resetHistory, undo, redo, canUndo, canRedo } = useMindMapHistory(setNodes, setEdges);

  const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reactFlowRef = useRef<HTMLDivElement>(null);

  // Load mind map data
  useEffect(() => {
    if (!mindMap) return;
    const rawNodes = parseStoredNodes(mindMap.nodes);
    const rawEdges = parseStoredEdges(mindMap.edges);

    const cardNodes: Node[] = cards.map((card) => {
      const nodeId = `card-${card.id}`;
      return {
        id: nodeId,
        type: "cardNode",
        position: rawNodes.find((n) => n.id === nodeId)?.position ?? { x: 600, y: Math.random() * 400 },
        data: { title: card.title, status: card.status, priority: card.priority, dueDate: card.dueDate, cardId: card.id },
      };
    });

    const nonCardNodes = rawNodes.filter((n) => !n.id.startsWith("card-"));
    const allNodes = [...nonCardNodes, ...cardNodes];
    const allEdges = rawEdges;

    setNodes(allNodes);
    setEdges(allEdges);
    resetHistory(allNodes, allEdges);
  }, [mindMap, cards]);

  // Auto-save
  const triggerSave = useCallback((ns: Node[], es: Edge[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateMindMap.mutateAsync({
          mindMapId,
          nodes: ns.filter((n) => !n.id.startsWith("card-")),
          edges: es,
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
        nodes: nodes.filter((n) => !n.id.startsWith("card-")),
        edges,
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
    const usedColors = new Set(currentNodes.filter((n) => n.type === "topic" || n.type === "mindMapRoot").map((n) => readNodeColor(n)).filter(Boolean));
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
      const isCollapsed = isNodeCollapsed(node);

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

  // Sem dependências de propósito: registra a cada render para os nós sempre chamarem a versão atual.
  useEffect(() =>
    registerMindMapEditorActions({
      addChild: addChildNode,
      addSibling: addSiblingNode,
      deleteNode,
      changeColor,
      toggleCollapse,
      finishEdit,
      cancelEdit,
      generateAI,
      createPost: (_nodeId, label) => setMmPostDialog({ open: true, title: label }),
    }),
  );

  // ── AI Generation ─────────────────────────────────────────────────────────
  const generateAI = useCallback(async (nodeId: string) => {
    const currentNodes = getNodes();
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const label = typeof node.data.label === "string" ? node.data.label : "";
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
        const label = readNodeText(n).toLowerCase();
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
        const label = readNodeText(n).toLowerCase();
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

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    // track position changes for history
    const hasMoved = changes.some((c) => c.type === "position" && c.dragging === false);
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

  const toolbarState: MindMapToolbarState = {
    canUndo: canUndo(),
    canRedo: canRedo(),
    isSaving,
    isWeekly,
    pendingContentCount: pendingContents.length,
  };
  const toolbarActions: MindMapToolbarActions = {
    onUndo: undo,
    onRedo: redo,
    onToggleSearch: () => setSearchOpen((isOpen) => !isOpen),
    onSearchInMap: () => { setChosenView("map"); setSearchOpen(true); },
    onAddItem: (kind) => requestAddItem(kind),
    onAddActionCard: () => setCardDialogOpen(true),
    onOrganize: organizeMap,
    onSyncWithScript: syncWithScript,
    onOpenContents: () => setIsContentsOpen(true),
    onExportPng: exportPNG,
    onExportJson: exportJSON,
    onSave: handleSave,
  };

  return (
    <MindMapPostsContext.Provider value={postsById}>
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="z-10 flex shrink-0 items-center gap-1.5 bg-background px-3 py-2">
        <Link href="/nasa-planner?tab=mindmaps" aria-label="Voltar aos mapas" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted">
          <ArrowLeftIcon className="size-4" />
        </Link>
        <span className="min-w-0 truncate text-sm font-semibold">{mindMap?.name ?? "Mapa Mental"}</span>
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

        <MindMapDesktopActions state={toolbarState} actions={toolbarActions} />
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
          nodeTypes={mindMapNodeTypes}
          edgeTypes={mindMapEdgeTypes}
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
              if (n.data.searchHighlight === false && searchQuery) return "#e5e7eb";
              return readNodeColor(n) ?? "#7C3AED";
            }}
            className="!bottom-4 !right-4 max-md:!hidden"
          />
        </ReactFlow>
      </div>

      <MindMapMobileMenu state={toolbarState} actions={toolbarActions} />

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
      <ActionCardDialog isOpen={cardDialogOpen} onOpenChange={setCardDialogOpen} plannerId={plannerId} mindMapId={mindMapId} />
      <AiSuggestionsDialog request={aiSuggestionDialog} onApply={applyAISuggestions} onClose={() => setAiSuggestionDialog(null)} />

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
