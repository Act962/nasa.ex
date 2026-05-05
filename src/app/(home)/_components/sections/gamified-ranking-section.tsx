import Link from "next/link";
import { Crown, Medal, Star, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FAKE_USERS = [
  {
    initials: "MF",
    name: "Mariana F.",
    company: "Studio MF Design",
    stars: 18_420,
    pts: 9_810,
    level: "Orbital",
    plan: "Explore",
    color: "#a855f7",
  },
  {
    initials: "RL",
    name: "Rafael Lima",
    company: "Lima Consultoria",
    stars: 15_880,
    pts: 8_340,
    level: "Satélite",
    plan: "Constellation",
    color: "#f59e0b",
  },
  {
    initials: "AC",
    name: "Ana Carvalho",
    company: "AC Imóveis",
    stars: 12_300,
    pts: 7_120,
    level: "Astronauta",
    plan: "Explore",
    color: "#3b82f6",
  },
  {
    initials: "JM",
    name: "João Mendes",
    company: "Mendes & Cia",
    stars: 10_750,
    pts: 6_900,
    level: "Astronauta",
    plan: "Explore",
    color: "#10b981",
  },
  {
    initials: "PS",
    name: "Patrícia S.",
    company: "PS Educação",
    stars: 9_200,
    pts: 5_600,
    level: "Explorador",
    plan: "Earth",
    color: "#f97316",
  },
  {
    initials: "GT",
    name: "Guilherme T.",
    company: "GTech Soluções",
    stars: 7_800,
    pts: 4_920,
    level: "Explorador",
    plan: "Earth",
    color: "#ec4899",
  },
  {
    initials: "VN",
    name: "Vitória Nunes",
    company: "VN Marketing",
    stars: 6_100,
    pts: 3_870,
    level: "Lunar",
    plan: "Earth",
    color: "#06b6d4",
  },
  {
    initials: "BS",
    name: "Bruno Silva",
    company: "Silva Advocacia",
    stars: 4_950,
    pts: 3_200,
    level: "Lunar",
    plan: "Suit",
    color: "#84cc16",
  },
];

const LEVEL_COLORS: Record<string, string> = {
  Orbital: "text-violet-400 bg-violet-400/15 border-violet-400/30",
  Satélite: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30",
  Astronauta: "text-blue-400   bg-blue-400/15   border-blue-400/30",
  Explorador: "text-orange-400 bg-orange-400/15 border-orange-400/30",
  Lunar: "text-cyan-400   bg-cyan-400/15   border-cyan-400/30",
  Terra: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30",
};

const SPACE_LEVELS = [
  { level: 1, name: "Terra", pts: 0, color: "#10b981", emoji: "🌍" },
  { level: 3, name: "Lunar", pts: 1_000, color: "#06b6d4", emoji: "🌙" },
  { level: 5, name: "Explorador", pts: 3_000, color: "#f97316", emoji: "🚀" },
  { level: 8, name: "Astronauta", pts: 6_000, color: "#3b82f6", emoji: "👨‍🚀" },
  { level: 12, name: "Orbital", pts: 10_000, color: "#a855f7", emoji: "🛸" },
  { level: 16, name: "Satélite", pts: 18_000, color: "#f59e0b", emoji: "🛰️" },
  { level: 20, name: "Galáxia", pts: 30_000, color: "#ff6b6b", emoji: "✨" },
];

const MISSIONS = [
  {
    icon: "🎯",
    title: "Primeiro Lead",
    desc: "Cadastre seu primeiro lead",
    pts: 50,
  },
  {
    icon: "📊",
    title: "Analista Espacial",
    desc: "Visualize 10 relatórios",
    pts: 200,
  },
  {
    icon: "🤝",
    title: "Negociador Estelar",
    desc: "Feche 5 negócios no FORGE",
    pts: 500,
  },
  { icon: "🤖", title: "Piloto de IA", desc: "Use o ASTRO 20 vezes", pts: 300 },
  {
    icon: "⚡",
    title: "Mestre das Flows",
    desc: "Crie 3 automações ativas",
    pts: 400,
  },
  {
    icon: "👥",
    title: "Comandante",
    desc: "Adicione 5 membros à organização",
    pts: 250,
  },
];

export function GamifiedRankingSection({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  return (
    <section className="py-28 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-violet-600/4 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-400/3 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2">
            <Trophy className="size-3.5 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold tracking-wide">
              Gamificação NASA — Space Points
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          NASA tem <span className="text-nasa">alma de jogo</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-16 max-w-xl mx-auto">
          Cada ação dentro da plataforma gera pontos. Evolua de nível,
          desbloqueie conquistas e dispute o ranking com outros usuários do
          NASA.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Leaderboard */}
          <div className="nasa-glass rounded-2xl border border-white/8 overflow-hidden">
            {/* Leaderboard header */}
            <div className="bg-[#7C3AED]/15 border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-yellow-400" />
                <span className="text-white font-bold text-sm">
                  Ranking Global — Julho 2026
                </span>
              </div>
              <div className="text-white/30 text-xs">Top 8</div>
            </div>

            {/* Top 3 podium */}
            <div className="flex items-end justify-center gap-3 px-5 pt-6 pb-4 border-b border-white/5">
              {/* 2nd */}
              <div className="text-center flex-1">
                <div
                  className="w-12 h-12 rounded-full border-2 border-blue-400/50 flex items-center justify-center mx-auto mb-2 text-sm font-black"
                  style={{
                    background: `linear-gradient(135deg, ${FAKE_USERS[1].color}30, ${FAKE_USERS[1].color}10)`,
                    color: FAKE_USERS[1].color,
                  }}
                >
                  {FAKE_USERS[1].initials}
                </div>
                <p className="text-white/70 text-[11px] font-semibold">
                  {FAKE_USERS[1].name}
                </p>
                <p className="text-blue-400 font-black text-sm">#{2}</p>
                <div className="w-full bg-blue-500/20 rounded-t-lg h-14 mt-2 flex items-center justify-center">
                  <span className="text-blue-400 text-[10px] font-bold">
                    {FAKE_USERS[1].pts.toLocaleString("pt-BR")} pts
                  </span>
                </div>
              </div>
              {/* 1st */}
              <div className="text-center flex-1">
                <div className="relative">
                  <div className="text-xl text-center mb-1">👑</div>
                  <div
                    className="w-14 h-14 rounded-full border-2 border-yellow-400/70 flex items-center justify-center mx-auto mb-2 text-sm font-black nasa-level-up"
                    style={{
                      background: `linear-gradient(135deg, ${FAKE_USERS[0].color}40, ${FAKE_USERS[0].color}15)`,
                      color: FAKE_USERS[0].color,
                    }}
                  >
                    {FAKE_USERS[0].initials}
                  </div>
                </div>
                <p className="text-white/90 text-[11px] font-bold">
                  {FAKE_USERS[0].name}
                </p>
                <p className="text-yellow-400 font-black text-sm">🥇 #1</p>
                <div className="w-full bg-yellow-500/20 rounded-t-lg h-20 mt-2 flex items-center justify-center">
                  <span className="text-yellow-400 text-[10px] font-bold">
                    {FAKE_USERS[0].pts.toLocaleString("pt-BR")} pts
                  </span>
                </div>
              </div>
              {/* 3rd */}
              <div className="text-center flex-1">
                <div
                  className="w-12 h-12 rounded-full border-2 border-orange-400/50 flex items-center justify-center mx-auto mb-2 text-sm font-black"
                  style={{
                    background: `linear-gradient(135deg, ${FAKE_USERS[2].color}30, ${FAKE_USERS[2].color}10)`,
                    color: FAKE_USERS[2].color,
                  }}
                >
                  {FAKE_USERS[2].initials}
                </div>
                <p className="text-white/70 text-[11px] font-semibold">
                  {FAKE_USERS[2].name}
                </p>
                <p className="text-orange-400 font-black text-sm">#{3}</p>
                <div className="w-full bg-orange-500/20 rounded-t-lg h-10 mt-2 flex items-center justify-center">
                  <span className="text-orange-400 text-[10px] font-bold">
                    {FAKE_USERS[2].pts.toLocaleString("pt-BR")} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Remaining users */}
            <div className="divide-y divide-white/4">
              {FAKE_USERS.slice(3).map((user, i) => (
                <div
                  key={user.name}
                  className="rank-row nasa-rank-in flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors"
                >
                  <span className="text-white/25 font-black text-sm w-5 text-center">
                    {i + 4}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${user.color}30, ${user.color}10)`,
                      color: user.color,
                      border: `1.5px solid ${user.color}40`,
                    }}
                  >
                    {user.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-semibold text-xs truncate">
                      {user.name}
                    </p>
                    <p className="text-white/25 text-[10px] truncate">
                      {user.company}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white/60 font-bold text-xs">
                      {user.pts.toLocaleString("pt-BR")} pts
                    </p>
                    <div
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 inline-block",
                        LEVEL_COLORS[user.level] ||
                          "text-white/30 bg-white/5 border-white/10",
                      )}
                    >
                      {user.level}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-12">
                    <p className="text-yellow-400/70 text-[10px] font-semibold">
                      {(user.stars / 1000).toFixed(1)}K ★
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stars total banner */}
            <div className="bg-gradient-to-r from-yellow-400/8 to-violet-400/8 border-t border-white/5 px-5 py-3 flex items-center justify-between">
              <span className="text-white/30 text-xs">
                Total de Stars na plataforma
              </span>
              <span className="text-yellow-400 font-black text-sm">
                {FAKE_USERS.reduce((s, u) => s + u.stars, 0).toLocaleString(
                  "pt-BR",
                )}{" "}
                ★
              </span>
            </div>
          </div>

          {/* Right: Levels + Missions */}
          <div className="flex flex-col gap-5">
            {/* Level progression */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Crown className="size-3.5 text-yellow-400" /> Níveis de
                Progressão
              </p>
              <div className="space-y-2.5">
                {SPACE_LEVELS.map((lvl, i) => {
                  const _nextPts = SPACE_LEVELS[i + 1]?.pts ?? 50_000;
                  void _nextPts;
                  const barPct = Math.min(100, (lvl.pts / 30_000) * 100);
                  return (
                    <div key={lvl.name} className="flex items-center gap-3">
                      <div className="text-xl shrink-0 w-7 text-center">
                        {lvl.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/70 text-xs font-semibold">
                            {lvl.name}
                          </span>
                          <span className="text-white/25 text-[10px]">
                            Nível {lvl.level}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              background: lvl.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-white/25 text-[10px] shrink-0 w-14 text-right">
                        {lvl.pts >= 1000 ? `${lvl.pts / 1000}K` : lvl.pts} pts
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/20 text-[10px] text-center mt-4">
                20 níveis no total · De Terra 🌍 a Galáxia 10 ✨
              </p>
            </div>

            {/* Missions */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target className="size-3.5 text-violet-400" /> Missões
                Disponíveis
              </p>
              <div className="grid grid-cols-1 gap-2">
                {MISSIONS.map((m) => (
                  <div
                    key={m.title}
                    className="flex items-center gap-3 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5 hover:border-violet-500/20 transition-colors group"
                  >
                    <span className="text-lg shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-xs font-semibold group-hover:text-white/90 transition-colors">
                        {m.title}
                      </p>
                      <p className="text-white/30 text-[10px] truncate">
                        {m.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="size-2.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-yellow-400 text-[10px] font-bold">
                        +{m.pts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements preview */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <Medal className="size-3.5 text-blue-400" /> Conquistas
                Desbloqueadas
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: "🚀", label: "Decolar", rarity: "comum" },
                  { emoji: "💬", label: "Comunicador", rarity: "raro" },
                  { emoji: "🎯", label: "Sniper de Leads", rarity: "épico" },
                  { emoji: "🤖", label: "Piloto de IA", rarity: "raro" },
                  { emoji: "👑", label: "Top 1", rarity: "lendário" },
                  { emoji: "⚡", label: "Automatizador", rarity: "épico" },
                  { emoji: "📊", label: "Analista", rarity: "comum" },
                  { emoji: "🌟", label: "Estrela", rarity: "lendário" },
                ].map(({ emoji, label, rarity }) => {
                  const cls =
                    rarity === "lendário"
                      ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                      : rarity === "épico"
                        ? "border-violet-400/40 bg-violet-400/10 text-violet-300"
                        : rarity === "raro"
                          ? "border-blue-400/40 bg-blue-400/10 text-blue-300"
                          : "border-white/10 bg-white/5 text-white/50";
                  return (
                    <div
                      key={label}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold",
                        cls,
                      )}
                    >
                      <span>{emoji}</span> {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-white/30 text-sm mb-4">
            Comece a acumular pontos hoje mesmo
          </p>
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Entrar para o jogo
              <Trophy className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
