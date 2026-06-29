"use client";

import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

export function NasaPoweredBy({ variant = "dark" }: { variant?: Variant }) {
  const logoSrc = variant === "dark" ? "/logo-dark.png" : "/logo.png";
  const textCls =
    variant === "dark" ? "text-slate-500" : "text-gray-500";
  const linkCls =
    variant === "dark"
      ? "text-[#a78bfa] hover:underline font-semibold"
      : "text-blue-600 hover:underline font-semibold";
  const borderCls =
    variant === "dark" ? "border-slate-800" : "border-gray-200";

  return (
    <div
      className={cn(
        "max-w-3xl mx-auto px-8 py-8 border-t flex flex-col sm:flex-row items-center justify-center gap-3 text-center",
        borderCls,
      )}
    >
      <img
        src={logoSrc}
        alt="N.A.S.A"
        className="h-7 object-contain opacity-90"
      />
      <p className={cn("text-xs", textCls)}>
        Proposta gerada por N.A.S.A —{" "}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          Conheça a plataforma
        </a>
      </p>
    </div>
  );
}
