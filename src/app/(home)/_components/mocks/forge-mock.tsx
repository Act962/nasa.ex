import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function ForgeMock() {
  return (
    <MacWindow title="FORGE — Proposta #0047 • Tech Corp">
      <div className="bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {["📊 Painel", "📦 Produtos", "📄 Propostas", "📋 Contratos"].map(
            (t, i) => (
              <div
                key={t}
                className={cn(
                  "text-[8px] px-3 py-2 cursor-pointer border-b-2 transition-colors",
                  i === 2
                    ? "border-[#7C3AED] text-[#a78bfa]"
                    : "border-transparent text-white/30",
                )}
              >
                {t}
              </div>
            ),
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[9px] font-semibold">
                João Silva — Tech Corp
              </p>
              <p className="text-white/30 text-[8px]">Criada em 28 Mar 2026</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-500/15 text-amber-400 text-[8px] border border-amber-500/25 px-2 py-0.5 rounded-full">
                Aguardando
              </span>
            </div>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-lg p-2 space-y-1">
            {[
              { desc: "Plano Enterprise Anual", value: "R$ 2.400/mês" },
              { desc: "Onboarding Dedicado", value: "R$ 800" },
              { desc: "Módulo FORGE PRO", value: "R$ 300/mês" },
            ].map((item) => (
              <div
                key={item.desc}
                className="flex justify-between items-center"
              >
                <span className="text-white/40 text-[8px]">{item.desc}</span>
                <span className="text-white/70 text-[8px] font-medium">
                  {item.value}
                </span>
              </div>
            ))}
            <div className="border-t border-white/8 pt-1 flex justify-between">
              <span className="text-white text-[9px] font-bold">
                Total Mensal
              </span>
              <span className="text-[#a78bfa] text-[9px] font-black">
                R$ 3.500
              </span>
            </div>
          </div>
          {/* Progress steps */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Proposta", status: "✓ Enviada", done: true },
              { label: "Contrato", status: "⏳ Pendente", done: false },
              { label: "Pagamento", status: "⏳ Pendente", done: false },
            ].map((step) => (
              <div
                key={step.label}
                className={cn(
                  "rounded-md p-1.5 text-center border",
                  step.done
                    ? "bg-[#7C3AED]/15 border-[#7C3AED]/25"
                    : "bg-white/3 border-white/8",
                )}
              >
                <p
                  className={cn(
                    "text-[7px]",
                    step.done ? "text-[#a78bfa]" : "text-white/30",
                  )}
                >
                  {step.label}
                </p>
                <p
                  className={cn(
                    "text-[7px] mt-0.5",
                    step.done ? "text-white/60" : "text-white/20",
                  )}
                >
                  {step.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MacWindow>
  );
}
