import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMock } from "../mocks/chat-mock";
import { ForgeMock } from "../mocks/forge-mock";
import { InsightsMock } from "../mocks/insights-mock";
import { IntegrationsMock } from "../mocks/integrations-mock";

/**
 * Método N.A.S.A.®, 4 etapas + estágios de foguete.
 * Cada etapa traz nome + apelido espacial grudado na função real
 * (Preparação, Ignição, Propulsão, Em órbita). NÃO há parágrafo
 * espacial solto: a metáfora nomeia, a copy explica.
 *
 * Briefing diz: considerar conectar visualmente as 4 etapas pra
 * reforçar "estágios em sequência". A grid permanece 2x2 mas cada
 * card ganha um marcador de estágio (01, 02, 03, 04) que cresce em
 * intensidade, simula a sequência de ignição dos estágios.
 */
export function NasaMethodSection() {
  const pillars = [
    {
      stage: "01",
      letter: "N",
      color: "blue",
      title: "Necessidade",
      stageLabel: "Preparação",
      description:
        "Você recebe e organiza os contatos que chegam de qualquer canal: WhatsApp, Instagram, formulário, anúncio. Tudo num lugar só, sem planilha.",
      features: [
        "Chat de todos os canais juntos",
        "Etapas da venda em Kanban",
        "Astro IA dentro do chat",
        "Captura automática de contatos",
      ],
      mock: <ChatMock />,
      gradFrom: "from-blue-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-blue-500/20",
      letter_color: "text-blue-400",
      accent: "text-blue-400",
    },
    {
      stage: "02",
      letter: "A",
      color: "emerald",
      title: "Análise",
      stageLabel: "Ignição",
      description:
        "Você entende quem está pronto pra comprar e qual o próximo passo de cada contato. Os números mostram onde focar.",
      features: [
        "8 indicadores de conversão",
        "Gráficos por canal e etapa",
        "Performance por atendente",
        "Relatórios pra exportar",
      ],
      mock: <InsightsMock />,
      gradFrom: "from-emerald-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-emerald-500/20",
      letter_color: "text-emerald-400",
      accent: "text-emerald-400",
    },
    {
      stage: "03",
      letter: "S",
      color: "amber",
      title: "Sistematização",
      stageLabel: "Propulsão",
      description:
        "As automações empurram cada cliente de uma etapa pra próxima sozinhas: marcam o retorno na hora certa, mandam a mensagem, avisam o setor seguinte.",
      features: [
        "200+ integrações disponíveis",
        "Astro instala por comando",
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
      stage: "04",
      letter: "A",
      color: "purple",
      title: "Ação",
      stageLabel: "Em órbita",
      description:
        "Proposta assinada, pagamento confirmado, entrega feita, e o atendimento já segue com todo o histórico. O processo não acaba na venda. Ele continua girando.",
      features: [
        "Propostas comerciais",
        "Contratos com assinatura digital",
        "Cobranças geradas automáticas",
        "Atendimento com histórico cheio",
      ],
      mock: <ForgeMock />,
      gradFrom: "from-[#7C3AED]/15",
      gradTo: "to-pink-600/10",
      border: "border-[#7C3AED]/30",
      letter_color: "text-[#a78bfa]",
      accent: "text-[#a78bfa]",
    },
  ];

  return (
    <section id="o-que-e-nasa" className="relative py-28 px-4 scroll-mt-24">
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
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5 leading-tight">
            O Método <span className="text-nasa">N.A.S.A.®</span>, do primeiro
            contato à entrega,
            <br className="hidden sm:inline" />
            <span className="text-white/70"> sem trocar de sistema.</span>
          </h2>
          <p className="text-white/45 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            Quatro etapas que organizam o processo inteiro, não só a venda. O
            que começa no comercial segue pro atendimento, pra entrega e pro
            financeiro sem ninguém precisar passar o recado na mão.
          </p>
        </div>

        {/* Grid de estágios, conexão visual entre eles via numeração e
            opacidade crescente. Mantém grid 2x2 mas cada card sinaliza
            "estágio N" pra reforçar sequência. */}
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
              {/* Marcador de estágio no canto sup-direito, sequência
                  do foguete (01→02→03→04). */}
              <div className="absolute top-4 right-5 text-[10px] uppercase tracking-[0.2em] text-white/30 font-mono">
                Estágio {p.stage}
              </div>
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
                    <h3 className="text-xl font-bold text-white">
                      {p.title},{" "}
                      <span className={cn("text-sm font-semibold", p.accent)}>
                        {p.stageLabel}
                      </span>
                    </h3>
                    <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-md">
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
