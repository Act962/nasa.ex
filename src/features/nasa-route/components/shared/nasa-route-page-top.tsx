"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NasaRoutePageTopProps {
  icon: ReactNode;
  /** Título do computador (nome do App ou da página). */
  title: string;
  /** No celular o título é a seção atual, porque a navegação está no menu de baixo. */
  mobileTitle?: string;
  subtitle: string;
  mobileSubtitle?: string;
  /** Ações secundárias: botões redondos só com ícone no celular. */
  actions?: ReactNode;
  className?: string;
}

export function NasaRoutePageTop({
  icon,
  title,
  mobileTitle,
  subtitle,
  mobileSubtitle,
  actions,
  className,
}: NasaRoutePageTopProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 text-info md:size-11 [&_svg]:size-5">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">
            {mobileTitle ?? title}
          </h1>
          <h1 className="hidden truncate text-2xl leading-tight font-bold tracking-tight md:block">
            {title}
          </h1>
          <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
            <span className="md:hidden">{mobileSubtitle ?? subtitle}</span>
            <span className="max-md:hidden">{subtitle}</span>
          </p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

interface TopActionLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  target?: string;
}

/** Celular: círculo só com ícone; computador: pílula com texto. */
export function TopActionLink({ href, icon, label, target }: TopActionLinkProps) {
  return (
    <Button
      asChild
      variant="outline"
      className="size-10 gap-1.5 rounded-full border-0 bg-knob p-0 md:h-9 md:w-auto md:border md:bg-transparent md:px-4"
      title={label}
    >
      <Link href={href} target={target} aria-label={label}>
        {icon}
        <span className="max-md:sr-only">{label}</span>
      </Link>
    </Button>
  );
}
