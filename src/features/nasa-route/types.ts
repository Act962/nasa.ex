/**
 * Tipos compartilhados do NASA Route.
 *
 * Os formatos foram movidos pra `./lib/formats.ts` (single source of truth
 * com metadata, validações e utilitários). Aqui mantemos os "labels" antigos
 * como derivações pra não quebrar imports existentes.
 */

import { COURSE_FORMATS, FORMAT_META, type CourseFormat } from "./lib/formats";

export const COURSE_LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

// ── Compatibilidade com código antigo (a ser substituído gradualmente
//    por `getFormatMeta` / `FORMAT_META` de `./lib/formats`).
export const COURSE_FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  COURSE_FORMATS.map((f) => [f, FORMAT_META[f].label]),
);

export const COURSE_FORMAT_ICONS: Record<string, string> = Object.fromEntries(
  COURSE_FORMATS.map((f) => [f, FORMAT_META[f].icon]),
);

export type { CourseFormat };
