import "server-only";

import type { CanonicalInboundMedia } from "../providers/types";

/**
 * Helpers de mimetype/extensão compartilhados entre as strategies dos
 * providers (Uazapi e Meta — Fase 5). O Uazapi (`uazapi-strategies.ts`)
 * tem cópias internas dessas funções desde a Fase 3; o Meta agora reusa
 * daqui. Em uma faxina futura, o Uazapi também pode passar a importar
 * daqui (boy-scout opcional — não fizemos agora pra manter o diff da
 * Fase 5 cirúrgico).
 *
 * Critério de design:
 *  - `defaultMimetypeForKind` cobre os 5 `CanonicalInboundMedia["kind"]`
 *    com defaults razoáveis pra UI tocar/exibir cross-browser.
 *  - `pickExtension` segue o mesmo critério do `route.ts` pré-Fase 3:
 *    para `document`/`sticker`, a extensão do path da URL é mais
 *    confiável que o mimetype genérico (servers retornam `application/
 *    octet-stream` em docs); para os demais, deriva do mimetype.
 */

export function defaultMimetypeForKind(
  kind: CanonicalInboundMedia["kind"],
): string {
  switch (kind) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/mpeg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/octet-stream";
    case "sticker":
      return "image/webp";
  }
}

export function pickExtension(
  kind: CanonicalInboundMedia["kind"],
  fileURL: string,
  mimetype: string,
): string {
  if (kind === "document" || kind === "sticker") {
    const fromUrl = fileURL.split(".").pop();
    if (fromUrl && fromUrl.length <= 5) return fromUrl;
  }
  const fromMime = mimetype.split("/")[1];
  if (fromMime) return fromMime.split(";")[0].trim();
  // Fallbacks finais por kind — paridade com `route.ts` pré-Fase 3.
  switch (kind) {
    case "document":
      return "pdf";
    case "sticker":
      return "webp";
    case "image":
      return "jpg";
    case "audio":
      return "mp3";
    case "video":
      return "mp4";
  }
}
