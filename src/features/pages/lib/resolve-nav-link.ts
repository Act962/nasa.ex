/**
 * Resolução de `NavLink` da section-navbar — converte o link salvo
 * (que pode ser URL externa, âncora ou referência a uma subpage do
 * site) num href final pronto pra renderizar.
 *
 * Padrão:
 *   - `subpageId` setado: busca em `siblingPages` o slug correspondente
 *     e monta `<base>/<subSlug>` (ou `<base>` se a subpage referenciada
 *     for o próprio root).
 *   - Senão usa `href` literal (URL externa ou âncora `#xyz`).
 *
 * O `<base>` depende de onde a page está servida:
 *   - Rota `/s/[[...slug]]` → `/s/<rootSlug>` (default, derivado do
 *     `rootSlug`).
 *   - Domínio próprio (`_sites/[host]`) → `linkBasePath = ""`, então a
 *     home vira `/` e as subpages `/<subSlug>`.
 *
 * Fallback: se `subpageId` aponta pra uma subpage que sumiu (foi
 * deletada) ou se não dá pra resolver o base, devolve `#` em vez de
 * renderizar link quebrado.
 */
export interface NavLinkShape {
  id: string;
  label: string;
  href?: string;
  subpageId?: string;
}

export interface SiblingPageInfo {
  id: string;
  slug: string;
  isRoot: boolean;
}

export function resolveNavLinkHref(
  link: NavLinkShape,
  rootSlug: string | undefined,
  siblingPages: SiblingPageInfo[] | undefined,
  linkBasePath?: string,
): string {
  if (link.subpageId) {
    const sub = siblingPages?.find((p) => p.id === link.subpageId);
    if (!sub) return "#";
    // `linkBasePath` explícito tem precedência (domínio próprio = "").
    // Senão cai no padrão `/s/<rootSlug>`.
    const base =
      linkBasePath !== undefined
        ? linkBasePath
        : rootSlug !== undefined
          ? `/s/${rootSlug}`
          : undefined;
    if (base === undefined) return "#";
    if (sub.isRoot) return base === "" ? "/" : base;
    return `${base}/${sub.slug}`;
  }
  return link.href ?? "#";
}
