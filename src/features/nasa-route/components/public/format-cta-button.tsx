"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasLessons, type CourseFormat } from "@/features/nasa-route/lib/formats";

interface Props {
  format: CourseFormat | string;
  priceStars: number;
  isFree: boolean;
  hasMultiplePlans: boolean;
  /** Pra format=event: data de início — usado pra decidir "encerrado". */
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
  /** Disabled enquanto algum estado externo carrega. */
  disabled?: boolean;
  size?: "default" | "lg" | "sm";
  className?: string;
  onClick?: () => void;
  /** Se vier href, vira <a> (caso de "Faça login pra comprar"). */
  href?: string;
}

function buildLabel(
  format: CourseFormat | string,
  isFree: boolean,
  hasMultiplePlans: boolean,
  eventEnded: boolean,
): string {
  if (eventEnded) return "Evento encerrado";
  if (hasMultiplePlans) return "Ver planos";
  if (isFree) {
    if (format === "ebook") return "Baixar grátis";
    if (format === "event") return "Garantir vaga grátis";
    if (format === "community") return "Entrar na comunidade";
    if (format === "subscription") return "Assinar grátis";
    return "Acessar gratuitamente";
  }
  switch (format) {
    case "ebook":
      return "Comprar eBook com STARs";
    case "event":
      return "Garantir vaga";
    case "community":
      return "Entrar na comunidade";
    case "subscription":
      return "Assinar com STARs";
    case "course":
    case "training":
    case "mentoring":
    default:
      if (hasLessons(format as CourseFormat)) return "Comprar curso com STARs";
      return "Comprar com STARs";
  }
}

export function FormatCtaButton({
  format,
  priceStars,
  isFree,
  hasMultiplePlans,
  eventStartsAt,
  eventEndsAt,
  disabled,
  size = "lg",
  className,
  onClick,
  href,
}: Props) {
  // Detecta evento encerrado
  const now = new Date();
  const startsAt = eventStartsAt
    ? eventStartsAt instanceof Date
      ? eventStartsAt
      : new Date(eventStartsAt)
    : null;
  const endsAt = eventEndsAt
    ? eventEndsAt instanceof Date
      ? eventEndsAt
      : new Date(eventEndsAt)
    : null;
  const eventEnded =
    format === "event"
      ? endsAt
        ? endsAt < now
        : startsAt
          ? startsAt < now
          : false
      : false;

  const label = buildLabel(format, isFree, hasMultiplePlans, eventEnded);
  const isDisabled = disabled || eventEnded;

  const subline =
    format === "subscription" && !hasMultiplePlans
      ? `${priceStars.toLocaleString("pt-BR")} ★ por mês`
      : null;

  if (href && !isDisabled) {
    return (
      <div className={cn("space-y-1", className)}>
        <Button asChild size={size} className="w-full">
          <a href={href}>{label}</a>
        </Button>
        {subline && (
          <p className="text-center text-[11px] text-muted-foreground">{subline}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <Button
        size={size}
        className="w-full"
        onClick={onClick}
        disabled={isDisabled}
      >
        {label}
      </Button>
      {subline && (
        <p className="text-center text-[11px] text-muted-foreground">{subline}</p>
      )}
    </div>
  );
}
