/**
 * Section Features — grid responsivo de cards.
 * Mobile: 1 coluna. Tablet+: auto-fit min 220px.
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
    { id: "1", icon: "⚡", title: "Rápido", description: "Configure tudo em minutos, sem precisar de dev." },
    { id: "2", icon: "🛡", title: "Seguro", description: "Criptografia ponta a ponta + LGPD compliant." },
    { id: "3", icon: "🚀", title: "Escalável", description: "Cresce com sua empresa, sem limite artificial." },
  ];

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);
  const anchorId = (element.anchorId as string) ?? undefined;

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-3">
            {heading}
          </h2>
          <p className="text-sm sm:text-base" style={{ color: muted }}>
            {subheading}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {features.map((f) => (
            <div
              key={f.id}
              className="p-5 sm:p-6 rounded-2xl border"
              style={{
                background: `${primary}08`,
                borderColor: `${primary}30`,
              }}
            >
              <div className="text-2xl sm:text-3xl mb-3">{f.icon}</div>
              <h3 className="text-base sm:text-lg font-bold mb-1.5" style={{ color: fg }}>
                {f.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: muted }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
