import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { Clapperboard, GalleryHorizontalEnd, Image as ImageIcon, CircleDashed, type LucideIcon } from "lucide-react";
import type { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";

/** Peças comuns do Planner v2 (spec 0058): status, formatos, mídia e períodos do calendário. */

const S3_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}` : "";

export function plannerMediaUrl(key: string | null | undefined) {
  if (!key) return undefined;
  if (key.startsWith("http") || key.startsWith("data:") || key.startsWith("/")) return key;
  return `${S3_BASE}/${key}`;
}

export interface PostStatusMeta {
  label: string;
  dotClassName: string;
  textClassName: string;
}

export const POST_STATUS_META: Record<NasaPlannerPostStatus, PostStatusMeta> = {
  IDEA: { label: "Pauta", dotClassName: "bg-knob", textClassName: "text-muted-foreground" },
  DRAFT: { label: "Rascunho", dotClassName: "bg-knob", textClassName: "text-muted-foreground" },
  PENDING_APPROVAL: { label: "Aguardando aprovação", dotClassName: "bg-warning", textClassName: "text-warning" },
  CHANGES_REQUESTED: { label: "Ajustes pedidos", dotClassName: "bg-warning", textClassName: "text-warning" },
  APPROVED: { label: "Aprovado", dotClassName: "bg-success/60", textClassName: "text-success" },
  SCHEDULED: { label: "Programado", dotClassName: "bg-info", textClassName: "text-info" },
  PUBLISHING: { label: "Publicando…", dotClassName: "bg-info animate-pulse", textClassName: "text-info" },
  PUBLISHED: { label: "Publicado", dotClassName: "bg-success", textClassName: "text-success" },
  FAILED: { label: "Falhou", dotClassName: "bg-destructive", textClassName: "text-destructive" },
};

export const POST_TYPE_META: Record<NasaPlannerPostType, { label: string; icon: LucideIcon; isVertical: boolean }> = {
  STATIC: { label: "Feed", icon: ImageIcon, isVertical: false },
  CAROUSEL: { label: "Carrossel", icon: GalleryHorizontalEnd, isVertical: false },
  REEL: { label: "Reel", icon: Clapperboard, isVertical: true },
  STORY: { label: "Story", icon: CircleDashed, isVertical: true },
};

export const POST_TYPES: NasaPlannerPostType[] = ["STATIC", "CAROUSEL", "REEL", "STORY"];

/** Status em que arrastar no calendário reprograma de verdade; os outros só mudam o horário pretendido. */
export const RESCHEDULABLE_STATUSES: NasaPlannerPostStatus[] = ["APPROVED", "SCHEDULED", "FAILED"];

export type CalendarView = "week" | "month" | "kanban" | "script";

export function computeVisibleRange(view: "week" | "month", anchorDate: Date) {
  if (view === "week") {
    const from = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return { from, to: addDays(from, 7) };
  }
  const from = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
  const to = addDays(endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 }), 1);
  return { from, to };
}

export function postDate(post: { scheduledAt: Date | string | null; publishedAt: Date | string | null }) {
  const rawDate = post.scheduledAt ?? post.publishedAt;
  return rawDate ? new Date(rawDate) : null;
}

export function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/** Cor de anel por cliente, só com tokens do Design System. */
const CLIENT_RING_CLASSES = ["ring-info", "ring-success", "ring-warning", "ring-destructive", "ring-foreground/60"];

export function clientRingClass(clientIndex: number) {
  return CLIENT_RING_CLASSES[clientIndex % CLIENT_RING_CLASSES.length];
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Pauta: conteúdo do roteiro que ainda não tem arte. */
export function isScriptOnlyPost(post: { status: string; thumbnail: string | null; videoKey: string | null }) {
  return post.status === "IDEA" || (post.status === "DRAFT" && !post.thumbnail && !post.videoKey);
}
