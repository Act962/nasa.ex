/**
 * Section Stats — strip horizontal de 3-4 números.
 * Mobile: 2 col. Desktop: N col. Cada stat tem typography overridável.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";
import {
  resolveTextStyle,
  textStyleToCSS,
  type TextStyle,
} from "../../../lib/text-style";
import {
  RenderInterludeBlocks,
  type InterludeZones,
} from "./interlude-block";

interface Stat {
  id: string;
  value: string;
  label: string;
  valueStyle?: TextStyle;
  labelStyle?: TextStyle;
}

export function SectionStats({ element, tokens }: SectionRendererProps) {
  const stats =
    (element.stats as Stat[] | undefined) ?? [
      { id: "1", value: "2.300+", label: "Empresas ativas" },
      { id: "2", value: "847k", label: "Leads capturados" },
      { id: "3", value: "89%", label: "Aumento médio em conversão" },
      { id: "4", value: "200+", label: "Integrações" },
    ];
  const anchorId = (element.anchorId as string) ?? undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  const sectionValueStyle = element.valueStyle as TextStyle | undefined;
  const sectionLabelStyle = element.labelStyle as TextStyle | undefined;

  const valueDefaults: TextStyle = {
    color: primary,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 1,
    align: "center",
  };
  const labelDefaults: TextStyle = {
    color: muted,
    fontSize: 14,
    align: "center",
  };

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 border-y scroll-mt-20"
      style={{ background: bg, color: fg, borderColor: `${fg}10` }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
        {stats.map((stat) => {
          const valueMerged = resolveTextStyle(
            stat.valueStyle,
            sectionValueStyle,
            valueDefaults,
          );
          const labelMerged = resolveTextStyle(
            stat.labelStyle,
            sectionLabelStyle,
            labelDefaults,
          );
          return (
            <div key={stat.id}>
              <div style={{ ...textStyleToCSS(valueMerged), marginBottom: 6 }}>
                {stat.value}
              </div>
              <div style={textStyleToCSS(labelMerged)}>{stat.label}</div>
            </div>
          );
        })}
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
