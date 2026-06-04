/**
 * Section Hero — mega-bloco pré-montado pra topo de landing.
 * Editável: badge, headline (2 linhas), subtitle, 2 CTAs, imagem.
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
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "48px 32px",
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 18,
        overflow: "hidden",
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 999,
          background: `${primary}20`,
          color: primary,
          fontSize: 12,
          fontWeight: 600,
          border: `1px solid ${primary}50`,
        }}
      >
        {badge}
      </div>

      {/* Headline */}
      <h1
        style={{
          fontSize: 48,
          fontWeight: 900,
          lineHeight: 1.05,
          margin: 0,
          maxWidth: 800,
        }}
      >
        {titleLine1}
        <br />
        <span style={{ color: primary }}>{titleLine2}</span>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 18,
          color: muted,
          maxWidth: 600,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {subtitle}
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          style={{
            background: primary,
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
          }}
        >
          {primaryCta}
        </button>
        <button
          style={{
            background: "transparent",
            color: fg,
            padding: "12px 28px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            border: `1px solid ${fg}30`,
            cursor: "pointer",
          }}
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
          style={{
            maxWidth: "85%",
            marginTop: 24,
            borderRadius: 12,
            boxShadow: `0 20px 60px ${primary}30`,
          }}
        />
      )}
    </div>
  );
}
