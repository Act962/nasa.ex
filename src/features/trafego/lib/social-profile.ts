/** Perfil social informado no wizard e o que a Graph API devolveu sobre ele. */

export type SocialNetwork = "instagram" | "facebook";

export interface TrafegoSocialProfile {
  network: SocialNetwork;
  handle: string;
  found: boolean;
  name: string | null;
  username: string | null;
  pictureUrl: string | null;
  followers: number | null;
  mediaCount: number | null;
  biography: string | null;
  website: string | null;
  /** Selo azul da plataforma. null = a API não informa (Instagram). */
  isVerified: boolean | null;
  checkedAt: string;
  /** Preenchido quando `found === false` ou a busca não pôde rodar. */
  reason: string | null;
}

/**
 * Aceita "@padaria", "padaria", "instagram.com/padaria", "facebook.com/padaria"
 * e devolve rede + handle limpo. Sem rede na URL, assume Instagram.
 */
export function normalizeSocialHandle(
  raw: string,
): { network: SocialNetwork; handle: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let network: SocialNetwork = "instagram";
  let candidate = trimmed;

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(instagram\.com|facebook\.com|fb\.com)\/([^/?#\s]+)/i,
  );
  if (urlMatch) {
    network = urlMatch[1].toLowerCase().startsWith("instagram") ? "instagram" : "facebook";
    candidate = urlMatch[2];
  }

  const handle = candidate.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;
  return { network, handle };
}

export function formatFollowers(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".0", "")} mil`;
  return String(value);
}
