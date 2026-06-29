import { ArrowRight, Zap } from "lucide-react";

/**
 * Automação como seção-herói. Briefing § 3.5: ESTA é a seção mais
 * importante depois do herói. Reforça o novo posicionamento, o
 * sistema leva o trabalho de um setor pro outro sozinho.
 *
 * Layout: diagrama horizontal de 5 estágios (chega → avança → fecha
 * → cobra → entrega) com conectores animados pra reforçar "fluxo
 * que não para". Cada estágio tem ícone + 1 frase.
 *
 * [TODO]: Wey pode trocar o diagrama por animação Lottie ou vídeo
 * curto do processo rodando. Mantenho versão SVG simples como
 * fallback pra não bloquear deploy.
 */
export function AutomationSection() {
  const stages = [
    {
      key: "chega",
      label: "Chega",
      desc: "Cliente entra por WhatsApp, Instagram, formulário ou anúncio",
      color: "from-blue-500/30 to-blue-500/10",
      ring: "ring-blue-500/30",
      text: "text-blue-300",
    },
    {
      key: "avanca",
      label: "Avança",
      desc: "Mensagem certa sai na hora certa, sem ninguém lembrar",
      color: "from-violet-500/30 to-violet-500/10",
      ring: "ring-violet-500/30",
      text: "text-violet-300",
    },
    {
      key: "fecha",
      label: "Fecha",
      desc: "Proposta assinada → atendimento recebe tudo, com histórico",
      color: "from-fuchsia-500/30 to-fuchsia-500/10",
      ring: "ring-fuchsia-500/30",
      text: "text-fuchsia-300",
    },
    {
      key: "cobra",
      label: "Cobra",
      desc: "Payment gera cobrança e dá baixa sozinho",
      color: "from-emerald-500/30 to-emerald-500/10",
      ring: "ring-emerald-500/30",
      text: "text-emerald-300",
    },
    {
      key: "entrega",
      label: "Entrega",
      desc: "NASA Route libera o conteúdo, atendimento segue com tudo",
      color: "from-orange-500/30 to-orange-500/10",
      ring: "ring-orange-500/30",
      text: "text-orange-300",
    },
  ];

  return (
    <section className="relative py-32 px-4 overflow-hidden border-t border-white/5">
      {/* Glows de destaque, esta é a seção-herói da página */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-fuchsia-500/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 rounded-full px-5 py-2 mb-6">
            <Zap className="size-3.5 text-violet-300" />
            <span className="text-violet-200 text-sm font-semibold tracking-wide">
              Automação ponta a ponta
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 leading-[1.05]">
            Um processo que anda sozinho,
            <br />
            <span className="text-nasa">do começo ao fim.</span>
          </h2>
          <p className="text-white/55 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            Quem leva o trabalho de um setor pro outro não é uma pessoa
            lembrando de fazer —{" "}
            <span className="text-white/85 font-semibold">é o sistema</span>. O
            cliente chega e a mensagem certa sai na hora certa. A venda fecha e
            o atendimento já recebe tudo, com o histórico junto. Chega a hora
            de cobrar, o Payment gera a cobrança e dá baixa sozinho. A entrega
            é liberada no NASA Route. É um ciclo que não para, e a sua equipe
            só entra onde precisa de decisão de gente.
          </p>
        </div>

        {/* Diagrama horizontal de 5 estágios, fluxo do processo.
            Em mobile vira coluna; em desktop linha com conectores
            animados.
            [TODO]: substituir por animação Lottie ou GIF quando Wey
            preparar, o briefing recomenda mockup em movimento. */}
        <div className="relative">
          {/* Linha conectora desktop */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-[60px] left-[10%] right-[10%] h-px"
          >
            <div className="h-full bg-gradient-to-r from-blue-500/40 via-violet-500/40 via-fuchsia-500/40 via-emerald-500/40 to-orange-500/40" />
            <div
              className="absolute inset-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent nasa-flow"
              style={{ animationDuration: "3.5s" }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-3 relative z-10">
            {stages.map((s, idx) => (
              <div
                key={s.key}
                className="flex flex-col items-center text-center group"
                style={{ animationDelay: `${idx * 120}ms` }}
              >
                {/* Bolha, núcleo do estágio */}
                <div
                  className={`relative w-[120px] h-[120px] rounded-full flex items-center justify-center bg-gradient-to-br ${s.color} ring-1 ${s.ring} ring-offset-2 ring-offset-transparent transition-transform duration-300 group-hover:scale-105`}
                >
                  <span
                    className={`text-2xl font-black ${s.text} tracking-tight`}
                  >
                    {s.label}
                  </span>
                  {/* Indicador "→" entre bolhas em mobile */}
                  {idx < stages.length - 1 && (
                    <ArrowRight
                      className="lg:hidden absolute -bottom-10 size-5 text-white/30 rotate-90"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p className="mt-6 text-sm text-white/55 leading-snug max-w-[200px]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Linha de fecho discreta */}
        <p className="mt-20 text-center text-sm text-white/35">
          Sem precisar de Zapier, ETL ou cola entre ferramentas. Tudo no mesmo
          banco, falando entre si.
        </p>
      </div>
    </section>
  );
}
