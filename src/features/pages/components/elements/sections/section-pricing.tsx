/**
 * Section Pricing — cards de planos, responsivos.
 * Mobile: 1 coluna empilhada. Desktop: N colunas lado-a-lado.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  slogan?: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
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

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-3">
            {heading}
          </h2>
          <p className="text-sm sm:text-base" style={{ color: muted }}>
            {subheading}
          </p>
        </div>

        {/* Grid: 1 col mobile, 2 sm, N md+ baseado no número de plans */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mx-auto w-full ${
            plans.length === 3
              ? "lg:grid-cols-3"
              : plans.length === 4
                ? "lg:grid-cols-4"
                : "lg:grid-cols-3"
          }`}
        >
          {plans.map((p) => (
            <div
              key={p.id}
              className="relative p-5 sm:p-6 rounded-2xl flex flex-col gap-4 border-2"
              style={{
                background: p.highlighted ? `${primary}12` : `${fg}05`,
                borderColor: p.highlighted ? primary : `${fg}15`,
              }}
            >
              {p.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background: primary, color: "#fff" }}
                >
                  {p.badge}
                </span>
              )}

              <div>
                <h3 className="text-lg sm:text-xl font-bold">{p.name}</h3>
                {p.slogan && (
                  <p className="text-xs mt-1" style={{ color: muted }}>
                    {p.slogan}
                  </p>
                )}
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-black">{p.price}</span>
                {p.period && (
                  <span className="text-sm ml-1" style={{ color: muted }}>
                    {p.period}
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {p.features.map((f, i) => (
                  <li
                    key={i}
                    className="text-xs sm:text-sm flex items-start gap-2"
                    style={{ color: muted }}
                  >
                    <span style={{ color: primary }} className="font-bold shrink-0">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Botão do plano com href real — antes era <button>
                  sem destino, o campo "Link do botão" do editor era
                  ignorado silenciosamente. Agora respeita p.ctaHref. */}
              <a
                href={p.ctaHref ?? "#"}
                className="w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 inline-flex items-center justify-center"
                style={{
                  background: p.highlighted ? primary : "transparent",
                  color: p.highlighted ? "#fff" : fg,
                  border: p.highlighted ? "none" : `1px solid ${fg}30`,
                  textDecoration: "none",
                }}
              >
                {p.ctaLabel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
