import Link from "next/link";
import {
  Bolt,
  BrainCircuit,
  Gift,
  Layers,
  Lock,
  RefreshCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARS_CARDS = [
  {
    icon: Gift,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    title: "Plano Suit, Gratuito para sempre",
    desc: "Comece sem pagar nada. CRM completo, pipeline de vendas e usuários ilimitados (30★/usuário). Sem expiração.",
  },
  {
    icon: RefreshCw,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
    title: "Stars nunca se perdem",
    desc: "30% das suas Stars não utilizadas rolam automaticamente para o próximo mês. Seu esforço acumula.",
  },
  {
    icon: Layers,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/20",
    title: "Acumule e escale no seu ritmo",
    desc: "Compre pacotes avulsos de Stars quando precisar ativar uma integração específica. Sem comprometimento de plano.",
  },
  {
    icon: Bolt,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    title: "Cada Star tem poder real",
    desc: "Stars ativam integrações (WhatsApp, Instagram, IA), automações e relatórios avançados conforme você cresce.",
  },
  {
    icon: BrainCircuit,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    border: "border-pink-400/20",
    title: "IA inclusa em todo plano pago",
    desc: "O ASTRO, assistente de IA da plataforma, está disponível em todos os planos pagos para acelerar seu processo comercial.",
  },
  {
    icon: Lock,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
    title: "Seus dados, sua empresa",
    desc: "LGPD Compliant, hospedagem 100% no Brasil, backups diários. Seu negócio protegido do começo ao fim.",
  },
];

export function StarsInfoSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-yellow-400/4 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2">
            <Star className="size-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold tracking-wide">
              ★ Stars, A moeda do crescimento
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          Para quem está começando,
          <br />
          <span className="text-nasa">tudo começa de graça</span>
        </h2>

        {/* Reposicionamento das STARs, briefing § 3.7. Bloco novo
            ANTES do conteúdo de rollover/simulador (que segue intacto).
            Posiciona STARs como ferramenta de visibilidade de custo do
            processo, não só "moeda interna". */}
        <p className="text-white/60 text-center text-base sm:text-lg mb-6 max-w-3xl mx-auto leading-relaxed">
          As STARs não são só como você paga, são como você enxerga{" "}
          <span className="text-white/90 font-semibold">
            quanto custa cada passo do seu processo
          </span>
          . Você vê qual automação gasta mais, qual etapa pesa no bolso, e
          decide onde economizar. Conta no fim do mês sem saber o que pagou,
          nunca mais.
        </p>
        <p className="text-white/40 text-center text-sm sm:text-base mb-16 max-w-2xl mx-auto leading-relaxed">
          Cada plano inclui um crédito mensal pra ativar integrações,
          automações e ferramentas. Você começa sem gastar nada.
        </p>

        {/* How Stars work visual */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6 mb-12 max-w-4xl mx-auto">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest text-center mb-6">
            Como Stars funcionam
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {[
              {
                emoji: "📋",
                label: "Assine um plano",
                sub: "ou use o Suit grátis",
              },
              { emoji: "→", label: "", sub: "" },
              {
                emoji: "⭐",
                label: "Receba Stars mensais",
                sub: "créditos automáticos",
              },
              { emoji: "→", label: "", sub: "" },
              {
                emoji: "🔌",
                label: "Ative integrações",
                sub: "WhatsApp, IA, CRM...",
              },
              { emoji: "→", label: "", sub: "" },
              {
                emoji: "📈",
                label: "Escale seu negócio",
                sub: "com dados e automações",
              },
            ].map((step, i) =>
              step.label === "" ? (
                <div key={i} className="text-white/15 text-2xl hidden sm:block">
                  →
                </div>
              ) : (
                <div key={i} className="text-center flex-1">
                  <div className="text-3xl mb-1">{step.emoji}</div>
                  <p className="text-white/80 text-xs font-semibold">
                    {step.label}
                  </p>
                  <p className="text-white/30 text-[10px] mt-0.5">{step.sub}</p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Benefit cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {STARS_CARDS.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div
              key={title}
              className={cn(
                "nasa-glass rounded-xl p-5 border transition-all card-hover",
                border,
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
                  bg,
                )}
              >
                <Icon className={cn("size-4.5", color)} />
              </div>
              <p className="text-white font-bold text-sm mb-1.5">{title}</p>
              <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Rollover visual */}
        <div className="stars-card rounded-2xl p-8 max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-3">♻️</div>
          <h3 className="text-white font-black text-xl mb-2">
            Stars não utilizadas{" "}
            <span className="text-yellow-400">não desaparecem</span>
          </h3>
          <p className="text-white/50 text-sm mb-6 max-w-lg mx-auto leading-relaxed">
            Uma parte das suas Stars inutilizadas rolam para o próximo ciclo.
            Quanto melhor seu plano, maior o rollover, recompensando quem
            planeja com inteligência.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            {[
              {
                plan: "Suit",
                pct: "0%",
                color: "text-zinc-400",
                badge: "bg-zinc-700",
              },
              {
                plan: "Earth",
                pct: "20%",
                color: "text-blue-400",
                badge: "bg-blue-500/20",
              },
              {
                plan: "Explore",
                pct: "25%",
                color: "text-violet-400",
                badge: "bg-violet-500/20",
              },
              {
                plan: "Constellation",
                pct: "30%",
                color: "text-yellow-400",
                badge: "bg-yellow-500/20",
              },
            ].map(({ plan, pct, color, badge }) => (
              <div key={plan} className="text-center">
                <div className={cn("text-2xl font-black mb-1", color)}>
                  {pct}
                </div>
                <div
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-semibold text-white/70",
                    badge,
                  )}
                >
                  {plan}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar com Suit, Grátis
              <Gift className="size-4 ml-2" />
            </Link>
          </Button>
          <p className="text-white/25 text-xs mt-3">
            Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  );
}
