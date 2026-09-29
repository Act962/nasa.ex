// Geometria da trilha espacial: cada parada ganha um ponto em % do painel,
// subindo de baixo (plataforma) para cima (destino) em zigue-zague.

export type PlanetPalette = "amber" | "violet" | "teal" | "rose" | "sky" | "lime";
export type PlanetSurface = "bands" | "craters";

export interface JourneyStop {
  id: string;
  kind: "planet" | "asteroid";
  label?: string;
  palette?: PlanetPalette;
  surface?: PlanetSurface;
  hasRing?: boolean;
  /** Destino final: planeta maior, com brilho. */
  isDestination?: boolean;
}

export interface JourneyPoint {
  x: number;
  y: number;
}

const TOP_MARGIN_PERCENT = 11;
const BOTTOM_MARGIN_PERCENT = 14;
const ZIGZAG_AMPLITUDE_PERCENT = 24;
/** Planetas ocupam mais trilha que asteroides: rótulos não se atropelam. */
const PLANET_GAP_WEIGHT = 4;
const ASTEROID_GAP_WEIGHT = 1;
const WEIGHT_PER_SWING = 9;

/** Arredonda para o HTML do servidor e do navegador baterem (hidratação). */
function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function layoutJourney(stops: JourneyStop[]): JourneyPoint[] {
  const usableHeight = 100 - TOP_MARGIN_PERCENT - BOTTOM_MARGIN_PERCENT;
  const offsets: number[] = [];
  stops.forEach((stop, index) => {
    const previous = stops[index - 1];
    const gap = !previous ? 0 : stop.kind === "planet" || previous.kind === "planet" ? PLANET_GAP_WEIGHT : ASTEROID_GAP_WEIGHT;
    offsets.push((offsets[index - 1] ?? 0) + gap);
  });
  const totalWeight = offsets[offsets.length - 1] || 1;
  return offsets.map((offset) => ({
    x: roundCoordinate(50 + Math.sin((offset / WEIGHT_PER_SWING) * Math.PI) * ZIGZAG_AMPLITUDE_PERCENT),
    y: roundCoordinate(100 - BOTTOM_MARGIN_PERCENT - (offset / totalWeight) * usableHeight),
  }));
}

/** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos, no viewBox 0–100. */
export function buildTrailPath(points: JourneyPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let path = `M ${first.x} ${first.y}`;
  rest.forEach((point, offset) => {
    const index = offset + 1;
    const previous = points[index - 1];
    const beforePrevious = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const control1 = {
      x: roundCoordinate(previous.x + (point.x - beforePrevious.x) / 6),
      y: roundCoordinate(previous.y + (point.y - beforePrevious.y) / 6),
    };
    const control2 = { x: roundCoordinate(point.x - (next.x - previous.x) / 6), y: roundCoordinate(point.y - (next.y - previous.y) / 6) };
    path += ` C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${point.x} ${point.y}`;
  });
  return path;
}

/** Ângulo (graus) para o foguete apontar para a próxima parada; o painel é mais alto que largo. */
export function headingDegrees(from: JourneyPoint, to: JourneyPoint | undefined, aspectRatio: number): number {
  if (!to) return 0;
  const deltaX = to.x - from.x;
  const deltaY = (to.y - from.y) * aspectRatio;
  return Math.round((Math.atan2(deltaX, -deltaY) * 180) / Math.PI);
}

export const STARS_PER_ASTEROID = 1;
export const STARS_PER_PLANET = 5;

/** STARs acumuladas até a parada atual (as já visitadas). */
export function starsCollected(stops: JourneyStop[], currentIndex: number): number {
  return stops
    .slice(0, Math.max(0, currentIndex))
    .reduce((total, stop) => total + (stop.kind === "planet" ? STARS_PER_PLANET : STARS_PER_ASTEROID), 0);
}
