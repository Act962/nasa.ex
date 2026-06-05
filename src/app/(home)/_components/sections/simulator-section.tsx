"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Plug2,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ALL_APPS } from "./apps-showcase-data";

const STAR_PER_USER = 30;

const SIM_PLANS = [
  {
    id: "suit",
    label: "Suit",
    min: 0,
    max: 0,
    stars: 0,
    price: 0,
    color: "#10b981",
    bgClass: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    id: "earth",
    label: "Earth",
    min: 1,
    max: 1500,
    stars: 1000,
    price: 197,
    color: "#3b82f6",
    bgClass: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    id: "explore",
    label: "Explore",
    min: 1501,
    max: 4000,
    stars: 3000,
    price: 397,
    color: "#7C3AED",
    bgClass: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  {
    id: "constellation",
    label: "Constellation",
    min: 4001,
    max: 20000,
    stars: 20000,
    price: 797,
    color: "#f59e0b",
    bgClass: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
];

// Top 8 apps mais populares para o simulador
const POPULAR_SLUGS = [
  "whatsapp-business",
  "instagram-dm",
  "openai",
  "meta-ads",
  "google-ads",
  "stripe",
  "zapier",
  "shopify",
];
const APP_COSTS: { name: string; cost: number; icon: string }[] = ALL_APPS
  .filter((a) => POPULAR_SLUGS.includes(a.slug))
  .sort(
    (a, b) => POPULAR_SLUGS.indexOf(a.slug) - POPULAR_SLUGS.indexOf(b.slug),
  )
  .map((a) => ({ name: a.name, cost: a.cost, icon: a.icon }));

export function SimulatorSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [userCount, setUserCount] = useState(5);
  const [appCount, setAppCount] = useState(3);
  const MAX_USERS = 50;
  const MAX_APPS = APP_COSTS.length;

  // Total Stars needed = users * cost_per_user + sum of selected apps
  const userStars = userCount * STAR_PER_USER;
  const appStars = APP_COSTS.slice(0, appCount).reduce((s, a) => s + a.cost, 0);
  const totalStars = userStars + appStars;

  const userPct = (userCount / MAX_USERS) * 100;
  const appPct = (appCount / MAX_APPS) * 100;

  const recommended = SIM_PLANS.reduce((acc, p) => {
    if (totalStars >= p.min) return p;
    return acc;
  }, SIM_PLANS[0]);

  const starsBalance = recommended.stars - totalStars;
  const rolloverPct =
    recommended.id === "constellation"
      ? 0.3
      : recommended.id === "explore"
        ? 0.25
        : recommended.id === "earth"
          ? 0.2
          : 0;
  const rolloverNext = Math.max(0, Math.floor(starsBalance * rolloverPct));

  return (
    <section className="py-28 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/5 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-5 py-2">
            <BarChart2 className="size-3.5 text-violet-400" />
            <span className="text-violet-300 text-sm font-semibold tracking-wide">
              Simulador de Stars
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          Descubra qual plano{" "}
          <span className="text-nasa">faz sentido para você</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-12 max-w-xl mx-auto">
          Ajuste usuários e integrações, veja o consumo de Stars em tempo real
          e qual plano cobre sua operação.
        </p>

        {/* Two sliders */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6 mb-6 space-y-6">
          {/* Users slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-violet-400" />
                <p className="text-white/60 text-sm font-medium">
                  Usuários ativos
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 rounded-lg px-3 py-1">
                <span className="text-violet-300 font-black text-base">
                  {userCount}
                </span>
                <span className="text-violet-400/50 text-xs">
                  usuários × {STAR_PER_USER}★
                </span>
                <span className="text-yellow-400 font-bold text-sm ml-1">
                  = {userStars}★
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={MAX_USERS}
              step={1}
              value={userCount}
              onChange={(e) => setUserCount(Number(e.target.value))}
              style={{ "--track-pct": `${userPct}%` } as React.CSSProperties}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-1">
              <span>1 usuário</span>
              <span>25 usuários</span>
              <span>50 usuários</span>
            </div>
          </div>

          {/* Apps slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Plug2 className="size-4 text-blue-400" />
                <p className="text-white/60 text-sm font-medium">
                  Integrações ativas
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/25 rounded-lg px-3 py-1">
                <span className="text-blue-300 font-black text-base">
                  {appCount}
                </span>
                <span className="text-blue-400/50 text-xs">apps</span>
                <span className="text-yellow-400 font-bold text-sm ml-1">
                  = {appStars}★
                </span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_APPS}
              step={1}
              value={appCount}
              onChange={(e) => setAppCount(Number(e.target.value))}
              style={{ "--track-pct": `${appPct}%` } as React.CSSProperties}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-1">
              <span>0 apps</span>
              <span>{Math.floor(MAX_APPS / 2)} apps</span>
              <span>{MAX_APPS} apps</span>
            </div>
          </div>

          {/* Total Stars needed */}
          <div className="flex items-center justify-between bg-white/4 rounded-xl px-4 py-3 border border-white/6">
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Star className="size-3.5 text-yellow-400" />
              Total de Stars necessárias
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs">
                {userStars}★ usuários + {appStars}★ apps =
              </span>
              <span className="text-yellow-400 font-black text-xl">
                {totalStars.toLocaleString("pt-BR")} ★
              </span>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recommended plan */}
          <div
            className={cn(
              "rounded-2xl border p-6 transition-all",
              recommended.bgClass,
              recommended.border,
            )}
          >
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">
              Plano recomendado
            </p>
            <div className="flex items-start justify-between mb-4">
              <p className="text-white font-black text-3xl">
                {recommended.label}
              </p>
              <p className="text-white font-black text-2xl">
                {recommended.price === 0 ? (
                  <span className="text-emerald-400">Grátis</span>
                ) : (
                  <>
                    R$ {recommended.price}
                    <span className="text-white/30 text-sm font-normal">
                      /mês
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: "Stars/mês",
                  value:
                    recommended.stars === 0
                      ? "—"
                      : recommended.stars >= 1000
                        ? `${recommended.stars / 1000}K`
                        : String(recommended.stars),
                },
                {
                  label: "Saldo livre",
                  value:
                    starsBalance >= 0
                      ? `+${starsBalance.toLocaleString("pt-BR")}★`
                      : `${starsBalance.toLocaleString("pt-BR")}★`,
                },
                {
                  label: "Rollover",
                  value:
                    recommended.id === "constellation"
                      ? "30%"
                      : recommended.id === "explore"
                        ? "25%"
                        : recommended.id === "earth"
                          ? "20%"
                          : "0%",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white/5 rounded-xl p-3 text-center"
                >
                  <div
                    className={cn(
                      "font-black text-base",
                      label === "Saldo livre" && starsBalance < 0
                        ? "text-red-400"
                        : "text-white",
                    )}
                  >
                    {value}
                  </div>
                  <div className="text-white/30 text-[10px] mt-0.5">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {starsBalance < 0 ? (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-center">
                <p className="text-red-400 text-[11px] font-semibold">
                  ⚠️ Faltam {Math.abs(starsBalance).toLocaleString("pt-BR")} ★ —
                  considere o plano acima ou compre Stars avulsas
                </p>
              </div>
            ) : (
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px]">
                  Rollover para o próximo mês:
                  <span className="text-emerald-400 font-bold ml-1">
                    {rolloverNext.toLocaleString("pt-BR")} ★
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="nasa-glass rounded-2xl border border-white/8 p-6 space-y-3">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
              Detalhamento do consumo
            </p>

            {/* Users */}
            <div className="flex items-center justify-between bg-violet-500/8 border border-violet-500/15 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Users className="size-3.5 text-violet-400 shrink-0" />
                <span className="text-white/70 text-xs">
                  {userCount} usuário{userCount !== 1 ? "s" : ""} ×{" "}
                  {STAR_PER_USER}★
                </span>
              </div>
              <span className="text-violet-300 font-bold text-xs">
                {userStars} ★/mês
              </span>
            </div>

            {/* Apps list */}
            {APP_COSTS.slice(0, appCount).map((app) => (
              <div
                key={app.name}
                className="flex items-center justify-between bg-white/4 border border-white/6 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{app.icon}</span>
                  <span className="text-white/60 text-xs">{app.name}</span>
                </div>
                <span className="text-yellow-400/70 text-xs font-semibold">
                  {app.cost} ★/mês
                </span>
              </div>
            ))}

            {appCount === 0 && (
              <p className="text-white/20 text-xs text-center py-2">
                Nenhuma integração selecionada
              </p>
            )}

            <div className="border-t border-white/8 pt-3 flex items-center justify-between">
              <span className="text-white/40 text-xs font-semibold">Total</span>
              <span className="text-yellow-400 font-black text-base">
                {totalStars} ★/mês
              </span>
            </div>
          </div>
        </div>

        {/* All plans comparison */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest mb-5 text-center">
            Qual plano cobre sua operação?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SIM_PLANS.map((p) => {
              const isRec = p.id === recommended.id;
              const covers = p.stars >= totalStars;
              const maxUsers =
                p.stars > 0 ? Math.floor(p.stars / STAR_PER_USER) : 0;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl p-4 text-center border transition-all",
                    isRec
                      ? `${p.bgClass} ${p.border} scale-[1.03]`
                      : covers
                        ? "border-white/8 opacity-70"
                        : "border-white/4 opacity-35",
                  )}
                >
                  <p className="text-white font-bold text-sm mb-0.5">
                    {p.label}
                  </p>
                  <p className="text-white font-black text-base">
                    {p.price === 0 ? (
                      <span className="text-emerald-400">Grátis</span>
                    ) : (
                      `R$ ${p.price}`
                    )}
                  </p>
                  <p className="text-white/30 text-[10px] mt-0.5">
                    {p.stars === 0
                      ? "sem stars"
                      : `${p.stars >= 1000 ? p.stars / 1000 + "K" : p.stars} ★/mês`}
                  </p>
                  <p className="text-violet-400/70 text-[10px]">
                    {p.stars > 0 ? `~${maxUsers} usuários` : "0 usuários"}
                  </p>
                  {isRec && (
                    <div
                      className="mt-1.5 text-[10px] font-bold"
                      style={{ color: p.color }}
                    >
                      ✓ Recomendado
                    </div>
                  )}
                  {!covers && p.stars > 0 && !isRec && (
                    <div className="mt-1.5 text-[10px] text-white/20">
                      Insuficiente
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-10">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar com o plano {recommended.label}
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
