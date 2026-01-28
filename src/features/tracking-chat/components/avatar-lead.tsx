"use client";

import { Lead } from "@/generated/prisma/client";
import Image from "next/image";

interface AvatarLeadProps {
  Lead: Lead;
}

export function AvatarLead({ Lead }: AvatarLeadProps) {
  return (
    <div className="relative">
      <div className="relative inline-block rounded-full overflow-hidden h-9 w-9 md:h-11 md:w-11">
        <Image
          src={Lead?.profile || "/placehonder-lead.avif"}
          alt="avatar"
          fill
        />
      </div>
      <span className="absolute block bg-green-500 ring-2 ring-white bottom-0 right-0 w-2 h-2 rounded-full md:w-3 md:h-3"></span>
    </div>
  );
}
