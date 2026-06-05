"use client";

import { useEffect, useState } from "react";
import { Rocket, Sparkles } from "lucide-react";

/**
 * Loader divertido com foguete subindo + frases rotativas pra
 * distrair o user enquanto o template é aplicado (createPage +
 * updatePage levam ~3-5s).
 *
 * Mostra:
 *   - Foguete subindo com chama animada (CSS keyframes)
 *   - Frase rotativa (troca a cada 2.5s)
 *   - Progress bar visual sem barra real (efeito psicológico)
 */

const FUNNY_LINES = [
  "🚀 Calma que o foguete tá aquecendo os motores!",
  "☕ Aproveite pra beber uma água enquanto sua página fica pronta",
  "🛰 Posicionando os satélites ao redor da sua landing…",
  "👨‍🚀 Astronautas finalizando os últimos ajustes",
  "🌌 Carregando o combustível espacial premium",
  "✨ Polindo cada pixel pra brilhar como uma estrela",
  "🌍 Conectando ao centro de controle em Houston…",
  "🎯 Alinhando trajetória pra órbita perfeita",
  "🔧 Apertando os parafusos finais do compartimento",
  "📡 Sintonizando antenas pra captar o melhor sinal",
  "🪐 Sua landing está saindo de Saturno com tudo!",
  "⚡ Recarregando as STARs estelares…",
  "🎨 Pintando o foguete com a cor da sua marca",
  "🧑‍🚀 Briefing final com a tripulação concluído",
  "🌠 Conte uma piada espacial enquanto isso? Por que o sol foi à escola? Pra ficar mais brilhante!",
];

export function RocketLoader({
  title = "Preparando sua landing page",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const [lineIdx, setLineIdx] = useState(0);
  // Roda fora dependência de Math.random pra ser estável
  useEffect(() => {
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % FUNNY_LINES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 px-4 text-center">
      {/* Cena espacial — fundo escuro + estrelas + foguete subindo */}
      <div className="relative w-full max-w-xs h-64 rounded-2xl overflow-hidden bg-gradient-to-b from-slate-950 via-violet-950/40 to-zinc-950 border border-violet-500/30">
        {/* Estrelas */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 10% 12%, white 1px, transparent 1px), radial-gradient(1.5px 1.5px at 25% 28%, white 1px, transparent 1px), radial-gradient(1px 1px at 50% 45%, white 1px, transparent 1px), radial-gradient(1px 1px at 70% 18%, white 1px, transparent 1px), radial-gradient(1.5px 1.5px at 85% 60%, white 1px, transparent 1px), radial-gradient(1px 1px at 35% 75%, white 1px, transparent 1px), radial-gradient(1px 1px at 60% 88%, white 1px, transparent 1px)",
            backgroundSize: "100% 220px",
            animation: "rocketStars 3s linear infinite",
          }}
        />

        {/* Foguete subindo */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-4"
          style={{ animation: "rocketFloat 2.2s ease-in-out infinite" }}
        >
          <div className="relative">
            <Rocket
              className="size-16 text-violet-300 -rotate-45"
              strokeWidth={1.5}
            />
            {/* Chama */}
            <div
              className="absolute -bottom-3 -right-3 w-3 h-6 bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 rounded-full"
              style={{
                animation: "rocketFlame 0.18s ease-in-out infinite",
                transformOrigin: "top",
                filter: "blur(1px)",
              }}
            />
          </div>
        </div>

        {/* Sparkles decorativas */}
        <Sparkles
          className="absolute top-6 left-6 size-3 text-yellow-300 animate-pulse"
          style={{ animationDelay: "0.2s" }}
        />
        <Sparkles
          className="absolute top-12 right-8 size-2.5 text-violet-300 animate-pulse"
          style={{ animationDelay: "0.6s" }}
        />
      </div>

      {/* Título principal */}
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-white/50">{subtitle}</p>
        )}
      </div>

      {/* Frase rotativa */}
      <div
        key={lineIdx}
        className="min-h-[3rem] flex items-center justify-center px-4 text-sm text-violet-300 max-w-md"
        style={{ animation: "rocketFade 0.5s ease-out" }}
      >
        {FUNNY_LINES[lineIdx]}
      </div>

      {/* Pseudo progress bar */}
      <div className="w-full max-w-xs h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500"
          style={{
            animation: "rocketProgress 2s linear infinite",
            width: "200%",
            backgroundSize: "50% 100%",
          }}
        />
      </div>

      {/* Keyframes inline */}
      <style>{`
        @keyframes rocketStars {
          from { background-position: 0 0; }
          to { background-position: 0 220px; }
        }
        @keyframes rocketFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes rocketFlame {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; }
          50% { transform: scaleY(1.3) scaleX(0.8); opacity: 1; }
        }
        @keyframes rocketFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rocketProgress {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
