"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";

/**
 * Celular do hero: o painel que o cliente recebe, resumido em um gráfico.
 * É ilustração — os números são de exemplo e não vêm de conta nenhuma.
 */
const BARS = [34, 46, 38, 58, 52, 72, 66, 88];

export function HeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-full bg-violet-600/20 blur-3xl"
      />

      <div className="relative rounded-[2.5rem] border border-white/15 bg-black/70 p-2.5 shadow-2xl shadow-violet-950/50">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#141419] to-[#0c0c11]">
          <div className="mx-auto mt-2.5 h-4 w-24 rounded-full bg-black" />

          <div className="px-5 pb-7 pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/trafego-logo.png"
              alt=""
              width={289}
              height={96}
              className="h-4 w-auto opacity-70"
            />

            <p className="mt-5 text-xs text-white/45">Vendas</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">+237</span>
              <span className="mb-1 inline-flex items-center gap-0.5 text-sm font-semibold text-emerald-400">
                <ArrowUpRight className="size-3.5" />
                48%
              </span>
            </div>

            <div className="mt-5 flex h-28 items-end gap-1.5" aria-hidden>
              {BARS.map((height, index) => (
                <span
                  key={index}
                  style={{ height: `${height}%` }}
                  className={
                    index === BARS.length - 1
                      ? "flex-1 rounded-t bg-violet-500"
                      : "flex-1 rounded-t bg-violet-500/30"
                  }
                />
              ))}
            </div>

            <div className="mt-5 h-1 w-full rounded-full bg-white/[0.06]">
              <div className="h-1 w-3/5 rounded-full bg-violet-500/60" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#16161c] px-3 py-2.5 shadow-xl sm:-left-8">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
          <Sparkles className="size-4 text-violet-300" />
        </span>
        <span className="text-[11px] leading-tight">
          <strong className="block font-semibold text-white">Mais resultados</strong>
          <span className="text-white/45">para o seu negócio</span>
        </span>
      </div>
    </div>
  );
}
