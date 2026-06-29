"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plug2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ALL_APPS, APP_CATEGORIES } from "./apps-showcase-data";

export function AppsShowcaseSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [activeCategory, setActiveCategory] = useState<string>("Mensageiros");
  const [showAll, setShowAll] = useState(false);

  const filtered = ALL_APPS.filter((a) => a.category === activeCategory);
  const displayed = showAll ? filtered : filtered.slice(0, 8);

  const totalApps = ALL_APPS.length;
  const cheapest = Math.min(...ALL_APPS.map((a) => a.cost));

  return (
    <section className="py-24 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-[#7C3AED]/4 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-5 py-2">
            <Plug2 className="size-3.5 text-blue-400" />
            <span className="text-blue-300 text-sm font-semibold tracking-wide">
              {totalApps}+ integrações disponíveis
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-3 leading-tight">
          Todos os apps disponíveis
          <br />
          <span className="text-nasa">em qualquer plano</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-4 max-w-2xl mx-auto leading-relaxed">
          Não existe app bloqueado por plano. O único critério é ter Stars
          suficientes para ativá-los. Quanto mais Stars, mais você pode
          conectar.
        </p>

        {/* Key stats */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {[
            {
              label: "Apps disponíveis",
              value: `${totalApps}+`,
              color: "text-violet-400",
            },
            {
              label: "Menor custo",
              value: `${cheapest} ★/mês`,
              color: "text-yellow-400",
            },
            {
              label: "Bloqueados por plano",
              value: "0",
              color: "text-emerald-400",
            },
            {
              label: "Categorias",
              value: `${APP_CATEGORIES.length}`,
              color: "text-blue-400",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="nasa-glass border border-white/8 rounded-xl px-5 py-3 text-center min-w-[120px]"
            >
              <p className={cn("text-xl font-black", color)}>{value}</p>
              <p className="text-white/30 text-[11px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {APP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setShowAll(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                activeCategory === cat
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20",
              )}
            >
              {cat}
              <span className="ml-1.5 text-[10px] opacity-60">
                ({ALL_APPS.filter((a) => a.category === cat).length})
              </span>
            </button>
          ))}
        </div>

        {/* Apps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {displayed.map((app) => (
            <div
              key={app.slug}
              className="nasa-glass rounded-xl border border-white/8 p-4 flex items-start gap-3 hover:border-violet-500/30 transition-all group"
            >
              <span className="text-2xl shrink-0">{app.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/85 font-semibold text-xs group-hover:text-white transition-colors">
                  {app.name}
                </p>
                <p className="text-white/30 text-[10px] leading-relaxed mt-0.5 line-clamp-2">
                  {app.desc}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="size-2.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400/80 text-[10px] font-bold">
                    {app.cost} ★/mês
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show more */}
        {filtered.length > 8 && (
          <div className="text-center mb-10">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-white/40 hover:text-white/70 text-sm border border-white/10 hover:border-white/20 rounded-full px-5 py-2 transition-all"
            >
              {showAll
                ? "Mostrar menos"
                : `Ver mais ${filtered.length - 8} apps de ${activeCategory}`}
            </button>
          </div>
        )}

        {/* Banner: all plans unlocked */}
        <div className="nasa-glass rounded-2xl border border-violet-500/20 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="text-4xl shrink-0">🔓</div>
          <div className="flex-1">
            <p className="text-white font-bold text-base">
              Nenhum app bloqueado por plano
            </p>
            <p className="text-white/40 text-sm mt-0.5">
              No Suit (grátis) você ainda pode comprar Stars avulsas e ativar
              qualquer integração. Upgrade de plano = mais Stars mensais, não
              mais acesso.
            </p>
          </div>
          <Button
            asChild
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shrink-0"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar agora <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
