import { cn } from "@/lib/utils";

/** Foguete da jornada: casco claro, escotilha azul, aletas e chama animada. */
export function Rocket({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 100" width={size} height={(size * 100) / 64} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id="rocket-hull" x1="0" x2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id="rocket-window" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        <linearGradient id="rocket-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path className="animate-rocket-flame" style={{ transformOrigin: "32px 76px" }} d="M22 76 Q32 112 42 76 Z" fill="url(#rocket-flame)" />
      <path d="M14 56 L4 78 L20 72 Z" fill="#f97316" />
      <path d="M50 56 L60 78 L44 72 Z" fill="#ea580c" />
      <path d="M32 4 C48 18 50 40 46 74 L18 74 C14 40 16 18 32 4 Z" fill="url(#rocket-hull)" />
      <path d="M32 4 C40 11 44 18 45 24 L19 24 C20 18 24 11 32 4 Z" fill="#f43f5e" />
      <circle cx="32" cy="42" r="9" fill="#1e293b" />
      <circle cx="32" cy="42" r="7" fill="url(#rocket-window)" />
      <circle cx="29" cy="39" r="2" fill="#fff" opacity="0.8" />
      <rect x="29" y="60" width="6" height="16" rx="3" fill="#fb923c" />
    </svg>
  );
}
