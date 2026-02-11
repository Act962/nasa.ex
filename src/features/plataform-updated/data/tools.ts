export interface Tool {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  color: string; // HSL accent color for each tool
  icon: string; // Emoji or icon letter
}

export const tools: Tool[] = [
  {
    id: "comments",
    name: "COMMENTS",
    description:
      "Automatize respostas nos comentários do Instagram e leve o cliente direto para o atendimento certo. Simples, rápido e sem complicação. Mais barato, mais inteligente e integrado ao resto da operação.",
    keywords: [
      "instagram",
      "comentários",
      "respostas",
      "automação",
      "redes sociais",
      "social media",
    ],
    color: "270 70% 55%",
    icon: "/COMMENTS-ICON.png",
  },
  {
    id: "nerp",
    name: "NERP",
    description:
      "ERP inteligente. Controle financeiro, loja online, sistema de frente de caixa e dados do negócio no mesmo lugar. Tudo integrado ao comercial e ao atendimento.",
    keywords: [
      "erp",
      "financeiro",
      "loja",
      "caixa",
      "controle",
      "financas",
      "gestão",
    ],
    color: "250 60% 55%",
    icon: "/NERP-ICON.png",
  },
  {
    id: "cosmic",
    name: "COSMIC",
    description:
      "Sistema de formulários inteligentes. Cada resposta do cliente vira informação estratégica. O sistema entende o interesse e organiza automaticamente no CRM.",
    keywords: [
      "formulário",
      "formularios",
      "crm",
      "leads",
      "captação",
      "forms",
    ],
    color: "280 65% 50%",
    icon: "/COSMIC-ICON.png",
  },
  {
    id: "nasachat",
    name: "NASACHAT",
    description:
      "O WhatsApp organizado do jeito que ele deveria ser. Possui sistema de conversas interno offline. Atenda clientes sem perder histórico, contexto ou oportunidade. Tudo integrado ao CRM e ao ASTRO IA.",
    keywords: [
      "whatsapp",
      "chat",
      "mensagens",
      "atendimento",
      "conversas",
      "comunicação",
    ],
    color: "260 70% 55%",
    icon: "/NASACHAT-ICON.png",
  },
  {
    id: "spacetime",
    name: "SPACETIME",
    description:
      "Quem controla o tempo, controla a venda. Múltiplas agendas conectadas ao atendimento, CRM e equipe. Nada de cliente esquecido ou horário perdido.",
    keywords: [
      "agenda",
      "agendamento",
      "horário",
      "tempo",
      "calendário",
      "schedule",
    ],
    color: "240 60% 55%",
    icon: "/SPACETIME-ICON.png",
  },
  {
    id: "orbit",
    name: "ORBIT",
    description:
      "Crie propostas inteligentes puxando serviços, produtos e dados do cliente em segundos. Sem retrabalho. Sem improviso.",
    keywords: ["propostas", "orçamento", "vendas", "proposta", "comercial"],
    color: "275 65% 50%",
    icon: "/ORBIT-ICON.png",
  },
  {
    id: "linnker",
    name: "LINNKER",
    description:
      "Links personalizados que não só direcionam, organizam. Cada clique vira dado. Cada acesso vira oportunidade.",
    keywords: ["links", "link", "url", "encurtador", "rastreamento"],
    color: "265 70% 55%",
    icon: "/LINNKER-ICON.png",
  },
  {
    id: "boost",
    name: "BOOST",
    description:
      "Acompanhe resultados, crie ranking e motive o time. Venda vira jogo. E jogo com regra gera resultado.",
    keywords: [
      "gamificação",
      "ranking",
      "motivação",
      "equipe",
      "resultados",
      "performance",
    ],
    color: "285 65% 55%",
    icon: "/BOOST-ICON.png",
  },
  {
    id: "stars",
    name: "STARS",
    description:
      "Cliente lembrado, cliente que volta. Crie programas de pontos direto no atendimento. O cliente acompanha tudo em um painel próprio.",
    keywords: [
      "fidelidade",
      "pontos",
      "programa",
      "cliente",
      "recompensa",
      "loyalty",
    ],
    color: "255 70% 55%",
    icon: "/STARS-ICON.png",
  },
  {
    id: "demand",
    name: "DEMAND",
    description:
      "O painel de controle da sua operação. Organize tarefas, equipe, clientes e treinamentos em um único lugar. Kanban, listas, automações e mensagens integradas.",
    keywords: [
      "kanban",
      "tarefas",
      "gestão",
      "painel",
      "operação",
      "organização",
      "projeto",
    ],
    color: "270 60% 50%",
    icon: "/DEMAND-ICON.png",
  },
  {
    id: "astro",
    name: "ASTRO",
    description:
      "IA treinada para informar, preparar, quebrar objeções e sair de cena. Sem roubar a venda do humano. Sem parecer robô.",
    keywords: [
      "ia",
      "inteligência artificial",
      "ai",
      "bot",
      "automação",
      "artificial",
    ],
    color: "280 75% 60%",
    icon: "/ASTRO-ICON.png",
  },
  {
    id: "task",
    name: "TASK",
    description:
      "Centralize pedidos, tarefas e chamados. Cliente acompanha. Equipe executa.",
    keywords: ["tarefas", "pedidos", "chamados", "tickets", "suporte"],
    color: "250 65% 55%",
    icon: "/TASK-ICON.png",
  },
  {
    id: "tracking",
    name: "TRACKING",
    description:
      "A rota completa do cliente, do primeiro contato à venda. Organize atendimentos, vendas, projetos e setores em múltiplos CRMs conectados. Rastreie de onde o cliente veio, o que quer e quando agir.",
    keywords: [
      "rastreamento",
      "tracking",
      "funil",
      "vendas",
      "pipeline",
      "crm",
    ],
    color: "260 65% 55%",
    icon: "/TRACKING-ICON.png",
  },
];

export function searchTools(query: string): Tool[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return tools.filter((tool) => {
    const nameMatch = tool.name.toLowerCase().includes(q);
    const descMatch = tool.description.toLowerCase().includes(q);
    const keyMatch = tool.keywords.some((k) => k.includes(q));
    return nameMatch || descMatch || keyMatch;
  });
}
