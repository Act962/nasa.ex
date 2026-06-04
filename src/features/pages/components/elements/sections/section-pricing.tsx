/**
 * Section Pricing — tabela de planos com cards comparáveis.
 * Editável: heading, lista de planos (nome, preço, slogan, features, CTA).
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
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    slogan: "Pra começar.",
    features: ["1 usuário", "Recursos básicos", "Suporte por email"],
    ctaLabel: "Começar grátis",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 197",
    period: "/mês",
    slogan: "Pra equipes pequenas.",
    features: ["10 usuários", "Todas as integrações", "Suporte prioritário"],
    ctaLabel: "Assinar Pro",
    highlighted: true,
    badge: "Mais popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    slogan: "Pra grandes operações.",
    features: ["Usuários ilimitados", "Gerente dedicado", "SLA customizado"],
    ctaLabel: "Falar com vendas",
  },
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
      <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 900, margin: 0, marginBottom: 12 }}>
          {heading}
        </h2>
        <p style={{ fontSize: 16, color: muted, margin: 0 }}>{subheading}</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))`,
          gap: 16,
        }}
      >
        {plans.map((p) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              padding: 24,
              borderRadius: 16,
              background: p.highlighted ? `${primary}12` : `${fg}05`,
              border: p.highlighted
                ? `2px solid ${primary}`
                : `1px solid ${fg}15`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {p.badge && (
              <span
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: primary,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 999,
                }}
              >
                {p.badge}
              </span>
            )}

            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{p.name}</h3>
              {p.slogan && (
                <p style={{ fontSize: 12, color: muted, margin: 0, marginTop: 4 }}>
                  {p.slogan}
                </p>
              )}
            </div>

            <div>
              <span style={{ fontSize: 32, fontWeight: 900 }}>{p.price}</span>
              {p.period && (
                <span style={{ fontSize: 14, color: muted, marginLeft: 4 }}>
                  {p.period}
                </span>
              )}
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
              }}
            >
              {p.features.map((f, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    color: muted,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ color: primary, fontWeight: 700 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={{
                background: p.highlighted ? primary : "transparent",
                color: p.highlighted ? "#fff" : fg,
                padding: "12px 16px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                border: p.highlighted ? "none" : `1px solid ${fg}30`,
                cursor: "pointer",
              }}
            >
              {p.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
