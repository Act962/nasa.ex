"use client";

import { cn } from "@/lib/utils";
import { clientInitials, clientRingClass } from "./planner-v2-utils";

/** Bolinha do cliente (org): logo ou iniciais, com anel de cor própria para diferenciar no calendário. */
export function ClientAvatar({
  name,
  logo,
  clientIndex,
  className,
}: {
  name: string;
  logo?: string | null;
  clientIndex: number;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-knob text-[8px] font-bold text-foreground ring-2",
        clientRingClass(clientIndex),
        className,
      )}
    >
      {logo ? <img src={logo} alt="" className="size-full object-cover" /> : clientInitials(name)}
    </span>
  );
}
