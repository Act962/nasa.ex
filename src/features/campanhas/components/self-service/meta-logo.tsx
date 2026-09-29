import { cn } from "@/lib/utils";

/** Símbolo da Meta (infinito), para botões que levam às telas da Meta. */
export function MetaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden fill="none">
      <path
        d="M3 14.5C3 10 5 6.5 7.5 6.5c2.6 0 4.4 3.6 6.4 7 1.6 2.7 2.8 4 4.1 4 1.5 0 3-1.4 3-4.3 0-3.9-2-6.7-4.3-6.7-2.5 0-4.3 3.4-6.3 6.9C8.9 16.2 7.7 17.5 6 17.5c-1.8 0-3-1.2-3-3Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
