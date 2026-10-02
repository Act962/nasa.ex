"use client";

import Link from "next/link";
import { BarChart3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/features/insights/types";

/** Botão "Relatório" das configurações de cada App: abre o Insights com aquele App selecionado. */
export function AppReportButton({
  appModule,
  className,
  size = "sm",
  variant = "outline",
  isCompactOnMobile = false,
}: {
  appModule: AppModule;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
  /** No celular mostra só o ícone, para caber ao lado do título. */
  isCompactOnMobile?: boolean;
}) {
  return (
    <Button asChild size={size} variant={variant} className={cn("gap-1.5", isCompactOnMobile && "max-sm:size-9 max-sm:px-0", className)}>
      <Link href={`/insights/${appModule}`}>
        <BarChart3Icon className="size-4" />
        <span className={cn(isCompactOnMobile && "max-sm:sr-only")}>Relatório</span>
      </Link>
    </Button>
  );
}
