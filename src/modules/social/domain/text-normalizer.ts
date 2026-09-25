/**
 * Normalização usada por todo o casamento de texto: minúsculas, sem acento,
 * espaços colapsados. É o que faz "promoção" casar "PROMOCAO" (spec 0024 RF-11).
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
