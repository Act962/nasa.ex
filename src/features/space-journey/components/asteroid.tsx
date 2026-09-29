import { cn } from "@/lib/utils";

/** Asteroide: parada pequena entre dois planetas (um passo dentro de uma etapa). */
export function Asteroid({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={cn("overflow-visible", className)} aria-hidden>
      <path d="M4 6 L9 2 L15 3 L18 8 L16 14 L10 18 L4 15 L2 10 Z" fill="#a8a29e" stroke="#57534e" strokeWidth="1" />
      <circle cx="8" cy="8" r="1.8" fill="#78716c" />
      <circle cx="13" cy="12" r="1.3" fill="#78716c" />
    </svg>
  );
}
