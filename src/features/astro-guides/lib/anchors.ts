// Catálogo de âncoras que os guias do Astro podem destacar (spec 0046).
// O componente usa `data-guide={GUIDE_ANCHORS.x.id}`; `pnpm guides:check`
// confere que cada âncora usada por um guia ainda existe no código.

export const GUIDE_ANCHORS = {
  commentsConnectInstagram: {
    id: "comments.connect-instagram",
    description: "Botão que abre o passo a passo para conectar uma conta do Instagram, em /comments → Integrações e nos Satélites",
  },
  commentsAccountSelect: {
    id: "comments.account-select",
    description: "Seletor da conta do Instagram em uso, no topo de /comments",
  },
  plannerAccountFilter: {
    id: "planner.account-filter",
    description: "Filtro \"Conta\" do calendário do Planner: mostra só os posts de uma conta do Instagram",
  },
  plannerBrandKitSwitcher: {
    id: "planner.brand-kit.switcher",
    description: "Lista de kits da empresa (padrão e adicionais) e o botão \"Novo kit\", na aba Kit da Marca do Planner",
  },
  plannerBrandKitPage: {
    id: "planner.brand-kit.page",
    description: "Tela Kit da Marca do Planner (logos, cores, fontes, voz, produtos, materiais e referências)",
  },
  plannerBrandKitMeter: {
    id: "planner.brand-kit.meter",
    description: "Medidor de completude do Kit da Marca, com o que falta",
  },
  plannerAstroGenerate: {
    id: "planner.astro-generate",
    description: "Botão \"Gerar com o Astro\" no Roteiro do Novo conteúdo",
  },
  externalAiGenerateKey: {
    id: "external-ai.generate-key",
    description: "Botão \"Gerar chave\" em Satélites → IA externa (MCP do ÓRBITA para Claude Code)",
  },
  plannerWeeklyMindMap: {
    id: "planner.weekly-mind-map",
    description: "Botão \"Planejar a semana\" da aba Mapas Mentais do Planner",
  },
  plannerWeekdayTheme: {
    id: "planner.weekday-theme",
    description: "Etiqueta do tema fixo do dia da semana, acima do dia no calendário semanal do Planner",
  },
  plannerContentFilter: {
    id: "planner.content-filter",
    description: "Filtro \"Conteúdo\" do calendário do Planner (pautas da semana com o botão Criar)",
  },
  plannerImportWeeklyScript: {
    id: "planner.import-weekly-script",
    description: "Opção \"Conteúdo (roteiro da semana)\" do menu Criar do Planner",
  },
  plannerCreationsTab: {
    id: "planner.creations-tab",
    description: "Filtro \"Origem\" do Kanban do Planner (conteúdos criados por IA)",
  },
  commentsConnectWithMeta: {
    id: "comments.connect-with-meta",
    description: "Botão \"Usar @conta\" que conecta o Instagram já ligado na Meta",
  },
  trackingList: {
    id: "tracking.list",
    description: "Lista de trackings da organização em /tracking",
  },
  trackingNewButton: {
    id: "tracking.new-button",
    description: "Botão \"Novo tracking\" em /tracking",
  },
  trackingCreateName: {
    id: "tracking.create.name",
    description: "Campo de nome no modal de criar tracking",
  },
  trackingCreateSubmit: {
    id: "tracking.create.submit",
    description: "Botão \"Criar\" no modal de criar tracking",
  },
  boardColumns: {
    id: "tracking.board.columns",
    description: "Área das colunas (etapas) do board do tracking",
  },
  boardNewLeadButton: {
    id: "tracking.board.new-lead",
    description: "Botão \"Novo Lead\" na barra do board",
  },
  boardCustomizeButton: {
    id: "tracking.board.customize",
    description: "Botão \"Personalizar\" na barra do board",
  },
  boardCustomizeSheet: {
    id: "tracking.board.customize-sheet",
    description: "Sheet \"Personalizar board\" com os toggles de campos",
  },
  leadSheetName: {
    id: "lead-sheet.name",
    description: "Campo de nome no Sheet de novo lead",
  },
  leadSheetPhone: {
    id: "lead-sheet.phone",
    description: "Campo de WhatsApp no Sheet de novo lead",
  },
  leadSheetSubmit: {
    id: "lead-sheet.submit",
    description: "Botão \"Criar lead\" no Sheet de novo lead",
  },
  chatConversationList: {
    id: "chat.conversation-list",
    description: "Lista de conversas em /tracking-chat",
  },
  chatComposer: {
    id: "chat.composer",
    description: "Caixa de escrever e enviar mensagem na conversa aberta",
  },
  chatSettingsButton: {
    id: "chat.settings-button",
    description: "Engrenagem da lista de conversas (abre as configurações do funil)",
  },
  chatNewLeadButton: {
    id: "chat.new-lead-button",
    description: "Botão \"+\" da lista de conversas no celular (abre o Novo Lead com o tracking atual)",
  },
  settingsInstanceTab: {
    id: "tracking-settings.instance-tab",
    description: "Aba \"Integrações\" nas configurações do tracking",
  },
  whatsappInstancesPanel: {
    id: "whatsapp.instances-panel",
    description: "Painel de instâncias de WhatsApp na aba Integrações",
  },
  whatsappCreateFirstInstance: {
    id: "whatsapp.create-first-instance",
    description: "Botão \"Criar primeira instância\" (funil sem número)",
  },
  whatsappProviderChoice: {
    id: "whatsapp.provider-choice",
    description: "Escolha do provedor no modal de nova instância",
  },
  whatsappInstanceName: {
    id: "whatsapp.instance-name",
    description: "Campo de nome no modal de nova instância",
  },
  whatsappInstanceSubmit: {
    id: "whatsapp.instance-submit",
    description: "Botão \"Criar\" no modal de nova instância",
  },
  whatsappQrDialog: {
    id: "whatsapp.qr-dialog",
    description: "Modal \"Conectar Instância\" com o QR Code",
  },
  agendaShowListButton: {
    id: "agenda.show-list",
    description: "Botão que abre a lista de agendas recolhida em /agendas",
  },
  agendaNewButton: {
    id: "agenda.new-button",
    description: "Botão \"Nova\" na lista de agendas",
  },
  agendaCopyLinkButton: {
    id: "agenda.copy-link",
    description: "Botão \"Copiar link\" de uma agenda na lista",
  },
  agendaCreateTitle: {
    id: "agenda.create.title",
    description: "Campo de título no modal de nova agenda",
  },
  agendaCreateTracking: {
    id: "agenda.create.tracking",
    description: "Select de tracking no modal de nova agenda",
  },
  agendaCreateSubmit: {
    id: "agenda.create.submit",
    description: "Botão \"Continuar\" no modal de nova agenda",
  },
  forgeProposalsTab: {
    id: "forge.proposals-tab",
    description: "Aba \"Propostas\" no Forge",
  },
  forgeNewProposalButton: {
    id: "forge.new-proposal",
    description: "Botão \"Nova Proposta\" na aba Propostas",
  },
  forgeProposalTitle: {
    id: "forge.proposal.title",
    description: "Campo de título no formulário de proposta",
  },
  forgeProposalAddProduct: {
    id: "forge.proposal.add-product",
    description: "Botão \"Adicionar\" produto no formulário de proposta",
  },
  forgeProposalSave: {
    id: "forge.proposal.save",
    description: "Botão \"Salvar Proposta\"",
  },
  forgeProposalShareButton: {
    id: "forge.proposal.share",
    description: "Botão \"Copiar link\" no card da proposta",
  },
  forgeProductsTab: {
    id: "forge.products-tab",
    description: "Aba \"Produtos\" no Forge",
  },
  forgeNewProductButton: {
    id: "forge.new-product",
    description: "Botão \"Novo Produto\" na aba Produtos",
  },
  forgeProductName: {
    id: "forge.product.name",
    description: "Campo de nome no modal de produto",
  },
  forgeProductSku: {
    id: "forge.product.sku",
    description: "Campo de SKU no modal de produto",
  },
  forgeProductValue: {
    id: "forge.product.value",
    description: "Campo de valor no modal de produto",
  },
  forgeProductSave: {
    id: "forge.product.save",
    description: "Botão \"Salvar Produto\"",
  },
  formList: {
    id: "form.list",
    description: "Lista de formulários em /form",
  },
  formCreateButton: {
    id: "form.create-button",
    description: "Botão \"Criar formulário\" em /form",
  },
  formCreateTitle: {
    id: "form.create.title",
    description: "Campo de título no modal de novo formulário",
  },
  formCreateSubmit: {
    id: "form.create.submit",
    description: "Botão \"Criar\" no modal de novo formulário",
  },
  formPublishButton: {
    id: "form.publish",
    description: "Botão \"Publicar\" no editor do formulário",
  },
  contactsNewLeadButton: {
    id: "contacts.new-lead",
    description: "Botão \"Adicionar novo lead\" em /contatos",
  },
  leadSheetTracking: {
    id: "lead-sheet.tracking",
    description: "Select de tracking no Sheet de novo lead (aberto fora de um tracking)",
  },
  contactsSearchField: {
    id: "contacts.search-field",
    description: "Campo \"Buscar contato\" em /contatos (abre a busca)",
  },
  contactsSearchDialog: {
    id: "contacts.search-dialog",
    description: "Janela de busca de leads",
  },
  workspaceNewButton: {
    id: "workspace.new-button",
    description: "Botão \"Novo workspace\" em /workspaces",
  },
  workspaceList: {
    id: "workspace.list",
    description: "Lista de workspaces em /workspaces",
  },
  workspaceCreateName: {
    id: "workspace.create.name",
    description: "Campo de nome no modal de novo workspace",
  },
  workspaceCreateSubmit: {
    id: "workspace.create.submit",
    description: "Botão \"Criar workspace\"",
  },
  actionNewButton: {
    id: "action.new-button",
    description: "Botão \"Nova ação\" dentro do workspace",
  },
  actionCreateTitle: {
    id: "action.create.title",
    description: "Campo de título no modal de nova ação",
  },
  actionCreateSubmit: {
    id: "action.create.submit",
    description: "Botão \"Criar ação\"",
  },
  paymentTabsBar: {
    id: "payment.tabs-bar",
    description: "Barra de abas do Financeiro (Painel, Receita, Despesa…)",
  },
  paymentNewReceivableButton: {
    id: "payment.new-receivable",
    description: "Botão \"Nova Receita\" na aba Receita do Financeiro",
  },
  paymentNewPayableButton: {
    id: "payment.new-payable",
    description: "Botão \"Nova Despesa\" na aba Despesa do Financeiro",
  },
  paymentEntryDescription: {
    id: "payment.entry.description",
    description: "Campo de descrição no formulário de lançamento",
  },
  paymentEntryAmount: {
    id: "payment.entry.amount",
    description: "Campo de valor no formulário de lançamento",
  },
  paymentEntrySave: {
    id: "payment.entry.save",
    description: "Botão \"Salvar\" do lançamento",
  },
  paymentEntriesTable: {
    id: "payment.entries-table",
    description: "Tabela de lançamentos da aba Receita/Despesa (desktop)",
  },
  paymentOpenEntryMenu: {
    id: "payment.entry-menu",
    description: "Menu de ações de um lançamento em aberto (tabela)",
  },
  paymentRegisterPayment: {
    id: "payment.register-payment",
    description: "Item \"Registrar pagamento\" do menu do lançamento",
  },
  paymentPaidAmount: {
    id: "payment.paid-amount",
    description: "Campo \"Valor pago\" no diálogo de pagamento",
  },
  paymentConfirmPay: {
    id: "payment.confirm-pay",
    description: "Botão \"Confirmar Pagamento\"",
  },
  officialNumberBanner: {
    id: "official-number.banner",
    description: "Aviso \"Conecte seu WhatsApp oficial\" em /campanhas (sem número oficial)",
  },
  officialNumberWizard: {
    id: "official-number.wizard",
    description: "Assistente de conexão do número oficial (trazer/comprar, Meta, cartão)",
  },
  campaignNewButton: {
    id: "campaign.new-button",
    description: "Botão \"Nova campanha\" em /campanhas",
  },
  campaignName: {
    id: "campaign.name",
    description: "Campo de nome no diálogo de nova campanha",
  },
  campaignSendingNumber: {
    id: "campaign.sending-number",
    description: "Select \"Número de origem\" (WhatsApp oficial)",
  },
  campaignCreateSubmit: {
    id: "campaign.create.submit",
    description: "Botão \"Criar campanha\"",
  },
  memberAddButton: {
    id: "settings.member-add",
    description: "Botão \"Adicionar Membro\" em /settings/members",
  },
  memberInviteEmail: {
    id: "settings.member-email",
    description: "Campo de e-mail no modal de adicionar membro",
  },
  memberInviteSubmit: {
    id: "settings.member-submit",
    description: "Botão \"Adicionar\" no modal de membro",
  },
  trafegoNewCampaign: {
    id: "trafego.new-campaign",
    description: "Botão \"Nova campanha\" em /trafego/painel",
  },
  trafegoStartButton: {
    id: "trafego.start",
    description: "Botão \"Montar minha campanha\" na página do trafeGO",
  },
  trafegoWizard: {
    id: "trafego.wizard",
    description: "Assistente de montagem da campanha na página do trafeGO",
  },
  pagesNewButton: {
    id: "pages.new-button",
    description: "Botão \"Novo site\" em /pages",
  },
  pagesList: {
    id: "pages.list",
    description: "Lista de sites em /pages",
  },
  pagesWizard: {
    id: "pages.wizard",
    description: "Assistente de criação de site (modelo → detalhes → criar)",
  },
  pagesPublishButton: {
    id: "pages.publish",
    description: "Botão \"Publicar\" no editor do site",
  },
  pagesSeoPanel: {
    id: "pages.seo-panel",
    description: "Bloco \"SEO e compartilhamento\" na aba Ajustes do editor do site",
  },
  pagesDeviceSwitcher: {
    id: "pages.device-switcher",
    description: "Seletor Computador / Tablet / Celular no topo do editor do site",
  },
  linnkerNewButton: {
    id: "linnker.new-button",
    description: "Botão \"Nova página\" em /linnker",
  },
  linnkerList: {
    id: "linnker.list",
    description: "Lista de páginas Linnker",
  },
  linnkerCreateTitle: {
    id: "linnker.create.title",
    description: "Campo de título no diálogo de nova página Linnker",
  },
  linnkerCreateSubmit: {
    id: "linnker.create.submit",
    description: "Botão \"Criar página\" do Linnker",
  },
  linnkerAddLinkButton: {
    id: "linnker.add-link",
    description: "Botão \"Adicionar link\" no editor Linnker",
  },
  linnkerLinkTitle: {
    id: "linnker.link.title",
    description: "Campo de título do link",
  },
  linnkerLinkUrl: {
    id: "linnker.link.url",
    description: "Campo \"URL de destino\" do link",
  },
  linnkerLinkSubmit: {
    id: "linnker.link.submit",
    description: "Botão \"Adicionar\" do link",
  },
  nboxUploadButton: {
    id: "nbox.upload",
    description: "Botão \"Enviar\" do N-Box",
  },
  nboxDropzone: {
    id: "nbox.dropzone",
    description: "Área de arrastar arquivos no envio do N-Box",
  },
  nboxNewFolderButton: {
    id: "nbox.new-folder",
    description: "Botão \"Pasta\" do N-Box",
  },
  nboxFolderName: {
    id: "nbox.folder.name",
    description: "Campo de nome da pasta",
  },
  nboxFolderSubmit: {
    id: "nbox.folder.submit",
    description: "Botão \"Criar\" da pasta",
  },
  plannerNewButton: {
    id: "planner.new-button",
    description: "Botão \"Novo Planner\" em /nasa-planner",
  },
  plannerList: {
    id: "planner.list",
    description: "Lista de planners",
  },
  plannerOrgPicker: {
    id: "planner.org-picker",
    description: "Seletor de empresa no novo planner",
  },
  plannerName: {
    id: "planner.name",
    description: "Campo de nome do planner",
  },
  plannerSubmit: {
    id: "planner.submit",
    description: "Botão \"Criar Planner\"",
  },
  plannerPostsTab: {
    id: "planner.posts-tab",
    description: "Aba \"Posts\" dentro do planner",
  },
  plannerNewPostButton: {
    id: "planner.new-post",
    description: "Botão \"Novo Post\"",
  },
  plannerPostTitle: {
    id: "planner.post.title",
    description: "Campo de título do post",
  },
  plannerPostSubmit: {
    id: "planner.post.submit",
    description: "Botão \"Criar Post\"",
  },
  plannerCalendar: {
    id: "planner.calendar",
    description: "Calendário do Planner (Semana/Mês) em /nasa-planner",
  },
  plannerTodayButton: {
    id: "planner.today-button",
    description: "Botão \"Hoje\" do calendário do Planner",
  },
  plannerViewToggle: {
    id: "planner.view-toggle",
    description: "Alternador Semana | Mês do calendário do Planner",
  },
  plannerClientFilter: {
    id: "planner.client-filter",
    description: "Filtro de clientes (empresas) do calendário do Planner",
  },
  plannerTypeFilter: {
    id: "planner.type-filter",
    description: "Filtro de formato (Feed, Carrossel, Reel, Story) do Planner",
  },
  plannerCreateMenu: {
    id: "planner.create-menu",
    description: "Botão \"Criar\" do calendário do Planner",
  },
  plannerBestTimeSlot: {
    id: "planner.best-time-slot",
    description: "Horário sugerido tracejado \"Programar\" no calendário",
  },
  plannerDraftsTab: {
    id: "planner.side-panel.drafts",
    description: "Coluna \"Rascunho\" do Kanban do Planner",
  },
  plannerApprovalTab: {
    id: "planner.side-panel.approval",
    description: "Coluna \"Aguardando aprovação\" do Kanban do Planner",
  },
  plannerComposerClient: {
    id: "planner.composer.client",
    description: "Escolha do cliente e da conta no criador de post",
  },
  plannerComposerType: {
    id: "planner.composer.type",
    description: "Escolha do formato no criador de post",
  },
  plannerComposerSubmitApproval: {
    id: "planner.composer.submit-approval",
    description: "Botão \"Enviar para aprovação\" no criador de post",
  },
  plannerComposerSchedule: {
    id: "planner.composer.schedule",
    description: "Botão \"Programar\" no criador de post",
  },
  plannerReelCoverFromVideo: {
    id: "planner.reel.cover-from-video",
    description: "Botão \"Usar este quadro\" que define a capa do Reel a partir do vídeo",
  },
  plannerReviewApprove: {
    id: "planner.review.approve",
    description: "Botão \"Aprovar\" na revisão do post",
  },
  plannerReviewRequestChanges: {
    id: "planner.review.request-changes",
    description: "Botão \"Pedir ajustes\" na revisão do post",
  },
  plannerCommentsPanel: {
    id: "planner.comments-panel",
    description: "Painel \"Comentários automáticos\" (Comments) dentro do post do Planner",
  },
  plannerCommentsSave: {
    id: "planner.comments-save",
    description: "Botão \"Salvar automação\" do Comments no post do Planner",
  },
  plannerBroadcastSubmit: {
    id: "planner.broadcast-submit",
    description: "Botão \"Programar disparo\" do disparo de WhatsApp no Planner",
  },
  plannerFailedRetry: {
    id: "planner.failed-retry",
    description: "Botão \"Tentar de novo\" de post que falhou",
  },
  routeNewCourseButton: {
    id: "route.new-course",
    description: "Botão \"Novo curso\" no painel do criador",
  },
  routeCourseList: {
    id: "route.course-list",
    description: "Lista de cursos do criador",
  },
  routeCourseTitle: {
    id: "route.course.title",
    description: "Campo de título do curso",
  },
  routeCourseSubmit: {
    id: "route.course.submit",
    description: "Botão de salvar o curso",
  },
  routeNewLessonButton: {
    id: "route.new-lesson",
    description: "Botão \"Nova aula\" no editor do curso",
  },
  routeLessonTitle: {
    id: "route.lesson.title",
    description: "Campo de título da aula",
  },
  routeLessonSubmit: {
    id: "route.lesson.submit",
    description: "Botão de salvar a aula",
  },
  stationNick: {
    id: "station.nick",
    description: "Campo @nick da Space Station",
  },
  stationSubmit: {
    id: "station.submit",
    description: "Botão \"Criar Space Station\" / \"Salvar Perfil\"",
  },
  starFriendsRewardsTab: {
    id: "star-friends.rewards-tab",
    description: "Aba \"Cartões e prêmios\" do STAR FRIENDS",
  },
  starFriendsNewReward: {
    id: "star-friends.new-reward",
    description: "Botão \"Novo prêmio\"",
  },
  starFriendsRewardName: {
    id: "star-friends.reward.name",
    description: "Campo de nome do prêmio",
  },
  starFriendsRewardCost: {
    id: "star-friends.reward.cost",
    description: "Campo de custo em ⭐ do prêmio",
  },
  starFriendsRewardSave: {
    id: "star-friends.reward.save",
    description: "Botão \"Salvar\" do prêmio",
  },
  integrationsSearch: {
    id: "integrations.search",
    description: "Busca dos Satélites (marketplace de integrações)",
  },
  integrationsConnectButton: {
    id: "integrations.connect",
    description: "Botão \"Conectar\" de um card de integração",
  },
  integrationsConfigDialog: {
    id: "integrations.config-dialog",
    description: "Janela de configuração da integração",
  },
  insightsSaveReportButton: {
    id: "insights.save-report",
    description: "Botão \"Salvar Relatório\" na lateral do Insights",
  },
  insightsReportName: {
    id: "insights.report.name",
    description: "Campo de nome do relatório",
  },
  insightsReportSave: {
    id: "insights.report.save",
    description: "Botão \"Salvar\" do relatório",
  },
  insightsAddInsightButton: {
    id: "insights.add-insight",
    description: "Botão \"Adicionar Insight\" de uma seção",
  },
  insightsAddInsightSheet: {
    id: "insights.add-insight-sheet",
    description: "Painel de indicadores da seção",
  },
  commentsConnectDialog: {
    id: "comments.connect-dialog",
    description: "Janela do passo a passo para conectar o Instagram",
  },
  commentsNewAutomation: {
    id: "comments.new-automation",
    description: "Botão \"Nova\" automação de comentários",
  },
  astroAgentsPanel: {
    id: "astro.agents-panel",
    description: "Painel de agentes na aba Permissões do Astro",
  },
  astroChatAddSite: {
    id: "astro-chat.add-site",
    description: "Botão \"Adicionar site\" do Astro Chat",
  },
  astroChatSiteDialog: {
    id: "astro-chat.site-dialog",
    description: "Janela \"Adicionar site\" do Astro Chat",
  },
  astroChatSiteSubmit: {
    id: "astro-chat.site-submit",
    description: "Botão \"Criar e ativar\" do site",
  },
  nerpConnectButton: {
    id: "nerp.connect",
    description: "Botão \"Conectar com nerp\"",
  },
} as const;

export type GuideAnchorKey = keyof typeof GUIDE_ANCHORS;

export function guideSelector(anchorKey: GuideAnchorKey): string {
  return `[data-guide="${GUIDE_ANCHORS[anchorKey].id}"]`;
}
