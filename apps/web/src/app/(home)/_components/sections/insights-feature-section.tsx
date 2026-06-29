import Link from "next/link";
import { ArrowRight, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InsightsAnimatedMock } from "../mocks/insights-animated-mock";

export function InsightsFeatureSection({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1877F2]/3 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <BarChart2 className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">
              Tráfego pago unificado
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5 leading-tight">
            Onde o processo trava —
            <br className="hidden sm:inline" />{" "}
            <span className="text-nasa">e quanto cada etapa custa.</span>
          </h2>
          <p className="text-white/55 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Todos os dados do seu investimento em divulgação num painel só.
            Meta Ads, Google Ads, TikTok Ads, conectados às etapas do seu
            processo, em tempo real.
          </p>
        </div>

        <div className="relative rounded-3xl border border-[#7C3AED]/25 overflow-hidden nasa-glass p-8 md:p-12">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#4285F4]/6 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#1877F2]/6 blur-[80px] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start gap-12">
            {/* Left: animated mock */}
            <div className="w-full lg:w-[440px] shrink-0">
              <InsightsAnimatedMock />
              {/* Source badges */}
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                {[
                  { name: "Meta Ads", color: "#1877F2" },
                  { name: "Google Ads", color: "#4285F4" },
                  { name: "TikTok Ads", color: "#69C9D0" },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-full px-2.5 py-1"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="text-white/40 text-[9px] font-medium">
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: features */}
            <div className="flex-1">
              <ul className="space-y-4 mb-8">
                {[
                  {
                    icon: "📊",
                    text: "Retorno do que você investiu, quanto cada cliente custou, impressões e cliques por canal, em tempo real",
                  },
                  {
                    icon: "🎯",
                    text: "Cada cliente atribuído ao anúncio que o gerou, com o caminho completo da venda",
                  },
                  {
                    icon: "🤖",
                    text: "Astro analisa os dados e sugere onde investir mais",
                  },
                  {
                    icon: "🔁",
                    text: "Dados entram direto nas etapas, nenhum contato se perde",
                  },
                  {
                    icon: "📈",
                    text: "Comparativo entre períodos com alertas de queda de performance",
                  },
                  {
                    icon: "🔗",
                    text: "Integração nativa com Meta Business, Google Ads e TikTok Ads",
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

              {/* Mini stat cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  {
                    label: "Redução no custo por cliente",
                    value: "até 40%",
                    color: "text-emerald-400",
                    bg: "bg-emerald-400/8 border-emerald-400/20",
                  },
                  {
                    label: "Retorno médio do investido",
                    value: "3.8×",
                    color: "text-[#a78bfa]",
                    bg: "bg-[#7C3AED]/10 border-[#7C3AED]/20",
                  },
                  {
                    label: "Canais integrados",
                    value: "3 plats.",
                    color: "text-[#4285F4]",
                    bg: "bg-[#4285F4]/8 border-[#4285F4]/20",
                  },
                  {
                    label: "Atualização",
                    value: "Em tempo real",
                    color: "text-yellow-400",
                    bg: "bg-yellow-400/8 border-yellow-400/20",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={cn("rounded-xl p-3 border", stat.bg)}
                  >
                    <p className="text-white/40 text-[10px] font-medium mb-0.5">
                      {stat.label}
                    </p>
                    <p className={cn("font-black text-sm", stat.color)}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-7 py-5 rounded-xl card-hover nasa-glow-sm"
              >
                <Link href={isLoggedIn ? "/insights" : "/sign-up"}>
                  Ver meu painel de Insights
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
