/**
 * Geometria do ASTRO arrastável (spec 0029): onde o orb fica e onde o painel
 * de mensagens abre a partir dele. Puro, sem DOM — recebe o tamanho da tela.
 */

/** Diâmetro do orb (`size-12`). */
export const ORB_SIZE_PX = 48;
/** Distância mínima entre o orb e a borda da tela. */
export const ORB_EDGE_MARGIN_PX = 12;
/** Posição padrão: canto inferior direito, como sempre foi (`bottom-5 right-5`). */
const DEFAULT_OFFSET_PX = 20;

const PANEL_WIDTH_PX = 460;
const PANEL_MAX_HEIGHT_PX = 720;
const PANEL_MIN_HEIGHT_PX = 360;
const PANEL_GAP_PX = 12;
/** Abaixo disso o painel vira folha de baixo, largura inteira (celular). */
export const PANEL_SHEET_BREAKPOINT_PX = 640;

export interface Viewport {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Posição salva: centro do orb como fração da tela, para sobreviver a resize. */
export interface OrbAnchor {
  xRatio: number;
  yRatio: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function defaultOrbCenter(viewport: Viewport): Point {
  const half = ORB_SIZE_PX / 2;
  return {
    x: viewport.width - DEFAULT_OFFSET_PX - half,
    y: viewport.height - DEFAULT_OFFSET_PX - half,
  };
}

/** Mantém o orb inteiro dentro da tela, com folga da borda. */
export function clampOrbCenter(center: Point, viewport: Viewport): Point {
  const minDistance = ORB_SIZE_PX / 2 + ORB_EDGE_MARGIN_PX;
  return {
    x: clamp(center.x, minDistance, viewport.width - minDistance),
    y: clamp(center.y, minDistance, viewport.height - minDistance),
  };
}

export function anchorToCenter(anchor: OrbAnchor | null, viewport: Viewport): Point {
  if (!anchor) return defaultOrbCenter(viewport);
  return clampOrbCenter(
    { x: anchor.xRatio * viewport.width, y: anchor.yRatio * viewport.height },
    viewport,
  );
}

export function centerToAnchor(center: Point, viewport: Viewport): OrbAnchor {
  return {
    xRatio: viewport.width > 0 ? center.x / viewport.width : 1,
    yRatio: viewport.height > 0 ? center.y / viewport.height : 1,
  };
}

/**
 * Para que lado as coisas presas ao orb abrem (balão, menu, painel): para
 * dentro da tela. Orb na metade de baixo abre para cima; na metade direita,
 * alinha pela direita.
 */
export function orbSides(center: Point, viewport: Viewport) {
  return {
    opensUpward: center.y > viewport.height / 2,
    alignsRight: center.x > viewport.width / 2,
  };
}

export interface PanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Onde o painel de mensagens abre, a partir do orb. No celular a resposta é
 * `null`: o painel vira folha de baixo, largura inteira, como antes.
 */
export function computePanelRect(center: Point, viewport: Viewport): PanelRect | null {
  if (viewport.width < PANEL_SHEET_BREAKPOINT_PX) return null;

  const half = ORB_SIZE_PX / 2;
  const { opensUpward, alignsRight } = orbSides(center, viewport);
  const width = Math.min(PANEL_WIDTH_PX, viewport.width - 2 * ORB_EDGE_MARGIN_PX);

  const spaceAbove = center.y - half - PANEL_GAP_PX - ORB_EDGE_MARGIN_PX;
  const spaceBelow = viewport.height - (center.y + half + PANEL_GAP_PX) - ORB_EDGE_MARGIN_PX;
  const availableHeight = opensUpward ? spaceAbove : spaceBelow;
  const fullHeight = viewport.height - 2 * ORB_EDGE_MARGIN_PX;

  // Espaço de sobra acima/abaixo do orb: o painel abre colado nele.
  if (availableHeight >= PANEL_MIN_HEIGHT_PX) {
    const height = Math.min(PANEL_MAX_HEIGHT_PX, availableHeight);
    const rawLeft = alignsRight ? center.x + half - width : center.x - half;
    return {
      left: clamp(rawLeft, ORB_EDGE_MARGIN_PX, viewport.width - width - ORB_EDGE_MARGIN_PX),
      top: opensUpward ? center.y - half - PANEL_GAP_PX - height : center.y + half + PANEL_GAP_PX,
      width,
      height,
    };
  }

  // Orb perto do meio da altura: o painel abre ao lado dele, sem cobri-lo.
  const height = Math.min(PANEL_MAX_HEIGHT_PX, fullHeight);
  const rawLeft = alignsRight
    ? center.x - half - PANEL_GAP_PX - width
    : center.x + half + PANEL_GAP_PX;
  return {
    left: clamp(rawLeft, ORB_EDGE_MARGIN_PX, viewport.width - width - ORB_EDGE_MARGIN_PX),
    top: clamp(center.y - height / 2, ORB_EDGE_MARGIN_PX, viewport.height - height - ORB_EDGE_MARGIN_PX),
    width,
    height,
  };
}
