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
  getBezierPath,
  useNodes,
} from "@xyflow/react";
import { useMemo } from "react";
import { validateNode } from "@/features/workflows/lib/validate-node";

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
}: EdgeProps) {
  const nodes = useNodes();

  // Verifica se algum dos endpoints tem validação falhando
  const hasError = useMemo(() => {
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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: hasError ? "rgb(239,68,68)" : undefined,
          strokeWidth: hasError ? 2.5 : undefined,
          // Pulse via CSS animation no path; animate-pulse só funciona
          // em elementos com display block, então usamos opacity timing.
          animation: hasError ? "edge-pulse 1.5s ease-in-out infinite" : undefined,
        }}
      />
      {/* Animação CSS local — sem precisar de tailwind config */}
      {hasError && (
        <style>{`
          @keyframes edge-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
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
                ? "rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5"
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
