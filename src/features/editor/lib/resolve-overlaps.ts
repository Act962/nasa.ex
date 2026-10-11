// Afasta quadros que ficaram um em cima do outro (spec 0090). Usa o tamanho que o quadro tem na
// tela; quem a pessoa acabou de soltar fica onde está e os outros abrem espaço.

interface PlacedNode {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

const GAP = 28;
const MAX_ROUNDS = 12;
const FALLBACK_SIZE = { width: 60, height: 60 };

function sizeOf(node: PlacedNode) {
  return { width: node.measured?.width ?? FALLBACK_SIZE.width, height: node.measured?.height ?? FALLBACK_SIZE.height };
}

/** Devolve só as posições que mudaram. Vazio = ninguém estava sobreposto. */
export function resolveOverlaps(nodes: PlacedNode[], fixedNodeId?: string): Map<string, { x: number; y: number }> {
  const positions = new Map(nodes.map((node) => [node.id, { ...node.position }]));
  const moved = new Map<string, { x: number; y: number }>();

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let hasOverlap = false;
    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const first = nodes[firstIndex];
        const second = nodes[secondIndex];
        const firstPosition = positions.get(first.id)!;
        const secondPosition = positions.get(second.id)!;
        const firstSize = sizeOf(first);
        const secondSize = sizeOf(second);
        const overlapX = Math.min(firstPosition.x + firstSize.width, secondPosition.x + secondSize.width) - Math.max(firstPosition.x, secondPosition.x) + GAP;
        const overlapY = Math.min(firstPosition.y + firstSize.height, secondPosition.y + secondSize.height) - Math.max(firstPosition.y, secondPosition.y) + GAP;
        if (overlapX <= 0 || overlapY <= 0) continue;
        hasOverlap = true;

        // Quem se mexe: nunca o que a pessoa acabou de soltar; no mais, o que está mais à direita/abaixo.
        const isSecondAfterFirst =
          secondPosition.x + secondSize.width / 2 + (secondPosition.y + secondSize.height / 2) >=
          firstPosition.x + firstSize.width / 2 + (firstPosition.y + firstSize.height / 2);
        const mover = first.id === fixedNodeId ? second : second.id === fixedNodeId ? first : isSecondAfterFirst ? second : first;
        const anchor = mover === first ? second : first;
        const moverPosition = positions.get(mover.id)!;
        const anchorPosition = positions.get(anchor.id)!;
        const moverSize = sizeOf(mover);
        const anchorSize = sizeOf(anchor);
        if (overlapX <= overlapY) {
          const goesRight = moverPosition.x + moverSize.width / 2 >= anchorPosition.x + anchorSize.width / 2;
          moverPosition.x = goesRight ? anchorPosition.x + anchorSize.width + GAP : anchorPosition.x - moverSize.width - GAP;
        } else {
          const goesDown = moverPosition.y + moverSize.height / 2 >= anchorPosition.y + anchorSize.height / 2;
          moverPosition.y = goesDown ? anchorPosition.y + anchorSize.height + GAP : anchorPosition.y - moverSize.height - GAP;
        }
        moved.set(mover.id, moverPosition);
      }
    }
    if (!hasOverlap) break;
  }
  return moved;
}
