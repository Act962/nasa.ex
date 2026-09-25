"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AstroCommandPersona } from "@/generated/prisma/enums";

/**
 * Marca visual do comando na lista e no cabeçalho (spec 0023). Cada papel tem
 * seu gradiente, então dá para reconhecer o comando antes de ler o nome.
 */
const PERSONA_GRADIENTS: Record<AstroCommandPersona, string> = {
  SALES: "from-fuchsia-500 to-purple-600",
  FINANCE: "from-emerald-400 to-teal-600",
  ADMIN: "from-sky-400 to-indigo-600",
  ACCOUNTING: "from-amber-400 to-orange-600",
  CUSTOM: "from-violet-400 to-purple-600",
};

export function CommandAvatar({
  persona,
  iconUrl,
  size = "md",
}: {
  persona: AstroCommandPersona;
  iconUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";

  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt=""
        width={48}
        height={48}
        className={cn(dimension, "shrink-0 rounded-full object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        dimension,
        "shrink-0 rounded-full bg-gradient-to-br shadow-inner",
        PERSONA_GRADIENTS[persona],
      )}
    />
  );
}
