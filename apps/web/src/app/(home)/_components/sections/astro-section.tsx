import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiModelBadge } from "../mocks/ai-model-badge";
import { AstroAnimatedMock } from "../mocks/astro-animated-mock";

export function AstroSection() {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/4 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <Bot className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">
              IA nativa no NASA
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            Conheça o <span className="text-nasa">Astro</span>.
          </h2>
          <p className="text-white/55 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            A inteligência artificial do NASA, treinada pra informar, preparar o
            atendimento e quebrar objeções. Ela conhece o histórico de cada
            cliente em qualquer etapa, e responde pelo seu time mesmo quando
            você está dormindo.
          </p>
        </div>

        <div className="relative rounded-3xl border border-[#7C3AED]/25 overflow-hidden nasa-glass p-8 md:p-12">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#7C3AED]/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#a855f7]/7 blur-[80px] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start gap-12">
            {/* Left col */}
            <div className="flex-1">
              {/* AI model logos */}
              <p className="text-white/30 text-xs uppercase tracking-widest font-medium mb-3">
                Movido por
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                <AiModelBadge
                  name="Claude · Anthropic"
                  color="#D97757"
                  letter="C"
                />
                <AiModelBadge
                  name="Gemini · Google"
                  color="#4285F4"
                  letter="G"
                />
                <AiModelBadge
                  name="GPT-4o · OpenAI"
                  color="#10A37F"
                  letter="O"
                />
              </div>

              <ul className="space-y-4 mb-8">
                {[
                  {
                    icon: "🎙️",
                    text: "Recebe áudio, entende a intenção, cria agenda e proposta no fluxo",
                  },
                  {
                    icon: "📄",
                    text: "Monta propostas comerciais com o histórico do cliente em segundos",
                  },
                  {
                    icon: "📅",
                    text: "Agenda reuniões e marca os retornos direto no calendário",
                  },
                  {
                    icon: "🔌",
                    text: "Instala integrações por comando de voz ou texto",
                  },
                  {
                    icon: "🧭",
                    text: "Conhece o Método N.A.S.A.® e guia seu time passo a passo",
                  },
                  {
                    icon: "📊",
                    text: "Sugere o próximo passo com base no que está acontecendo agora",
                  },
                ].map((item) => (
                  <li
                    key={item.text}
                    className="flex items-start gap-3 text-white/65"
                  >
                    <span className="text-base shrink-0 mt-0.5">
                      {item.icon}
                    </span>
                    <span className="text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-7 py-5 rounded-xl card-hover nasa-glow-sm"
              >
                <Link href="/sign-up">
                  Testar o Astro
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Right col: animated chat mock */}
            <div className="w-full lg:w-[420px] shrink-0">
              <AstroAnimatedMock />
              {/* Live indicator */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="nasa-ping absolute inline-flex h-full w-full rounded-full bg-[#a78bfa] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]" />
                </span>
                <span className="text-white/30 text-[10px] font-medium">
                  Demonstração ao vivo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
