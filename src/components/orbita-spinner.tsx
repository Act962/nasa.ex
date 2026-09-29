import { useId } from "react";
import { cn } from "@/lib/utils";

/** Marca da ÓRBITA girando — anel azul com o recorte do ponto em órbita. */
export function OrbitaSpinner({ className }: { className?: string }) {
  const maskId = useId();

  return (
    <svg
      viewBox="0 0 1200 1200"
      aria-hidden="true"
      className={cn("size-16 animate-spin [animation-duration:1.4s]", className)}
    >
      <defs>
        <mask id={maskId}>
          <rect width="1200" height="1200" fill="white" />
          <circle cx="893" cy="202" r="348" fill="black" />
        </mask>
      </defs>
      <circle
        cx="585"
        cy="605"
        r="510"
        fill="none"
        stroke="#00A1F8"
        strokeWidth="115"
        mask={`url(#${maskId})`}
      />
      <circle cx="893" cy="202" r="190" fill="white" />
    </svg>
  );
}
