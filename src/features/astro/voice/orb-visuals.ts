import type { OrbPhase } from "./use-astro-orb-store";

/** Cor, anel e brilho do orb em cada fase da voz. */
export const ORB_PHASES: Record<OrbPhase, { bg: string; ring: string; glow: string }> = {
  idle: {
    bg: "bg-gradient-to-br from-violet-600 to-purple-700",
    ring: "ring-2 ring-violet-500/40",
    glow: "0 8px 32px -8px rgba(124,58,237,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
  },
  listening: {
    bg: "bg-gradient-to-br from-blue-500 to-blue-700",
    ring: "ring-2 ring-blue-400/40",
    glow: "0 10px 36px -6px rgba(59,130,246,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
  },
  thinking: {
    bg: "bg-gradient-to-br from-purple-500 to-fuchsia-700",
    ring: "ring-2 ring-fuchsia-400/40",
    glow: "0 10px 36px -6px rgba(217,70,239,0.65), 0 0 0 1px rgba(255,255,255,0.06)",
  },
  speaking: {
    bg: "bg-gradient-to-br from-emerald-500 to-teal-700",
    ring: "ring-2 ring-emerald-400/40",
    glow: "0 12px 40px -4px rgba(16,185,129,0.75), 0 0 0 1px rgba(255,255,255,0.1)",
  },
};

/**
 * Keyframes do orb. Tudo respeita `prefers-reduced-motion: reduce`
 * (animações são desabilitadas via media query).
 */
export const ORB_KEYFRAMES = `
  @keyframes orb-ripple {
    0%   { transform: scale(0.8); opacity: 0.9; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes orb-aurora {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes orb-breathe {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.06); }
  }
  /* Órbita dos sparkles — cada um nasce no centro, vai pra borda e some.
     Combinação de translate + scale + opacity pra criar "respiração de luz". */
  @keyframes orb-orbit {
    0% {
      transform: translate(-50%, -50%) rotate(0deg) translateX(0px) scale(0);
      opacity: 0;
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(72deg) translateX(20px) scale(1);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(288deg) translateX(28px) scale(1);
    }
    100% {
      transform: translate(-50%, -50%) rotate(360deg) translateX(0px) scale(0);
      opacity: 0;
    }
  }
  @keyframes orb-icon-in {
    0%   { transform: scale(0.6) rotate(-12deg); opacity: 0; }
    60%  { transform: scale(1.12) rotate(4deg);  opacity: 1; }
    100% { transform: scale(1) rotate(0deg);     opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Mantém apenas indicação estática — sem motion */
  }
`;
