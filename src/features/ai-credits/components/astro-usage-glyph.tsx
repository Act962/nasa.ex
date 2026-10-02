/** O ASTRO sem o disco — anel aberto, lua e olhos — com o anel na cor do limite (spec 0055, RF-10). */
export function AstroUsageGlyph({ ringColor, className }: { ringColor: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M 84.8 40.7 A 36 36 0 1 1 49.4 14" fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round" />
      <circle cx="72" cy="22" r="11" fill="currentColor" />
      <ellipse cx="42" cy="52" rx="4.5" ry="7.5" fill="currentColor" />
      <ellipse cx="58" cy="52" rx="4.5" ry="7.5" fill="currentColor" />
    </svg>
  );
}
