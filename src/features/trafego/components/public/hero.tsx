"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroPhone } from "./hero-phone";

/**
 * Hero: a promessa em seis partes. A primeira é o título; as outras cinco ficam
 * numeradas embaixo, e o destaque percorre a lista — a animação continua, mas
 * o cliente lê tudo de uma vez em vez de esperar a frase seguinte aparecer.
 */
const CLAIMS = [
  "Você escolhe quanto investir.",
  "Envia os criativos ou seleciona da sua rede social.",
  "Nossa equipe coloca a campanha no ar.",
  "Você acompanha tudo na palma da mão.",
  "Quanto maior o investimento, menor a nossa taxa.",
];

const STATS = [
  { value: "R$ 50 milhões", label: "investidos em tráfego pago" },
  { value: "5.350", label: "clientes atendidos" },
  { value: "12 marcas", label: "nacionais na carteira" },
];

const STEP_MS = 2_400;

export function Hero({ onStart }: { onStart: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % CLAIMS.length),
      STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
      <div>
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Chega de pagar mensalidade em{" "}
          <span className="text-violet-400">tráfego pago.</span>
        </h1>

        <ol className="mt-7 space-y-3">
          {CLAIMS.map((claim, index) => {
            const isActive = !reduceMotion && index === activeIndex;
            return (
              <li key={claim} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-500",
                    isActive
                      ? "scale-110 bg-violet-500 text-white"
                      : "bg-white/[0.07] text-white/45",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm transition-colors duration-500 sm:text-[0.95rem]",
                    isActive ? "font-medium text-white" : "text-white/55",
                  )}
                >
                  {claim}
                </span>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
        >
          Montar minha campanha
          <ArrowRight className="size-4" />
        </button>

        <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/[0.07] pt-6">
          {STATS.map((stat) => (
            <div key={stat.value}>
              <dt className="text-lg font-bold leading-tight text-white sm:text-xl">
                {stat.value}
              </dt>
              <dd className="mt-0.5 text-[11px] leading-snug text-white/40">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="order-first lg:order-none">
        <HeroPhone />
      </div>
    </section>
  );
}
