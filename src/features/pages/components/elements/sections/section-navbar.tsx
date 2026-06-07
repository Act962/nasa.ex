/**
 * Section Navbar — header fixo no topo da landing.
 * Logo à esquerda, links centralizados, CTAs à direita.
 * Responsivo: em mobile vira hamburguer que abre drawer com links + CTAs.
 */
"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { SectionRendererProps } from "./types";
import { bgColor, fgColor, mutedColor, primaryColor } from "./types";
import { usePageRenderContext } from "../../public/page-context";
import { resolveNavLinkHref, type NavLinkShape } from "../../../lib/resolve-nav-link";

interface NavLink {
  id: string;
  label: string;
  href?: string;
  /** Quando setado, link aponta pra subpage do mesmo site. Resolvido
   *  via context `siblingPages` no public renderer pra montar URL
   *  `/s/<rootSlug>/<subSlug>` (ou root). */
  subpageId?: string;
}

export function SectionNavbar({ element, tokens }: SectionRendererProps) {
  const { rootSlug, siblingPages } = usePageRenderContext();
  // O `stickyMode` (sticky/fixed/static) NÃO é aplicado aqui dentro —
  // é o wrapper externo (no `PublicPageRenderer`) que renderiza a
  // navbar com a posição correta FORA do flex-col, garantindo
  // z-index real do viewport. Aqui só renderizamos o conteúdo visual
  // estático da navbar.
  //
  // No editor (canvas), a navbar é renderizada como qualquer outro
  // element via ElementBox (position: absolute). O comportamento real
  // de fixed/sticky aparece SÓ na página publicada.
  const logoSrc = (element.logoSrc as string) ?? "";
  const logoText = (element.logoText as string) ?? "N.A.S.A";
  const logoHref = (element.logoHref as string) ?? "#top";
  const links =
    (element.links as NavLink[] | undefined) ?? [
      { id: "1", label: "Planos", href: "#planos" },
      { id: "2", label: "O que é NASA?", href: "#o-que-e-nasa" },
      { id: "3", label: "Como funciona", href: "#como-funciona" },
    ];
  const primaryCta = (element.primaryCta as string) ?? "Começar grátis";
  const secondaryCta = (element.secondaryCta as string) ?? "Entrar";
  // Hrefs configuráveis dos CTAs. Aceitam:
  //   - URL absoluta: "https://..."
  //   - Âncora interna: "#planos" (rola pra section com id="planos")
  //   - mailto/tel: "mailto:..." / "tel:..."
  const primaryCtaHref = (element.primaryCtaHref as string) ?? "#";
  const secondaryCtaHref = (element.secondaryCtaHref as string) ?? "#";

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  // Inclui as subpages-irmãs como links acessíveis no menu mobile
  // (mesmo que o user não tenha adicionado manualmente). UX comum em
  // sites multi-page: o hamburguer expõe todas as páginas. Em desktop
  // só aparecem os links explicitamente configurados via `links`.
  const subpageLinks: NavLink[] = (siblingPages ?? [])
    .filter((sibling) => !sibling.isRoot)
    .map((sibling) => ({
      id: `__sub__${sibling.id}`,
      label: sibling.title || sibling.slug,
      subpageId: sibling.id,
    }));

  // Se há subpages mas o user não adicionou link manual pra elas, mescla
  // pra que apareçam no hamburguer. Evita duplicar quando o user já
  // criou link com subpageId.
  const existingSubIds = new Set(
    links.filter((l) => l.subpageId).map((l) => l.subpageId),
  );
  const extraSubLinks = subpageLinks.filter(
    (sub) => !existingSubIds.has(sub.subpageId),
  );
  const mobileLinks = [...links, ...extraSubLinks];

  // Mostra o hamburguer quando há QUALQUER conteúdo navegável em
  // mobile — links manuais OU subpages do site OU CTA secundário
  // (que fica escondido em mobile no desktop layout).
  const hasMobileMenu =
    mobileLinks.length > 0 || Boolean(secondaryCta);

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="w-full backdrop-blur-md border-b"
      style={{
        background: `${bg}cc`,
        borderColor: `${fg}10`,
        color: fg,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo — clicável volta pro topo (ou pra URL custom) */}
        <a href={logoHref} className="flex items-center gap-2 shrink-0">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={logoText}
              className="h-8 sm:h-10 w-auto"
            />
          ) : (
            <span
              className="text-xl font-black tracking-tight"
              style={{ color: fg }}
            >
              {logoText}
            </span>
          )}
        </a>

        {/* Links centralizados - hidden em mobile. Resolução suporta
            URL externa, âncora interna OU subpage do mesmo site
            (NavLink.subpageId). */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <a
              key={link.id}
              href={resolveNavLinkHref(
                link as NavLinkShape,
                rootSlug,
                siblingPages,
              )}
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: muted }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTAs - secundário hidden em mobile, primário sempre visível.
            Renderizados como <a> pra suportar ancoras e URL externas. */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={secondaryCtaHref}
            className="hidden sm:inline-flex text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: muted, textDecoration: "none" }}
          >
            {secondaryCta}
          </a>
          <a
            href={primaryCtaHref}
            className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: primary, color: "#fff", textDecoration: "none" }}
          >
            {primaryCta}
          </a>

          {/* Hamburguer mobile — só aparece quando há conteúdo navegável.
              Visível ABAIXO de md (768px). Botão fica logo após os CTAs
              (canto direito). */}
          {hasMobileMenu && (
            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="md:hidden inline-flex items-center justify-center size-9 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: fg }}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Drawer mobile — slide-down abaixo do navbar. Não usa Sheet do
          shadcn porque queremos controle total de cores via tokens da page.
          Posição absolute pra cobrir o conteúdo abaixo sem deslocar.
          Animação simples via transition-all + max-height. */}
      {hasMobileMenu && (
        <div
          className="md:hidden overflow-hidden transition-all duration-300 ease-out border-t"
          style={{
            maxHeight: menuOpen ? "80vh" : 0,
            borderColor: `${fg}10`,
            background: bg,
          }}
        >
          <nav className="flex flex-col px-4 py-3 gap-1">
            {mobileLinks.map((link) => (
              <a
                key={link.id}
                href={resolveNavLinkHref(
                  link as NavLinkShape,
                  rootSlug,
                  siblingPages,
                )}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: fg }}
              >
                {link.label}
              </a>
            ))}
            {/* CTA secundário também acessível no menu mobile, já que
                fica escondido no header em telas pequenas. */}
            {secondaryCta && (
              <a
                href={secondaryCtaHref}
                onClick={() => setMenuOpen(false)}
                className="sm:hidden text-sm font-medium px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5 mt-1"
                style={{ color: muted, textDecoration: "none" }}
              >
                {secondaryCta}
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
