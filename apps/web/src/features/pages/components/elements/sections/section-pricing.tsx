/**
 * Section Pricing — cards de planos, responsivos.
 * Tipografia customizável por plano: nameStyle, sloganStyle,
 * priceStyle, periodStyle, featureStyle, ctaStyle.
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
import { wrapCardWithAnimatedBorder } from "../animated-border";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  slogan?: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  highlighted?: boolean;
  badge?: string;
  // Overrides por card
  nameStyle?: TextStyle;
  sloganStyle?: TextStyle;
  priceStyle?: TextStyle;
  periodStyle?: TextStyle;
  featureStyle?: TextStyle;
  ctaStyle?: TextStyle;
  cardBg?: string;
  cardBorder?: string;
}

const DEFAULT_PLANS: PricingPlan[] = [
  { id: "free", name: "Free", price: "R$ 0", period: "/mês", slogan: "Pra começar.", features: ["1 usuário", "Recursos básicos"], ctaLabel: "Começar grátis" },
  { id: "pro", name: "Pro", price: "R$ 197", period: "/mês", slogan: "Pra equipes pequenas.", features: ["10 usuários", "Integrações", "Suporte"], ctaLabel: "Assinar", highlighted: true, badge: "Mais popular" },
  { id: "enterprise", name: "Enterprise", price: "Sob consulta", slogan: "Pra grandes operações.", features: ["Ilimitado", "Gerente dedicado", "SLA"], ctaLabel: "Falar com vendas" },
];

export function SectionPricing({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Planos pra todo tipo de time";
  const subheading =
    (element.subheading as string) ?? "Sem cartão pra começar. Cancele quando quiser.";
  const plans = (element.plans as PricingPlan[] | undefined) ?? DEFAULT_PLANS;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);
  const anchorId = (element.anchorId as string) ?? undefined;

  // Section-level styles
  const headingStyle = element.headingStyle as TextStyle | undefined;
  const subheadingStyle = element.subheadingStyle as TextStyle | undefined;
  const sectionNameStyle = element.nameStyle as TextStyle | undefined;
  const sectionSloganStyle = element.sloganStyle as TextStyle | undefined;
  const sectionPriceStyle = element.priceStyle as TextStyle | undefined;
  const sectionPeriodStyle = element.periodStyle as TextStyle | undefined;
  const sectionFeatureStyle = element.featureStyle as TextStyle | undefined;
  const sectionCtaStyle = element.ctaStyle as TextStyle | undefined;

  // Defaults
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
  const nameDefaults: TextStyle = {
    color: fg,
    fontSize: 20,
    fontWeight: "700",
  };
  const sloganDefaults: TextStyle = {
    color: muted,
    fontSize: 12,
  };
  const priceDefaults: TextStyle = {
    color: fg,
    fontSize: 32,
    fontWeight: "900",
  };
  const periodDefaults: TextStyle = {
    color: muted,
    fontSize: 14,
  };
  const featureDefaults: TextStyle = {
    color: muted,
    fontSize: 14,
  };
  const ctaDefaults: TextStyle = {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  };

  const cardRadius = (element.cardRadius as number) ?? 16;
  const cardPadding = (element.cardPadding as number) ?? 24;

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        <RenderInterludeBlocks blocks={interlude.aboveHeading} />
        <div className="max-w-2xl mx-auto">
          <h2 style={{ ...textStyleToCSS(resolveTextStyle(undefined, headingStyle, headingDefaults)), marginBottom: 12 }}>
            {heading}
          </h2>
          <p style={textStyleToCSS(resolveTextStyle(undefined, subheadingStyle, subheadingDefaults))}>
            {subheading}
          </p>
        </div>
        <RenderInterludeBlocks blocks={interlude.betweenHeadingAndCards} />

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mx-auto w-full ${
            plans.length === 3
              ? "lg:grid-cols-3"
              : plans.length === 4
                ? "lg:grid-cols-4"
                : "lg:grid-cols-3"
          }`}
        >
          {plans.map((plan) => {
            const nameMerged = resolveTextStyle(plan.nameStyle, sectionNameStyle, nameDefaults);
            const sloganMerged = resolveTextStyle(plan.sloganStyle, sectionSloganStyle, sloganDefaults);
            const priceMerged = resolveTextStyle(plan.priceStyle, sectionPriceStyle, priceDefaults);
            const periodMerged = resolveTextStyle(plan.periodStyle, sectionPeriodStyle, periodDefaults);
            const featureMerged = resolveTextStyle(plan.featureStyle, sectionFeatureStyle, featureDefaults);
            const ctaMerged = resolveTextStyle(plan.ctaStyle, sectionCtaStyle, plan.highlighted ? ctaDefaults : { ...ctaDefaults, color: fg });
            const planInner = (
              <div
                className="relative flex flex-col gap-4 border-2"
                style={{
                  background:
                    plan.cardBg ??
                    (plan.highlighted ? `${primary}12` : `${fg}05`),
                  borderColor:
                    plan.cardBorder ??
                    (plan.highlighted ? primary : `${fg}15`),
                  borderRadius: cardRadius,
                  padding: cardPadding,
                  width: "100%",
                  height: "100%",
                }}
              >
                {plan.badge && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ background: primary, color: "#fff" }}
                  >
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 style={textStyleToCSS(nameMerged)}>{plan.name}</h3>
                  {plan.slogan && (
                    <p style={{ ...textStyleToCSS(sloganMerged), marginTop: 4 }}>
                      {plan.slogan}
                    </p>
                  )}
                </div>

                <div>
                  <span style={textStyleToCSS(priceMerged)}>{plan.price}</span>
                  {plan.period && (
                    <span style={{ ...textStyleToCSS(periodMerged), marginLeft: 4 }}>
                      {plan.period}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2 flex-1">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      style={{
                        ...textStyleToCSS(featureMerged),
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{ color: primary, fontWeight: 700, flexShrink: 0 }}
                      >
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.ctaHref ?? "#"}
                  className="w-full py-3 rounded-xl transition-opacity hover:opacity-90 inline-flex items-center justify-center"
                  style={{
                    background: plan.highlighted ? primary : "transparent",
                    border: plan.highlighted ? "none" : `1px solid ${fg}30`,
                    textDecoration: "none",
                    ...textStyleToCSS(ctaMerged),
                  }}
                >
                  {plan.ctaLabel}
                </a>
              </div>
            );
            return (
              <div key={plan.id}>
                {wrapCardWithAnimatedBorder(element, planInner)}
              </div>
            );
          })}
        </div>
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
