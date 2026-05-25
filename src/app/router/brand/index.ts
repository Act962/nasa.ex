import { extractFromLogo } from "./extract-from-logo";
import { getBrandKit } from "./get-brand-kit";
import { updateBrandKit } from "./update-brand-kit";
import { searchGoogleFonts } from "./search-google-fonts";

/**
 * Brand router — NASA Planner 2.0.
 *
 * Centraliza tudo relacionado a brand kit da organização: extração
 * automática via Claude Vision, leitura/atualização manual dos campos,
 * e proxy do Google Fonts pro autocomplete de tipografia na aba
 * "Branding".
 *
 * Consumido por:
 *  - `src/features/nasa-planner/components/branding-tab.tsx` (aba do
 *    popup do Planner)
 *  - `src/features/nasa-planner/lib/brand-context.ts` (helper de
 *    injeção em prompts de IA — lê via prisma direto, não via oRPC, pra
 *    evitar overhead em hot paths)
 */
export const brandRouter = {
  extractFromLogo,
  getBrandKit,
  updateBrandKit,
  searchGoogleFonts,
};
