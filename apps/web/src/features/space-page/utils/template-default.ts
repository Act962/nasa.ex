/**
 * Layouts pré-moldados da Spacehome. Usuário escolhe um destes
 * via `Organization.spacehomeTemplate`; se quiser customização total,
 * vincula uma NasaPage em `Organization.nasaPageId` (layout JSON).
 *
 * Cada item da lista vira um `<SpaceCard type="..." />` no render.
 * O array dentro de `rows` define colunas (2+ = grid; 1 = full width).
 */

export type SpaceCardType =
  | "header"
  | "organogram"
  | "projects"
  | "space-station"
  | "connected-orgs"
  | "ranking"
  | "followers"
  | "calendar"
  | "nbox"
  | "forms"
  | "chat"
  | "linnker"
  | "reviews"
  | "news"
  | "social-banners"
  | "integrations"
  | "stars"
  | "footer";

export interface SpaceLayoutRow {
  cards: SpaceCardType[];
}

export interface SpaceLayout {
  slug: "default" | "corporate" | "creative";
  rows: SpaceLayoutRow[];
}

// "news" foi removido dos layouts a pedido do produto (10/05/26). O tipo
// permanece em SpaceCardType porque ainda existe no banco de páginas
// customizadas — apenas não aparece nos templates padrão.

export const DEFAULT_LAYOUT: SpaceLayout = {
  slug: "default",
  rows: [
    { cards: ["header"] },
    { cards: ["space-station"] },        // Logo abaixo do header — porta de entrada
    { cards: ["projects", "ranking"] },
    { cards: ["calendar"] },
    { cards: ["nbox", "forms"] },
    { cards: ["reviews"] },
    { cards: ["stars", "followers"] },
    { cards: ["footer"] },
  ],
};

export const CORPORATE_LAYOUT: SpaceLayout = {
  slug: "corporate",
  rows: [
    { cards: ["header"] },
    { cards: ["space-station"] },        // Logo abaixo do header
    { cards: ["organogram"] },
    { cards: ["projects"] },
    { cards: ["integrations", "connected-orgs"] },
    { cards: ["forms"] },
    { cards: ["reviews"] },
    { cards: ["footer"] },
  ],
};

export const CREATIVE_LAYOUT: SpaceLayout = {
  slug: "creative",
  rows: [
    { cards: ["header"] },
    { cards: ["space-station"] },        // Logo abaixo do header
    { cards: ["social-banners"] },
    { cards: ["projects"] },
    { cards: ["stars", "followers"] },
    { cards: ["linnker", "chat"] },
    { cards: ["calendar"] },
    { cards: ["footer"] },
  ],
};

export const TEMPLATES: Record<string, SpaceLayout> = {
  default: DEFAULT_LAYOUT,
  corporate: CORPORATE_LAYOUT,
  creative: CREATIVE_LAYOUT,
};

export function resolveLayout(template?: string | null): SpaceLayout {
  if (!template) return DEFAULT_LAYOUT;
  return TEMPLATES[template] ?? DEFAULT_LAYOUT;
}
