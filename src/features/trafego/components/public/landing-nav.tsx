"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#resultados", label: "Resultados" },
  { href: "#duvidas", label: "Dúvidas" },
];

/**
 * Barra fixa no topo. O CTA rola até o wizard em vez de navegar — a página
 * inteira é uma coisa só, e sair dela perderia o que já foi preenchido.
 */
export function LandingNav({ onStart }: { onStart: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08080c]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/trafego-logo.png"
          alt="trafeGO"
          width={289}
          height={96}
          className="h-6 w-auto shrink-0"
        />

        <ul className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-white/55 transition hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onStart}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2",
            "text-sm font-semibold text-white transition hover:bg-violet-500",
          )}
        >
          Começar agora
          <ArrowRight className="size-3.5" />
        </button>
      </nav>
    </header>
  );
}
