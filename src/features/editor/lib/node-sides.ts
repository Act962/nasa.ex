import { Position } from "@xyflow/react";

// Lado do quadro em que ficam a entrada e a saída (spec 0090). É só desenho: fica em `data.ui` do
// quadro e não muda o identificador da ligação, que é o que o motor usa para seguir o fluxo.

export type NodeSide = "left" | "top" | "right" | "bottom";

const SIDE_ORDER: NodeSide[] = ["left", "top", "right", "bottom"];
const SIDE_POSITION: Record<NodeSide, Position> = {
  left: Position.Left,
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
};
export const SIDE_LABEL: Record<NodeSide, string> = {
  left: "esquerda",
  top: "em cima",
  right: "direita",
  bottom: "embaixo",
};

function asSide(value: unknown, fallback: NodeSide): NodeSide {
  return SIDE_ORDER.includes(value as NodeSide) ? (value as NodeSide) : fallback;
}

export function readNodeSides(data: unknown): { inputSide: NodeSide; outputSide: NodeSide } {
  const ui = (data as { ui?: { inputSide?: unknown; outputSide?: unknown } } | undefined)?.ui;
  return { inputSide: asSide(ui?.inputSide, "left"), outputSide: asSide(ui?.outputSide, "right") };
}

export function toPosition(side: NodeSide): Position {
  return SIDE_POSITION[side];
}

/** Próximo lado no sentido horário, pulando o que já está ocupado pela outra ponta. */
export function nextSide(current: NodeSide, occupied: NodeSide): NodeSide {
  let candidate = current;
  do {
    candidate = SIDE_ORDER[(SIDE_ORDER.indexOf(candidate) + 1) % SIDE_ORDER.length];
  } while (candidate === occupied);
  return candidate;
}

const OPPOSITE_SIDE: Record<NodeSide, NodeSide> = { left: "right", right: "left", top: "bottom", bottom: "top" };

export function oppositeSide(side: NodeSide): NodeSide {
  return OPPOSITE_SIDE[side];
}

/** Lado do quadro mais próximo do ponto em que a ligação foi solta. */
export function nearestSide(
  box: { left: number; top: number; width: number; height: number },
  pointerX: number,
  pointerY: number,
): NodeSide {
  const horizontal = (pointerX - (box.left + box.width / 2)) / (box.width / 2 || 1);
  const vertical = (pointerY - (box.top + box.height / 2)) / (box.height / 2 || 1);
  if (Math.abs(horizontal) > Math.abs(vertical)) return horizontal > 0 ? "right" : "left";
  return vertical > 0 ? "bottom" : "top";
}
