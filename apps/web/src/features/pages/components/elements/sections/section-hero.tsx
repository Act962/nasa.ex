/**
 * Section Hero — mobile-first responsive.
 *
 * Dois modos de uso de imagem (combináveis):
 *
 * 1. `backgroundImage` — imagem cobre o FUNDO inteiro da section
 *    (full-bleed estilo "A MINA", "Drathaine"), com `backgroundOverlay`
 *    escurecendo pra contraste do texto. Mobile e desktop iguais.
 *
 * 2. `imageUrl` — imagem renderiza ABAIXO do texto, centralizada,
 *    boxShadow colorido. Padrão tipo "hero com mockup de produto".
 *
 * Os dois podem ser usados juntos (background como ambiente +
 * mockup central), ou só um, ou nenhum (fallback `bgColor`).
 *
 * Editável: badge, headline (2 linhas), subtitle, 2 CTAs, hrefs,
 * imagem central, imagem de fundo, overlay, alinhamento.
 */
import type { CSSProperties } from "react";
import { resolveButtons, renderSectionButton } from "./buttons";
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
  // Hrefs configuráveis — aceita âncoras (#), URLs externas, mailto
  const primaryCtaHref = (element.primaryCtaHref as string) ?? "#";
  const secondaryCtaHref = (element.secondaryCtaHref as string) ?? "#";
  const imageUrl = (element.imageUrl as string) ?? "";
  // backgroundImage cobre o fundo da section toda (estilo A MINA).
  // backgroundOverlay é o gradient/cor sobre a imagem pra contraste.
  // Default: gradient escuro top → mais escuro embaixo.
  const backgroundImage = (element.backgroundImage as string) ?? "";
  const backgroundOverlay =
    (element.backgroundOverlay as string) ??
    "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%)";
  const backgroundPosition =
    (element.backgroundPosition as string) ?? "center";
  // `anchorId` permite linkar pra essa section via "#<id>" em outros
  // CTAs / navbar. Default: gera a partir do tipo do bloco.
  const anchorId = (element.anchorId as string) ?? undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  // Monta style do <section>: se tem backgroundImage, usa
  // `backgroundImage` (com overlay + url) ao invés de `background`
  // chapado. Sintaxe `linear-gradient(...), url(...)` empilha overlay
  // POR CIMA da imagem.
  const sectionStyle: CSSProperties = backgroundImage
    ? {
        backgroundImage: `${backgroundOverlay}, url("${backgroundImage}")`,
        backgroundSize: "cover",
        backgroundPosition,
        backgroundRepeat: "no-repeat",
        backgroundColor: bg, // fallback se imagem falhar
        color: fg,
      }
    : { background: bg, color: fg };

  return (
    <section
      id={anchorId}
      className="relative w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28 flex flex-col items-center text-center gap-5 sm:gap-6 overflow-hidden scroll-mt-20"
      style={sectionStyle}
    >
      {/* Badge */}
      <div
        className="relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium border"
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
        className="relative text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl"
        style={{ color: fg, textShadow: backgroundImage ? "0 2px 16px rgba(0,0,0,0.6)" : undefined }}
      >
        {titleLine1}
        <br />
        <span style={{ color: primary }}>{titleLine2}</span>
      </h1>

      {/* Subtitle */}
      <p
        className="relative text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl"
        style={{ color: muted, textShadow: backgroundImage ? "0 1px 8px rgba(0,0,0,0.6)" : undefined }}
      >
        {subtitle}
      </p>

      {/* CTAs - lista variável de botões (resolvido com fallback
          legacy primaryCta/secondaryCta pra back-compat). */}
      {(() => {
        const buttons = resolveButtons(element, {
          defaultPrimary: primaryCta,
          defaultSecondary: secondaryCta,
        });
        if (buttons.length === 0) return null;
        return (
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-center flex-wrap gap-3 mt-2 w-full sm:w-auto">
            {buttons.map((b) =>
              renderSectionButton(b, {
                primary,
                fg,
                size: "md",
                textShadow: backgroundImage
                  ? "0 1px 4px rgba(0,0,0,0.4)"
                  : undefined,
              }),
            )}
          </div>
        );
      })()}

      {/* Imagem central opcional (estilo mockup abaixo do texto) */}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="relative w-full max-w-4xl rounded-xl mt-4 sm:mt-6"
          style={{ boxShadow: `0 20px 60px ${primary}30` }}
        />
      )}
    </section>
  );
}
