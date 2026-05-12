"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Wrapper padrão dos cards da Spacehome — tema escuro consistente,
 * título + subtítulo + conteúdo flexível.
 *
 * Empty state aceita `emptyAction` (ReactNode) que renderiza embaixo do
 * texto — usado pra exibir CTA "Criar meu primeiro X" pra membros/admins
 * em cards sem conteúdo.
 */
interface SpaceCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  empty?: string;
  isEmpty?: boolean;
  /** CTA renderizado no empty state (ex: botão "Criar meu primeiro X"). */
  emptyAction?: ReactNode;
}

export function SpaceCard({
  title,
  subtitle,
  action,
  children,
  className,
  empty,
  isEmpty,
  emptyAction,
}: SpaceCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-900/50 p-5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-white">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-white/60">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-sm text-white/50">
            {empty ?? "Nada por aqui ainda."}
          </p>
          {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
