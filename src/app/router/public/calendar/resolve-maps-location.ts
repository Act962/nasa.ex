import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { resolveMapsUrlToLocation } from "@/features/public-calendar/utils/resolve-maps-url";
import { isGoogleMapsUrl } from "@/features/public-calendar/utils/maps";

/**
 * Recebe uma URL do Google Maps e devolve `{ city, state }` quando
 * consegue resolver (via Nominatim/OpenStreetMap). Usado pelo
 * formulário "Visualização Pública" do workspace pra auto-preencher
 * os campos Cidade/Estado quando o user cola um link do Maps no campo
 * "Endereço" — evita digitação redundante.
 *
 * Retorna `{ city: null, state: null }` quando:
 *  - URL não é do Google Maps
 *  - Nominatim não acha match
 *  - URL é short link inválido
 *  - Qualquer erro de rede
 *
 * Procedure pública (sem auth) porque o formulário roda no contexto
 * de "Visualização Pública" — qualquer user logado pode chamar.
 */
export const resolveMapsLocation = base
  .input(
    z.object({
      url: z.string().trim().min(1),
    }),
  )
  .handler(async ({ input }) => {
    if (!isGoogleMapsUrl(input.url)) {
      return { city: null, state: null };
    }
    const result = await resolveMapsUrlToLocation(input.url);
    return {
      city: result?.city ?? null,
      state: result?.state ?? null,
    };
  });
