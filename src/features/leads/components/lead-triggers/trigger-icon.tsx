import { cn } from "@/lib/utils";

// Ícone do Gatilho do lead (spec 0038): setas em círculo com raio no centro.
// Ligado, só as setas giram — o raio fica parado.

interface TriggerIconProps {
  className?: string;
  isSpinning?: boolean;
}

export function TriggerIcon({ className, isSpinning = false }: TriggerIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
      aria-hidden
    >
      <g
        className={cn(isSpinning && "animate-spin [animation-duration:2.5s] motion-reduce:animate-none")}
        style={{ transformOrigin: "12px 12px", transformBox: "view-box" }}
      >
        <path d="M19.5 9.5A8 8 0 0 0 6.2 6.4" />
        <path d="M6.6 3.6 6 6.6l3 .6" />
        <path d="M4.5 14.5a8 8 0 0 0 13.3 3.1" />
        <path d="M17.4 20.4l.6-3-3-.6" />
      </g>
      <path d="M12.8 6.8 9.6 12.4h2.8l-1.2 4.8 3.2-5.6h-2.8z" fill="currentColor" strokeWidth={1} />
    </svg>
  );
}
