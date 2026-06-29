import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function DashboardMock() {
  const navItems = [
    { icon: "⬛", label: "Trackings", active: false },
    { icon: "📋", label: "Formulários", active: false },
    { icon: "💬", label: "Chats", active: true },
    { icon: "📅", label: "Agenda", active: false },
    { icon: "👥", label: "Contatos", active: false },
    { icon: "📊", label: "Insights", active: false },
    { icon: "⚡", label: "Integrações", active: false },
    { icon: "🔲", label: "Apps", active: false },
  ];

  const stages = [
    {
      name: "Lead",
      count: 23,
      color: "border-white/20",
      cards: ["Ana Costa", "Pedro Lima"],
    },
    {
      name: "Qualificado",
      count: 14,
      color: "border-[#7C3AED]/50",
      cards: ["Mariana S.", "João F."],
    },
    {
      name: "Proposta",
      count: 8,
      color: "border-amber-500/50",
      cards: ["Tech Corp", "StartUp X"],
    },
    {
      name: "Negociação",
      count: 5,
      color: "border-blue-500/50",
      cards: ["Alfa Ltda"],
    },
    {
      name: "Fechado",
      count: 12,
      color: "border-emerald-500/50",
      cards: ["Beta SA"],
    },
  ];

  return (
    <MacWindow title="nasa.ex, Tracking • Pipeline Comercial">
      <div className="flex" style={{ height: 320 }}>
        {/* Sidebar */}
        <div className="w-40 flex flex-col bg-[#080613] border-r border-white/5 py-3 shrink-0">
          <div className="px-3 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-black">
              N
            </div>
            <span className="text-white/60 text-[11px] font-semibold">
              nasa.ex
            </span>
          </div>
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "mx-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] mb-0.5",
                item.active
                  ? "bg-[#7C3AED]/20 text-[#a78bfa] font-medium"
                  : "text-white/30 hover:text-white/50",
              )}
            >
              <span className="text-[11px]">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0d0a1a]">
          {/* KPI bar */}
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-white/5">
            {[
              {
                label: "Total Leads",
                value: "847",
                delta: "+47",
                color: "text-white",
              },
              {
                label: "Leads Ativos",
                value: "124",
                delta: "+12",
                color: "text-amber-400",
              },
              {
                label: "Leads Ganhos",
                value: "68",
                delta: "+8",
                color: "text-emerald-400",
              },
              {
                label: "Receita",
                value: "R$127k",
                delta: "+23%",
                color: "text-[#a78bfa]",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="bg-white/4 border border-white/5 rounded-lg p-2"
              >
                <p className="text-white/35 text-[8px] mb-0.5">{k.label}</p>
                <p className={cn("font-bold text-[11px]", k.color)}>
                  {k.value}
                </p>
                <p className="text-emerald-400 text-[8px]">
                  ↑ {k.delta} semana
                </p>
              </div>
            ))}
          </div>

          {/* Kanban */}
          <div className="flex gap-2 p-3 flex-1 overflow-x-auto">
            {stages.map((stage) => (
              <div
                key={stage.name}
                className={cn(
                  "shrink-0 w-24 border-t-2 rounded-lg bg-white/3 p-2",
                  stage.color,
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/50 text-[8px] font-medium">
                    {stage.name}
                  </span>
                  <span className="bg-white/10 text-white/50 text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                    {stage.count}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {stage.cards.map((card) => (
                    <div
                      key={card}
                      className="bg-[#1a1530] border border-white/8 rounded-md p-1.5"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-3 h-3 rounded-full bg-[#7C3AED]/60 flex items-center justify-center text-[6px] text-white">
                          {card[0]}
                        </div>
                        <span className="text-white/60 text-[8px] truncate">
                          {card}
                        </span>
                      </div>
                      <div className="h-1 bg-[#7C3AED]/20 rounded-full">
                        <div className="h-1 bg-[#7C3AED]/60 rounded-full w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MacWindow>
  );
}
