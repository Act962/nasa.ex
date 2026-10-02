import { cn } from "@/lib/utils";

interface PriceStarsDisplayProps {
  /** Preço em centavos BRL — fonte de verdade desde a migração Stripe. */
  priceBrlCents?: number | null;
  /** Flag explícita de curso gratuito. Quando true, sempre renderiza "Grátis". */
  isFree?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Badge de preço de curso. Apesar do nome histórico (`PriceStarsDisplay`),
 * hoje exibe em BRL — Stars deixou de comprar cursos. O nome do componente
 * permanece pra não quebrar imports; o display de Stars foi removido só do
 * render, os dados continuam no schema/API para usos futuros.
 */
export function PriceStarsDisplay({
  priceBrlCents,
  isFree,
  size = "md",
  className,
}: PriceStarsDisplayProps) {
  const cents = priceBrlCents ?? 0;
  const showFree = isFree === true || cents <= 0;

  if (showFree) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 font-medium text-success",
          size === "sm" && "text-[11px]",
          size === "md" && "text-xs",
          size === "lg" && "text-sm",
          className,
        )}
      >
        Gratuito
      </span>
    );
  }

  const formatted = (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2.5 py-0.5 font-semibold text-info",
        size === "sm" && "text-[11px]",
        size === "md" && "text-xs",
        size === "lg" && "text-base",
        className,
      )}
    >
      {formatted}
    </span>
  );
}
