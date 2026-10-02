import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const HAS_SIZE_CLASS = /(^|\s)(size|w|h)-/;

/** Marca da ÓRBITA girando — anel azul com o recorte do ponto em órbita. Loading padrão do app. */
export function OrbitaSpinner({
  className,
  size,
  isOnBrandColor = false,
  ...svgProps
}: Omit<ComponentProps<"svg">, "children"> & {
  size?: number | string;
  /** Sobre fundo azul (botão do Astro): desenha em branco para não sumir. */
  isOnBrandColor?: boolean;
}) {
  const brandColor = isOnBrandColor ? "#FFFFFF" : "#00A1F8";
  const maskId = useId();
  const hasSizeClass = HAS_SIZE_CLASS.test(className ?? "");

  return (
    <svg
      viewBox="0 0 1200 1200"
      role="status"
      aria-label="Carregando"
      width={size}
      height={size}
      {...svgProps}
      className={cn(
        "shrink-0 animate-spin [animation-duration:1.4s]",
        !hasSizeClass && size === undefined && "size-4",
        className,
      )}
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
        stroke={brandColor}
        strokeWidth="115"
        mask={`url(#${maskId})`}
      />
      <circle cx="893" cy="202" r="190" fill={brandColor} />
    </svg>
  );
}
