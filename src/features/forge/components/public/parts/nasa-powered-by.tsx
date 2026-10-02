"use client";

import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

export function NasaPoweredBy({ variant = "dark" }: { variant?: Variant }) {
  const logoSrc = variant === "dark" ? "/orbita-logo-dark.svg" : "/orbita-logo.svg";
  const textCls =
    variant === "dark" ? "text-muted-foreground" : "text-muted-foreground";
  const linkCls =
    variant === "dark"
      ? "text-[#a78bfa] hover:underline font-semibold"
      : "text-info hover:underline font-semibold";
  const borderCls =
    variant === "dark" ? "border-line" : "border-line";

  return (
    <div
      className={cn(
        "max-w-3xl mx-auto px-8 py-8 border-t flex flex-col sm:flex-row items-center justify-center gap-3 text-center",
        borderCls,
      )}
    >
      <img
        src={logoSrc}
        alt="ÓRBITA"
        className="h-7 object-contain opacity-90"
      />
      <p className={cn("text-xs", textCls)}>
        Proposta gerada por ÓRBITA —{" "}
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
