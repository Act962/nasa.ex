/**
 * Section CTA — bloco final de conversão.
 * Editável: heading (2 linhas), subtitle, 2 botões, selos de garantia.
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
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "56px 32px",
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow de fundo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 400,
          background: `${primary}15`,
          filter: "blur(120px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.05,
            marginBottom: 16,
          }}
        >
          {heading}
          <br />
          <span style={{ color: primary }}>{headingAccent}</span>
        </h2>

        <p
          style={{
            fontSize: 18,
            color: muted,
            maxWidth: 500,
            margin: "0 auto 24px",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          <button
            style={{
              background: primary,
              color: "#fff",
              padding: "14px 32px",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              boxShadow: `0 0 40px ${primary}50`,
            }}
          >
            {primaryCta}
          </button>
          <button
            style={{
              background: "transparent",
              color: fg,
              padding: "14px 32px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              border: `1px solid ${fg}30`,
              cursor: "pointer",
            }}
          >
            {secondaryCta}
          </button>
        </div>

        {/* Selos */}
        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            flexWrap: "wrap",
            fontSize: 13,
            color: muted,
          }}
        >
          {guarantees.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
