"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lead } from "@/generated/prisma/client";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface AvatarLeadProps {
  Lead: Lead;
}

export function AvatarLead({ Lead }: AvatarLeadProps) {
  const url = useConstructUrl(Lead?.profile!);
  return (
    <div className="relative">
      <div className="relative inline-block rounded-full overflow-hidden h-9 w-9 md:h-11 md:w-11">
        <Avatar className="h-full w-full">
          <AvatarImage src={url} alt={Lead.name} />
          <AvatarFallback>{Lead.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      <span className="absolute block bg-green-500 ring-2 ring-white bottom-0 right-0 w-2 h-2 rounded-full md:w-3 md:h-3"></span>
    </div>
  );
}
