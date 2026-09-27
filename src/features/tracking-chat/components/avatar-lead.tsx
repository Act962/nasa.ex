"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Lead } from "@/generated/prisma/client";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";

interface AvatarLeadProps {
  Lead: Lead;
  /** Sobrescreve o tamanho — dentro do anel de temperatura, preenche a área interna. */
  className?: string;
}

export function AvatarLead({ Lead, className }: AvatarLeadProps) {
  const url = useConstructUrl(Lead?.profile!);
  return (
    <div className={cn("relative flex", className)}>
      <div className={cn("relative block rounded-full overflow-hidden h-9 w-9 md:h-11 md:w-11", className)}>
        <Avatar className="h-full w-full">
          <AvatarImage src={url} alt={Lead.name} />
          <AvatarFallback>{Lead.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
