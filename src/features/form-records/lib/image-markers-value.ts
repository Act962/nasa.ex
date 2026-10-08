// Valor do bloco "Marcar na imagem" (spec 0075, RF-4): marcadores numerados
// sobre uma imagem qualquer, em porcentagem para valer em qualquer tamanho.

export const IMAGE_MARKERS_KIND = "image-markers";
export const IMAGE_MARKERS_BLOCK_TYPE = "ImageMarker";
export const MAX_IMAGE_MARKERS = 60;
const MAX_NOTE_LENGTH = 80;

export interface ImageMarker {
  id: string;
  xPercent: number;
  yPercent: number;
  note: string;
}

export interface ImageMarkersMeta {
  kind: typeof IMAGE_MARKERS_KIND;
  version: 1;
  markers: ImageMarker[];
}

function clampPercent(rawPercent: unknown): number | null {
  const percent = typeof rawPercent === "number" ? rawPercent : Number(rawPercent);
  if (!Number.isFinite(percent)) return null;
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100;
}

export function parseImageMarkers(meta: Record<string, unknown> | undefined): ImageMarker[] {
  if (!meta || meta.kind !== IMAGE_MARKERS_KIND || !Array.isArray(meta.markers)) return [];
  return meta.markers
    .flatMap((rawMarker) => {
      if (!rawMarker || typeof rawMarker !== "object") return [];
      const marker = rawMarker as Record<string, unknown>;
      const xPercent = clampPercent(marker.xPercent);
      const yPercent = clampPercent(marker.yPercent);
      if (typeof marker.id !== "string" || xPercent === null || yPercent === null) return [];
      const note = typeof marker.note === "string" ? marker.note.trim().slice(0, MAX_NOTE_LENGTH) : "";
      return [{ id: marker.id, xPercent, yPercent, note }];
    })
    .slice(0, MAX_IMAGE_MARKERS);
}

export function buildImageMarkersValue(markers: ImageMarker[]): { value: string; meta?: Record<string, unknown> } {
  if (markers.length === 0) return { value: "" };
  const notes = markers.map((marker) => marker.note).filter(Boolean);
  const count = `${markers.length} ${markers.length === 1 ? "marcação" : "marcações"}`;
  const meta: ImageMarkersMeta = { kind: IMAGE_MARKERS_KIND, version: 1, markers };
  return {
    value: notes.length > 0 ? `${count}: ${notes.join("; ")}` : count,
    meta: meta as unknown as Record<string, unknown>,
  };
}
