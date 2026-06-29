import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grid de módulos NASA, reagrupado por ETAPA DO PROCESSO em 5 grupos
 * (briefing § 3.4). A ordem dos grupos segue o fluxo: chega → avança →
 * fecha → entrega → enxerga.
 *
 * Mantém os cards/ícones/estilo atuais (briefing pediu pra não tocar
 * design). A mudança é estrutural: grupos com cabeçalho e ordem
 * narrativa de processo, em vez de grade plana de "soluções".
 */
type App = {
  name: string;
  tag: string;
  desc: string;
  icon: string;
  installed: boolean;
};

type Group = {
  title: string;
  subtitle: string;
  apps: App[];
};

const GROUPS: Group[] = [
  {
    title: "Quando o cliente chega",
    subtitle: "Captura de primeiro contato, todos os canais juntos",
    apps: [
      {
        name: "FORMULÁRIOS",
        tag: "Captura • Sem código",
        desc: "Formulário que vira contato organizado e dispara o processo seguinte sozinho.",
        icon: "📝",
        installed: true,
      },
      {
        name: "COMMENTS",
        tag: "Engajamento • Instagram",
        desc: "Respostas automáticas em comentários do Instagram, virando contato direto na sua etapa.",
        icon: "💬",
        installed: true,
      },
      {
        name: "LINNKER",
        tag: "Página pública • Bio link",
        desc: "Uma página com todos os seus links e ações, que mede cliques e gera contatos.",
        icon: "🔗",
        installed: true,
      },
      {
        name: "NASACHAT",
        tag: "Atendimento • WhatsApp",
        desc: "WhatsApp organizado, com IA no chat e histórico do contato em qualquer canal.",
        icon: "💭",
        installed: true,
      },
    ],
  },
  {
    title: "Quando o cliente avança",
    subtitle: "Da entrada à decisão, sem perder ninguém pelo caminho",
    apps: [
      {
        name: "TRACKING",
        tag: "Etapas da venda • Multi-quadro",
        desc: "Caminho do cliente em Kanban, com as etapas que sua empresa precisa, do jeito que vocês trabalham.",
        icon: "⬛",
        installed: true,
      },
      {
        name: "AGENDA",
        tag: "Calendário • Público",
        desc: "Calendários conectados ao processo. Toda reunião marcada vira contato organizado.",
        icon: "📅",
        installed: true,
      },
      {
        name: "ASTRO",
        tag: "Inteligência artificial",
        desc: "IA que conhece o histórico do cliente em qualquer etapa e responde pelo seu time quando ninguém pode.",
        icon: "✨",
        installed: true,
      },
    ],
  },
  {
    title: "Quando fecha o negócio",
    subtitle: "Proposta, contrato e cobrança no mesmo lugar",
    apps: [
      {
        name: "FORGE",
        tag: "Propostas • Contratos",
        desc: "Propostas visuais, contratos com assinatura digital e link público de fechamento.",
        icon: "🔥",
        installed: true,
      },
      {
        name: "PAYMENT",
        tag: "Cobrança • Multi-gateway",
        desc: "Geração de cobrança, controle de pagos e baixa automática conforme o processo avança.",
        icon: "💳",
        installed: true,
      },
    ],
  },
  {
    title: "Quando entrega e continua",
    subtitle: "A venda fechou, e o processo segue girando",
    apps: [
      {
        name: "NASA ROUTE",
        tag: "Trilhas • Cursos",
        desc: "Conteúdo, treinamento e comunidade pra continuar a relação depois da venda.",
        icon: "🛰",
        installed: true,
      },
      {
        name: "WORKSPACE",
        tag: "Tarefas • Cross-app",
        desc: "Tarefas que conhecem o cliente, com automações que cruzam setores.",
        icon: "🧩",
        installed: true,
      },
      {
        name: "N-BOX",
        tag: "Arquivos • Entrega",
        desc: "Arquivos pra entregar, vender ou compartilhar, com link público e analytics.",
        icon: "📦",
        installed: true,
      },
    ],
  },
  {
    title: "Pra enxergar tudo",
    subtitle: "O processo inteiro à vista, com o que cada etapa custa",
    apps: [
      {
        name: "INSIGHTS",
        tag: "Painéis • Processo",
        desc: "Onde o processo trava, quem produz, quanto cada etapa custa, em tempo real.",
        icon: "📊",
        installed: true,
      },
      {
        name: "NERP",
        tag: "Operação • ERP",
        desc: "ERP integrado com o comercial e o atendimento. Financeiro e operação na mesma fonte.",
        icon: "🔲",
        installed: true,
      },
    ],
  },
];

export function AppsSection() {
  return (
    <section id="como-funciona" className="py-28 px-4 relative scroll-mt-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/3 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <LayoutGrid className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">
              Uma plataforma, o processo na ordem
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5 leading-tight">
            Uma plataforma. O processo inteiro,{" "}
            <span className="text-nasa">na ordem certa.</span>
          </h2>
          <p className="text-white/55 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Cada ferramenta é um passo do mesmo processo, não um aplicativo
            solto que você liga na mão.
          </p>
        </div>

        {/* Grupos por etapa do processo, ordem narrativa */}
        <div className="space-y-14">
          {GROUPS.map((group, idx) => (
            <div key={group.title}>
              {/* Cabeçalho de grupo, número + título da etapa */}
              <div className="flex items-baseline gap-3 mb-5">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/25 font-mono">
                  Etapa 0{idx + 1}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <div className="mb-6">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {group.title}
                </h3>
                <p className="text-sm text-white/45 mt-1">{group.subtitle}</p>
              </div>

              {/* Cards do grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.apps.map((app) => (
                  <div
                    key={app.name}
                    className={cn(
                      "relative rounded-2xl border p-5 nasa-glass card-hover overflow-hidden group",
                      "border-white/10",
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
                          <h4 className="text-white font-black text-base tracking-tight">
                            {app.name}
                          </h4>
                          <span className="bg-emerald-500/15 text-emerald-400 text-[9px] border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                            Disponível
                          </span>
                        </div>
                        <p className="text-[#a78bfa] text-[10px] font-medium mb-2">
                          {app.tag}
                        </p>
                        <p className="text-white/45 text-xs leading-relaxed">
                          {app.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
