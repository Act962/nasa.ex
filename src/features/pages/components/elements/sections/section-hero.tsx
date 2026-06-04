/**
 * Section Hero — mobile-first responsive.
 * Editável: badge, headline (2 linhas), subtitle, 2 CTAs, imagem.
 * Cores via tokens. Layout fluido com Tailwind responsive classes.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

export function SectionHero({ element, tokens }: SectionRendererProps) {
  const badge = (element.badge as string) ?? "★ Novo na NASA";
  const titleLine1 = (element.titleLine1 as string) ?? "Headline poderosa";
  const titleLine2 =
    (element.titleLine2 as string) ?? "que para a rolagem.";
  const subtitle =
    (element.subtitle as string) ??
    "Uma frase clara que explica em 1 segundo o que sua empresa faz.";
  const primaryCta = (element.primaryCta as string) ?? "Começar agora";
  const secondaryCta = (element.secondaryCta as string) ?? "Ver demo";
  const imageUrl = (element.imageUrl as string) ?? "";

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      className="w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28 flex flex-col items-center text-center gap-5 sm:gap-6 overflow-hidden"
      style={{ background: bg, color: fg }}
    >
      {/* Badge */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium border"
        style={{
          background: `${primary}20`,
          color: primary,
          borderColor: `${primary}50`,
        }}
      >
        {badge}
      </div>

      {/* Headline */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl"
        style={{ color: fg }}
      >
        {titleLine1}
        <br />
        <span style={{ color: primary }}>{titleLine2}</span>
      </h1>

      {/* Subtitle */}
      <p
        className="text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl"
        style={{ color: muted }}
      >
        {subtitle}
      </p>

      {/* CTAs - empilha em mobile, lado-a-lado em sm+ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-2 w-full sm:w-auto">
        <button
          className="text-sm font-bold px-7 py-3 sm:py-3.5 rounded-xl transition-opacity hover:opacity-90"
          style={{ background: primary, color: "#fff" }}
        >
          {primaryCta}
        </button>
        <button
          className="text-sm font-semibold px-7 py-3 sm:py-3.5 rounded-xl transition-colors hover:bg-white/5 border"
          style={{ color: fg, borderColor: `${fg}30` }}
        >
          {secondaryCta}
        </button>
      </div>

      {/* Imagem opcional */}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="w-full max-w-4xl rounded-xl mt-4 sm:mt-6"
          style={{ boxShadow: `0 20px 60px ${primary}30` }}
        />
      )}
    </section>
  );
}
