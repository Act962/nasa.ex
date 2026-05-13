"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronLeft,
  X,
  Star,
  Zap,
  Trophy,
  Puzzle,
  Rocket,
  Users,
  Building2,
  BarChart2,
  MessageSquare,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { SP_KEY } from "@/features/space-point/hooks/use-space-point";
import { useTour } from "@/features/tour/context";
import { NASA_TOUR_STEPS } from "@/features/tour/steps";

// ── Step definitions ───────────────────────────────────────────────────────────
interface Step {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  accent: string; // tailwind gradient classes
  accentHex: string; // hex for glow
  astroPos: AstroPos;
  content: React.ReactNode;
}

type AstroPos =
  | "center"
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "right"
  | "left";

// ── Astro Mascot ───────────────────────────────────────────────────────────────
const ASTRO_TRANSFORMS: Record<AstroPos, string> = {
  center: "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-2 right-4",
  "bottom-left": "bottom-2 left-4",
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  right: "top-1/2 right-2 -translate-y-1/2",
  left: "top-1/2 left-2 -translate-y-1/2",
};

const ASTRO_SIZES: Record<AstroPos, string> = {
  center: "w-24 h-24 sm:w-40 sm:h-40",
  "bottom-right": "w-16 h-16 sm:w-27.5 sm:h-27.5",
  "bottom-left": "w-16 h-16 sm:w-27.5 sm:h-27.5",
  "top-right": "w-14 h-14 sm:w-22.5 sm:h-22.5",
  "top-left": "w-14 h-14 sm:w-22.5 sm:h-22.5",
  right: "w-16 h-16 sm:w-25 sm:h-25",
  left: "w-16 h-16 sm:w-25 sm:h-25",
};

const ASTRO_ANIMS: Record<AstroPos, string> = {
  center: "astroFloat",
  "bottom-right": "astroBob",
  "bottom-left": "astroBob",
  "top-right": "astroSpin",
  "top-left": "astroSpin",
  right: "astroFloat",
  left: "astroFloat",
};

function AstroMascot({ pos, glow }: { pos: AstroPos; glow: string }) {
  const sizeClass = ASTRO_SIZES[pos];
  const anim = ASTRO_ANIMS[pos];
  const cls = ASTRO_TRANSFORMS[pos];

  return (
    <div
      className={cn(
        "absolute pointer-events-none z-10 select-none",
        cls,
        sizeClass,
      )}
      style={{
        animation: `${anim} 3.5s ease-in-out infinite`,
        filter: `drop-shadow(0 0 ${pos === "center" ? 20 : 12}px ${glow}99)`,
      }}
    >
      <Image
        src="/icon-astro.svg"
        alt="Astro"
        fill
        className="object-contain"
        unoptimized
      />
    </div>
  );
}

// ── App pills ──────────────────────────────────────────────────────────────────
function AppPill({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white",
        color,
      )}
    >
      {icon}
      {label}
    </div>
  );
}

// ── Feature card ───────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/60 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ── Stars badge ────────────────────────────────────────────────────────────────
function StarBadge({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        <span className="text-xl font-extrabold text-yellow-300">{count}</span>
      </div>
      <span className="text-[10px] text-yellow-400/70 text-center">
        {label}
      </span>
    </div>
  );
}

// ── Build steps ────────────────────────────────────────────────────────────────
function buildSteps(): Step[] {
  return [
    // ── Step 1: Welcome ─────────────────────────────────────────────────────
    {
      id: 1,
      title: "Bem-vindo ao NASA! 🚀",
      subtitle: "Sua plataforma de vendas inteligente",
      description:
        "Olá! Eu sou o ASTRO, seu guia espacial. Vou te mostrar tudo que você precisa para decolar no universo NASA. São só 10 passos rápidos e você já sabe navegar!",
      accent: "from-violet-900 via-violet-800 to-indigo-900",
      accentHex: "#7c3aed",
      astroPos: "bottom-right",
      content: (
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {[
            { icon: "📊", label: "CRM Visual" },
            { icon: "🤖", label: "IA Integrada" },
            { icon: "⭐", label: "Stars" },
            { icon: "🚀", label: "Space Points" },
            { icon: "🔌", label: "Integrações" },
            { icon: "📱", label: "WhatsApp" },
          ].map((t) => (
            <span
              key={t.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs text-white font-medium"
            >
              {t.icon} {t.label}
            </span>
          ))}
        </div>
      ),
    },

    // ── Step 2: Empresa ──────────────────────────────────────────────────────
    {
      id: 2,
      title: "Sua Empresa 🏢",
      subtitle: "O hub central da sua equipe",
      description:
        "Sua organização é o espaço onde sua equipe colabora, gerencia leads e usa todos os apps da plataforma. Configure o nome, logo e identidade visual.",
      accent: "from-blue-900 via-blue-800 to-cyan-900",
      accentHex: "#1d4ed8",
      astroPos: "bottom-right",
      content: (
        <div className="space-y-2.5 mt-1">
          <FeatureCard
            icon={<Building2 className="w-5 h-5 text-blue-400" />}
            title="Perfil da empresa"
            desc="Nome, logo e dados da organização. Aparece para toda a sua equipe."
          />
          <FeatureCard
            icon={<Users className="w-5 h-5 text-cyan-400" />}
            title="Membros e funções"
            desc="Administradores, gerentes e consultores com permissões diferentes."
          />
        </div>
      ),
    },

    // ── Step 3: Equipe ───────────────────────────────────────────────────────
    {
      id: 3,
      title: "Sua Equipe 👥",
      subtitle: "Juntos vocês chegam mais longe",
      description:
        "Convide seus colegas para colaborar. Cada membro pode ter funções e permissões diferentes — do gestor ao consultor de vendas.",
      accent: "from-emerald-900 via-green-800 to-teal-900",
      accentHex: "#059669",
      astroPos: "left",
      content: (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex -space-x-2">
              {["A", "B", "C", "D"].map((l) => (
                <div
                  key={l}
                  className="w-8 h-8 rounded-full bg-emerald-600/60 border-2 border-emerald-900 flex items-center justify-center text-xs font-bold text-white"
                >
                  {l}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-white">Convide via e-mail</p>
              <p className="text-xs text-white/60">Configurações → Membros</p>
            </div>
          </div>
          <div className="flex gap-2">
            {["Administrador", "Gerente", "Consultor", "Moderador"].map((r) => (
              <span
                key={r}
                className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      ),
    },

    // ── Step 4: Tracking / Leads ─────────────────────────────────────────────
    {
      id: 4,
      title: "Tracking — Seu CRM 📊",
      subtitle: "Gerencie leads em um Kanban visual",
      description:
        "O Tracking é o coração do NASA. Acompanhe leads e clientes em colunas visuais, atribua responsáveis e feche negócios com mais agilidade.",
      accent: "from-orange-900 via-amber-800 to-yellow-900",
      accentHex: "#d97706",
      astroPos: "top-right",
      content: (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              "Novo Lead",
              "Qualificando",
              "Proposta",
              "Negociação",
              "Fechado ✓",
            ].map((col, i) => (
              <div
                key={col}
                className={cn(
                  "shrink-0 w-24 rounded-xl p-2 text-center",
                  i === 4
                    ? "bg-emerald-500/20 border border-emerald-500/40"
                    : "bg-white/5 border border-white/10",
                )}
              >
                <p className="text-[10px] font-semibold text-white/80">{col}</p>
                {i < 4 && (
                  <div className="mt-1.5 h-6 rounded-md bg-white/5 border border-white/10" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-white/50 text-center">
            Arraste leads entre as colunas para atualizar o status
          </p>
        </div>
      ),
    },

    // ── Step 5: Explorer ─────────────────────────────────────────────────────
    {
      id: 5,
      title: "NASA Explorer 🌌",
      subtitle: "Seu painel de controle central",
      description:
        "O Explorer é onde você acessa todos os apps instalados, gerencia sua assinatura, vê métricas e descobre novas funcionalidades da plataforma.",
      accent: "from-purple-900 via-fuchsia-800 to-pink-900",
      accentHex: "#9333ea",
      astroPos: "top-left",
      content: (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { emoji: "📊", label: "Tracking" },
            { emoji: "💬", label: "Chat" },
            { emoji: "🗓️", label: "Agenda" },
            { emoji: "📈", label: "Insights" },
            { emoji: "🔨", label: "Forge" },
            { emoji: "🗺️", label: "Planner" },
          ].map((app) => (
            <div
              key={app.label}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-default"
            >
              <span className="text-xl">{app.emoji}</span>
              <span className="text-[10px] text-white/70 font-medium">
                {app.label}
              </span>
            </div>
          ))}
        </div>
      ),
    },

    // ── Step 6: ASTRO ────────────────────────────────────────────────────────
    {
      id: 6,
      title: "ASTRO — IA Integrada 🤖",
      subtitle: "Seu assistente inteligente 24/7",
      description:
        "Sou eu! O ASTRO é a inteligência artificial do NASA. Posso responder dúvidas, criar leads, configurar integrações e muito mais. É só me chamar!",
      accent: "from-violet-900 via-purple-800 to-fuchsia-900",
      accentHex: "#7c3aed",
      astroPos: "right",
      content: (
        <div className="mt-2 space-y-2">
          {[
            { q: '"Crie um lead para João Silva"', icon: "📊" },
            { q: '"Conecte meu WhatsApp Business"', icon: "📱" },
            { q: '"Quais são meus melhores leads?"', icon: "🔍" },
            { q: '"Como funciona o Space Points?"', icon: "🚀" },
          ].map((item) => (
            <div
              key={item.q}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
            >
              <span className="text-base">{item.icon}</span>
              <p className="text-xs text-white/70 italic">{item.q}</p>
            </div>
          ))}
        </div>
      ),
    },

    // ── Step 7: Stars ────────────────────────────────────────────────────────
    {
      id: 7,
      title: "Stars ⭐ — A Moeda do NASA",
      subtitle: "Créditos para usar os apps da plataforma",
      description:
        "Stars são a moeda virtual do NASA. Use-as para ativar aplicativos, fazer recargas de mensagens e acessar recursos premium da plataforma.",
      accent: "from-yellow-900 via-amber-800 to-orange-900",
      accentHex: "#f59e0b",
      astroPos: "bottom-left",
      content: (
        <div className="mt-2 space-y-2.5">
          <div className="flex gap-3 justify-center">
            <StarBadge count={100} label="Bônus boas-vindas" />
            <StarBadge count={50} label="Recarga mensal" />
            <StarBadge count={500} label="Pacote Premium" />
          </div>
          <FeatureCard
            icon={<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
            title="Como usar"
            desc="Ative apps, expanda limites de mensagens e acesse integrações premium."
          />
        </div>
      ),
    },

    // ── Step 8: Space Points & Ranking ───────────────────────────────────────
    {
      id: 8,
      title: "Space Points & Ranking 🏆",
      subtitle: "Gamificação que motiva sua equipe",
      description:
        "Ganhe pontos realizando ações no NASA! Adicione leads, faça login diário, complete tarefas e suba no ranking da sua empresa para ganhar prêmios.",
      accent: "from-cyan-900 via-sky-800 to-blue-900",
      accentHex: "#0891b2",
      astroPos: "top-right",
      content: (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { pos: "🥇", name: "Ana Silva", pts: "1.240" },
              { pos: "🥈", name: "Carlos M.", pts: "980" },
              { pos: "🥉", name: "Julia R.", pts: "710" },
            ].map((r) => (
              <div
                key={r.pos}
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
              >
                <span className="text-base">{r.pos}</span>
                <div>
                  <p className="text-xs font-bold text-white">{r.name}</p>
                  <p className="text-[10px] text-white/50">{r.pts} pts</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { action: "Login diário", pts: "+5 pts" },
              { action: "Criar lead", pts: "+5 pts" },
              { action: "Lead ganho", pts: "+10 pts" },
              { action: "Integração", pts: "+25 pts" },
            ].map((a) => (
              <span
                key={a.action}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
              >
                <Zap className="w-2.5 h-2.5" /> {a.action}{" "}
                <span className="text-white font-bold">{a.pts}</span>
              </span>
            ))}
          </div>
        </div>
      ),
    },

    // ── Step 9: Apps e Integrações ───────────────────────────────────────────
    {
      id: 9,
      title: "Apps e Integrações 🔌",
      subtitle: "Um ecossistema completo para seu negócio",
      description:
        "O NASA é modular: ative apenas o que precisa. Conecte WhatsApp, Instagram, e-mail e dezenas de outras plataformas diretamente no Marketplace.",
      accent: "from-pink-900 via-rose-800 to-red-900",
      accentHex: "#e11d48",
      astroPos: "bottom-left",
      content: (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                label: "WhatsApp",
                emoji: "💬",
                color: "bg-green-500/20 border-green-500/40 text-green-300",
              },
              {
                label: "Instagram",
                emoji: "📸",
                color: "bg-pink-500/20 border-pink-500/40 text-pink-300",
              },
              {
                label: "RD Station",
                emoji: "📣",
                color: "bg-orange-500/20 border-orange-500/40 text-orange-300",
              },
              {
                label: "Telegram",
                emoji: "✈️",
                color: "bg-blue-500/20 border-blue-500/40 text-blue-300",
              },
              {
                label: "Gmail",
                emoji: "📧",
                color: "bg-red-500/20 border-red-500/40 text-red-300",
              },
              {
                label: "Hotmart",
                emoji: "🔥",
                color: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
              },
              {
                label: "Stripe",
                emoji: "💳",
                color: "bg-violet-500/20 border-violet-500/40 text-violet-300",
              },
              {
                label: "+ 40",
                emoji: "🔌",
                color: "bg-white/5 border-white/20 text-white/50",
              },
            ].map((i) => (
              <span
                key={i.label}
                className={cn(
                  "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium",
                  i.color,
                )}
              >
                {i.emoji} {i.label}
              </span>
            ))}
          </div>
          <FeatureCard
            icon={<Puzzle className="w-4 h-4 text-pink-400" />}
            title="Marketplace de Integrações"
            desc="Acesse em Integrações no menu lateral e conecte suas plataformas favoritas."
          />
        </div>
      ),
    },

    // ── Step 10: Complete ────────────────────────────────────────────────────
    {
      id: 10,
      title: "Missão Completa! 🎉",
      subtitle: "Você está pronto para decolar!",
      description:
        "Parabéns! Você completou a Missão de Boas-Vindas ao NASA. Como recompensa, você ganhou 10 Space Points para começar sua jornada! Agora é hora de explorar.",
      accent: "from-violet-900 via-indigo-800 to-purple-900",
      accentHex: "#6d28d9",
      astroPos: "bottom-left",
      content: (
        <div className="mt-2 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-violet-500/20 border border-violet-500/40">
            <Rocket className="w-6 h-6 text-violet-300" />
            <div>
              <p className="text-sm font-extrabold text-white">
                +10 Space Points
              </p>
              <p className="text-xs text-violet-300">Missão de Boas-Vindas</p>
            </div>
            <Trophy className="w-5 h-5 text-yellow-400 ml-2" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Crie seu primeiro lead",
              "Conecte o WhatsApp",
              "Convide sua equipe",
              "Explore o Ranking",
            ].map((tip) => (
              <span
                key={tip}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/15 text-white/60"
              >
                <Check className="w-2.5 h-2.5 text-emerald-400" /> {tip}
              </span>
            ))}
          </div>
        </div>
      ),
    },
  ];
}

// ── Main Wizard ────────────────────────────────────────────────────────────────
export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const qc = useQueryClient();
  const { startTour } = useTour();

  const steps = buildSteps();
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;

  const completeMut = useMutation({
    mutationFn: () => orpc.user.completeOnboarding.call({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SP_KEY });
      toast.success("🚀 +10 Space Points! Missão de Boas-Vindas completa!", {
        duration: 5000,
      });
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const goNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setExiting(true);
      setTimeout(() => {
        setStep((s) => s + 1);
        setExiting(false);
      }, 220);
    }
  };

  const goPrev = () => {
    setExiting(true);
    setTimeout(() => {
      setStep((s) => Math.max(0, s - 1));
      setExiting(false);
    }, 220);
  };

  const handleFinish = async () => {
    setCompleting(true);
    await completeMut.mutateAsync();
    onComplete();
    // Kick off the interactive guided tour right after onboarding
    setTimeout(() => startTour(NASA_TOUR_STEPS), 600);
  };

  const handleSkip = () => {
    completeMut.mutate();
    onComplete();
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes astroFloat {
          0%, 100% { transform: translateX(-50%) translateY(0px) rotate(-2deg); }
          50%       { transform: translateX(-50%) translateY(-14px) rotate(2deg); }
        }
        @keyframes astroBob {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50%       { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes astroSpin {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50%       { transform: rotate(8deg) scale(1.08); }
        }
        @keyframes onboardPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(1.06); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-12px); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; }
        }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-200 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        {/* Card */}
        <div
          className={cn(
            "relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl",
            "bg-linear-to-br",
            current.accent,
            exiting
              ? "[fadeSlideOut_0.22s_ease_forwards]"
              : "[fadeSlideIn_0.25s_ease_forwards]",
          )}
          style={{
            minHeight: "min(520px, calc(100dvh - 24px))",
            border: `1px solid ${current.accentHex}44`,
          }}
        >
          {/* Stars bg */}
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white pointer-events-none"
              style={{
                width: i % 6 === 0 ? 2 : 1,
                height: i % 6 === 0 ? 2 : 1,
                left: `${(((i * 1234567 + 89) % 9973) / 9973) * 100}%`,
                top: `${(((i * 7654321 + 31) % 9973) / 9973) * 100}%`,
                opacity: 0.1 + (i % 7) * 0.06,
                animation: `starTwinkle ${2 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${(i % 10) * 0.3}s`,
              }}
            />
          ))}

          {/* Glow blob */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 40%, ${current.accentHex}30 0%, transparent 65%)`,
            }}
          />

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            title="Pular introdução"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step counter */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i < step || true) {
                    setStep(i);
                    setExiting(false);
                  }
                }}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 h-2 bg-white"
                    : i < step
                      ? "w-2 h-2 bg-white/60"
                      : "w-2 h-2 bg-white/20",
                )}
              />
            ))}
          </div>

          {/* Astro mascot */}
          <AstroMascot pos={current.astroPos} glow={current.accentHex} />

          {/* Content */}
          <div
            className="relative z-10 flex flex-col h-full px-5 pt-14 pb-5 sm:px-7 sm:pt-16 sm:pb-7"
            style={{ minHeight: "min(520px, calc(100dvh - 24px))" }}
          >
            {/* Step label */}
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: current.accentHex + "cc" }}
            >
              Passo {current.id} de {steps.length}
            </p>

            {/* Title */}
            <h2 className="text-2xl font-extrabold text-white leading-tight mb-1">
              {current.title}
            </h2>
            <p
              className="text-sm font-semibold mb-3"
              style={{ color: current.accentHex + "dd" }}
            >
              {current.subtitle}
            </p>

            {/* Description */}
            <p className="text-sm text-white/75 leading-relaxed mb-4">
              {current.description}
            </p>

            {/* Dynamic content */}
            <div className="flex-1">{current.content}</div>

            {/* Progress bar */}
            <div className="mt-5 mb-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${current.accentHex}88, ${current.accentHex})`,
                }}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-semibold transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
              )}
              <button
                onClick={goNext}
                disabled={completing}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                  isLast
                    ? "text-white shadow-lg disabled:opacity-70"
                    : "bg-white/15 hover:bg-white/25 text-white",
                )}
                style={
                  isLast
                    ? {
                        background: `linear-gradient(135deg, ${current.accentHex}, ${current.accentHex}cc)`,
                        boxShadow: `0 4px 20px ${current.accentHex}55`,
                      }
                    : {}
                }
              >
                {completing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Completando...
                  </>
                ) : isLast ? (
                  <>
                    <Rocket className="w-4 h-4" /> Iniciar minha jornada!
                  </>
                ) : (
                  <>
                    Próximo <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
