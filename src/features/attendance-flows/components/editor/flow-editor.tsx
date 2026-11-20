"use client";

// Editor do FlowAstro (spec 0139): canvas claro, cartões com o conteúdo, painel de edição à esquerda e salvamento sozinho.
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useFlowColorMode } from "@/hooks/use-flow-color-mode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { createId } from "@paralleldrive/cuid2";
import { ChevronLeftIcon, LayoutTemplateIcon, PhoneIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { autoLayoutWorkflow } from "@/features/editor/lib/auto-layout";
import { cn } from "@/lib/utils";
import { BLOCKS, type BlockDefinition } from "../../lib/block-catalog";
import { PROMO_LOOKUP_VARIABLES, PROMO_RECEIPT_VARIABLES } from "../../lib/nodes";
import {
  useAttendanceFlow,
  useAttendanceFlowGraph,
  useAttendanceFlows,
  useAttendanceLeadsByNode,
  useAttendanceNumberOptions,
  useRenameAttendanceFlow,
  useSaveAttendanceFlowGraph,
  useSetAttendanceFlowActive,
  useSetAttendanceFlowNumbers,
} from "../../hooks/use-attendance-flows";
import { BlockPanel, type FlowNumber } from "./block-panel";
import { BLOCK_ICONS, FlowBlockNode, TONE_CLASSES, type FlowBlockData, type FlowBlockNodeType } from "./flow-block-node";

const BLOCK_NODE_TYPES = ["ATTENDANCE_START", "IF_CONDITION", "SEND_MESSAGE", "ASK_QUESTION", "RANDOMIZER", "WAIT", "CALL_WORKFLOW", "AI_AGENT", "DISTRIBUTE", "TAG", "FINISH_ATTENDANCE", "PROMO_ENROLL", "PROMO_RECEIPT", "PROMO_LOOKUP"];
const NODE_TYPES: NodeTypes = Object.fromEntries(BLOCK_NODE_TYPES.map((nodeType) => [nodeType, FlowBlockNode]));
const AUTOSAVE_DELAY_MS = 1200;
// Largura da lista de blocos (w-80) mais a folga até o ponto solto.
const DROP_PALETTE_SPACE_PX = 320 + 24;
const EDGE_STYLE = { stroke: "var(--muted-foreground)", strokeOpacity: 0.55, strokeWidth: 1.5 };

type SaveState = "saved" | "pending" | "saving" | "error";

// Ligação solta no vazio: onde abrir a lista de blocos e de qual saída ela partiu.
interface PendingDrop {
  anchor: { x: number; y: number };
  flowPosition: { x: number; y: number };
  source: string;
  sourceHandle: string | null;
}

function stripRuntimeData(data: FlowBlockData): Record<string, unknown> {
  const { leadsHere: _leadsHere, ...rest } = data;
  return rest;
}

function BlockPalette({ onAdd }: { onAdd: (block: BlockDefinition) => void }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = BLOCKS.filter((block) => block.key !== "start" && (!term || `${block.label} ${block.description}`.toLowerCase().includes(term)));
  const categories = [...new Set(visible.map((block) => block.category))];
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar blocos…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {categories.map((category) => (
          <div key={category} className="space-y-1">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
            {visible
              .filter((block) => block.category === category)
              .map((block) => {
                const Icon = BLOCK_ICONS[block.key];
                return (
                  <button key={block.key} type="button" onClick={() => onAdd(block)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_CLASSES[block.tone].icon)} />
                    <span>
                      <span className="block text-sm font-medium">{block.label}</span>
                      <span className="block text-xs text-muted-foreground">{block.description}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function NumbersPicker({ workflowId, selectedIds, numbers }: { workflowId: string; selectedIds: string[]; numbers: FlowNumber[] }) {
  const setNumbers = useSetAttendanceFlowNumbers();
  const toggle = (trackingId: string, isChecked: boolean) => {
    const next = isChecked ? [...selectedIds, trackingId] : selectedIds.filter((id) => id !== trackingId);
    setNumbers.mutate({ workflowId, trackingIds: next }, { onError: (error) => toast.error(error.message) });
  };
  const summary = selectedIds.length === 0 ? "Nenhum número" : selectedIds.length === 1 ? (numbers.find((number) => number.trackingId === selectedIds[0])?.name ?? "1 número") : `${selectedIds.length} números`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", selectedIds.length === 0 && "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300")}>
          <PhoneIcon className="size-4" /> {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-sm font-medium">Números em que o fluxo responde</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {numbers.map((number) => (
            <label key={number.trackingId} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
              <Checkbox checked={selectedIds.includes(number.trackingId)} disabled={setNumbers.isPending} onCheckedChange={(checked) => toggle(number.trackingId, checked === true)} />
              {number.name}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FlowCanvas({ workflowId }: { workflowId: string }) {
  const flowColorMode = useFlowColorMode();
  const { data: graph } = useAttendanceFlowGraph(workflowId);
  const { data: flowMeta } = useAttendanceFlow(workflowId);
  const { data: numberOptions } = useAttendanceNumberOptions();
  const { data: flowList } = useAttendanceFlows();
  const { data: leadCounts } = useAttendanceLeadsByNode(workflowId);
  const saveGraph = useSaveAttendanceFlowGraph();
  const renameFlow = useRenameAttendanceFlow();
  const setActive = useSetAttendanceFlowActive();
  const { screenToFlowPosition, getViewport, setViewport, fitView, getInternalNode } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowBlockNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    if (!graph || isLoadedRef.current) return;
    isLoadedRef.current = true;
    setNodes(graph.nodes.map((node) => ({ id: node.id, type: String(node.type), position: node.position, data: (node.data ?? {}) as FlowBlockData })));
    // O cartão já nomeia cada saída ("Respondeu", botões): a legenda técnica da linha ("answered") só polui.
    setEdges(graph.edges.map((edge) => ({ ...edge, label: undefined, style: EDGE_STYLE })));
  }, [graph, setNodes, setEdges]);

  // Só o desenho conta: selecionar um bloco não é mudança para salvar.
  const graphPayload = useMemo(
    () => ({
      nodes: nodes.map((node) => ({ id: node.id, type: node.type ?? null, position: node.position, data: stripRuntimeData(node.data) })),
      edges: edges.map((edge) => ({ source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null, targetHandle: edge.targetHandle ?? null })),
    }),
    [nodes, edges],
  );
  const graphSignature = useMemo(() => JSON.stringify(graphPayload), [graphPayload]);

  // Salva sozinho depois de uma pausa nas mudanças, como no BotConversa.
  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    setSaveState("pending");
    const timer = setTimeout(() => {
      setSaveState("saving");
      saveGraph.mutate(
        { id: workflowId, ...(JSON.parse(graphSignature) as typeof graphPayload) },
        {
          onSuccess: (saved) => {
            setSaveState("saved");
            // O resto foi salvo; o bloco Início disputava a entrada com outro fluxo e voltou ao que era (spec 0139, RF-5).
            if (saved.entryConflict) {
              const { message, startNodeId, startNodeData } = saved.entryConflict;
              toast.error(message);
              setNodes((current) => current.map((node) => (node.id === startNodeId ? { ...node, data: startNodeData as FlowBlockData } : node)));
            }
          },
          onError: (error) => {
            setSaveState("error");
            toast.error(error.message);
          },
        },
      );
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // `saveGraph` muda a cada render; só o desenho dispara o salvamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphSignature, workflowId]);

  const numbers = useMemo<FlowNumber[]>(() => {
    const linkedIds = new Set(flowMeta?.trackingIds ?? []);
    return (numberOptions?.numbers ?? []).filter((number) => linkedIds.has(number.trackingId));
  }, [flowMeta?.trackingIds, numberOptions?.numbers]);

  // Variáveis que os blocos do fluxo gravam: a Condição pode testar cada uma.
  const variableNames = useMemo(() => {
    const names = new Set<string>();
    for (const node of nodes) {
      if (node.type === "ASK_QUESTION") {
        const name = String(node.data.variableName ?? "") || String(node.data.saveToField ?? "");
        if (name) names.add(name);
      }
      if (node.type === "AI_AGENT" && Array.isArray(node.data.fields)) {
        for (const field of node.data.fields as { variableName?: unknown; leadField?: unknown }[]) {
          const name = String(field.variableName ?? "") || String(field.leadField ?? "");
          if (name) names.add(name);
        }
      }
      if (node.type === "DISTRIBUTE") names.add("atendente");
      if (node.type === "PROMO_RECEIPT") for (const name of PROMO_RECEIPT_VARIABLES) names.add(name);
      if (node.type === "PROMO_LOOKUP") for (const name of PROMO_LOOKUP_VARIABLES) names.add(name);
    }
    return [...names];
  }, [nodes]);

  const otherFlows = useMemo(() => (flowList?.flows ?? []).filter((flow) => flow.id !== workflowId).map((flow) => ({ id: flow.id, name: flow.name })), [flowList?.flows, workflowId]);

  const countsByNode = useMemo(() => new Map((leadCounts?.counts ?? []).map((row) => [row.nodeId, row.leads])), [leadCounts?.counts]);
  const nodesWithCounts = useMemo(
    () => nodes.map((node) => (countsByNode.has(node.id) ? { ...node, data: { ...node.data, leadsHere: countsByNode.get(node.id) } } : node)),
    [nodes, countsByNode],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowBlockNodeType>[]) => {
      // O bloco inicial não sai do fluxo: sem ele ninguém entra.
      const allowed = changes.filter((change) => change.type !== "remove" || nodes.find((node) => node.id === change.id)?.type !== "ATTENDANCE_START");
      onNodesChange(allowed);
    },
    [nodes, onNodesChange],
  );

  // Uma ligação por saída: ligar de novo a mesma saída troca o destino.
  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: createId(), style: EDGE_STYLE },
          current.filter((edge) => !(edge.source === connection.source && (edge.sourceHandle ?? "source-1") === (connection.sourceHandle ?? "source-1"))),
        ),
      );
    },
    [setEdges],
  );

  const createBlockNode = (block: BlockDefinition, position: { x: number; y: number }) => {
    const id = createId();
    setNodes((current) => [...current, { id, type: block.nodeType, position, data: JSON.parse(JSON.stringify(block.defaultData)) as FlowBlockData }]);
    setSelectedNodeId(id);
    return id;
  };

  const addBlock = (block: BlockDefinition) => {
    createBlockNode(block, screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
    setIsPaletteOpen(false);
  };

  // Soltou a ligação no vazio, como no BotConversa: abre a lista ali e o bloco escolhido já nasce ligado.
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (connectionState.isValid || connectionState.fromHandle?.type !== "source" || !connectionState.fromNode || !canvasRef.current) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const canvasBox = canvasRef.current.getBoundingClientRect();
      const flowPosition = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      const anchor = { x: point.clientX - canvasBox.left, y: point.clientY - canvasBox.top };
      // A lista abre à direita do ponto; sem espaço, o canvas anda para a esquerda em vez de a lista cobrir o bloco.
      const missingSpace = anchor.x + DROP_PALETTE_SPACE_PX - canvasBox.width;
      if (missingSpace > 0) {
        const viewport = getViewport();
        void setViewport({ ...viewport, x: viewport.x - missingSpace }, { duration: 200 });
        anchor.x -= missingSpace;
      }
      setPendingDrop({
        anchor,
        flowPosition,
        source: connectionState.fromNode.id,
        sourceHandle: connectionState.fromHandle.id ?? null,
      });
    },
    [screenToFlowPosition, getViewport, setViewport],
  );

  const addBlockFromDrop = (block: BlockDefinition) => {
    if (!pendingDrop) return;
    const id = createBlockNode(block, { x: pendingDrop.flowPosition.x, y: pendingDrop.flowPosition.y - 20 });
    handleConnect({ source: pendingDrop.source, sourceHandle: pendingDrop.sourceHandle, target: id, targetHandle: "target-1" });
    setPendingDrop(null);
  };

  // Organiza da esquerda para a direita; as saídas entram na ordem em que aparecem no cartão para as linhas não se cruzarem.
  const organizeFlow = () => {
    if (nodes.length < 2) return;
    const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
    const outputTop = (edge: Edge) =>
      getInternalNode(edge.source)?.internals.handleBounds?.source?.find((handle) => handle.id === edge.sourceHandle)?.y ?? 0;
    const orderedEdges = [...edges].sort(
      (first, second) => (nodeOrder.get(first.source) ?? 0) - (nodeOrder.get(second.source) ?? 0) || outputTop(first) - outputTop(second),
    );
    const { nodes: laidOut } = autoLayoutWorkflow(nodes, orderedEdges, { direction: "LR", nodeSep: 50, rankSep: 110 });
    const positions = new Map(laidOut.map((node) => [node.id, node.position]));
    const previousPositions = new Map(nodes.map((node) => [node.id, node.position]));
    const applyPositions = (byId: Map<string, { x: number; y: number }>) => {
      setNodes((current) => current.map((node) => ({ ...node, position: byId.get(node.id) ?? node.position })));
      void fitView({ padding: 0.15, duration: 500, maxZoom: 1 });
    };
    applyPositions(positions);
    toast.success("Fluxo organizado", { action: { label: "Desfazer", onClick: () => applyPositions(previousPositions) } });
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const updateSelectedData = (data: Record<string, unknown>) => {
    setNodes((current) => current.map((node) => (node.id === selectedNodeId ? { ...node, data: data as FlowBlockData } : node)));
  };
  const deleteSelected = () => {
    if (!selectedNodeId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
  };
  const duplicateSelected = () => {
    if (!selectedNode) return;
    const id = createId();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      { ...selectedNode, id, selected: true, position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 }, data: JSON.parse(JSON.stringify(stripRuntimeData(selectedNode.data))) as FlowBlockData },
    ]);
    setSelectedNodeId(id);
  };

  const saveLabel: Record<SaveState, string> = {
    saved: "Todas as alterações foram salvas",
    pending: "Alterações não salvas",
    saving: "Salvando…",
    error: "Erro ao salvar",
  };

  if (!graph || !flowMeta) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando fluxo…</div>;

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <Link href="/flowastro" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Todos os fluxos
        </Link>
        <Input
          key={flowMeta.name}
          defaultValue={flowMeta.name}
          className="h-9 max-w-xs border-transparent text-base font-semibold shadow-none hover:border-border focus-visible:border-border"
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== flowMeta.name) renameFlow.mutate({ workflowId, name }, { onError: (error) => toast.error(error.message) });
          }}
        />
        <span className={cn("ml-auto text-xs", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>{saveLabel[saveState]}</span>
        <NumbersPicker workflowId={workflowId} selectedIds={flowMeta.trackingIds} numbers={numberOptions?.numbers ?? []} />
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={flowMeta.isActive}
            disabled={setActive.isPending}
            onCheckedChange={(isActive) =>
              setActive.mutate(
                { workflowId, isActive, ignoreCollisions: true },
                { onSuccess: () => toast.success(isActive ? "Fluxo ligado" : "Fluxo desligado"), onError: (error) => toast.error(error.message) },
              )
            }
          />
          {flowMeta.isActive ? "Ligado" : "Desligado"}
        </label>
      </header>
      <div className="flex min-h-0 flex-1">
        {selectedNode && (
          <BlockPanel
            key={selectedNode.id}
            nodeType={String(selectedNode.type)}
            data={stripRuntimeData(selectedNode.data)}
            numbers={numbers}
            flows={otherFlows}
            variableNames={variableNames}
            onChange={updateSelectedData}
            onClose={() => setSelectedNodeId(null)}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
          />
        )}
        <div ref={canvasRef} className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodesWithCounts}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            defaultEdgeOptions={{ style: EDGE_STYLE }}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            className="bg-muted/40"
            colorMode={flowColorMode}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
          <Popover open={pendingDrop !== null} onOpenChange={(isOpen) => !isOpen && setPendingDrop(null)}>
            <PopoverAnchor asChild>
              <span className="pointer-events-none absolute size-0" style={{ left: pendingDrop?.anchor.x ?? 0, top: pendingDrop?.anchor.y ?? 0 }} />
            </PopoverAnchor>
            <PopoverContent align="start" side="right" sideOffset={12} className="w-80">
              <BlockPalette onAdd={addBlockFromDrop} />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={organizeFlow}
            disabled={nodes.length < 2}
            className="absolute right-20 top-[26px] z-10 rounded-full bg-card shadow-md"
            title="Organiza os blocos da esquerda para a direita, sem sobrepor"
          >
            <LayoutTemplateIcon className="size-4" /> Organizar
          </Button>
          <Popover open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="absolute right-5 top-5 z-10 flex size-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700" aria-label="Adicionar bloco">
                <PlusIcon className="size-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <BlockPalette onAdd={addBlock} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export function FlowEditor({ workflowId }: { workflowId: string }) {
  return (
    <ReactFlowProvider>
      <FlowCanvas workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
