import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMock } from "../mocks/chat-mock";
import { ForgeMock } from "../mocks/forge-mock";
import { InsightsMock } from "../mocks/insights-mock";
import { IntegrationsMock } from "../mocks/integrations-mock";

export function NasaMethodSection() {
  const pillars = [
    {
      letter: "N",
      color: "blue",
      title: "Necessidade",
      subtitle: "Chat & Pipeline",
      description:
        "Capture e qualifique leads de qualquer canal. Pipeline visual Kanban para nunca perder uma oportunidade comercial.",
      features: [
        "Chat omnichannel unificado",
        "Pipeline Kanban drag & drop",
        "IA ASTRO integrada no chat",
        "Captura automática de leads",
      ],
      mock: <ChatMock />,
      gradFrom: "from-blue-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-blue-500/20",
      letter_color: "text-blue-400",
      accent: "text-blue-400",
    },
    {
      letter: "A",
      color: "emerald",
      title: "Análise",
      subtitle: "Insights & Métricas",
      description:
        "Dashboards em tempo real. Entenda seu funil, meça o ROI de cada canal e tome decisões baseadas em dados reais.",
      features: [
        "8 KPIs de conversão",
        "Gráficos por canal e status",
        "Performance por atendente",
        "Relatórios exportáveis",
      ],
      mock: <InsightsMock />,
      gradFrom: "from-emerald-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-emerald-500/20",
      letter_color: "text-emerald-400",
      accent: "text-emerald-400",
    },
    {
      letter: "S",
      color: "amber",
      title: "Sistematização",
      subtitle: "Integrações & Automações",
      description:
        "Conecte +200 ferramentas ao seu processo comercial. ASTRO instala e configura integrações por comando de texto.",
      features: [
        "200+ integrações disponíveis",
        "ASTRO instala por comando",
        "Automações sem código",
        "WhatsApp, Instagram, Telegram",
      ],
      mock: <IntegrationsMock />,
      gradFrom: "from-amber-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-amber-500/20",
      letter_color: "text-amber-400",
      accent: "text-amber-400",
    },
    {
      letter: "A",
      color: "purple",
      title: "Ação",
      subtitle: "FORGE — Propostas & Contratos",
      description:
        "Feche negócios mais rápido. Crie propostas profissionais, contratos digitais e links de pagamento em minutos.",
      features: [
        "Propostas comerciais",
        "Contratos com assinatura digital",
        "Links de pagamento integrados",
        "Multi-gateway: Stripe, Pix, etc.",
      ],
      mock: <ForgeMock />,
      gradFrom: "from-[#7C3AED]/20",
      gradTo: "to-pink-600/10",
      border: "border-[#7C3AED]/30",
      letter_color: "text-[#a78bfa]",
      accent: "text-[#a78bfa]",
    },
  ];

  return (
    <section className="relative py-28 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/4 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <Sparkles className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">
              Nossa metodologia exclusiva
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            O Método <span className="text-nasa">N.A.S.A.®</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto leading-relaxed">
            4 etapas que estruturam seu processo comercial do zero ao
            fechamento. Uma metodologia criada para times de vendas que querem
            resultados reais.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className={cn(
                "relative rounded-2xl border p-6 nasa-glass card-hover overflow-hidden",
                p.border,
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none",
                  p.gradFrom,
                  p.gradTo,
                )}
              />
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-4xl font-black border shrink-0 bg-white/5",
                      p.border,
                      p.letter_color,
                    )}
                  >
                    {p.letter}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-xl font-bold text-white">{p.title}</h3>
                    <p className={cn("text-sm font-semibold mt-0.5", p.accent)}>
                      {p.subtitle}
                    </p>
                    <p className="text-white/45 text-xs mt-1.5 leading-relaxed max-w-sm">
                      {p.description}
                    </p>
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-2 mb-5">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-xs text-white/55"
                    >
                      <CheckCircle2
                        className={cn("size-3.5 shrink-0", p.accent)}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.mock}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
