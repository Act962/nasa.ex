/**
 * Gera um slug "humano" para a URL de continuar preenchimento de uma resposta:
 *   /formulario/<slug>/<responseId>
 *
 * O `slug` é cosmético (kebab-case do nome do form + data); a verdade é o
 * `responseId` no segundo segmento. Mantemos o slug pra que a URL seja
 * legível em links compartilhados internamente.
 */
export function buildResponseSlug(
  formName: string,
  date: Date | string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const namePart = (formName || "formulario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "formulario";

  return `${namePart}-${yyyy}${mm}${dd}`;
}
