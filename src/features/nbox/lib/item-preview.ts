import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBytes } from "../components/nbox-file-type-icon";
import type { NBoxItemView } from "../components/nbox-types";

export type NBoxItemPreviewKind = "image" | "pdf" | "link" | "contract" | "proposal" | "spreadsheet" | "file";

export function isImageItem(item: NBoxItemView): boolean {
  return item.type === "IMAGE" || (item.type === "FILE" && !!item.mimeType?.startsWith("image/"));
}

export function isPdfItem(item: NBoxItemView): boolean {
  return item.mimeType === "application/pdf" || item.name.toLowerCase().endsWith(".pdf");
}

function isSpreadsheetMime(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv");
}

export function getItemPreviewKind(item: NBoxItemView): NBoxItemPreviewKind {
  if (item.type === "LINK") return "link";
  if (item.type === "CONTRACT") return "contract";
  if (item.type === "PROPOSAL") return "proposal";
  if (isImageItem(item)) return "image";
  if (isPdfItem(item)) return "pdf";
  if (isSpreadsheetMime(item.mimeType)) return "spreadsheet";
  return "file";
}

export function getLinkHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function getFaviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

export function formatRelativeDate(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

const KIND_LABELS: Record<NBoxItemPreviewKind, string> = {
  image: "Imagem",
  pdf: "PDF",
  link: "Link",
  contract: "Contrato",
  proposal: "Proposta",
  spreadsheet: "Planilha",
  file: "Arquivo",
};

export function getItemKindLabel(item: NBoxItemView): string {
  return KIND_LABELS[getItemPreviewKind(item)];
}

/** "1.2 MB · há 2 dias" — para links, o domínio entra no lugar do tamanho. */
export function getItemMetaLine(item: NBoxItemView): string {
  const leadingPart =
    item.type === "LINK"
      ? getLinkHostname(item.url)
      : item.size
        ? formatBytes(item.size)
        : getItemKindLabel(item);
  return [leadingPart, formatRelativeDate(item.createdAt)].filter(Boolean).join(" · ");
}
