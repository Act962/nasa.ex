import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppsSection() {
  const apps = [
    {
      name: "TRACKING",
      tag: "CRM • Multi-pipeline",
      desc: "Pipeline Kanban completo para toda a jornada do cliente, do lead ao fechamento.",
      icon: "⬛",
      installed: true,
    },
    {
      name: "NASACHAT",
      tag: "Atendimento • WhatsApp",
      desc: "WhatsApp organizado com CRM nativo e IA para capturar e nutrir leads automaticamente.",
      icon: "💬",
      installed: true,
    },
    {
      name: "FORGE",
      tag: "Vendas • Multi-gateway",
      desc: "Propostas, contratos e pagamentos em um único lugar. Feche negócios mais rápido.",
      icon: "🔥",
      installed: true,
    },
    {
      name: "SPACETIME",
      tag: "Agenda • CRM integrado",
      desc: "Múltiplos calendários conectados ao seu CRM. Agendamentos que viram leads automaticamente.",
      icon: "📅",
      installed: true,
    },
    {
      name: "COMMENTS",
      tag: "Engajamento • Instagram",
      desc: "Automatize respostas de comentários no Instagram e converta engajamento em vendas.",
      icon: "💬",
      installed: true,
    },
    {
      name: "NERP",
      tag: "Gestão • ERP",
      desc: "ERP integrado com módulo comercial e suporte. Gerencie toda a operação da empresa.",
      icon: "🔲",
      installed: true,
    },
    {
      name: "ASTRO",
      tag: "IA de Vendas",
      desc: "Assistente de IA nativo que guia seu time pelo Método NASA e instala integrações.",
      icon: "✨",
      installed: false,
      soon: true,
    },
    {
      name: "COSMIC",
      tag: "Formulários inteligentes",
      desc: "Formulários com IA que qualificam leads automaticamente e alimentam seu CRM.",
      icon: "🌌",
      installed: false,
      soon: true,
    },
    {
      name: "BOOST",
      tag: "Gamificação de vendas",
      desc: "Ranking, metas e recompensas para o seu time de vendas. Engajamento que gera resultados.",
      icon: "⚡",
      installed: false,
      soon: true,
    },
  ];

  return (
    <section className="py-28 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/3 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <LayoutGrid className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">
              Ecossistema completo
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            Universo de Soluções <span className="text-nasa">N.A.S.A.®</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto">
            Todas as ferramentas que seu time comercial precisa, integradas e
            prontas para usar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <div
              key={app.name}
              className={cn(
                "relative rounded-2xl border p-5 nasa-glass card-hover overflow-hidden group",
                app.installed ? "border-white/10" : "border-white/6 opacity-70",
              )}
            >
              {/* Hover gradient top accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center text-xl shrink-0">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-white font-black text-base tracking-tight">
                      {app.name}
                    </h3>
                    {app.installed ? (
                      <span className="bg-emerald-500/15 text-emerald-400 text-[9px] border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        Disponível
                      </span>
                    ) : (
                      <span className="bg-amber-500/15 text-amber-400 text-[9px] border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-[#a78bfa] text-[10px] font-medium mb-2">
                    {app.tag}
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    {app.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
