/**
 * Resolução de `NavLink` da section-navbar — converte o link salvo
 * (que pode ser URL externa, âncora ou referência a uma subpage do
 * site) num href final pronto pra renderizar.
 *
 * Padrão:
 *   - `subpageId` setado: busca em `siblingPages` o slug correspondente
 *     e monta `/s/<rootSlug>/<subSlug>` (ou `/s/<rootSlug>` se a
 *     subpage referenciada for o próprio root).
 *   - Senão usa `href` literal (URL externa ou âncora `#xyz`).
 *
 * Fallback: se `subpageId` aponta pra uma subpage que sumiu (foi
 * deletada) ou se `siblingPages` não estiver disponível, devolve `#`
 * em vez de renderizar link quebrado.
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
  siteBasePath?: string,
): string {
  if (link.subpageId) {
    const sub = siblingPages?.find((p) => p.id === link.subpageId);
    if (!sub) return "#";
    // Em domínio próprio o site mora na raiz: nada de `/s/<slug>`.
    if (siteBasePath !== undefined) return sub.isRoot ? `${siteBasePath}/` : `${siteBasePath}/${sub.slug}`;
    if (!rootSlug) return "#";
    if (sub.isRoot) return `/s/${rootSlug}`;
    return `/s/${rootSlug}/${sub.slug}`;
  }
  return link.href ?? "#";
}
