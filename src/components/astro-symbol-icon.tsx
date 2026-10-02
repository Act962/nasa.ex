import { cn } from "@/lib/utils";

/** Símbolo do ASTRO (anel aberto, lua e olhos) como ícone de linha: segue a cor do texto, igual aos ícones do lucide. */
export function AstroSymbolIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("size-4", className)}>
      <path d="M 84.8 40.7 A 36 36 0 1 1 49.4 14" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <circle cx="72" cy="22" r="11" fill="currentColor" />
      <ellipse cx="42" cy="52" rx="5" ry="8" fill="currentColor" />
      <ellipse cx="58" cy="52" rx="5" ry="8" fill="currentColor" />
    </svg>
  );
}
