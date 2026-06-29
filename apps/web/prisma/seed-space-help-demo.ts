/**
 * Seed de DEMONSTRAÇÃO — NASA Space Help
 *
 * Popula categorias, funcionalidades, passos, trilhas educacionais (Academy)
 * e selos de conquista (Expert NASA, Comercial Master, Atendimento Pro).
 *
 * Rode com:  npx tsx prisma/seed-space-help-demo.ts
 *
 * 100% idempotente — usa upsert por slug.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// ─── Categorias (espelham apps NASA) ─────────────────────────────────────
const CATEGORIES = [
  {
    slug: "tracking",
    name: "Tracking de Leads",
    description: "Pipeline visual de vendas com Kanban, status e responsáveis.",
    iconKey: "tracking",
    appId: "tracking",
    order: 0,
  },
  {
    slug: "forge",
    name: "Forge — Propostas e Contratos",
    description: "Crie propostas, contratos e templates comerciais.",
    iconKey: "forge",
    appId: "forge",
    order: 1,
  },
  {
    slug: "cosmic",
    name: "Cosmic — Formulários",
    description: "Formulários inteligentes que viram leads no CRM.",
    iconKey: "cosmic",
    appId: "cosmic",
    order: 2,
  },
  {
    slug: "nasachat",
    name: "NasaChat — WhatsApp",
    description: "Atendimento integrado com WhatsApp Business.",
    iconKey: "nasachat",
    appId: "nasachat",
    order: 3,
  },
  {
    slug: "spacetime",
    name: "Spacetime — Agenda",
    description: "Agenda compartilhada e agendamentos com clientes.",
    iconKey: "spacetime",
    appId: "spacetime",
    order: 4,
  },
  {
    slug: "payment",
    name: "Payment — Hub Financeiro",
    description: "Controle financeiro completo: contas, conciliação e relatórios.",
    iconKey: "payment",
    appId: "payment",
    order: 5,
  },
  {
    slug: "workspace",
    name: "Workspace — Projetos & Clientes",
    description: "Gerencie projetos, clientes, favoritos e calendário do seu workspace.",
    iconKey: "workspace",
    appId: "workspace",
    order: 6,
  },
  {
    slug: "contatos",
    name: "Contatos",
    description: "Base centralizada de leads, clientes e parceiros.",
    iconKey: "contacts",
    appId: "contacts",
    order: 7,
  },
  {
    slug: "insights",
    name: "Insights — Métricas",
    description: "Dashboards, métricas comerciais e relatórios da operação.",
    iconKey: "insights",
    appId: "insights",
    order: 8,
  },
  {
    slug: "integrations",
    name: "Integrações",
    description: "Conecte WhatsApp, Instagram, Meta Ads, Google e outras ferramentas.",
    iconKey: "integrations",
    appId: "integrations",
    order: 9,
  },
  {
    slug: "nbox",
    name: "N-Box — Inbox Universal",
    description: "Caixa unificada para leads, formulários e mensagens recebidas.",
    iconKey: "nbox",
    appId: "nbox",
    order: 10,
  },
  {
    slug: "linnker",
    name: "Linker — Link na Bio",
    description: "Página de link na bio com botões, links e rastreamento.",
    iconKey: "linnker",
    appId: "linnker",
    order: 11,
  },
  {
    slug: "space-point",
    name: "Space Point — Gamificação",
    description: "Sistema de pontos, missões diárias e níveis para sua equipe.",
    iconKey: "space-point",
    appId: "space-point",
    order: 12,
  },
  {
    slug: "stars",
    name: "STARs — Moeda Virtual",
    description: "Compre, transfira e gaste STARs em recompensas e benefícios.",
    iconKey: "stars",
    appId: "stars",
    order: 13,
  },
  {
    slug: "apps",
    name: "Apps & Marketplace",
    description: "Instale apps adicionais e descubra integrações no marketplace.",
    iconKey: "apps",
    appId: "apps",
    order: 14,
  },
  {
    slug: "settings",
    name: "Configurações",
    description: "Configurações da empresa, equipe, segurança e plano.",
    iconKey: "settings",
    appId: "settings",
    order: 15,
  },
  {
    slug: "notifications",
    name: "Notificações",
    description: "Central de notificações: leads, mensagens, lembretes e eventos.",
    iconKey: "notifications",
    appId: "notifications",
    order: 16,
  },
  {
    slug: "shortcuts",
    name: "Atalhos",
    description: "Atalhos de teclado e comandos rápidos para acelerar o uso.",
    iconKey: "shortcuts",
    appId: "shortcuts",
    order: 17,
  },
];

// ─── Funcionalidades por categoria ───────────────────────────────────────
const FEATURES: Array<{
  categorySlug: string;
  slug: string;
  title: string;
  summary: string;
  youtubeUrl?: string;
  steps: Array<{
    title: string;
    description: string;
    screenshotUrl?: string;
    annotations?: Array<{ x: number; y: number; angle: number; label: string }>;
  }>;
}> = [
  {
    categorySlug: "tracking",
    slug: "criar-novo-tracking",
    title: "Criar um novo Tracking",
    summary: "Como criar um pipeline de vendas do zero.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Abra o menu Tracking",
        description: "Na sidebar esquerda, clique em 'Tracking' para acessar a lista de pipelines da sua organização.",
        annotations: [{ x: 0.05, y: 0.3, angle: 0, label: "Clique aqui" }],
      },
      {
        title: "Clique em 'Novo Tracking'",
        description: "No canto superior direito da tela, clique no botão '+ Novo Tracking' para abrir o modal de criação.",
        annotations: [{ x: 0.92, y: 0.08, angle: 180, label: "Botão de criar" }],
      },
      {
        title: "Preencha nome e configurações",
        description: "Dê um nome ao Tracking, escolha as colunas iniciais e os responsáveis. Você pode editar tudo depois.",
      },
    ],
  },
  {
    categorySlug: "tracking",
    slug: "mover-leads-pelo-kanban",
    title: "Mover leads pelo Kanban",
    summary: "Arraste e solte leads entre colunas de status.",
    steps: [
      {
        title: "Localize o lead",
        description: "No board do Tracking, encontre o card do lead que deseja mover.",
        annotations: [{ x: 0.2, y: 0.5, angle: 270, label: "Card do lead" }],
      },
      {
        title: "Arraste para a nova coluna",
        description: "Clique e segure no card, depois arraste até a coluna de destino e solte.",
      },
    ],
  },
  {
    categorySlug: "tracking",
    slug: "configurar-status-personalizados",
    title: "Configurar status personalizados",
    summary: "Crie e edite status (colunas) do seu pipeline.",
    steps: [
      {
        title: "Abra configurações do Tracking",
        description: "Dentro do Tracking, clique no ícone de engrenagem no header.",
        annotations: [{ x: 0.95, y: 0.1, angle: 180, label: "Engrenagem" }],
      },
      {
        title: "Adicione ou edite status",
        description: "Na aba 'Status', clique em '+ Novo Status' ou edite os existentes alterando nome e cor.",
      },
    ],
  },
  {
    categorySlug: "forge",
    slug: "criar-proposta",
    title: "Criar uma proposta",
    summary: "Monte uma proposta comercial em minutos.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Acesse Forge no menu",
        description: "Clique em 'Forge' na sidebar para abrir o módulo comercial.",
        annotations: [{ x: 0.05, y: 0.4, angle: 0, label: "Forge" }],
      },
      {
        title: "Selecione 'Propostas'",
        description: "Na aba superior, escolha 'Propostas' e clique em '+ Nova Proposta'.",
      },
      {
        title: "Preencha dados do cliente e produtos",
        description: "Adicione cliente, produtos e valores. O total é calculado automaticamente.",
      },
    ],
  },
  {
    categorySlug: "forge",
    slug: "templates-de-contrato",
    title: "Usar templates de contrato",
    summary: "Reuse contratos modelo para acelerar fechamentos.",
    steps: [
      {
        title: "Vá em 'Templates'",
        description: "Dentro do Forge, acesse a aba 'Templates' para ver os modelos cadastrados.",
      },
      {
        title: "Clique em 'Usar este template'",
        description: "Em cima do template desejado, clique no botão para gerar um novo contrato preenchido.",
        annotations: [{ x: 0.7, y: 0.6, angle: 90, label: "Usar" }],
      },
    ],
  },
  {
    categorySlug: "cosmic",
    slug: "criar-formulario",
    title: "Criar um formulário",
    summary: "Monte formulários com campos personalizados.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Abra Cosmic na sidebar",
        description: "Acesse o módulo Cosmic clicando no item da sidebar.",
        annotations: [{ x: 0.05, y: 0.45, angle: 0, label: "Cosmic" }],
      },
      {
        title: "Clique em '+ Novo Formulário'",
        description: "No topo da tela, clique para criar um formulário do zero.",
      },
      {
        title: "Adicione campos via drag & drop",
        description: "Arraste tipos de campos (texto, e-mail, telefone, etc.) da paleta lateral para o formulário.",
      },
    ],
  },
  {
    categorySlug: "cosmic",
    slug: "publicar-formulario",
    title: "Publicar e compartilhar",
    summary: "Gere link público e/ou embed para seu site.",
    steps: [
      {
        title: "Abra 'Publicar'",
        description: "Dentro do formulário, clique em 'Publicar' no canto superior direito.",
        annotations: [{ x: 0.9, y: 0.08, angle: 180, label: "Publicar" }],
      },
      {
        title: "Copie o link ou snippet",
        description: "Use o link público para compartilhar no WhatsApp/Instagram, ou copie o embed para colar no seu site.",
      },
    ],
  },
  {
    categorySlug: "nasachat",
    slug: "conectar-whatsapp",
    title: "Conectar WhatsApp",
    summary: "Conecte sua conta do WhatsApp Business à plataforma.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Acesse 'Integrações'",
        description: "No menu, vá em Integrações e selecione WhatsApp Business.",
      },
      {
        title: "Escaneie o QR Code",
        description: "Abra o WhatsApp no celular > Aparelhos conectados > Conectar dispositivo > escaneie o QR.",
        annotations: [{ x: 0.5, y: 0.5, angle: 0, label: "QR Code" }],
      },
    ],
  },
  {
    categorySlug: "nasachat",
    slug: "atender-conversa",
    title: "Atender uma conversa",
    summary: "Responda mensagens e converta em lead.",
    steps: [
      {
        title: "Selecione a conversa",
        description: "Na lista lateral, clique em qualquer conversa para abri-la no painel principal.",
      },
      {
        title: "Use respostas rápidas",
        description: "Aperte '/' no campo de mensagem para abrir o menu de respostas pré-cadastradas.",
        annotations: [{ x: 0.5, y: 0.85, angle: 270, label: "Comando /" }],
      },
    ],
  },
  {
    categorySlug: "spacetime",
    slug: "criar-agenda",
    title: "Criar uma agenda",
    summary: "Configure horários disponíveis para agendamentos.",
    steps: [
      {
        title: "Vá em 'Spacetime'",
        description: "Clique em Spacetime na sidebar para abrir o gerenciador de agendas.",
      },
      {
        title: "Defina horários e duração",
        description: "Configure dias da semana, horário de início/fim e duração padrão de cada slot.",
      },
    ],
  },
  {
    categorySlug: "spacetime",
    slug: "compartilhar-link-agendamento",
    title: "Compartilhar link de agendamento",
    summary: "Gere um link público para clientes marcarem com você.",
    steps: [
      {
        title: "Copie o link da agenda",
        description: "Cada agenda tem um link único. Clique no ícone de copiar ao lado do nome.",
        annotations: [{ x: 0.85, y: 0.3, angle: 180, label: "Copiar link" }],
      },
      {
        title: "Cole onde quiser",
        description: "Use no Instagram, e-mail, WhatsApp ou em qualquer lugar.",
      },
    ],
  },
  {
    categorySlug: "payment",
    slug: "registrar-entrada",
    title: "Registrar uma entrada",
    summary: "Adicione recebimentos ao financeiro.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Acesse Payment",
        description: "Clique em Payment na sidebar para abrir o hub financeiro.",
      },
      {
        title: "Clique em '+ Nova entrada'",
        description: "Preencha valor, data, categoria e cliente (opcional).",
        annotations: [{ x: 0.92, y: 0.1, angle: 180, label: "Nova entrada" }],
      },
    ],
  },
  {
    categorySlug: "payment",
    slug: "conciliar-extrato",
    title: "Conciliar extrato bancário",
    summary: "Importe extrato OFX e concilie com lançamentos.",
    steps: [
      {
        title: "Importe o arquivo OFX",
        description: "Em Payment > Conciliação, clique em 'Importar OFX' e selecione o arquivo do seu banco.",
      },
      {
        title: "Vincule lançamentos",
        description: "Para cada linha do extrato, escolha o lançamento correspondente ou crie um novo.",
      },
    ],
  },

  // ─── Tracking — features adicionais de onboarding crítico ──────────────
  {
    categorySlug: "tracking",
    slug: "criar-primeira-tag",
    title: "🎯 Criar sua primeira Tag",
    summary: "Tags organizam leads por origem, interesse ou prioridade. Passo crítico do onboarding.",
    steps: [
      {
        title: "Abra um Tracking existente",
        description: "Selecione um Tracking na sidebar para abrir o board. Se ainda não tiver, crie um primeiro.",
        screenshotUrl: "/space-help/screenshots/tracking-tag/01-abrir-tracking.png",
        annotations: [{ x: 0.08, y: 0.35, angle: 0, label: "Sidebar Tracking" }],
      },
      {
        title: "Acesse 'Configurações' do Tracking",
        description: "No header do board, clique no ícone de engrenagem para abrir as configurações.",
        screenshotUrl: "/space-help/screenshots/tracking-tag/02-engrenagem.png",
        annotations: [{ x: 0.95, y: 0.1, angle: 180, label: "Engrenagem" }],
      },
      {
        title: "Aba 'Tags' → '+ Nova Tag'",
        description: "Clique na aba Tags e em '+ Nova Tag'. Defina nome (ex: 'Hot Lead'), cor e ícone opcional.",
        screenshotUrl: "/space-help/screenshots/tracking-tag/03-nova-tag.png",
        annotations: [{ x: 0.85, y: 0.2, angle: 180, label: "+ Nova Tag" }],
      },
      {
        title: "Aplique a Tag em um lead",
        description: "Volte ao board, abra um card de lead e selecione a tag recém-criada no campo 'Tags'.",
        screenshotUrl: "/space-help/screenshots/tracking-tag/04-aplicar.png",
      },
    ],
  },
  {
    categorySlug: "tracking",
    slug: "atribuir-responsaveis",
    title: "Atribuir responsáveis a um lead",
    summary: "Designe um agente para cada lead e acompanhe a carteira individualmente.",
    steps: [
      {
        title: "Abra o card do lead",
        description: "No board, clique no card que deseja atribuir. O painel lateral abre com todos os campos.",
      },
      {
        title: "Campo 'Responsável'",
        description: "Selecione o membro da equipe. Ele recebe notificação automática.",
        annotations: [{ x: 0.7, y: 0.3, angle: 270, label: "Responsável" }],
      },
    ],
  },
  {
    categorySlug: "tracking",
    slug: "criar-status-personalizados",
    title: "Adicionar status (colunas) novos",
    summary: "Personalize o pipeline com etapas que fazem sentido pro seu funil.",
    steps: [
      {
        title: "Abra Configurações do Tracking",
        description: "Clique na engrenagem no header do Tracking.",
      },
      {
        title: "Aba 'Status' → '+ Novo Status'",
        description: "Adicione nome (ex: 'Qualificação'), cor de identificação e posição no Kanban.",
        annotations: [{ x: 0.85, y: 0.25, angle: 180, label: "+ Novo Status" }],
      },
    ],
  },
  {
    categorySlug: "tracking",
    slug: "filtros-do-tracking",
    title: "Filtrar leads no board",
    summary: "Combine filtros por tag, responsável, valor e data para encontrar rapidamente.",
    steps: [
      {
        title: "Botão 'Filtros' no topo",
        description: "Clique em 'Filtros' acima do Kanban para abrir o painel.",
        annotations: [{ x: 0.4, y: 0.12, angle: 270, label: "Filtros" }],
      },
      {
        title: "Combine critérios",
        description: "Adicione múltiplos filtros: tags, responsáveis, valor mínimo, criado nos últimos X dias.",
      },
    ],
  },

  // ─── Forge — features adicionais ──────────────────────────────────────
  {
    categorySlug: "forge",
    slug: "cadastrar-primeiro-produto",
    title: "🛒 Cadastrar seu primeiro produto",
    summary: "Produtos cadastrados aparecem ao montar propostas. Passo crítico do onboarding.",
    steps: [
      {
        title: "Acesse Forge → Produtos",
        description: "No menu lateral do Forge, clique em 'Produtos & Serviços'.",
        screenshotUrl: "/space-help/screenshots/forge-product/01-menu-produtos.png",
        annotations: [{ x: 0.1, y: 0.4, angle: 0, label: "Produtos" }],
      },
      {
        title: "Botão '+ Novo Produto'",
        description: "Clique no canto superior direito para abrir o formulário.",
        screenshotUrl: "/space-help/screenshots/forge-product/02-novo-produto.png",
        annotations: [{ x: 0.92, y: 0.1, angle: 180, label: "+ Novo Produto" }],
      },
      {
        title: "Preencha nome, valor e descrição",
        description: "Defina nome do item, valor unitário, descrição e categoria. Salve.",
        screenshotUrl: "/space-help/screenshots/forge-product/03-formulario.png",
      },
      {
        title: "Use em uma proposta",
        description: "Ao montar uma proposta, busque o produto cadastrado pelo nome — ele aparece no autocomplete.",
        screenshotUrl: "/space-help/screenshots/forge-product/04-usar-proposta.png",
      },
    ],
  },
  {
    categorySlug: "forge",
    slug: "assinatura-eletronica",
    title: "Assinatura eletrônica de contratos",
    summary: "Envie contratos para assinatura digital e acompanhe status em tempo real.",
    steps: [
      {
        title: "Abra um contrato finalizado",
        description: "No Forge, abra qualquer contrato pronto na lista.",
      },
      {
        title: "Botão 'Enviar para assinatura'",
        description: "Adicione e-mails dos signatários. Cada um recebe link único para assinar.",
        annotations: [{ x: 0.85, y: 0.15, angle: 180, label: "Enviar" }],
      },
    ],
  },

  // ─── Workspace ────────────────────────────────────────────────────────
  {
    categorySlug: "workspace",
    slug: "configurar-workspace",
    title: "🚀 Configurar seu Workspace",
    summary: "Workspace é onde você organiza projetos, clientes e o calendário do time. Passo crítico do onboarding.",
    steps: [
      {
        title: "Acesse Workspace na sidebar",
        description: "Clique em 'Workspace' no menu lateral. Você verá Projetos, Clientes, Favoritos e Calendário.",
        screenshotUrl: "/space-help/screenshots/workspace-setup/01-menu.png",
        annotations: [{ x: 0.06, y: 0.5, angle: 0, label: "Workspace" }],
      },
      {
        title: "Crie seu primeiro Projeto",
        description: "Em 'Projetos', clique em '+ Novo Projeto'. Defina nome, cliente vinculado e prazo.",
        screenshotUrl: "/space-help/screenshots/workspace-setup/02-novo-projeto.png",
        annotations: [{ x: 0.92, y: 0.1, angle: 180, label: "+ Novo Projeto" }],
      },
      {
        title: "Adicione um Cliente",
        description: "Em 'Clientes', cadastre seus clientes principais. Eles ficam disponíveis para vincular em projetos e propostas.",
        screenshotUrl: "/space-help/screenshots/workspace-setup/03-cliente.png",
      },
      {
        title: "Marque favoritos",
        description: "Use a estrela em projetos e clientes recorrentes para ter acesso rápido em 'Favoritos'.",
        screenshotUrl: "/space-help/screenshots/workspace-setup/04-favoritos.png",
        annotations: [{ x: 0.5, y: 0.4, angle: 270, label: "Estrela = favorito" }],
      },
    ],
  },
  {
    categorySlug: "workspace",
    slug: "calendario-workspace",
    title: "Calendário do Workspace",
    summary: "Visualize todos os eventos, prazos e agendamentos do time em um só lugar.",
    steps: [
      {
        title: "Aba 'Calendário'",
        description: "Dentro do Workspace, clique na aba Calendário.",
      },
      {
        title: "Crie um evento",
        description: "Clique em qualquer slot do calendário ou no botão '+ Evento'. Vincule a um projeto/cliente se quiser.",
        annotations: [{ x: 0.9, y: 0.12, angle: 180, label: "+ Evento" }],
      },
    ],
  },
  {
    categorySlug: "workspace",
    slug: "favoritos-workspace",
    title: "Favoritos: acesso rápido",
    summary: "Tenha clientes e projetos prioritários sempre à mão.",
    steps: [
      {
        title: "Marque com a estrela",
        description: "Em qualquer card de projeto ou cliente, clique no ícone de estrela.",
      },
      {
        title: "Acesse pela aba Favoritos",
        description: "A aba Favoritos lista todos os itens marcados, ordenados por uso recente.",
      },
    ],
  },

  // ─── Contatos ────────────────────────────────────────────────────────
  {
    categorySlug: "contatos",
    slug: "adicionar-contato",
    title: "Adicionar um contato",
    summary: "Cadastre leads, clientes e parceiros em um só lugar.",
    steps: [
      {
        title: "Abra Contatos na sidebar",
        description: "Clique em 'Contatos' no menu lateral.",
        annotations: [{ x: 0.06, y: 0.55, angle: 0, label: "Contatos" }],
      },
      {
        title: "Botão '+ Novo Contato'",
        description: "Preencha nome, e-mail, WhatsApp e tipo (lead, cliente, parceiro).",
        annotations: [{ x: 0.92, y: 0.1, angle: 180, label: "+ Novo" }],
      },
    ],
  },
  {
    categorySlug: "contatos",
    slug: "importar-contatos",
    title: "Importar contatos via CSV",
    summary: "Suba uma planilha e importe centenas de contatos de uma vez.",
    steps: [
      {
        title: "Botão 'Importar'",
        description: "No topo da lista de contatos, clique em 'Importar'.",
        annotations: [{ x: 0.78, y: 0.1, angle: 180, label: "Importar" }],
      },
      {
        title: "Mapeie colunas",
        description: "Faça upload do CSV e mapeie colunas (nome, e-mail, telefone) para os campos do NASA.",
      },
    ],
  },
  {
    categorySlug: "contatos",
    slug: "segmentar-contatos",
    title: "Segmentar com tags",
    summary: "Use tags para criar segmentos como 'Cliente VIP', 'Lead frio' ou 'Setor X'.",
    steps: [
      {
        title: "Selecione contatos em massa",
        description: "Use o checkbox no topo da lista para selecionar todos visíveis.",
      },
      {
        title: "Aplique tag em massa",
        description: "Clique em 'Aplicar tag' e escolha a tag desejada para todos os selecionados.",
      },
    ],
  },

  // ─── Insights ────────────────────────────────────────────────────────
  {
    categorySlug: "insights",
    slug: "dashboard-comercial",
    title: "Dashboard Comercial",
    summary: "Visão geral de pipeline, conversão, ticket médio e ranking de vendedores.",
    steps: [
      {
        title: "Acesse Insights na sidebar",
        description: "Clique em 'Insights' para abrir o dashboard.",
        annotations: [{ x: 0.06, y: 0.6, angle: 0, label: "Insights" }],
      },
      {
        title: "Aba 'Comercial'",
        description: "Veja gráficos de leads por etapa, taxa de conversão e ticket médio do período.",
      },
      {
        title: "Filtre por período",
        description: "Use o seletor no topo direito para alternar entre 7d, 30d, 90d ou período customizado.",
        annotations: [{ x: 0.9, y: 0.1, angle: 180, label: "Período" }],
      },
    ],
  },
  {
    categorySlug: "insights",
    slug: "metricas-atendimento",
    title: "Métricas de Atendimento",
    summary: "Tempo de resposta, volume de mensagens e CSAT do NasaChat.",
    steps: [
      {
        title: "Aba 'Atendimento'",
        description: "Em Insights, clique na aba Atendimento.",
      },
      {
        title: "Compare agentes",
        description: "Tabela ranqueia agentes por tempo médio de resposta, volume e satisfação.",
      },
    ],
  },
  {
    categorySlug: "insights",
    slug: "exportar-relatorio",
    title: "Exportar relatório PDF/CSV",
    summary: "Gere relatórios para diretoria ou auditoria.",
    steps: [
      {
        title: "Botão 'Exportar'",
        description: "Em qualquer dashboard, clique em 'Exportar' no canto superior direito.",
        annotations: [{ x: 0.92, y: 0.12, angle: 180, label: "Exportar" }],
      },
      {
        title: "Escolha formato",
        description: "Selecione PDF para apresentação ou CSV para análise em Excel/Sheets.",
      },
    ],
  },

  // ─── Integrações ─────────────────────────────────────────────────────
  {
    categorySlug: "integrations",
    slug: "conectar-instancia-whatsapp",
    title: "📱 Conectar Instância WhatsApp",
    summary: "PASSO 1 DO ONBOARDING. Conecte seu número WhatsApp para receber mensagens dentro do NASA.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Acesse Integrações na sidebar",
        description: "Clique em 'Integrações' no menu lateral.",
        screenshotUrl: "/space-help/screenshots/whatsapp/01-menu-integracoes.png",
        annotations: [{ x: 0.06, y: 0.65, angle: 0, label: "Integrações" }],
      },
      {
        title: "Card 'WhatsApp Business'",
        description: "Localize o card do WhatsApp Business e clique em 'Conectar'.",
        screenshotUrl: "/space-help/screenshots/whatsapp/02-card-whatsapp.png",
        annotations: [{ x: 0.4, y: 0.4, angle: 270, label: "Conectar" }],
      },
      {
        title: "Crie uma instância",
        description: "Dê um nome à instância (ex: 'Vendas Principal') e clique em 'Gerar QR Code'.",
        screenshotUrl: "/space-help/screenshots/whatsapp/03-criar-instancia.png",
        annotations: [{ x: 0.5, y: 0.5, angle: 0, label: "Gerar QR" }],
      },
      {
        title: "Escaneie o QR Code",
        description: "No celular: WhatsApp > Configurações > Aparelhos conectados > Conectar dispositivo > escaneie o QR exibido na tela.",
        screenshotUrl: "/space-help/screenshots/whatsapp/04-qr-code.png",
        annotations: [{ x: 0.5, y: 0.5, angle: 0, label: "QR Code" }],
      },
      {
        title: "Pronto! Mensagens chegam no NasaChat",
        description: "Sua instância aparece como 'Conectada'. Todas as mensagens recebidas viram conversas no NasaChat.",
        screenshotUrl: "/space-help/screenshots/whatsapp/05-conectado.png",
        annotations: [{ x: 0.4, y: 0.5, angle: 270, label: "Conectada" }],
      },
    ],
  },
  {
    categorySlug: "integrations",
    slug: "integrar-instagram",
    title: "Integrar Instagram Direct",
    summary: "Receba DMs do Instagram dentro do NasaChat.",
    steps: [
      {
        title: "Card 'Instagram'",
        description: "Em Integrações, localize o card do Instagram.",
      },
      {
        title: "Autorize via Meta",
        description: "Faça login na sua conta business do Meta e autorize o NASA.",
      },
    ],
  },
  {
    categorySlug: "integrations",
    slug: "integrar-meta-ads",
    title: "Conectar Meta Ads (Lead Ads)",
    summary: "Leads capturados em campanhas Meta entram direto no Tracking.",
    steps: [
      {
        title: "Card 'Meta Ads'",
        description: "Clique em conectar no card do Meta Ads.",
      },
      {
        title: "Selecione Tracking de destino",
        description: "Escolha em qual Tracking os leads chegam e o status inicial.",
      },
    ],
  },
  {
    categorySlug: "integrations",
    slug: "webhooks-customizados",
    title: "Webhooks customizados",
    summary: "Receba dados de qualquer ferramenta externa via webhook.",
    steps: [
      {
        title: "Aba 'Webhooks'",
        description: "Em Integrações, clique na aba Webhooks.",
      },
      {
        title: "Copie a URL única",
        description: "Configure a URL gerada na ferramenta de origem (Zapier, Make, etc).",
      },
    ],
  },

  // ─── N-Box ───────────────────────────────────────────────────────────
  {
    categorySlug: "nbox",
    slug: "como-funciona-nbox",
    title: "Como funciona o N-Box",
    summary: "Inbox unificado para leads vindos de formulários, mensagens e integrações.",
    steps: [
      {
        title: "Acesse N-Box na sidebar",
        description: "Clique em 'N-Box' no menu lateral.",
        annotations: [{ x: 0.06, y: 0.7, angle: 0, label: "N-Box" }],
      },
      {
        title: "Filtre por origem",
        description: "Use os filtros laterais para ver leads por canal: WhatsApp, formulário, manual, Meta Ads.",
      },
      {
        title: "Mova para Tracking",
        description: "Em qualquer item, use 'Mover para Tracking' para enviar ao pipeline correto.",
        annotations: [{ x: 0.85, y: 0.45, angle: 180, label: "Mover" }],
      },
    ],
  },
  {
    categorySlug: "nbox",
    slug: "responder-do-nbox",
    title: "Responder direto do N-Box",
    summary: "Não precisa abrir cada conversa: responda da própria caixa.",
    steps: [
      {
        title: "Selecione um item",
        description: "Clique em qualquer card de mensagem para abrir o painel de detalhes.",
      },
      {
        title: "Resposta rápida",
        description: "Use o campo de resposta no painel sem mudar de tela.",
      },
    ],
  },

  // ─── Linker ──────────────────────────────────────────────────────────
  {
    categorySlug: "linnker",
    slug: "criar-pagina-linnker",
    title: "Criar sua página Linker",
    summary: "Página de link na bio com seus principais canais e CTAs.",
    steps: [
      {
        title: "Acesse Linker na sidebar",
        description: "Clique em 'Linker' no menu.",
        annotations: [{ x: 0.06, y: 0.75, angle: 0, label: "Linker" }],
      },
      {
        title: "Edite título, foto e bio",
        description: "Personalize o cabeçalho com seu nome/empresa, foto e descrição curta.",
      },
      {
        title: "Adicione blocos (botões e links)",
        description: "Clique em '+ Novo bloco' para adicionar links, botões de WhatsApp, formulários etc.",
        annotations: [{ x: 0.5, y: 0.6, angle: 0, label: "+ Novo bloco" }],
      },
      {
        title: "Publique e copie o link",
        description: "Use o link gerado na bio do Instagram, e-mail e onde quiser.",
      },
    ],
  },
  {
    categorySlug: "linnker",
    slug: "estatisticas-linnker",
    title: "Estatísticas de cliques",
    summary: "Veja quais blocos convertem mais e otimize sua bio.",
    steps: [
      {
        title: "Aba 'Estatísticas'",
        description: "Cada página Linker tem aba dedicada com cliques por bloco e visitantes únicos.",
      },
    ],
  },

  // ─── Space Point ─────────────────────────────────────────────────────
  {
    categorySlug: "space-point",
    slug: "como-ganhar-pontos",
    title: "Como ganhar Space Points",
    summary: "Cada ação na plataforma gera pontos. Conheça as principais regras.",
    steps: [
      {
        title: "Acesse Space Point",
        description: "Clique em 'Space Point' na sidebar para ver seu saldo e histórico.",
        annotations: [{ x: 0.06, y: 0.8, angle: 0, label: "Space Point" }],
      },
      {
        title: "Aba 'Regras'",
        description: "Veja todas as ações que dão pontos: criar lead, fechar venda, atender mensagem etc.",
      },
      {
        title: "Missões diárias",
        description: "Algumas ações dão pontos extras se feitas todos os dias. Acompanhe a missão diária no topo.",
        annotations: [{ x: 0.5, y: 0.15, angle: 270, label: "Missão diária" }],
      },
    ],
  },
  {
    categorySlug: "space-point",
    slug: "ranking-equipe",
    title: "Ranking da equipe",
    summary: "Compare pontos com colegas e celebre os destaques semanais.",
    steps: [
      {
        title: "Aba 'Ranking'",
        description: "Em Space Point, veja ranking semanal e mensal da equipe.",
      },
    ],
  },
  {
    categorySlug: "space-point",
    slug: "selos-niveis",
    title: "Selos e Níveis",
    summary: "Cada faixa de pontos desbloqueia um selo. Mostre seu progresso no perfil.",
    steps: [
      {
        title: "Aba 'Selos'",
        description: "Veja todos os selos disponíveis e quanto falta para o próximo.",
      },
    ],
  },

  // ─── STARs ───────────────────────────────────────────────────────────
  {
    categorySlug: "stars",
    slug: "o-que-sao-stars",
    title: "O que são STARs",
    summary: "Moeda virtual usada para resgatar recompensas dentro do NASA.",
    steps: [
      {
        title: "Saldo de STARs",
        description: "Veja o saldo da organização no header do app, ao lado do contador de Space Points.",
        annotations: [{ x: 0.85, y: 0.05, angle: 270, label: "STARs" }],
      },
      {
        title: "Como ganhar",
        description: "STARs são creditados ao concluir trilhas, missões especiais e via compra direta.",
      },
    ],
  },
  {
    categorySlug: "stars",
    slug: "comprar-stars",
    title: "Comprar STARs",
    summary: "Adquira pacotes para liberar recompensas extras.",
    steps: [
      {
        title: "Acesse STARs na sidebar",
        description: "Clique em 'STARs'.",
      },
      {
        title: "Aba 'Comprar'",
        description: "Selecione o pacote desejado e finalize com cartão.",
      },
    ],
  },
  {
    categorySlug: "stars",
    slug: "transferir-stars",
    title: "Transferir STARs entre membros",
    summary: "Recompense colegas com STARs por boas práticas.",
    steps: [
      {
        title: "Aba 'Transferir'",
        description: "Em STARs, vá em Transferir, escolha membro, valor e motivo.",
      },
    ],
  },

  // ─── Apps & Marketplace ──────────────────────────────────────────────
  {
    categorySlug: "apps",
    slug: "instalar-app",
    title: "Instalar um app",
    summary: "Adicione novos módulos à sua organização via marketplace.",
    steps: [
      {
        title: "Acesse 'Apps' na sidebar",
        description: "Clique em Apps para ver o marketplace.",
        annotations: [{ x: 0.06, y: 0.85, angle: 0, label: "Apps" }],
      },
      {
        title: "Escolha um app",
        description: "Navegue por categoria. Cada app tem descrição, capturas e plano necessário.",
      },
      {
        title: "Botão 'Instalar'",
        description: "Clique em Instalar. O app aparece imediatamente na sidebar.",
        annotations: [{ x: 0.85, y: 0.5, angle: 180, label: "Instalar" }],
      },
    ],
  },
  {
    categorySlug: "apps",
    slug: "ocultar-apps",
    title: "Ocultar apps que não usa",
    summary: "Mantenha a sidebar limpa escondendo apps desnecessários.",
    steps: [
      {
        title: "Configurações > Sidebar",
        description: "Acesse Configurações da org → aba Sidebar.",
      },
      {
        title: "Desmarque apps",
        description: "Use os toggles para esconder. Apps desativados continuam acessíveis em /apps.",
      },
    ],
  },

  // ─── Configurações ───────────────────────────────────────────────────
  {
    categorySlug: "settings",
    slug: "configurar-empresa",
    title: "🏢 Configurar dados da empresa",
    summary: "PASSO 2 DO ONBOARDING. Preencha razão social, CNPJ, logo, endereço e contatos.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    steps: [
      {
        title: "Acesse Configurações",
        description: "Clique no avatar no canto inferior esquerdo > 'Configurações da Organização'.",
        screenshotUrl: "/space-help/screenshots/empresa/01-menu-config.png",
        annotations: [{ x: 0.05, y: 0.95, angle: 45, label: "Avatar" }],
      },
      {
        title: "Aba 'Empresa'",
        description: "Na aba Empresa, preencha razão social, nome fantasia, CNPJ e segmento.",
        screenshotUrl: "/space-help/screenshots/empresa/02-aba-empresa.png",
        annotations: [{ x: 0.2, y: 0.2, angle: 0, label: "Empresa" }],
      },
      {
        title: "Suba sua logo",
        description: "Clique em 'Trocar logo' e faça upload do PNG/SVG (preferível 500x500px com fundo transparente).",
        screenshotUrl: "/space-help/screenshots/empresa/03-logo.png",
        annotations: [{ x: 0.4, y: 0.4, angle: 0, label: "Trocar logo" }],
      },
      {
        title: "Endereço e contatos",
        description: "Preencha CEP, endereço, telefone comercial e e-mail de suporte.",
        screenshotUrl: "/space-help/screenshots/empresa/04-endereco.png",
      },
      {
        title: "Salve e ganhe STARs",
        description: "Ao completar 100% das informações, você ganha STARs como recompensa de configuração.",
        screenshotUrl: "/space-help/screenshots/empresa/05-stars.png",
        annotations: [{ x: 0.5, y: 0.5, angle: 0, label: "🎉 Stars liberadas" }],
      },
    ],
  },
  {
    categorySlug: "settings",
    slug: "convidar-membros",
    title: "Convidar membros para a equipe",
    summary: "Adicione vendedores, atendentes e moderadores.",
    steps: [
      {
        title: "Aba 'Equipe'",
        description: "Em Configurações > Equipe, clique em '+ Convidar membro'.",
        annotations: [{ x: 0.85, y: 0.15, angle: 180, label: "Convidar" }],
      },
      {
        title: "E-mail e papel",
        description: "Informe e-mail, escolha papel (membro, moderador, owner). Convite vai por e-mail.",
      },
    ],
  },
  {
    categorySlug: "settings",
    slug: "permissoes-papeis",
    title: "Permissões e papéis",
    summary: "Defina o que cada papel pode ver e fazer.",
    steps: [
      {
        title: "Aba 'Permissões'",
        description: "Configure granularmente o acesso de cada papel a cada módulo.",
      },
    ],
  },
  {
    categorySlug: "settings",
    slug: "plano-cobranca",
    title: "Plano e Cobrança",
    summary: "Veja seu plano atual, troque de plano ou atualize cartão.",
    steps: [
      {
        title: "Aba 'Plano'",
        description: "Em Configurações > Plano, veja status, próxima cobrança e histórico.",
      },
      {
        title: "Mudar plano",
        description: "Clique em 'Comparar planos' para fazer upgrade/downgrade.",
      },
    ],
  },

  // ─── Notificações ────────────────────────────────────────────────────
  {
    categorySlug: "notifications",
    slug: "central-notificacoes",
    title: "Central de Notificações",
    summary: "Sininho no header lista todos os eventos importantes.",
    steps: [
      {
        title: "Sino no canto superior",
        description: "Clique no ícone de sino para abrir o painel de notificações.",
        annotations: [{ x: 0.93, y: 0.06, angle: 225, label: "Sino" }],
      },
      {
        title: "Filtros por tipo",
        description: "Filtre por leads, mensagens, propostas, pagamentos ou eventos do sistema.",
      },
    ],
  },
  {
    categorySlug: "notifications",
    slug: "configurar-canais",
    title: "Configurar canais (e-mail, push, WhatsApp)",
    summary: "Escolha como receber cada tipo de notificação.",
    steps: [
      {
        title: "Configurações > Notificações",
        description: "Em configurações pessoais, abra a aba Notificações.",
      },
      {
        title: "Toggles por evento",
        description: "Para cada tipo de evento, marque os canais (e-mail, push do navegador, WhatsApp).",
      },
    ],
  },

  // ─── Atalhos ─────────────────────────────────────────────────────────
  {
    categorySlug: "shortcuts",
    slug: "lista-atalhos",
    title: "Lista completa de atalhos",
    summary: "Use o teclado para acelerar tudo: navegação, busca, ações rápidas.",
    steps: [
      {
        title: "Pressione '?'",
        description: "Em qualquer tela, aperte '?' para abrir a lista completa de atalhos.",
        annotations: [{ x: 0.5, y: 0.5, angle: 0, label: "?" }],
      },
      {
        title: "Atalhos essenciais",
        description: "⌘K — busca global. G+T — ir para Tracking. G+W — Workspace. N — novo lead/projeto.",
      },
    ],
  },
  {
    categorySlug: "shortcuts",
    slug: "command-palette",
    title: "Command Palette (⌘K)",
    summary: "Acesse qualquer tela ou ação via busca por texto.",
    steps: [
      {
        title: "Aperte ⌘K (ou Ctrl+K)",
        description: "Abre a busca global. Digite o nome da ação ou tela.",
        annotations: [{ x: 0.5, y: 0.4, angle: 0, label: "⌘K" }],
      },
      {
        title: "Resultados em tempo real",
        description: "Use ↑↓ para navegar e Enter para abrir.",
      },
    ],
  },
];

// ─── Selos (Badges) ──────────────────────────────────────────────────────
const BADGES = [
  {
    slug: "expert-nasa",
    name: "Expert NASA",
    description: "Concluiu a trilha completa de capacitação NASA. Você domina a plataforma!",
    iconUrl: "/space-help/badges/expert-nasa.svg",
    color: "#7C3AED",
  },
  {
    slug: "comercial-master",
    name: "Comercial Master",
    description: "Concluiu a trilha de Comercial. Pronto para escalar suas vendas.",
    iconUrl: "/space-help/badges/comercial-master.svg",
    color: "#0EA5E9",
  },
  {
    slug: "atendimento-pro",
    name: "Atendimento Pro",
    description: "Concluiu a trilha de Atendimento. Dominou o suporte ao cliente.",
    iconUrl: "/space-help/badges/atendimento-pro.svg",
    color: "#F59E0B",
  },
  {
    slug: "setup-master",
    name: "Setup Master",
    description: "Concluiu o setup inicial completo: WhatsApp, empresa, primeiro Tracking, Workspace e Forge. Pronto pra decolar!",
    iconUrl: "/space-help/badges/setup-master.svg",
    color: "#10B981",
  },
  {
    slug: "org-ready",
    name: "Organização Pronta",
    description: "Sua organização atingiu 100% de configuração inicial — WhatsApp, empresa, Tracking, Workspace e Forge. STARs liberadas!",
    iconUrl: "/space-help/badges/org-ready.svg",
    color: "#22C55E",
  },
];

// ─── Trilhas (Academy) ───────────────────────────────────────────────────
const TRACKS: Array<{
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  level: string;
  durationMin: number;
  rewardStars: number;
  rewardSpacePoints: number;
  rewardBadgeSlug: string;
  order: number;
  lessons: Array<{
    title: string;
    summary: string;
    contentMd: string;
    youtubeUrl?: string;
    durationMin: number;
  }>;
}> = [
  {
    slug: "setup-inicial-nasa",
    title: "🚀 Setup Inicial NASA",
    subtitle: "Os 5 passos críticos pra decolar com a plataforma",
    description: "Trilha guiada do que você precisa configurar antes de tudo: conectar WhatsApp, configurar empresa, criar primeiro Tracking + Tag, montar Workspace e cadastrar produtos no Forge. Conclua e ganhe o selo Setup Master + STARs.",
    level: "beginner",
    durationMin: 30,
    rewardStars: 100,
    rewardSpacePoints: 200,
    rewardBadgeSlug: "setup-master",
    order: 0,
    lessons: [
      {
        title: "1️⃣ Conectar instância WhatsApp",
        summary: "Comece pelo essencial: ter mensagens chegando dentro do NASA.",
        contentMd:
          "## Por que isso primeiro?\n\nO WhatsApp é o canal #1 de relacionamento com clientes no Brasil. Conectar sua instância é o que liga sua operação ao NASA.\n\n## Como fazer\n\n1. Acesse **Integrações** na sidebar.\n2. No card **WhatsApp Business**, clique em **Conectar**.\n3. Crie uma instância (nome livre, ex: 'Vendas Principal').\n4. **Escaneie o QR Code** com o WhatsApp do seu celular: Configurações > Aparelhos conectados > Conectar dispositivo.\n5. Pronto — todas as conversas chegam no NasaChat.\n\n💡 **Dica**: você pode ter múltiplas instâncias (vendas, suporte, financeiro), cada uma com um número diferente.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 6,
      },
      {
        title: "2️⃣ Configurar dados da empresa",
        summary: "CNPJ, logo, endereço — informações que aparecem em propostas e contratos.",
        contentMd:
          "## Por que importa?\n\nDados da empresa aparecem automaticamente em propostas, contratos, e-mails e relatórios. Configurar uma vez economiza retrabalho infinito.\n\n## Como fazer\n\n1. Clique no **avatar** no canto inferior esquerdo > **Configurações da Organização**.\n2. Aba **Empresa**: preencha razão social, nome fantasia, CNPJ, segmento.\n3. Faça **upload da logo** (PNG/SVG, ideal 500x500 com fundo transparente).\n4. Endereço completo + telefone comercial + e-mail de suporte.\n5. Salve.\n\n🎁 **Recompensa**: ao chegar em 100% das informações preenchidas, você ganha **STARs** automaticamente.",
        durationMin: 5,
      },
      {
        title: "3️⃣ Criar primeiro Tracking + primeira Tag",
        summary: "Pipeline + organização desde o dia zero.",
        contentMd:
          "## Tracking + Tag = base do CRM\n\n**Tracking** é seu pipeline visual (Kanban). **Tag** é o rótulo que organiza leads (origem, prioridade, segmento).\n\n## Criando o Tracking\n\n1. **Tracking** na sidebar > **+ Novo Tracking**.\n2. Nome (ex: 'Vendas 2026'), colunas iniciais (Novo, Contato, Proposta, Fechado).\n3. Adicione responsáveis (quem da equipe vê esse pipeline).\n\n## Criando a primeira Tag\n\n1. Dentro do Tracking, clique na **engrenagem** > aba **Tags**.\n2. **+ Nova Tag**: nome (ex: 'Hot Lead'), cor, ícone.\n3. Aplique a tag em qualquer card de lead pelo campo Tags do painel lateral.\n\n💡 Tags comuns para começar: Hot/Warm/Cold, Indicação, Site, Anúncio, VIP.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 7,
      },
      {
        title: "4️⃣ Configurar Workspace",
        summary: "Onde projetos, clientes e calendário do time vivem.",
        contentMd:
          "## Por que Workspace?\n\nWorkspace é o hub que conecta projetos a clientes e times. Sem ele, você terá leads soltos sem entrega vinculada.\n\n## Como fazer\n\n1. **Workspace** na sidebar.\n2. Aba **Clientes**: cadastre seus 3-5 clientes principais (nome, contato, segmento).\n3. Aba **Projetos**: **+ Novo Projeto**, vincule a um cliente, defina prazo.\n4. **Favoritos**: marque com a estrela os projetos/clientes recorrentes.\n5. Aba **Calendário**: crie eventos vinculados a projetos.\n\n💡 **Dica**: Workspace é colaborativo — qualquer membro vê os mesmos projetos.",
        durationMin: 6,
      },
      {
        title: "5️⃣ Cadastrar produtos no Forge → primeira proposta",
        summary: "Catálogo de produtos + sua primeira proposta comercial.",
        contentMd:
          "## Forge = vendas escaláveis\n\nProdutos cadastrados no Forge aparecem no autocomplete ao montar propostas. Faça uma vez, use sempre.\n\n## Cadastrar produtos\n\n1. **Forge** na sidebar > **Produtos & Serviços**.\n2. **+ Novo Produto**: nome, valor unitário, descrição, categoria.\n3. Cadastre 3-5 produtos principais.\n\n## Sua primeira proposta\n\n1. Forge > **Propostas** > **+ Nova Proposta**.\n2. Selecione um cliente (do Workspace).\n3. **Buscar produto** — aparece no autocomplete o que você cadastrou.\n4. Adicione quantidade. Total calcula automático.\n5. Salve e envie pelo botão **Compartilhar**.\n\n🎉 **Parabéns!** Ao terminar esta trilha você ganha o selo **Setup Master** + 200 SP + 100 Stars. Sua plataforma está oficialmente operacional.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 6,
      },
    ],
  },
  {
    slug: "comece-com-nasa",
    title: "Comece com NASA",
    subtitle: "Sua primeira hora dentro da plataforma",
    description: "Trilha essencial para novos usuários. Aprenda os módulos principais e comece a operar com confiança.",
    level: "beginner",
    durationMin: 60,
    rewardStars: 50,
    rewardSpacePoints: 100,
    rewardBadgeSlug: "expert-nasa",
    order: 1,
    lessons: [
      {
        title: "Bem-vindo ao NASA",
        summary: "Visão geral da plataforma e como ela vai te ajudar.",
        contentMd:
          "## Bem-vindo!\n\nA NASA é uma plataforma all-in-one que conecta tracking de leads, atendimento, agenda, propostas e financeiro em um só lugar.\n\nNesta trilha você vai aprender a operar os módulos principais e começar a tirar valor desde o primeiro dia.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 5,
      },
      {
        title: "Navegando a sidebar",
        summary: "Conheça cada item do menu e o que cada módulo faz.",
        contentMd: "Cada item da sidebar representa um módulo. Você pode ocultar os que não usa em Configurações > Sidebar.",
        durationMin: 8,
      },
      {
        title: "Criando seu primeiro Tracking",
        summary: "Pipeline de vendas em 3 minutos.",
        contentMd: "Acesse Tracking > + Novo Tracking. Preencha nome, escolha colunas iniciais (ex: Novo, Contato, Proposta, Fechado) e adicione responsáveis.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 10,
      },
      {
        title: "Conectando o WhatsApp",
        summary: "Atendimento integrado em poucos cliques.",
        contentMd: "Em Integrações > WhatsApp Business > escaneie o QR Code com seu celular. Pronto, todas as conversas chegam no NasaChat.",
        durationMin: 7,
      },
      {
        title: "Próximos passos",
        summary: "Onde aprofundar depois desta trilha.",
        contentMd: "Após esta trilha você ganha o selo **Expert NASA** + 100 SP + 50 Stars. Próximas trilhas recomendadas: 'Escale seu Comercial' e 'Domine o Atendimento'.",
        durationMin: 5,
      },
    ],
  },
  {
    slug: "escale-comercial",
    title: "Escale seu Comercial",
    subtitle: "Estrutura de vendas que cresce com seu time",
    description: "Aprenda a estruturar pipeline, propostas e métricas comerciais para escalar vendas sem perder controle.",
    level: "intermediate",
    durationMin: 90,
    rewardStars: 80,
    rewardSpacePoints: 150,
    rewardBadgeSlug: "comercial-master",
    order: 2,
    lessons: [
      {
        title: "Estruturando o pipeline ideal",
        summary: "Status, etapas e gatilhos de avanço.",
        contentMd: "Um bom pipeline tem 4-6 etapas, cada uma com critério claro de avanço.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 15,
      },
      {
        title: "Forge: propostas que convertem",
        summary: "Templates, personalização e tracking de visualização.",
        contentMd: "Use templates para padronizar e o tracking de abertura para timing perfeito de follow-up.",
        durationMin: 20,
      },
      {
        title: "Métricas que importam",
        summary: "Conversão por etapa, ciclo médio e ticket.",
        contentMd: "Em Insights, acompanhe taxa de conversão por etapa e identifique gargalos.",
        durationMin: 15,
      },
      {
        title: "Automatizando follow-ups",
        summary: "Use Workflows para nunca perder lead.",
        contentMd: "Configure workflows que disparam mensagens automáticas quando um lead fica X dias sem movimento.",
        durationMin: 20,
      },
    ],
  },
  {
    slug: "domine-atendimento",
    title: "Domine o Atendimento",
    subtitle: "Suporte e SAC de alta performance",
    description: "Como estruturar atendimento ágil e consistente usando NasaChat, respostas rápidas e roteamento inteligente.",
    level: "intermediate",
    durationMin: 75,
    rewardStars: 70,
    rewardSpacePoints: 120,
    rewardBadgeSlug: "atendimento-pro",
    order: 3,
    lessons: [
      {
        title: "Configurando NasaChat",
        summary: "Conectar canais e organizar inbox.",
        contentMd: "Conecte WhatsApp, Instagram e configure rótulos para organizar conversas por tema.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        durationMin: 15,
      },
      {
        title: "Respostas rápidas e templates",
        summary: "Padronize respostas frequentes.",
        contentMd: "Crie templates para perguntas comuns. Use '/' no chat para inserir.",
        durationMin: 15,
      },
      {
        title: "Roteamento por agentes",
        summary: "Cada agente recebe os atendimentos certos.",
        contentMd: "Configure regras de distribuição (rodízio, capacidade, especialidade) em Configurações > Atendimento.",
        durationMin: 20,
      },
      {
        title: "Métricas de SAC",
        summary: "Tempo de resposta, satisfação e volume.",
        contentMd: "Acompanhe SLAs e identifique horários de pico para dimensionar equipe.",
        durationMin: 15,
      },
    ],
  },
];

async function main() {
  console.log("🚀 Seed Space Help — iniciando…");

  // 1) Badges
  for (const b of BADGES) {
    await prisma.spaceHelpBadge.upsert({
      where: { slug: b.slug },
      create: b,
      update: { name: b.name, description: b.description, iconUrl: b.iconUrl, color: b.color },
    });
  }
  console.log(`✓ ${BADGES.length} badges criados.`);

  // 2) Categorias
  for (const c of CATEGORIES) {
    await prisma.spaceHelpCategory.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, iconKey: c.iconKey, appId: c.appId, order: c.order },
    });
  }
  console.log(`✓ ${CATEGORIES.length} categorias criadas.`);

  // 3) Features + Steps
  let totalFeatures = 0;
  let totalSteps = 0;
  for (const f of FEATURES) {
    const cat = await prisma.spaceHelpCategory.findUnique({ where: { slug: f.categorySlug } });
    if (!cat) continue;

    const feature = await prisma.spaceHelpFeature.upsert({
      where: { categoryId_slug: { categoryId: cat.id, slug: f.slug } },
      create: {
        categoryId: cat.id,
        slug: f.slug,
        title: f.title,
        summary: f.summary,
        youtubeUrl: f.youtubeUrl,
        order: totalFeatures,
      },
      update: { title: f.title, summary: f.summary, youtubeUrl: f.youtubeUrl },
    });
    totalFeatures++;

    // Limpa steps antigos para reseed limpo
    await prisma.spaceHelpStep.deleteMany({ where: { featureId: feature.id } });
    for (let i = 0; i < f.steps.length; i++) {
      const s = f.steps[i]!;
      await prisma.spaceHelpStep.create({
        data: {
          featureId: feature.id,
          order: i,
          title: s.title,
          description: s.description,
          screenshotUrl: s.screenshotUrl,
          annotations: s.annotations ? (s.annotations as any) : undefined,
        },
      });
      totalSteps++;
    }
  }
  console.log(`✓ ${totalFeatures} features e ${totalSteps} steps criados.`);

  // 4) Tracks + Lessons
  let totalLessons = 0;
  for (const t of TRACKS) {
    const badge = await prisma.spaceHelpBadge.findUnique({ where: { slug: t.rewardBadgeSlug } });
    const track = await prisma.spaceHelpTrack.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        title: t.title,
        subtitle: t.subtitle,
        description: t.description,
        level: t.level,
        durationMin: t.durationMin,
        rewardStars: t.rewardStars,
        rewardSpacePoints: t.rewardSpacePoints,
        rewardBadgeId: badge?.id,
        order: t.order,
      },
      update: {
        title: t.title,
        subtitle: t.subtitle,
        description: t.description,
        level: t.level,
        durationMin: t.durationMin,
        rewardStars: t.rewardStars,
        rewardSpacePoints: t.rewardSpacePoints,
        rewardBadgeId: badge?.id,
        order: t.order,
      },
    });

    await prisma.spaceHelpLesson.deleteMany({ where: { trackId: track.id } });
    for (let i = 0; i < t.lessons.length; i++) {
      const l = t.lessons[i]!;
      await prisma.spaceHelpLesson.create({
        data: {
          trackId: track.id,
          order: i,
          title: l.title,
          summary: l.summary,
          contentMd: l.contentMd,
          youtubeUrl: l.youtubeUrl,
          durationMin: l.durationMin,
        },
      });
      totalLessons++;
    }
  }
  console.log(`✓ ${TRACKS.length} trilhas e ${totalLessons} aulas criadas.`);

  console.log("\n🎉 Seed Space Help concluído.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
