import React from "react";

/**
 * RocketLoader — foguete SVG com chama animada pulsando "forte/fraca".
 *
 * Usado pelo ThinkingDisplay quando o orchestrator do Astro está
 * delegando pra um sub-agente (route_to_*). Substitui o spinner
 * genérico por algo temático com a marca NASA.
 *
 * Animações puras CSS (keyframes inline pra não precisar mexer no
 * tailwind config):
 *  - rocket-hover: o foguete sobe/desce sutilmente como se flutuasse
 *  - flame-outer: chama externa amarela amplia/contrai (1.0 → 1.4)
 *  - flame-inner: chama interna laranja, defasada pra flicker visível
 *  - flame-strong: pulso mais agressivo overlay pra dar "chama forte"
 */
export function RocketLoader({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-end relative"
      style={{ width: size, height: size * 1.4 }}
      aria-hidden
    >
      <style>{ROCKET_KEYFRAMES}</style>

      {/* Foguete (corpo) */}
      <svg
        width={size}
        height={size * 1.4}
        viewBox="0 0 28 40"
        style={{ animation: "rocket-hover 1.4s ease-in-out infinite" }}
        className="relative z-10"
      >
        {/* Cabine */}
        <ellipse cx="14" cy="6" rx="4" ry="4" fill="#a78bfa" />
        {/* Corpo */}
        <path
          d="M 10 6 L 18 6 L 20 22 L 8 22 Z"
          fill="url(#rocketBody)"
        />
        {/* Janela */}
        <circle cx="14" cy="13" r="2.2" fill="#60a5fa" />
        <circle cx="14" cy="13" r="1.2" fill="#1e3a8a" />
        {/* Aletas */}
        <path d="M 8 22 L 4 27 L 8 27 Z" fill="#7c3aed" />
        <path d="M 20 22 L 24 27 L 20 27 Z" fill="#7c3aed" />

        <defs>
          <linearGradient id="rocketBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e4e4e7" />
            <stop offset="50%" stopColor="#f4f4f5" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>
        </defs>
      </svg>

      {/* Chamas — empilhadas pra dar profundidade */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: 2, width: size * 0.6, height: size * 0.85 }}
      >
        {/* Chama externa (amarela) — pulsa "fraca" */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at top, rgba(253,224,71,0.95) 0%, rgba(251,146,60,0.6) 50%, rgba(239,68,68,0.1) 80%, transparent 100%)",
            borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
            transformOrigin: "top center",
            animation: "flame-outer 0.32s ease-in-out infinite alternate",
            filter: "blur(0.3px)",
          }}
        />
        {/* Chama interna (laranja → branco) — pulsa "forte" defasada */}
        <span
          style={{
            position: "absolute",
            inset: "10% 18% 8% 18%",
            background:
              "radial-gradient(ellipse at top, #fff 0%, #fde047 30%, #fb923c 60%, rgba(239,68,68,0.4) 100%)",
            borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%",
            transformOrigin: "top center",
            animation: "flame-inner 0.22s ease-in-out infinite alternate",
            filter: "blur(0.2px)",
          }}
        />
        {/* Núcleo branco — flicker rápido (chama forte) */}
        <span
          style={{
            position: "absolute",
            inset: "30% 35% 30% 35%",
            background:
              "radial-gradient(ellipse at top, #fff 0%, #fef3c7 80%, transparent 100%)",
            borderRadius: "50%",
            animation: "flame-strong 0.14s ease-in-out infinite alternate",
          }}
        />
      </div>
    </span>
  );
}

const ROCKET_KEYFRAMES = `
  @keyframes rocket-hover {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-1.5px); }
  }
  @keyframes flame-outer {
    0%   { transform: scaleY(0.85) scaleX(0.9);  opacity: 0.7; }
    100% { transform: scaleY(1.15) scaleX(1.05); opacity: 1.0; }
  }
  @keyframes flame-inner {
    0%   { transform: scaleY(0.7) scaleX(0.8); opacity: 0.9; }
    100% { transform: scaleY(1.25) scaleX(1.1); opacity: 1.0; }
  }
  @keyframes flame-strong {
    0%   { transform: scale(0.6); opacity: 0.85; }
    100% { transform: scale(1.05); opacity: 1.0; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Animações removidas — chama estática pra evitar trigger seizure */
  }
`;
