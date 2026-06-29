import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Crown,
  Rocket,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Seção que demonstra o sistema Space Points (gamificação) reproduzindo
 * visualmente a UI real do app, com pódio (top 3 astronautas),
 * classificação completa e tabs de período (semanal/quinzenal/mensal/
 * anual). Não é screenshot, é um mock React.
 *
 * Mostrar a UI real (em vez de um banner "Space Points coming soon")
 * deixa claro que a feature existe e como funciona.
 */

const RANKING = [
  {
    pos: 1,
    name: "Weydson Lima",
    galaxy: "Galaxy 2",
    pts: 232,
    avatar: "https://i.pravatar.cc/120?img=12",
    isYou: true,
  },
  {
    pos: 2,
    name: "Arthur Fabrícyo",
    galaxy: "Galaxy 1",
    pts: 214,
    avatar: "https://i.pravatar.cc/120?img=33",
    isYou: false,
  },
  {
    pos: 3,
    name: "João Gabriel",
    galaxy: "Galaxy 1",
    pts: 213,
    avatar: "https://i.pravatar.cc/120?img=15",
    isYou: false,
  },
  {
    pos: 4,
    name: "Christyan Melo",
    galaxy: "Saturno",
    pts: 150,
    avatar: "https://i.pravatar.cc/120?img=58",
    isYou: false,
  },
];

const PODIUM = [
  {
    pos: 2,
    name: "Arthur Fabrícyo",
    pts: 214,
    avatar: RANKING[1].avatar,
    medal: "🥈",
    gold: false,
  },
  {
    pos: 1,
    name: "Weydson Lima",
    pts: 232,
    avatar: RANKING[0].avatar,
    medal: "👑",
    gold: true,
  },
  {
    pos: 3,
    name: "João Gabriel",
    pts: 213,
    avatar: RANKING[2].avatar,
    medal: "🥉",
    gold: false,
  },
];

export function GamifiedRankingSection({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  return (
    <section className="relative py-28 px-4 overflow-hidden border-t border-white/5">
      {/* Glow violeta de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header da section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 rounded-full px-5 py-2 mb-5">
            <Trophy className="size-3.5 text-violet-300" />
            <span className="text-violet-200 text-sm font-semibold tracking-wide">
              Gamificação N.A.S.A · Space Points
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 leading-[1.05]">
            Quem produz aparece.{" "}
            <span className="text-nasa">A equipe inteira vê.</span>
          </h2>
          <p className="text-white/55 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Cada ação na operação vira ponto. Toda semana sua equipe vê quem
            está produzindo, em que galáxia está, e onde está o esforço.
          </p>
        </div>

        {/* Card Mock, reproduz visualmente a UI do Space Point dentro do app */}
        <div className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-zinc-950/60 to-zinc-950/80 backdrop-blur-sm overflow-hidden shadow-[0_0_120px_rgba(124,58,237,0.2)] nasa-float">
          {/* Linha violeta superior */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          {/* Cabeçalho do mock, Space Point + pontos + Galaxy */}
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-white/5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-violet-500/25 border border-violet-400/40 flex items-center justify-center shrink-0">
                <Rocket
                  className="size-5 text-violet-200"
                  strokeWidth={1.6}
                />
              </div>
              <div>
                <h3 className="text-white font-bold text-base sm:text-lg">
                  Space Point
                </h3>
                <p className="text-white/45 text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="font-semibold text-white/70">
                    3.926 pts
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1">
                    📈 Galaxy 2
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs principais */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-4 border-b border-white/5">
            {[
              { icon: "🏅", label: "Meus Selos", active: false },
              { icon: "🗺️", label: "Minha Rota", active: false },
              { icon: "🏆", label: "Ranking", active: true },
              { icon: "⚙️", label: "Configurações", active: false },
            ].map((t) => (
              <div
                key={t.label}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium",
                  t.active
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/40"
                    : "text-white/50",
                )}
              >
                <span>{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>

          {/* Sub-tabs de período */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 sm:px-6 pt-5">
            {[
              { label: "Semanal", active: true },
              { label: "Quinzenal", active: false },
              { label: "Mensal", active: false },
              { label: "Anual", active: false },
              { label: "Histórico", active: false },
              { label: "📅 Data", active: false },
            ].map((t) => (
              <div
                key={t.label}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium",
                  t.active ? "bg-violet-600 text-white" : "text-white/45",
                )}
              >
                {t.label}
              </div>
            ))}
          </div>

          {/* Conteúdo principal, pódio à esquerda, ranking à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 sm:p-6">
            {/* PÓDIO, 3 astronautas */}
            <div className="relative rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-zinc-950/40 p-6 overflow-hidden">
              {/* Fundo de estrelas */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-60 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(1px 1px at 25% 30%, white 1px, transparent 1px), radial-gradient(1px 1px at 70% 45%, white 1px, transparent 1px), radial-gradient(1px 1px at 40% 70%, white 1px, transparent 1px), radial-gradient(1px 1px at 85% 80%, white 1px, transparent 1px), radial-gradient(1px 1px at 15% 85%, white 1px, transparent 1px)",
                }}
              />

              <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-3">
                {PODIUM.map((p) => (
                  <div
                    key={p.pos}
                    className="flex flex-col items-center flex-1 min-w-0"
                  >
                    {/* Coroa/medalha em cima */}
                    <div className="text-2xl sm:text-3xl mb-1">{p.medal}</div>

                    {/* Capacete de astronauta, vidro circular com foto */}
                    <div className="relative">
                      <div
                        className={cn(
                          "rounded-full border-4 overflow-hidden bg-zinc-900 shadow-2xl",
                          p.gold
                            ? "border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.5)] w-24 h-24 sm:w-28 sm:h-28"
                            : "border-white/30 w-20 h-20 sm:w-24 sm:h-24",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Indicador de posição */}
                      <div
                        className={cn(
                          "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2",
                          p.gold
                            ? "bg-yellow-400 text-black border-yellow-200"
                            : "bg-white/10 text-white border-white/40",
                        )}
                      >
                        {p.pos}
                      </div>
                    </div>

                    {/* Nome */}
                    <p
                      className={cn(
                        "mt-3 text-xs sm:text-sm font-bold text-center truncate w-full",
                        p.gold ? "text-yellow-300" : "text-white/80",
                      )}
                    >
                      {p.name.split(" ")[0]}
                    </p>

                    {/* Badge de pontos */}
                    <div
                      className={cn(
                        "mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        p.gold
                          ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/40"
                          : "bg-white/5 text-white/60 border-white/15",
                      )}
                    >
                      ✦ {p.pts} pts
                    </div>

                    {/* Selo */}
                    <div className="mt-2 w-6 h-6 rounded-full bg-violet-500/30 border border-violet-400/40 flex items-center justify-center">
                      <span className="text-[10px]">🏆</span>
                    </div>

                    {/* CTA Ver stats */}
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/55"
                    >
                      <BarChart2 className="size-3" />
                      Ver stats
                    </button>
                  </div>
                ))}
              </div>

              <p className="relative z-10 text-center text-white/30 text-xs mt-6">
                Últimos 7 dias
              </p>
            </div>

            {/* CLASSIFICAÇÃO, lista completa */}
            <div className="rounded-2xl">
              <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-semibold mb-3">
                Classificação
              </p>
              <div className="space-y-2">
                {RANKING.map((u) => (
                  <div
                    key={u.pos}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                      u.isYou
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02]",
                    )}
                  >
                    {/* Número da posição */}
                    <div className="w-6 text-center text-white/40 font-bold text-sm shrink-0">
                      {u.pos}
                    </div>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full border border-white/15 overflow-hidden bg-zinc-900 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Nome + galáxia */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white font-semibold text-sm truncate">
                          {u.name}
                        </p>
                        {u.isYou && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/30 text-violet-200 border border-violet-400/40">
                            você
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-[11px] flex items-center gap-1">
                        <span className="text-violet-300">●</span>
                        {u.galaxy}
                      </p>
                    </div>
                    {/* Pontos */}
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "font-bold text-sm",
                          u.isYou ? "text-violet-200" : "text-white/80",
                        )}
                      >
                        {u.pts} pts
                      </p>
                    </div>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-md border border-white/8 flex items-center justify-center text-white/35"
                      aria-label="Ver stats"
                    >
                      <BarChart2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bullets de benefício abaixo do mock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {[
            {
              icon: Crown,
              title: "Quem produz aparece",
              desc: "O time inteiro vê quem está liderando a galáxia da semana.",
            },
            {
              icon: Trophy,
              title: "Pontuação por ação real",
              desc: "Pontos vêm de atendimento, vendas, tarefas concluídas, propostas assinadas. Não é vaidade.",
            },
            {
              icon: Settings,
              title: "Você ajusta as regras",
              desc: "Defina quanto vale cada ação no painel. A gamificação adapta ao seu processo.",
            },
          ].map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <b.icon
                className="size-5 text-violet-300 mb-2"
                strokeWidth={1.6}
              />
              <p className="text-white font-bold text-sm mb-1">{b.title}</p>
              <p className="text-white/45 text-xs leading-relaxed">
                {b.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-9 py-6 text-base rounded-xl card-hover nasa-glow-sm"
          >
            <Link href={isLoggedIn ? "/space-point" : "/sign-up"}>
              Ver minha galáxia
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
