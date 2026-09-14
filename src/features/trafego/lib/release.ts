/** Fontes do Release e o formato do que fica gravado no pedido. */

export type ReleaseSourceKind = "site" | "pdf" | "instagram" | "facebook";

export interface ReleaseSource {
  id: string;
  kind: ReleaseSourceKind;
  /** URL ou nome do arquivo — o que o cliente vê. */
  value: string;
  /** Só para PDF: onde o arquivo está no bucket. */
  fileKey?: string | null;
  /** Quando o texto foi lido; null = ainda não lido ou não legível. */
  extractedAt?: string | null;
  chars?: number | null;
  /** Preenchido quando a leitura falhou ou não se aplica. */
  note?: string | null;
}

export interface TrafegoReleaseContent {
  about: string;
  products: string[];
  differentials: string[];
  audience: string;
  tone: string;
  offers: string[];
  doNotSay: string[];
}

/**
 * Instagram e Facebook não são raspáveis — a Meta não expõe conteúdo de perfil
 * de terceiro por API, e raspar violaria os termos. Ficam guardados como
 * referência para o gestor abrir na mão.
 */
export const READABLE_SOURCE_KINDS: ReleaseSourceKind[] = ["site", "pdf"];

export function isReadableSource(kind: ReleaseSourceKind): boolean {
  return READABLE_SOURCE_KINDS.includes(kind);
}

export const SOURCE_LABEL: Record<ReleaseSourceKind, string> = {
  site: "Site",
  pdf: "PDF",
  instagram: "Instagram",
  facebook: "Facebook",
};

export function parseReleaseSources(raw: unknown): ReleaseSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ReleaseSource =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ReleaseSource).id === "string" &&
      typeof (item as ReleaseSource).value === "string",
  );
}

export function parseRelease(raw: unknown): TrafegoReleaseContent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TrafegoReleaseContent>;
  if (typeof value.about !== "string") return null;
  return {
    about: value.about,
    products: Array.isArray(value.products) ? value.products : [],
    differentials: Array.isArray(value.differentials) ? value.differentials : [],
    audience: typeof value.audience === "string" ? value.audience : "",
    tone: typeof value.tone === "string" ? value.tone : "",
    offers: Array.isArray(value.offers) ? value.offers : [],
    doNotSay: Array.isArray(value.doNotSay) ? value.doNotSay : [],
  };
}

/** Checklist de acessos que a equipe precisa para publicar. */
export const ACCESS_CHECKLIST_ITEMS = [
  { id: "facebook-page", label: "Tenho página no Facebook" },
  { id: "instagram", label: "Tenho perfil comercial no Instagram" },
  { id: "instagram-linked", label: "Instagram e Facebook estão vinculados" },
  { id: "business-manager", label: "Tenho conta de anúncios (BM)" },
  { id: "partner-added", label: "Adicionei a Órbita como parceira na minha BM" },
] as const;

export type AccessChecklistId = (typeof ACCESS_CHECKLIST_ITEMS)[number]["id"];

export function parseAccessChecklist(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const checklist: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") checklist[key] = value;
  }
  return checklist;
}
