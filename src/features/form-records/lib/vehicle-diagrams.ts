// Diagramas de veículo do bloco "Diagrama do veículo" (spec 0075, RF-12).
// A arte é uma imagem pronta de um modelo só; por cima dela vão as áreas
// clicáveis de cada peça. Tela e PDF usam as mesmas áreas.

import {
  VEHICLE_ART_AREAS,
  VEHICLE_ART_HEIGHT,
  VEHICLE_ART_IMAGE_URL,
  VEHICLE_ART_WIDTH,
} from "@/features/form-records/lib/vehicle-diagram-art";

// Um modelo só, por decisão de produto. A lista existe para a resposta gravada
// dizer qual desenho foi usado, caso outro modelo entre no futuro.
export const VEHICLE_TYPES = [{ id: "car", label: "Veículo" }] as const;

export type VehicleTypeId = (typeof VEHICLE_TYPES)[number]["id"];
export const DEFAULT_VEHICLE_TYPE: VehicleTypeId = "car";

const PART_LABELS: Record<string, string> = {
  capo: "Capô",
  teto: "Teto",
  "tampa-traseira": "Tampa traseira",
  "para-choque-dianteiro": "Para-choque dianteiro",
  "para-choque-traseiro": "Para-choque traseiro",
  "para-lama-dianteiro-le": "Para-lama dianteiro esquerdo",
  "para-lama-dianteiro-ld": "Para-lama dianteiro direito",
  "porta-dianteira-le": "Porta dianteira esquerda",
  "porta-dianteira-ld": "Porta dianteira direita",
  "porta-traseira-le": "Porta traseira esquerda",
  "porta-traseira-ld": "Porta traseira direita",
  "lateral-traseira-le": "Lateral traseira esquerda",
  "lateral-traseira-ld": "Lateral traseira direita",
  "soleira-le": "Soleira esquerda",
  "soleira-ld": "Soleira direita",
  "roda-dianteira-le": "Roda dianteira esquerda",
  "roda-dianteira-ld": "Roda dianteira direita",
  "roda-traseira-le": "Roda traseira esquerda",
  "roda-traseira-ld": "Roda traseira direita",
};

export interface DiagramPart {
  /** Estável: é o que fica gravado na resposta. */
  id: string;
  label: string;
  /** Uma área por vista em que a peça aparece; `points` no formato do SVG, em pixels da imagem. */
  polygons: string[];
}

export interface VehicleDiagram {
  imageUrl: string;
  width: number;
  height: number;
  parts: DiagramPart[];
}

let cachedDiagram: VehicleDiagram | null = null;

export function buildVehicleDiagram(_vehicleType: VehicleTypeId = DEFAULT_VEHICLE_TYPE): VehicleDiagram {
  if (cachedDiagram) return cachedDiagram;

  // A mesma peça aparece em mais de uma vista (o capô, de cima e de frente):
  // as áreas se somam, e selecionar pinta todas.
  const partsById = new Map<string, DiagramPart>();
  for (const artArea of VEHICLE_ART_AREAS) {
    const polygon = artArea.points.map(([x, y]) => `${x},${y}`).join(" ");
    const existing = partsById.get(artArea.partId);
    if (existing) existing.polygons.push(polygon);
    else partsById.set(artArea.partId, { id: artArea.partId, label: PART_LABELS[artArea.partId] ?? artArea.partId, polygons: [polygon] });
  }

  cachedDiagram = { imageUrl: VEHICLE_ART_IMAGE_URL, width: VEHICLE_ART_WIDTH, height: VEHICLE_ART_HEIGHT, parts: [...partsById.values()] };
  return cachedDiagram;
}

export function isVehicleTypeId(value: unknown): value is VehicleTypeId {
  return VEHICLE_TYPES.some((vehicleType) => vehicleType.id === value);
}

// ── Valor gravado na resposta ───────────────────────────────────────────────

export const VEHICLE_DIAGRAM_KIND = "vehicle-diagram";
export const VEHICLE_DIAGRAM_BLOCK_TYPE = "VehicleDiagram";
const MAX_NOTE_LENGTH = 120;

export interface SelectedVehiclePart {
  partId: string;
  label: string;
  /** Ponto de observação escrito por quem preencheu. */
  note: string;
}

export interface VehicleDiagramMeta {
  kind: typeof VEHICLE_DIAGRAM_KIND;
  version: 1;
  vehicleType: VehicleTypeId;
  parts: SelectedVehiclePart[];
}

export function parseVehicleDiagramMeta(meta: Record<string, unknown> | undefined): VehicleDiagramMeta | null {
  if (!meta || meta.kind !== VEHICLE_DIAGRAM_KIND || !isVehicleTypeId(meta.vehicleType) || !Array.isArray(meta.parts)) return null;
  const knownParts = new Map(buildVehicleDiagram(meta.vehicleType).parts.map((part) => [part.id, part.label]));
  const parts = meta.parts.flatMap((rawPart) => {
    const part = rawPart as { partId?: unknown; note?: unknown } | null;
    const label = typeof part?.partId === "string" ? knownParts.get(part.partId) : undefined;
    if (!part || !label) return [];
    return [{ partId: part.partId as string, label, note: typeof part.note === "string" ? part.note.trim().slice(0, MAX_NOTE_LENGTH) : "" }];
  });
  return { kind: VEHICLE_DIAGRAM_KIND, version: 1, vehicleType: meta.vehicleType, parts };
}

export function buildVehicleDiagramValue(vehicleType: VehicleTypeId, parts: SelectedVehiclePart[]): { value: string; meta?: Record<string, unknown> } {
  if (parts.length === 0) return { value: "" };
  const typeLabel = VEHICLE_TYPES.find((candidate) => candidate.id === vehicleType)?.label ?? "";
  const described = parts.map((part) => (part.note ? `${part.label} (${part.note})` : part.label)).join("; ");
  const meta: VehicleDiagramMeta = { kind: VEHICLE_DIAGRAM_KIND, version: 1, vehicleType, parts };
  return { value: `${typeLabel}: ${described}`, meta: meta as unknown as Record<string, unknown> };
}
