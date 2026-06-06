/**
 * Section Features — grid responsivo de cards.
 *
 * Personalização tipográfica (mesma hierarquia das outras sections):
 *   - heading/subheading: TextStyle no element.
 *   - Cada card: title/description com override próprio + opcional
 *     section-level (`titleStyle`, `descriptionStyle`).
 *   - Aparência do card individual: `cardBg`, `cardBorder`, `cardRadius`,
 *     `cardPadding`, `iconSize`.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionListItem,
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
import { wrapCardWithAnimatedBorder } from "../animated-border";

interface FeatureItem extends SectionListItem {
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
  cardBg?: string;
  cardBorder?: string;
}

export function SectionFeatures({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Por que escolher a gente";
  const subheading =
    (element.subheading as string) ??
    "3 motivos pra você acreditar antes mesmo de testar.";
  const features = (element.features as FeatureItem[] | undefined) ?? [
    { id: "1", icon: "⚡", title: "Rápido", description: "Configure tudo em minutos, sem precisar de dev." },
    { id: "2", icon: "🛡", title: "Seguro", description: "Criptografia ponta a ponta + LGPD compliant." },
    { id: "3", icon: "🚀", title: "Escalável", description: "Cresce com sua empresa, sem limite artificial." },
  ];

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);
  const anchorId = (element.anchorId as string) ?? undefined;

  const headingStyle = element.headingStyle as TextStyle | undefined;
  const subheadingStyle = element.subheadingStyle as TextStyle | undefined;
  const sectionTitleStyle = element.titleStyle as TextStyle | undefined;
  const sectionDescStyle = element.descriptionStyle as TextStyle | undefined;

  const headingDefaults: TextStyle = {
    color: fg,
    fontSize: 32,
    fontWeight: "900",
    align: "center",
    lineHeight: 1.15,
  };
  const subheadingDefaults: TextStyle = {
    color: muted,
    fontSize: 16,
    align: "center",
  };
  const titleDefaults: TextStyle = {
    color: fg,
    fontSize: 18,
    fontWeight: "700",
  };
  const descDefaults: TextStyle = {
    color: muted,
    fontSize: 14,
    lineHeight: 1.55,
  };

  const sectionCardBg = (element.cardBg as string) ?? `${primary}08`;
  const sectionCardBorder = (element.cardBorder as string) ?? `${primary}30`;
  const cardRadius = (element.cardRadius as number) ?? 16;
  const cardPadding = (element.cardPadding as number) ?? 24;
  const iconSize = (element.iconSize as number) ?? 32;

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        <RenderInterludeBlocks blocks={interlude.aboveHeading} />
        <div className="max-w-2xl mx-auto px-2">
          <h2 style={{ ...textStyleToCSS(resolveTextStyle(undefined, headingStyle, headingDefaults)), marginBottom: 12 }}>
            {heading}
          </h2>
          <p style={textStyleToCSS(resolveTextStyle(undefined, subheadingStyle, subheadingDefaults))}>
            {subheading}
          </p>
        </div>
        <RenderInterludeBlocks blocks={interlude.betweenHeadingAndCards} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {features.map((card) => {
            const titleMerged = resolveTextStyle(
              card.titleStyle,
              sectionTitleStyle,
              titleDefaults,
            );
            const descMerged = resolveTextStyle(
              card.descriptionStyle,
              sectionDescStyle,
              descDefaults,
            );
            const cardInner = (
              <div
                className="border"
                style={{
                  background: card.cardBg ?? sectionCardBg,
                  borderColor: card.cardBorder ?? sectionCardBorder,
                  borderRadius: cardRadius,
                  padding: cardPadding,
                  width: "100%",
                  height: "100%",
                }}
              >
                <div style={{ fontSize: iconSize, marginBottom: 12 }}>
                  {card.icon}
                </div>
                <h3 style={{ ...textStyleToCSS(titleMerged), marginBottom: 6 }}>
                  {card.title}
                </h3>
                <p style={textStyleToCSS(descMerged)}>{card.description}</p>
              </div>
            );
            return (
              <div key={card.id}>
                {wrapCardWithAnimatedBorder(element, cardInner)}
              </div>
            );
          })}
        </div>
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
