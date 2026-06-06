/**
 * Section Navbar — header fixo no topo da landing.
 * Logo à esquerda, links centralizados, CTAs à direita.
 * Responsivo: em mobile vira hamburguer simples (links escondidos).
 */
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
        </div>
      </div>
    </header>
  );
}
