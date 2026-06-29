/**
 * Garante que uma URL de redirecionamento tenha protocolo absoluto.
 *
 * Sem isso, `window.location.href = "google.com"` é interpretado como path
 * relativo pelo browser e leva pra `<origem-atual>/google.com` em vez de
 * `https://google.com`. Cobre valores salvos antes da gente validar no input.
 *
 * Regras:
 *  - URL vazia/whitespace → string vazia (caller decide o que fazer).
 *  - Já começa com `http://` ou `https://` → devolve como está (só trim).
 *  - Começa com `/` → path interno, devolve como está (mantém comportamento
 *    de redirect pra rota da própria app).
 *  - Começa com `//` (protocol-relative) → prepende `https:`.
 *  - Caso contrário → prepende `https://`.
 */
export function normalizeRedirectUrl(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}
