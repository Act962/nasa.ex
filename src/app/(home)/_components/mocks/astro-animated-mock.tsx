"use client";

import { useEffect, useState } from "react";
import { MacWindow } from "./mac-window";

type AstroStep =
  | "idle"
  | "audio"
  | "thinking"
  | "agenda"
  | "proposal_cmd"
  | "thinking2"
  | "proposal";

export function AstroAnimatedMock() {
  const [step, setStep] = useState<AstroStep>("idle");

  useEffect(() => {
    const timeline: Array<{ from: AstroStep; to: AstroStep; delay: number }> = [
      { from: "idle", to: "audio", delay: 1200 },
      { from: "audio", to: "thinking", delay: 1800 },
      { from: "thinking", to: "agenda", delay: 2000 },
      { from: "agenda", to: "proposal_cmd", delay: 2800 },
      { from: "proposal_cmd", to: "thinking2", delay: 1500 },
      { from: "thinking2", to: "proposal", delay: 2200 },
    ];

    let t: ReturnType<typeof setTimeout>;
    let cur = 0;

    function run() {
      const entry = timeline[cur];
      t = setTimeout(() => {
        setStep(entry.to);
        cur++;
        if (cur < timeline.length) {
          run();
        } else {
          // loop: reset after 4 s
          t = setTimeout(() => {
            setStep("idle");
            cur = 0;
            run();
          }, 4000);
        }
      }, entry.delay);
    }

    run();
    return () => clearTimeout(t);
  }, []);

  const show = (s: AstroStep) =>
    step === s ||
    (s === "audio" &&
      [
        "audio",
        "thinking",
        "agenda",
        "proposal_cmd",
        "thinking2",
        "proposal",
      ].includes(step));

  const showThinking = step === "thinking";
  const showThinking2 = step === "thinking2";
  const showAgenda = [
    "agenda",
    "proposal_cmd",
    "thinking2",
    "proposal",
  ].includes(step);
  const showProposalCmd = ["proposal_cmd", "thinking2", "proposal"].includes(
    step,
  );
  const showProposal = step === "proposal";

  return (
    <MacWindow title="ASTRO — Assistente de IA">
      <div
        className="p-3 space-y-2 bg-[#0d0a1a] overflow-hidden"
        style={{ minHeight: 320 }}
      >
        {/* Welcome */}
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
          <p className="text-white/70 text-xs leading-relaxed">
            👋 Olá! Sou o <strong className="text-[#a78bfa]">ASTRO</strong>.
            Como posso ajudar hoje?
          </p>
        </div>

        {/* User: audio message */}
        {show("audio") && (
          <div className="flex justify-end nasa-pop-in">
            <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 flex items-center gap-2">
              <div className="flex items-end gap-[2px] h-4">
                {[1, 2, 3, 4, 5, 3, 2].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-[#a78bfa] wave-bar"
                    style={{
                      height: `${h * 3}px`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-white/50 text-[10px]">0:04</span>
            </div>
          </div>
        )}

        {/* ASTRO thinking 1 */}
        {showThinking && (
          <div className="nasa-pop-in">
            <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-3" />
            </div>
          </div>
        )}

        {/* Agenda created */}
        {showAgenda && (
          <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
            <p className="text-[#a78bfa] text-[10px] font-semibold mb-1.5">
              ✅ Agenda criada com sucesso
            </p>
            <div className="bg-black/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-white/60 text-[10px]">
                  Reunião com João · Amanhã 14h
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                <span className="text-white/60 text-[10px]">
                  Follow-up proposta · Sex 10h
                </span>
              </div>
            </div>
          </div>
        )}

        {/* User: proposal command */}
        {showProposalCmd && (
          <div className="flex justify-end nasa-pop-in">
            <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
              <p className="text-white/60 text-xs">
                Gera uma proposta para o João — R$2.400/mês
              </p>
            </div>
          </div>
        )}

        {/* ASTRO thinking 2 */}
        {showThinking2 && (
          <div className="nasa-pop-in">
            <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-3" />
            </div>
          </div>
        )}

        {/* Proposal created */}
        {showProposal && (
          <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
            <p className="text-[#a78bfa] text-[10px] font-semibold mb-2">
              📄 Proposta gerada — pronta para enviar
            </p>
            <div className="bg-black/30 rounded-lg p-2.5 border border-white/8">
              <p className="text-white/70 text-[10px] font-medium mb-1">
                Proposta Comercial — João Silva
              </p>
              <p className="text-white/40 text-[9px] leading-relaxed">
                Plano NASA Explore · 3 usuários · WhatsApp + CRM + Insights
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-emerald-400 text-[10px] font-bold">
                  R$ 2.400/mês
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Pronta p/ envio
                </span>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {["📤 Enviar por WhatsApp", "📋 Copiar link"].map((l) => (
                <div
                  key={l}
                  className="bg-[#7C3AED]/20 border border-[#7C3AED]/30 rounded-full px-2 py-1 text-[9px] text-[#c4b5fd]"
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MacWindow>
  );
}
