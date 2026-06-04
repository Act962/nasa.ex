"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function InsightsAnimatedMock() {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAnimKey((k) => k + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const channels = [
    {
      name: "Meta Ads",
      color: "#1877F2",
      value: 82,
      roas: "4.2x",
      cpl: "R$18",
    },
    {
      name: "Google Ads",
      color: "#4285F4",
      value: 67,
      roas: "3.1x",
      cpl: "R$24",
    },
    {
      name: "TikTok Ads",
      color: "#69C9D0",
      value: 45,
      roas: "2.4x",
      cpl: "R$31",
    },
    { name: "Orgânico", color: "#a78bfa", value: 30, roas: "∞", cpl: "R$0" },
  ];

  return (
    <MacWindow title="NASA Insights, Tráfego Pago">
      <div className="bg-[#0d0a1a] p-4">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Impressões", value: "142K", delta: "+18%", up: true },
            { label: "Cliques", value: "8.3K", delta: "+12%", up: true },
            { label: "CPL médio", value: "R$21", delta: "-9%", up: true },
            { label: "ROAS", value: "3.8x", delta: "+0.4", up: true },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white/4 rounded-xl p-2.5 border border-white/6"
            >
              <p className="text-white/35 text-[8px] font-medium mb-0.5">
                {kpi.label}
              </p>
              <p className="text-white text-sm font-black">{kpi.value}</p>
              <p
                className={cn(
                  "text-[9px] font-semibold",
                  kpi.up ? "text-emerald-400" : "text-red-400",
                )}
              >
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/6 mb-3">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider mb-3">
            Performance por canal
          </p>
          <div className="space-y-2.5">
            {channels.map((ch, i) => (
              <div
                key={`${ch.name}-${animKey}`}
                className="flex items-center gap-2"
              >
                <div className="w-[70px] text-[9px] text-white/50 shrink-0 text-right">
                  {ch.name}
                </div>
                <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bar-rise"
                    style={{
                      width: `${ch.value}%`,
                      background: ch.color,
                      transformOrigin: "left",
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="text-[9px] text-emerald-400 font-bold w-8 text-right">
                    {ch.roas}
                  </span>
                  <span className="text-[9px] text-white/40 w-8 text-right">
                    {ch.cpl}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4 mt-2 pt-2 border-t border-white/5">
            <span className="text-[8px] text-emerald-400 font-medium">
              ROAS
            </span>
            <span className="text-[8px] text-white/35 font-medium">CPL</span>
          </div>
        </div>

        {/* Data flow arrow */}
        <div className="flex items-center gap-1.5 justify-center">
          {[
            { logo: "f", color: "#1877F2", label: "Meta" },
            { logo: "G", color: "#4285F4", label: "Google" },
          ].map((src) => (
            <div key={src.label} className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-black"
                style={{ background: src.color }}
              >
                {src.logo}
              </div>
              <span className="text-white/30 text-[8px]">{src.label}</span>
            </div>
          ))}
          <div className="flex-1 mx-1 h-px bg-gradient-to-r from-[#4285F4]/50 via-[#7C3AED]/70 to-[#a78bfa]/50 relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[#a78bfa] text-[8px]">
              →
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-md bg-[#7C3AED]/30 border border-[#7C3AED]/50 flex items-center justify-center">
              <BarChart2 className="size-2.5 text-[#a78bfa]" />
            </div>
            <span className="text-white/50 text-[8px] font-semibold">
              NASA Insights
            </span>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}
