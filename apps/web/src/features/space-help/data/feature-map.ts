/**
 * Mapeia pathname → categoria default do Space Help.
 * Usado pelo SpaceHelpButton no header de cada app para abrir o tutorial certo.
 */
export const PATHNAME_TO_CATEGORY: Array<{ match: RegExp; categorySlug: string }> = [
  { match: /^\/tracking(\b|\/)/, categorySlug: "tracking" },
  { match: /^\/forge(\b|\/)/, categorySlug: "forge" },
  { match: /^\/form(\b|\/)/, categorySlug: "cosmic" },
  { match: /^\/tracking-chat(\b|\/)/, categorySlug: "nasachat" },
  { match: /^\/agendas?(\b|\/)/, categorySlug: "spacetime" },
  { match: /^\/payment(\b|\/)/, categorySlug: "payment" },
];

export function resolveCategoryFromPath(pathname: string): string | null {
  const match = PATHNAME_TO_CATEGORY.find((m) => m.match.test(pathname));
  return match?.categorySlug ?? null;
}
