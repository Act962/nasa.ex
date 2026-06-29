import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MacWindow } from "./mac-window";

export function ChatMock() {
  return (
    <MacWindow title="Chat, João Silva • WhatsApp Business">
      <div className="flex" style={{ height: 200 }}>
        {/* Sidebar list */}
        <div className="w-28 border-r border-white/8 bg-[#080613] overflow-hidden">
          {[
            {
              name: "João Silva",
              msg: "Quero saber mais...",
              time: "14:32",
              unread: 2,
              active: true,
            },
            {
              name: "Ana Costa",
              msg: "Perfeito! Quando...",
              time: "13:15",
              unread: 0,
              active: false,
            },
            {
              name: "Tech Corp",
              msg: "Pode enviar a...",
              time: "12:00",
              unread: 1,
              active: false,
            },
          ].map((conv) => (
            <div
              key={conv.name}
              className={cn(
                "flex items-start gap-1.5 p-2 border-b border-white/5 cursor-pointer",
                conv.active && "bg-[#7C3AED]/10",
              )}
            >
              <div className="w-5 h-5 rounded-full bg-[#7C3AED]/50 flex items-center justify-center text-[8px] text-white shrink-0">
                {conv.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[8px] font-medium truncate">
                    {conv.name}
                  </span>
                  <span className="text-white/30 text-[7px] shrink-0">
                    {conv.time}
                  </span>
                </div>
                <p className="text-white/30 text-[7px] truncate">{conv.msg}</p>
              </div>
              {conv.unread > 0 && (
                <div className="w-3.5 h-3.5 rounded-full bg-[#7C3AED] flex items-center justify-center text-[7px] text-white shrink-0">
                  {conv.unread}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-[#0d0a1a]">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/8 bg-[#110d20]">
            <div className="w-5 h-5 rounded-full bg-[#7C3AED]/50 flex items-center justify-center text-[8px] text-white">
              J
            </div>
            <div>
              <p className="text-white/80 text-[9px] font-medium">João Silva</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-400 text-[7px]">Online</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-[#7C3AED]/15 border border-[#7C3AED]/25 rounded-full px-1.5 py-0.5">
              <span className="text-[#a78bfa] text-[7px]">🤖 ASTRO ativo</span>
            </div>
          </div>
          <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
            <div className="flex gap-1 items-end">
              <div className="w-4 h-4 rounded-full bg-[#7C3AED]/40 flex items-center justify-center text-[6px] text-white shrink-0">
                J
              </div>
              <div className="bg-white/8 rounded-xl rounded-bl-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/70 text-[8px]">
                  Olá! Quero saber sobre o plano Enterprise 🚀
                </p>
              </div>
            </div>
            <div className="flex gap-1 items-end justify-end">
              <div className="bg-[#7C3AED]/25 border border-[#7C3AED]/30 rounded-xl rounded-br-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/80 text-[8px]">
                  Olá João! Nosso plano Enterprise inclui todos os módulos do
                  ecossistema NASA...
                </p>
              </div>
              <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center text-[6px] text-white shrink-0">
                N
              </div>
            </div>
            <div className="flex gap-1 items-end">
              <div className="w-4 h-4 rounded-full bg-[#7C3AED]/40 flex items-center justify-center text-[6px] text-white shrink-0">
                J
              </div>
              <div className="bg-white/8 rounded-xl rounded-bl-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/70 text-[8px]">
                  Quando podemos agendar uma demo?
                </p>
              </div>
            </div>
          </div>
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5">
              <span className="text-white/20 text-[8px] flex-1">
                Digite uma mensagem...
              </span>
              <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center">
                <ArrowRight className="size-2 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}
