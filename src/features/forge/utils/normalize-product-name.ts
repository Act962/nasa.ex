/** "Climatizador 130 L" e "climatizador 130 l " contam como o mesmo produto (spec 0151, RF-5). */
export function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
