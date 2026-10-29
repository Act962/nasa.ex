// Caminho do "Ir até" que desvia dos móveis: A* numa grade sobre o piso e depois corta os cantos desnecessários.
// Sem Three.js e sem DOM, como o resto de `layout/`. Antes o caminho era só por pontos de porta, em linha reta, e
// prendia num móvel quando a pessoa saía de um ponto fora do centro da sala.
import {
  HALL_WIDTH,
  PLAYER_RADIUS,
  ROOM_DEPTH,
  ROOM_OFFSET_Z,
  hitsObstacle,
  isWalkable,
  type Obstacle,
  type RoomOpenCheck,
  type StationLayout,
} from "./station-layout";

type Point = { x: number; z: number };

const CELL_SIZE = 0.4;
/** Até onde procurar um ponto livre quando o destino (ou a origem) cai em cima de um móvel. */
const SNAP_RADIUS_CELLS = 8;
const LINE_STEP = 0.15;
const DIAGONAL_COST = Math.SQRT2;

interface Grid {
  columns: number;
  rows: number;
  originX: number;
  originZ: number;
  isFree: Uint8Array;
}

function buildGrid(layout: StationLayout, obstacles: readonly Obstacle[], isRoomOpen: RoomOpenCheck): Grid {
  const halfLength = layout.hallLength / 2 + 1;
  const halfDepth = Math.max(ROOM_OFFSET_Z + ROOM_DEPTH / 2, HALL_WIDTH / 2) + 1;
  const columns = Math.ceil((halfLength * 2) / CELL_SIZE);
  const rows = Math.ceil((halfDepth * 2) / CELL_SIZE);
  const grid: Grid = { columns, rows, originX: -halfLength, originZ: -halfDepth, isFree: new Uint8Array(columns * rows) };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const { x, z } = cellCenter(grid, column, row);
      grid.isFree[row * columns + column] = isWalkable(layout, x, z, isRoomOpen) && !hitsObstacle(obstacles, x, z, PLAYER_RADIUS) ? 1 : 0;
    }
  }
  return grid;
}

function cellCenter(grid: Grid, column: number, row: number): Point {
  return { x: grid.originX + (column + 0.5) * CELL_SIZE, z: grid.originZ + (row + 0.5) * CELL_SIZE };
}

function cellOf(grid: Grid, point: Point): [number, number] {
  return [Math.floor((point.x - grid.originX) / CELL_SIZE), Math.floor((point.z - grid.originZ) / CELL_SIZE)];
}

function isFreeCell(grid: Grid, column: number, row: number): boolean {
  return column >= 0 && row >= 0 && column < grid.columns && row < grid.rows && grid.isFree[row * grid.columns + column] === 1;
}

/** Célula livre mais perto do ponto, em anéis crescentes. */
function nearestFreeCell(grid: Grid, point: Point): [number, number] | null {
  const [column, row] = cellOf(grid, point);
  for (let radius = 0; radius <= SNAP_RADIUS_CELLS; radius++) {
    let best: [number, number] | null = null;
    let bestDistance = Infinity;
    for (let deltaRow = -radius; deltaRow <= radius; deltaRow++) {
      for (let deltaColumn = -radius; deltaColumn <= radius; deltaColumn++) {
        if (Math.max(Math.abs(deltaRow), Math.abs(deltaColumn)) !== radius) continue;
        if (!isFreeCell(grid, column + deltaColumn, row + deltaRow)) continue;
        const center = cellCenter(grid, column + deltaColumn, row + deltaRow);
        const distance = Math.hypot(center.x - point.x, center.z - point.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = [column + deltaColumn, row + deltaRow];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Fila de prioridade simples (heap binário) pelo custo estimado. */
class OpenSet {
  private readonly cells: number[] = [];
  constructor(private readonly score: Float64Array) {}
  get size() {
    return this.cells.length;
  }
  push(cell: number) {
    this.cells.push(cell);
    let index = this.cells.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.score[this.cells[parent]] <= this.score[this.cells[index]]) break;
      [this.cells[parent], this.cells[index]] = [this.cells[index], this.cells[parent]];
      index = parent;
    }
  }
  pop(): number {
    const top = this.cells[0];
    const last = this.cells.pop()!;
    if (this.cells.length) {
      this.cells[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.cells.length && this.score[this.cells[left]] < this.score[this.cells[smallest]]) smallest = left;
        if (right < this.cells.length && this.score[this.cells[right]] < this.score[this.cells[smallest]]) smallest = right;
        if (smallest === index) break;
        [this.cells[smallest], this.cells[index]] = [this.cells[index], this.cells[smallest]];
        index = smallest;
      }
    }
    return top;
  }
}

function aStar(grid: Grid, start: [number, number], goal: [number, number]): number[] | null {
  const total = grid.columns * grid.rows;
  const startCell = start[1] * grid.columns + start[0];
  const goalCell = goal[1] * grid.columns + goal[0];
  const costSoFar = new Float64Array(total).fill(Infinity);
  const estimated = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const isClosed = new Uint8Array(total);
  const heuristic = (cell: number) => {
    const deltaColumn = Math.abs((cell % grid.columns) - goal[0]);
    const deltaRow = Math.abs(Math.floor(cell / grid.columns) - goal[1]);
    return Math.max(deltaColumn, deltaRow) + (DIAGONAL_COST - 1) * Math.min(deltaColumn, deltaRow);
  };
  const open = new OpenSet(estimated);
  costSoFar[startCell] = 0;
  estimated[startCell] = heuristic(startCell);
  open.push(startCell);
  while (open.size) {
    const current = open.pop();
    if (current === goalCell) {
      const cells = [current];
      while (cameFrom[cells[cells.length - 1]] !== -1) cells.push(cameFrom[cells[cells.length - 1]]);
      return cells.reverse();
    }
    if (isClosed[current]) continue;
    isClosed[current] = 1;
    const column = current % grid.columns;
    const row = Math.floor(current / grid.columns);
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaColumn = -1; deltaColumn <= 1; deltaColumn++) {
        if (!deltaRow && !deltaColumn) continue;
        const nextColumn = column + deltaColumn;
        const nextRow = row + deltaRow;
        if (!isFreeCell(grid, nextColumn, nextRow)) continue;
        // Diagonal só com os dois lados livres: não corta a quina de um móvel.
        if (deltaRow && deltaColumn && (!isFreeCell(grid, column + deltaColumn, row) || !isFreeCell(grid, column, row + deltaRow))) continue;
        const next = nextRow * grid.columns + nextColumn;
        if (isClosed[next]) continue;
        const cost = costSoFar[current] + (deltaRow && deltaColumn ? DIAGONAL_COST : 1);
        if (cost >= costSoFar[next]) continue;
        costSoFar[next] = cost;
        cameFrom[next] = current;
        estimated[next] = cost + heuristic(next);
        open.push(next);
      }
    }
  }
  return null;
}

function hasLineOfSight(grid: Grid, from: Point, to: Point): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / LINE_STEP));
  for (let step = 1; step <= steps; step++) {
    const point = { x: from.x + ((to.x - from.x) * step) / steps, z: from.z + ((to.z - from.z) * step) / steps };
    const [column, row] = cellOf(grid, point);
    if (!isFreeCell(grid, column, row)) return false;
  }
  return true;
}

/** Tira os pontos intermediários quando dá para ir direto: o personagem anda em poucas retas, não em degraus. */
function smoothPath(grid: Grid, points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const smoothed = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let farthest = anchor + 1;
    for (let candidate = points.length - 1; candidate > anchor + 1; candidate--) {
      if (hasLineOfSight(grid, points[anchor], points[candidate])) {
        farthest = candidate;
        break;
      }
    }
    smoothed.push(points[farthest]);
    anchor = farthest;
  }
  return smoothed;
}

/**
 * Pontos de passagem de `from` até `to`, desviando de paredes, móveis e salas trancadas. Destino em cima de um móvel
 * vai para o ponto livre mais perto. `null` quando não há caminho (destino isolado): quem chama mantém o caminho antigo.
 */
export function findPath(layout: StationLayout, obstacles: readonly Obstacle[], from: Point, to: Point, isRoomOpen: RoomOpenCheck): Point[] | null {
  const grid = buildGrid(layout, obstacles, isRoomOpen);
  const start = nearestFreeCell(grid, from);
  const goal = nearestFreeCell(grid, to);
  if (!start || !goal) return null;
  const cells = aStar(grid, start, goal);
  if (!cells) return null;
  const points = cells.map((cell) => cellCenter(grid, cell % grid.columns, Math.floor(cell / grid.columns)));
  points[0] = from;
  return smoothPath(grid, points).slice(1);
}

/** Encurta o fim do caminho: para `distance` metros antes do destino (perto do colega, sem entrar nele). */
export function stopShortOf(from: Point, path: Point[], distance: number): Point[] {
  const points = [from, ...path];
  let remaining = distance;
  while (points.length > 1) {
    const end = points[points.length - 1];
    const before = points[points.length - 2];
    const length = Math.hypot(end.x - before.x, end.z - before.z);
    if (length > remaining) {
      const ratio = (length - remaining) / length;
      points[points.length - 1] = { x: before.x + (end.x - before.x) * ratio, z: before.z + (end.z - before.z) * ratio };
      return points.slice(1);
    }
    remaining -= length;
    points.pop();
  }
  return [];
}
