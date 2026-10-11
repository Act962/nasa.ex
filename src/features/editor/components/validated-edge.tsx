"use client";

/**
 * Edge customizada que detecta automaticamente se origem OU destino têm
 * erro de validação e pinta a linha em vermelho pulsante.
 *
 * Funciona como o `default` edge type — substitui o renderer só quando o
 * estado de validação tá ruim. Caso contrário renderiza idêntico ao
 * `BezierEdge` nativo, com label opcional pro `fromOutput` semântico
 * (loop/done/true/false/accepted/etc.) preservado em `edge.data`.
 */
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  Position,
  getBezierPath,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { validateNode } from "@/features/workflows/lib/validate-node";
import { stepByStepStateAtom } from "../store/step-by-step-atoms";
import { useIsEdgeOnFlowError, useIsNodeBlockedByFlowProblem, useNodeFlowDiagnostics } from "../hooks/use-flow-diagnostics";
import { flowIsActiveAtom, insertOnEdgeIdAtom, sparkRouteAtom } from "../store/atoms";
import { sparkKeyframes } from "../lib/spark-route";
import { DASH_GAP, DASH_LENGTH, DASH_MARCH_ANIMATION, FlowSpark, outlineToneColor, type OutlineTone } from "./rich/animated-outline";

const SPARK_SECONDS_PER_EDGE = 1.4;
const END_PLUS_OFFSET = 14;
/** Ângulo de quem SAI do quadro por cada lado. */
const LEAVING_ANGLE: Record<Position, number> = {
  [Position.Right]: 0,
  [Position.Bottom]: 90,
  [Position.Left]: 180,
  [Position.Top]: 270,
};

/** "+" pequeno numa ponta da ligação: aparece ao passar o mouse e indica que a ponta pode ser arrastada. */
function EdgeEndPlus({ x, y, side, color }: { x: number; y: number; side: Position; color: string }) {
  const radians = (LEAVING_ANGLE[side] * Math.PI) / 180;
  const centerX = x + Math.cos(radians) * END_PLUS_OFFSET;
  const centerY = y + Math.sin(radians) * END_PLUS_OFFSET;
  return (
    <g className="orbita-edge-end" transform={`translate(${centerX} ${centerY})`}>
      <circle r={7} fill={color} stroke="white" strokeWidth={1.5} />
      <path d="M-3.2 0 H3.2 M0 -3.2 V3.2" stroke="white" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

export function ValidatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  label,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const requestInsertOnEdge = useSetAtom(insertOnEdgeIdAtom);
  const nodes = useNodes();
  const stepState = useAtomValue(stepByStepStateAtom);

  // Quadro com erro previsto (regras do canal) também pinta as ligações que tocam nele.
  const isOnFlowError = useIsEdgeOnFlowError(id);
  // Verifica se algum dos endpoints tem validação falhando
  const hasFieldError = useMemo(() => {
    const src = nodes.find((n) => n.id === source);
    const tgt = nodes.find((n) => n.id === target);
    const check = (n?: { type?: string; data: unknown }) => {
      if (!n?.type) return false;
      const v = validateNode(
        n.type,
        n.data as Record<string, unknown> | undefined,
      );
      return !v.valid && !v.skip;
    };
    return check(src as never) || check(tgt as never);
  }, [nodes, source, target]);
  const hasError = hasFieldError || isOnFlowError;
  // A ligação é grossa e leva a cor do quadro de onde sai, nas duas visões.
  const sourceDiagnostics = useNodeFlowDiagnostics(source);
  const isSourceBlocked = useIsNodeBlockedByFlowProblem(source);
  const sourceTone: OutlineTone = sourceDiagnostics.length > 0 || isSourceBlocked ? "problem" : "ok";
  const isFlowActive = useAtomValue(flowIsActiveAtom);
  const sparkSlot = useAtomValue(sparkRouteAtom)[id];
  const sparkCycleSeconds = sparkSlot ? 2 * sparkSlot.total * SPARK_SECONDS_PER_EDGE : 0;

  // ── Step-by-Step overrides ────────────────────────────────────
  // Quando o modo está ativo, edges ganham cor verde/vermelho/cinza
  // baseado em `edgeStatuses` do atom. Override total da cor (não
  // cumula com hasError de validação).
  const stepEdgeStatus = stepState.active ? stepState.edgeStatuses[id] : undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Label semântico vindo de data.fromOutput (loop/done/true/etc) ou
  // do label direto da edge. Preserva o texto que já existia.
  const visibleLabel =
    label ??
    ((data as { fromOutput?: string } | undefined)?.fromOutput &&
    (data as { fromOutput?: string }).fromOutput !== "main"
      ? (data as { fromOutput?: string }).fromOutput
      : undefined);

  // Resolve estilo final levando em conta step-by-step
  let stroke: string | undefined;
  let strokeWidth: number | undefined;
  let animation: string | undefined;
  let opacity: number | undefined;
  let strokeDasharray: string | undefined;
  let showsSpark = false;

  if (stepEdgeStatus === "passed") {
    stroke = "var(--success)";
    strokeWidth = 2.5;
  } else if (stepEdgeStatus === "failed") {
    stroke = "var(--destructive)";
    strokeWidth = 2.5;
    animation = "edge-pulse 1.5s ease-in-out infinite";
  } else if (stepEdgeStatus === "skipped") {
    stroke = "var(--muted-foreground)";
    opacity = 0.35;
  } else {
    stroke = outlineToneColor(hasFieldError ? "problem" : sourceTone);
    strokeWidth = 4;
    strokeDasharray = `${DASH_LENGTH} ${DASH_GAP}`;
    // Trecho com problema fica tracejado e parado: o que não roda não se move.
    const isProblemEdge = hasFieldError || sourceTone === "problem";
    animation = isProblemEdge ? undefined : DASH_MARCH_ANIMATION;
    // A luz só anda em fluxo ligado e em trecho que de fato roda.
    showsSpark = isFlowActive && !hasFieldError && sourceTone === "ok" && Boolean(sparkSlot);
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth, animation, opacity, strokeDasharray, strokeLinecap: strokeDasharray ? "round" : undefined }}
      />
      {showsSpark && stroke && sparkSlot && (
        <>
          <style>{sparkKeyframes(`orbita-spark-${sparkSlot.index}-${sparkSlot.total}`, sparkSlot)}</style>
          {/* A chave muda junto em todas as ligações: recomeçam no mesmo instante e a nave passa de uma para a outra. */}
          <g
            key={sparkSlot.routeVersion}
            className="orbita-flow-spark"
            style={{
              offsetPath: `path("${edgePath}")`,
              animation: `orbita-spark-${sparkSlot.index}-${sparkSlot.total} ${sparkCycleSeconds}s linear infinite`,
            }}
          >
            <FlowSpark color={stroke} />
          </g>
        </>
      )}
      <EdgeEndPlus x={sourceX} y={sourceY} side={sourcePosition} color={stroke ?? "var(--info)"} />
      <EdgeEndPlus x={targetX} y={targetY} side={targetPosition} color={stroke ?? "var(--info)"} />
      <style>{`.orbita-edge-end { opacity: 0; pointer-events: none; transition: opacity .15s; }
.react-flow__edge:hover .orbita-edge-end, .react-flow__edge.selected .orbita-edge-end { opacity: 1; }
.react-flow__edge:hover .react-flow__edge-path { filter: drop-shadow(0 0 5px var(--info)); animation: orbita-edge-select 0.9s ease-in-out infinite; }
@keyframes orbita-edge-select { 0%, 100% { stroke-opacity: 1; } 50% { stroke-opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .react-flow__edge:hover .react-flow__edge-path { animation: none; } }`}</style>
      {strokeDasharray && (
        <style>{`@keyframes orbita-outline-march { to { stroke-dashoffset: -${DASH_LENGTH + DASH_GAP}; } }
@media (prefers-reduced-motion: reduce) { .orbita-flow-spark { display: none; } }`}</style>
      )}
      {animation && animation !== DASH_MARCH_ANIMATION && (
        <style>{`
          @keyframes edge-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - (visibleLabel ? 30 : 0)}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan flex items-center gap-0.5 rounded-full border bg-background p-0.5 shadow-md"
          >
            <button
              type="button"
              title="Encaixar um passo no meio desta ligação"
              aria-label="Encaixar um passo no meio desta ligação"
              className="grid size-7 place-items-center rounded-full hover:bg-muted"
              onClick={() => requestInsertOnEdge(id)}
            >
              <PlusIcon className="size-4" />
            </button>
            <button
              type="button"
              title="Excluir ligação"
              aria-label="Excluir ligação"
              className="grid size-7 place-items-center rounded-full text-destructive hover:bg-destructive/10"
              onClick={() => setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== id))}
            >
              <Trash2Icon className="size-4" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {visibleLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className={
              hasError
                ? "rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5"
                : "rounded-md border bg-background text-foreground text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5"
            }
          >
            {visibleLabel as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
