/**
 * Section CTA — bloco final de conversão, responsivo.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

export function SectionCta({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Pronto pra começar?";
  const headingAccent =
    (element.headingAccent as string) ?? "Vamos decolar.";
  const subtitle =
    (element.subtitle as string) ??
    "Sem cartão, sem contrato. Comece num clique e cancele quando quiser.";
  const primaryCta = (element.primaryCta as string) ?? "Começar agora";
  const secondaryCta = (element.secondaryCta as string) ?? "Falar com vendas";
  const primaryCtaHref = (element.primaryCtaHref as string) ?? "#";
  const secondaryCtaHref = (element.secondaryCtaHref as string) ?? "#";
  const anchorId = (element.anchorId as string) ?? undefined;
  const guarantees =
    (element.guarantees as string[] | undefined) ?? [
      "🛡 LGPD Compliant",
      "🌎 Hospedagem no Brasil",
      "⚡ Setup em 5 minutos",
    ];

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      id={anchorId}
      className="relative w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 md:py-24 text-center overflow-hidden scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      {/* Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: `${primary}15`,
          filter: "blur(120px)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col gap-6">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05]">
          {heading}
          <br />
          <span style={{ color: primary }}>{headingAccent}</span>
        </h2>

        <p className="text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto" style={{ color: muted }}>
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-2">
          <a
            href={primaryCtaHref}
            className="text-sm font-extrabold px-8 py-3.5 sm:py-4 rounded-xl transition-opacity hover:opacity-90 inline-flex items-center justify-center"
            style={{ background: primary, color: "#fff", boxShadow: `0 0 40px ${primary}50`, textDecoration: "none" }}
          >
            {primaryCta}
          </a>
          <a
            href={secondaryCtaHref}
            className="text-sm font-semibold px-8 py-3.5 sm:py-4 rounded-xl transition-colors hover:bg-white/5 border inline-flex items-center justify-center"
            style={{ color: fg, borderColor: `${fg}30`, textDecoration: "none" }}
          >
            {secondaryCta}
          </a>
        </div>

        {/* Selos */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs sm:text-sm mt-4" style={{ color: muted }}>
          {guarantees.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
