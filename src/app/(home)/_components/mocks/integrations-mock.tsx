import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function IntegrationsMock() {
  const apps = [
    { name: "WhatsApp Business", color: "#25D366", installed: true },
    { name: "Instagram DM", color: "#E1306C", installed: true },
    { name: "Telegram", color: "#229ED9", installed: false },
    { name: "Gmail", color: "#EA4335", installed: false },
    { name: "Typeform", color: "#7C3AED", installed: false },
    { name: "Stripe", color: "#635BFF", installed: false },
  ];
  return (
    <MacWindow title="Integrações — Marketplace">
      <div className="p-3 bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {["Todos", "Mensageiros", "Pagamentos"].map((t, i) => (
              <div
                key={t}
                className={cn(
                  "text-[8px] px-2 py-0.5 rounded-full",
                  i === 0
                    ? "bg-[#7C3AED]/30 text-[#a78bfa] border border-[#7C3AED]/40"
                    : "text-white/30 border border-white/10",
                )}
              >
                {t}
              </div>
            ))}
          </div>
          <div className="text-white/30 text-[8px]">54 apps</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {apps.map((app) => (
            <div
              key={app.name}
              className={cn(
                "bg-white/5 border rounded-lg p-2 flex flex-col items-center gap-1 transition-colors",
                app.installed
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-white/8",
              )}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: app.color + "25" }}
              >
                <div
                  className="w-4 h-4 rounded-md"
                  style={{ backgroundColor: app.color }}
                />
              </div>
              <span className="text-white/60 text-[7px] text-center leading-tight">
                {app.name}
              </span>
              {app.installed ? (
                <span className="text-emerald-400 text-[7px] font-medium">
                  ✓ Ativo
                </span>
              ) : (
                <span className="text-[#a78bfa] text-[7px]">+ Instalar</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 bg-[#7C3AED]/8 border border-[#7C3AED]/20 rounded-lg p-2 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center text-[7px] text-white font-bold">
            A
          </div>
          <span className="text-white/40 text-[8px]">
            ASTRO: "Instalar Google Forms para capturar leads..."
          </span>
        </div>
      </div>
    </MacWindow>
  );
}
