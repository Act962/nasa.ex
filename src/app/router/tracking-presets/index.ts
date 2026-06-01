import { listTrackingPresets } from "./list";
import { previewTrackingPreset } from "./preview";
import { applyTrackingPreset } from "./apply";
import { getTrackingPresetDetail } from "./get-detail";

/**
 * Catálogo NASA de Padrões de Tracking (TrackingPreset).
 *
 * Procedures expostas:
 *  - `list`    → lista presets públicos (filtrável por paradigma)
 *  - `preview` → dry-run de aplicação (mostra conflitos sem persistir)
 *  - `apply`   → aplica preset (cria/mescla tracking + remapeia slugs → IDs)
 *
 * Admin (criar/editar presets) vive em router separado `admin.trackingPresets`
 * — adicionado na Fase 3.
 */
export const trackingPresetsRouter = {
  list: listTrackingPresets,
  getDetail: getTrackingPresetDetail,
  preview: previewTrackingPreset,
  apply: applyTrackingPreset,
};
