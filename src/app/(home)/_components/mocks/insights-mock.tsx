import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function InsightsMock() {
  return (
    <MacWindow title="Insights — Geral • Resumo">
      <div className="p-3 space-y-2.5 bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              label: "Total Leads",
              value: "847",
              icon: "👥",
              color: "text-white",
            },
            {
              label: "Leads Ativos",
              value: "124",
              icon: "🎯",
              color: "text-amber-400",
            },
            {
              label: "Leads Ganhos",
              value: "68",
              icon: "🏆",
              color: "text-emerald-400",
            },
            {
              label: "Tx. Conversão",
              value: "34%",
              icon: "%",
              color: "text-[#a78bfa]",
            },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-white/5 border border-white/8 rounded-lg p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/40 text-[8px]">{k.label}</span>
                <span className="text-[9px]">{k.icon}</span>
              </div>
              <p className={cn("font-black text-sm", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
        {/* Charts row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Bar chart: leads por status */}
          <div className="bg-white/4 border border-white/6 rounded-lg p-2">
            <p className="text-white/40 text-[8px] mb-1.5 font-medium">
              Leads por Status
            </p>
            <div className="space-y-1">
              {[
                { label: "Lead", pct: 60, color: "bg-white/30" },
                { label: "Qualif.", pct: 40, color: "bg-[#7C3AED]/70" },
                { label: "Proposta", pct: 25, color: "bg-amber-500/70" },
                { label: "Fechado", pct: 20, color: "bg-emerald-500/70" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className="text-white/30 text-[7px] w-10 shrink-0">
                    {b.label}
                  </span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div
                      className={cn("h-full rounded-full", b.color)}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Bar chart: leads por canal */}
          <div className="bg-white/4 border border-white/6 rounded-lg p-2">
            <p className="text-white/40 text-[8px] mb-1.5 font-medium">
              Leads por Canal
            </p>
            <div className="space-y-1">
              {[
                { label: "WhatsApp", pct: 75, color: "bg-green-500/70" },
                { label: "Instagram", pct: 50, color: "bg-pink-500/70" },
                { label: "Formulário", pct: 38, color: "bg-blue-500/70" },
                { label: "Outros", pct: 20, color: "bg-white/20" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className="text-white/30 text-[7px] w-12 shrink-0">
                    {b.label}
                  </span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div
                      className={cn("h-full rounded-full", b.color)}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}
