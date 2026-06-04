/**
 * Section Stats — strip horizontal de 3-4 números em destaque.
 * Editável: lista de stats {value, label}.
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
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "32px 24px",
        background: bg,
        color: fg,
        borderTop: `1px solid ${fg}10`,
        borderBottom: `1px solid ${fg}10`,
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        gap: 24,
        alignItems: "center",
      }}
    >
      {stats.map((s) => (
        <div key={s.id} style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: primary,
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            {s.value}
          </div>
          <div style={{ fontSize: 13, color: muted }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
