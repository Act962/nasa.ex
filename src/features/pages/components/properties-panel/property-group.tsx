"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Grupo recolhível do painel de propriedades: só o título fica à vista até o usuário abrir. */
export function PropertyGroup({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("border-b last:border-b-0", className)}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 py-2.5 text-left text-[11px] font-semibold tracking-wide text-foreground uppercase">
        {title}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
