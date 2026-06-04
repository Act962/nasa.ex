import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  FileSpreadsheet,
  Handshake,
  MessageSquareWarning,
  Play,
  Rocket,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sequência ilustrativa do "caos atual", 4 passos numerados
 * (1, 2, 3, 4) com ícone X de erro, marcando que NADA disso é
 * o jeito certo. Abaixo, bloco NASA explicando como funciona.
 *
 * Em desktop: linha horizontal de 4 cards numerados.
 * Em mobile: grid 2x2 (cabe melhor que coluna vertical).
 */
const CHAOS_STEPS = [
  {
    icon: Handshake,
    label: "Comercial fecha",
    desc: "Venda concluída",
  },
  {
    icon: MessageSquareWarning,
    label: "Print no WhatsApp",
    desc: "Avisa o atendimento",
  },
  {
    icon: FileSpreadsheet,
    label: "Planilha",
    desc: "Atendimento avisa o financeiro",
  },
  {
    icon: XCircle,
    label: "Cliente reclama",
    desc: "Alguém esqueceu alguma coisa",
  },
];

export function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[700px] h-[700px] rounded-full bg-[#7C3AED]/12 blur-[140px] nasa-glow pointer-events-none" />
      <div
        className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[#a855f7]/8 blur-[100px] nasa-glow pointer-events-none"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2.5 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 nasa-badge nasa-fade-up">
          <Rocket className="size-3.5 text-[#a78bfa]" />
          <span className="text-[#c4b5fd] text-sm font-medium">
            Powered pelo Método N.A.S.A.® exclusivo
          </span>
          <ChevronRight className="size-3.5 text-[#7C3AED]" />
        </div>

        {/* Headline, Novo posicionamento: processo cross-setorial */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-[0.95] nasa-fade-up-d1">
          <span className="text-white">Seu processo não devia morrer</span>
          <br />
          <span className="text-nasa">toda vez que muda de setor.</span>
        </h1>

        {/* Subtitle curto, uma linha que pavimenta a visualização */}
        <p className="text-base sm:text-lg text-white/45 max-w-2xl mb-10 leading-relaxed nasa-fade-up-d2">
          Hoje, a cada troca de mãos entre setores, alguém esquece alguma
          coisa. Você só descobre quando o cliente reclama.
        </p>

        {/* Fluxo ilustrativo dividido em 2 blocos:
            (1) 4 cards numerados do CAOS ATUAL, cada um com badge
                circular 1/2/3/4 e ícone X vermelho no canto sinalizando
                "isso está errado"
            (2) Bloco NASA abaixo, fundo violeta, explicando "como
                funciona" o jeito certo
            Conectores entre os 4 cards: setas chevron pra reforçar
            sequência. */}
        <div className="w-full max-w-6xl mb-12 nasa-fade-up-d3">
          {/* Cabeçalho do bloco de caos */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <XCircle className="size-4 text-red-400/80" />
            <p className="text-xs text-red-300/80 uppercase tracking-[0.25em] font-semibold">
              Como funciona hoje
            </p>
            <XCircle className="size-4 text-red-400/80" />
          </div>

          {/* Grid dos 4 passos do caos, desktop linha; mobile 2x2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {CHAOS_STEPS.map((step, idx) => (
              <div
                key={step.label}
                className="relative rounded-xl border border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm p-4 md:p-5 text-left overflow-hidden"
              >
                {/* Badge de número grande, canto sup-esquerdo */}
                <div className="absolute -top-2 -left-2 w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <span className="text-red-300 text-sm font-black tracking-tight">
                    {idx + 1}
                  </span>
                </div>

                {/* Ícone X no canto sup-direito, "isso não é certo" */}
                <div
                  className="absolute top-2 right-2 text-red-400/60"
                  aria-hidden="true"
                >
                  <XCircle className="size-4" strokeWidth={2} />
                </div>

                {/* Ícone temático do passo, centrado, opaco */}
                <div className="flex justify-center pt-3 pb-3">
                  <step.icon
                    className="size-8 md:size-10 text-white/40"
                    strokeWidth={1.4}
                  />
                </div>

                {/* Conteúdo */}
                <p className="text-white/85 text-sm font-semibold leading-tight text-center">
                  {step.label}
                </p>
                <p className="text-white/40 text-[11px] mt-1 leading-snug text-center">
                  {step.desc}
                </p>

                {/* Linha sutil vermelha no rodapé do card pra reforçar
                    "erro" sem competir com o conteúdo */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
              </div>
            ))}
          </div>

          {/* Bloco NASA abaixo, fundo violeta, glow, alinhado central.
              É a virada explicando "como FUNCIONA" no jeito certo. */}
          <div className="relative rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-500/15 via-violet-500/10 to-fuchsia-500/10 backdrop-blur-sm p-5 md:p-6 shadow-[0_0_60px_rgba(124,58,237,0.35)] overflow-hidden">
            {/* Linha violeta no topo */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

            <div className="flex items-start gap-4">
              {/* Selo NASA */}
              <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-violet-500/25 border border-violet-400/50 flex items-center justify-center">
                <Sparkles
                  className="size-6 md:size-7 text-violet-200"
                  strokeWidth={1.5}
                />
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80 font-bold">
                    Com NASA
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80 font-bold">
                    Como funciona
                  </span>
                </div>
                <p className="text-white text-base md:text-lg font-bold leading-snug mb-1">
                  Um processo só, do começo ao fim.
                </p>
                <p className="text-violet-100/80 text-sm leading-relaxed">
                  O sistema leva o trabalho de um setor pro outro sozinho —
                  sem print, sem planilha, sem ninguém esquecendo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 nasa-fade-up-d3">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-9 py-6 text-base rounded-xl nasa-glow-sm card-hover"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Ver funcionando
              <Rocket className="size-4 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/3 text-white hover:bg-white/8 font-semibold px-9 py-6 text-base rounded-xl card-hover"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              <Play className="size-4 mr-2 text-[#a78bfa] fill-[#a78bfa]" />
              Começar de graça
            </Link>
          </Button>
        </div>

        {/* Social proof, 3 selos do briefing */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/30 mb-10 nasa-fade-up-d3">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 nasa-ping" />
            </div>
            <span>2.300+ empresas ativas</span>
          </div>
          <span className="text-white/10">•</span>
          <span>Sem cartão de crédito</span>
          <span className="text-white/10">•</span>
          <span>Comece por um processo, não por tudo</span>
        </div>

        {/* Sub-strip de social proof, números absorvidos do StatsSection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-14 max-w-3xl w-full nasa-fade-up-d3">
          {[
            { value: "2.300+", label: "Empresas ativas" },
            { value: "847k+", label: "Contatos organizados" },
            { value: "89%", label: "Aumento médio em conversão" },
            { value: "200+", label: "Integrações disponíveis" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white mb-1">
                {s.value}
              </div>
              <div className="text-xs text-white/35">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hero, screenshot real do Tracking. Substituiu o
            `DashboardMock` antigo. Mantém efeito de flutuação
            (nasa-float) + frame escuro com glow violeta pra
            integrar ao tema. */}
        <div className="w-full max-w-5xl nasa-float">
          <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_120px_rgba(124,58,237,0.25)] nasa-glass">
            {/* Faixa superior, visual "tela de monitor" */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/60 to-transparent z-10" />
            {/* Vinheta de cantos pra "fundir" a imagem ao fundo */}
            <div
              className="absolute inset-0 pointer-events-none z-[1]"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)",
              }}
            />
            <Image
              src="/hero/tracking-hero.png"
              alt="Tracking N.A.S.A, quadro Kanban com leads organizados por etapa do processo"
              width={1996}
              height={1080}
              priority
              className="w-full h-auto block"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
