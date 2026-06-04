/**
 * Section Footer — rodapé com logo, tagline e links de utilidade.
 * Layout responsivo: empilha em mobile, lado-a-lado em desktop.
 */
import type { SectionRendererProps } from "./types";
import { bgColor, fgColor, mutedColor } from "./types";

interface FooterLink {
  id: string;
  label: string;
  href?: string;
}

export function SectionFooter({ element, tokens }: SectionRendererProps) {
  const logoSrc = (element.logoSrc as string) ?? "";
  const logoText = (element.logoText as string) ?? "N.A.S.A";
  const tagline =
    (element.tagline as string) ?? "Powered pelo Método N.A.S.A.®";
  const copyright =
    (element.copyright as string) ?? "© 2026 N.A.S.A";
  const links =
    (element.links as FooterLink[] | undefined) ?? [
      { id: "1", label: "Políticas de Privacidade", href: "#" },
      { id: "2", label: "Termos & Condições", href: "#" },
    ];

  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <footer
      className="w-full border-t py-8 sm:py-10 px-4"
      style={{ background: bg, color: fg, borderColor: `${fg}10` }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        {/* Branding */}
        <div className="flex items-center gap-3 text-center sm:text-left">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={logoText}
              className="h-8 sm:h-10 w-auto"
            />
          ) : (
            <span
              className="text-lg font-black tracking-tight"
              style={{ color: fg }}
            >
              {logoText}
            </span>
          )}
          {tagline && (
            <span
              className="hidden md:inline text-xs"
              style={{ color: muted }}
            >
              {tagline}
            </span>
          )}
        </div>

        {/* Links + copyright */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
          style={{ color: muted }}
        >
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href ?? "#"}
              className="hover:opacity-80 transition-opacity"
            >
              {link.label}
            </a>
          ))}
          <span className="text-xs">{copyright}</span>
        </div>
      </div>
    </footer>
  );
}
