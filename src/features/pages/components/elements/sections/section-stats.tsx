/**
 * Section Stats — strip horizontal de 3-4 números.
 * Mobile: 2 col. Desktop: N col.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

interface Stat {
  id: string;
  value: string;
  label: string;
}

export function SectionStats({ element, tokens }: SectionRendererProps) {
  const stats =
    (element.stats as Stat[] | undefined) ?? [
      { id: "1", value: "2.300+", label: "Empresas ativas" },
      { id: "2", value: "847k", label: "Leads capturados" },
      { id: "3", value: "89%", label: "Aumento médio em conversão" },
      { id: "4", value: "200+", label: "Integrações" },
    ];

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 border-y"
      style={{ background: bg, color: fg, borderColor: `${fg}10` }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
        {stats.map((s) => (
          <div key={s.id}>
            <div
              className="text-2xl sm:text-3xl md:text-4xl font-black leading-none mb-1.5"
              style={{ color: primary }}
            >
              {s.value}
            </div>
            <div className="text-xs sm:text-sm" style={{ color: muted }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
