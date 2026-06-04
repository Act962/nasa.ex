/**
 * Section Features — grid de cards "ícone + título + descrição".
 * Editável: heading, subheading, lista de features.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionListItem,
  type SectionRendererProps,
} from "./types";

export function SectionFeatures({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Por que escolher a gente";
  const subheading =
    (element.subheading as string) ??
    "3 motivos pra você acreditar antes mesmo de testar.";
  const features = (element.features as SectionListItem[] | undefined) ?? [
    {
      id: "1",
      icon: "⚡",
      title: "Rápido",
      description: "Configure tudo em minutos, sem precisar de dev.",
    },
    {
      id: "2",
      icon: "🛡",
      title: "Seguro",
      description: "Criptografia ponta a ponta + LGPD compliant.",
    },
    {
      id: "3",
      icon: "🚀",
      title: "Escalável",
      description: "Cresce com sua empresa, sem limite artificial.",
    },
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
        gap: 32,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
          }}
        >
          {heading}
        </h2>
        <p style={{ fontSize: 16, color: muted, margin: 0 }}>{subheading}</p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
          gap: 16,
        }}
      >
        {features.map((f) => (
          <div
            key={f.id}
            style={{
              padding: 24,
              borderRadius: 16,
              background: `${primary}08`,
              border: `1px solid ${primary}30`,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: 0,
                marginBottom: 6,
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                color: muted,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
