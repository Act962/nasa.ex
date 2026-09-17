/**
 * Dados fictícios para as telas de preview (`/trafego/preview/*`).
 *
 * Existem para trabalhar o layout do painel sem banco e sem login — os
 * componentes reais são renderizados com o cache do TanStack Query
 * pré-populado, então o que aparece na tela é o componente de produção.
 *
 * Nada aqui vai para o banco. As rotas de preview são bloqueadas fora de
 * desenvolvimento (ver `(public)/trafego/preview/layout.tsx`).
 */

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000);

const daysAgo = (days: number) => hoursAgo(days * 24);

export const PREVIEW_ORDER_ID = "preview-order-1";

/** Lista do painel do cliente — cobre status e plataformas diferentes. */
export const previewOrders = [
  {
    id: PREVIEW_ORDER_ID,
    code: "TG-0007",
    planNameSnapshot: "Tráfego R$ 1.000,00",
    platform: "META_ADS" as const,
    campaignType: "PROSPECCAO" as const,
    objective: "LEADS" as const,
    status: "RUNNING" as const,
    adBudgetBrlCents: 100_000,
    serviceFeeBrlCents: 40_000,
    totalBrlCents: 185_000,
    durationDays: 30,
    maxCreatives: 6,
    maxCopies: 4,
    createdAt: daysAgo(12),
    startedAt: daysAgo(8),
    endsAt: daysAgo(-22),
    metaCampaignExternalId: "120210000000000001",
    broadcastId: null,
    creativesCount: 4,
    copiesCount: 2,
    hasMetricsLink: true,
  },
  {
    id: "preview-order-2",
    code: "TG-0011",
    planNameSnapshot: "Tráfego R$ 300,00",
    platform: "GOOGLE_ADS" as const,
    campaignType: "VENDA_DIRETA" as const,
    objective: "SEARCH" as const,
    status: "ACCOUNT_REVIEW" as const,
    adBudgetBrlCents: 30_000,
    serviceFeeBrlCents: 15_000,
    totalBrlCents: 95_000,
    durationDays: 30,
    maxCreatives: 3,
    maxCopies: 2,
    createdAt: hoursAgo(5),
    startedAt: null,
    endsAt: null,
    metaCampaignExternalId: null,
    broadcastId: null,
    creativesCount: 0,
    copiesCount: 0,
    hasMetricsLink: false,
  },
  {
    id: "preview-order-3",
    code: "TG-0009",
    planNameSnapshot: "Tráfego R$ 2.500,00",
    platform: "WHATSAPP_OFICIAL" as const,
    campaignType: "RELACIONAMENTO" as const,
    objective: "BROADCAST" as const,
    status: "IN_REVIEW" as const,
    adBudgetBrlCents: 250_000,
    serviceFeeBrlCents: 87_500,
    totalBrlCents: 377_500,
    durationDays: 15,
    maxCreatives: 2,
    maxCopies: 2,
    createdAt: daysAgo(3),
    startedAt: null,
    endsAt: null,
    metaCampaignExternalId: null,
    broadcastId: "preview-broadcast-1",
    creativesCount: 2,
    copiesCount: 1,
    hasMetricsLink: true,
  },
];

/** Detalhe do pedido — o que `getOrder` devolveria. */
export const previewOrderDetail = {
  id: PREVIEW_ORDER_ID,
  code: "TG-0007",
  planNameSnapshot: "Tráfego R$ 1.000,00",
  platform: "META_ADS" as const,
  campaignType: "PROSPECCAO" as const,
  objective: "LEADS" as const,
  status: "RUNNING" as const,
  durationDays: 30,
  maxCreatives: 6,
  maxCopies: 4,
  materialsProfileLink: null,
  adBudgetBrlCents: 100_000,
  serviceFeeBrlCents: 40_000,
  totalBrlCents: 185_000,
  businessName: "Padaria do Bairro",
  businessNiche: "Alimentação",
  targetAudience:
    "Moradores num raio de 5 km, 25 a 55 anos, interessados em padaria artesanal e café.",
  destinationUrl: "https://padariadobairro.com.br",
  whatsappNumber: "(11) 98888-7777",
  notes: "Destacar o combo de café da manhã aos sábados.",
  releaseSavedAt: daysAgo(11),
  createdAt: daysAgo(12),
  requestedAt: daysAgo(10),
  approvedAt: daysAgo(9),
  startedAt: daysAgo(8),
  endsAt: daysAgo(-22),
  completedAt: null,
  metaCampaignExternalId: "120210000000000001",
  metaAutoLinkedAt: daysAgo(8),
  broadcastId: null,
  leadId: "preview-lead-1",
  materialsSubmittedAt: daysAgo(10),
  phoneVerifiedAt: daysAgo(12),
  socialHandle: "@padariadobairro",
  socialProfile: {
    network: "instagram" as const,
    handle: "padariadobairro",
    found: true,
    name: "Padaria do Bairro",
    username: "padariadobairro",
    pictureUrl: null,
    followers: 4820,
    mediaCount: 312,
    biography: "Pão de fermentação natural todo dia às 6h · Entrega em 5 km",
    website: "https://padariadobairro.com.br",
    isVerified: null,
    checkedAt: daysAgo(12).toISOString(),
    reason: null,
  },
  hasOfficialNumber: null,
  officialNumber: null,
  officialNumberCheck: null,
  creatives: [
    {
      id: "c1",
      kind: "IMAGE" as const,
      fileKey: "preview/criativo-1",
      url: "/marcas/popkins.png",
      fileName: "combo-cafe-manha.jpg",
      fileSize: 842_113,
      mimeType: "image/jpeg",
      width: 1080,
      height: 1080,
      durationSeconds: null,
      position: 0,
      status: "SELECTED" as const,
      reviewNote: null,
      createdAt: daysAgo(11),
    },
    {
      id: "c2",
      kind: "IMAGE" as const,
      fileKey: "preview/criativo-2",
      url: "/marcas/kobber.png",
      fileName: "pao-na-tabua.jpg",
      fileSize: 655_402,
      mimeType: "image/jpeg",
      width: 1080,
      height: 1350,
      durationSeconds: null,
      position: 1,
      status: "UPLOADED" as const,
      reviewNote: null,
      createdAt: daysAgo(11),
    },
    {
      id: "c3",
      kind: "IMAGE" as const,
      fileKey: "preview/criativo-3",
      url: "/marcas/riclan.png",
      fileName: "fachada.jpg",
      fileSize: 431_889,
      mimeType: "image/jpeg",
      width: 1200,
      height: 628,
      durationSeconds: null,
      position: 2,
      status: "REJECTED" as const,
      reviewNote: "Imagem com texto demais — o Meta limita texto na arte.",
      createdAt: daysAgo(11),
    },
  ],
  copies: [
    {
      id: "k1",
      headline: "Pão quentinho todo dia às 6h",
      primaryText:
        "Combo de café da manhã por R$ 18,90: pão na chapa, café coado e suco natural. Aos sábados, o combo vem com bolo caseiro.",
      description: "A 5 minutos de você",
      callToAction: "Enviar mensagem",
      source: "CLIENT" as const,
      isSelected: true,
      position: 0,
    },
    {
      id: "k2",
      headline: "Sua padaria de bairro, de verdade",
      primaryText:
        "Fermentação natural, forno a lenha e atendimento que sabe seu nome. Passa aqui hoje.",
      description: null,
      callToAction: "Saiba mais",
      source: "CLIENT" as const,
      isSelected: false,
      position: 1,
    },
  ],
  events: [
    {
      id: "e1",
      fromStatus: null,
      toStatus: "PAID" as const,
      title: "Pagamento confirmado",
      detail: "Recebemos seu pagamento e sua campanha foi criada.",
      source: "SYSTEM" as const,
      clientNotifiedAt: daysAgo(12),
      createdAt: daysAgo(12),
    },
    {
      id: "e2",
      fromStatus: "PAID" as const,
      toStatus: "ACCOUNT_REVIEW" as const,
      title: "Análise da conta de tráfego",
      detail:
        "Vamos verificar sua conta de anúncios (ou criar uma para você). Enquanto isso, envie seus criativos e a copy.",
      source: "SYSTEM" as const,
      clientNotifiedAt: daysAgo(12),
      createdAt: daysAgo(12),
    },
    {
      id: "e3",
      fromStatus: "ACCOUNT_REVIEW" as const,
      toStatus: "ONBOARDING" as const,
      title: "Aguardando seus materiais",
      detail: "Conta verificada — a Órbita já é parceira da sua BM.",
      source: "KANBAN" as const,
      clientNotifiedAt: daysAgo(11),
      createdAt: daysAgo(11),
    },
    {
      id: "e4",
      fromStatus: "ONBOARDING" as const,
      toStatus: "MATERIALS_SUBMITTED" as const,
      title: "Materiais enviados",
      detail:
        'Criativos e copy recebidos. Quando quiser, clique em "Ativar campanha".',
      source: "CLIENT" as const,
      clientNotifiedAt: null,
      createdAt: daysAgo(10),
    },
    {
      id: "e5",
      fromStatus: "MATERIALS_SUBMITTED" as const,
      toStatus: "REQUESTED" as const,
      title: "Campanha enviada para a equipe",
      detail:
        "Recebemos seus materiais. Nossa equipe vai revisar e colocar a campanha no ar.",
      source: "CLIENT" as const,
      clientNotifiedAt: null,
      createdAt: daysAgo(10),
    },
    {
      id: "e6",
      fromStatus: "REQUESTED" as const,
      toStatus: "IN_REVIEW" as const,
      title: "Em análise",
      detail:
        "Um criativo foi recusado pelo limite de texto do Meta — seguimos com os outros dois.",
      source: "KANBAN" as const,
      clientNotifiedAt: daysAgo(9),
      createdAt: daysAgo(9),
    },
    {
      id: "e7",
      fromStatus: "IN_REVIEW" as const,
      toStatus: "RUNNING" as const,
      title: "No ar",
      detail:
        "Sua campanha começou a rodar. Os números aparecem na aba Desempenho.",
      source: "KANBAN" as const,
      clientNotifiedAt: daysAgo(8),
      createdAt: daysAgo(8),
    },
  ],
};

/** Desempenho — o shape unificado que `getOrderPerformance` devolve. */
export const previewPerformance = {
  platform: "META_ADS" as const,
  status: "RUNNING" as const,
  hasMetrics: true as const,
  source: "snapshot" as const,
  updatedAt: hoursAgo(9),
  autoLinked: true,
  period: { from: daysAgo(8), to: new Date() },
  kpis: [
    {
      key: "impressions",
      label: "Impressões",
      value: 84_213,
      format: "int" as const,
    },
    {
      key: "reach",
      label: "Pessoas alcançadas",
      value: 31_902,
      format: "int" as const,
    },
    { key: "clicks", label: "Cliques", value: 1_744, format: "int" as const },
    {
      key: "ctr",
      label: "Taxa de cliques",
      value: 2.07,
      format: "pct" as const,
    },
    { key: "leads", label: "Leads", value: 96, format: "int" as const },
    {
      key: "conversions",
      label: "Conversões",
      value: 41,
      format: "int" as const,
    },
    {
      key: "spend",
      label: "Investido",
      value: 61_400,
      format: "currency" as const,
    },
    {
      key: "cpc",
      label: "Custo por clique",
      value: 35,
      format: "currency" as const,
    },
  ],
  series: Array.from({ length: 8 }, (_, index) => ({
    date: daysAgo(7 - index),
    primary: 7_800 + Math.round(Math.sin(index * 1.1) * 2_600) + index * 420,
    secondary: 160 + Math.round(Math.cos(index * 0.9) * 55) + index * 9,
  })),
  budget: {
    adBudgetBrlCents: 100_000,
    spentBrlCents: 61_400,
    remainingBrlCents: 38_600,
    percentUsed: 61.4,
  },
};

/** Thread de suporte. */
export const previewMessages = [
  {
    id: "m1",
    body: "Boa tarde! Consigo trocar o criativo que foi recusado por outro?",
    authorRole: "CLIENT" as const,
    attachmentKey: null,
    attachmentUrl: null,
    createdAt: daysAgo(7),
    author: { id: "u1", name: "Marina (Padaria do Bairro)", image: null },
  },
  {
    id: "m2",
    body: "Oi, Marina! Consegue sim. Suba o novo na aba Materiais que a gente substitui sem parar a campanha — o aprendizado do algoritmo não se perde.",
    authorRole: "NASA" as const,
    attachmentKey: null,
    attachmentUrl: null,
    createdAt: daysAgo(7),
    author: { id: "u2", name: "Rafael — Órbita", image: null },
  },
  {
    id: "m3",
    body: "Perfeito, subi agora. Obrigada!",
    authorRole: "CLIENT" as const,
    attachmentKey: null,
    attachmentUrl: null,
    createdAt: daysAgo(6),
    author: { id: "u1", name: "Marina (Padaria do Bairro)", image: null },
  },
];

/** Fila do painel da equipe. */
export const previewAdminOrders = {
  orders: previewOrders.map((order, index) => ({
    ...order,
    organization: {
      id: `org-${index}`,
      name:
        ["Padaria do Bairro", "Ótica Visão", "Studio Bella"][index] ??
        "Cliente",
      slug:
        ["padaria-do-bairro", "otica-visao", "studio-bella"][index] ??
        "cliente",
    },
    owner: {
      id: `u-${index}`,
      name: ["Marina Souza", "Carlos Prado", "Bianca Reis"][index] ?? "Cliente",
      email:
        [
          "marina@padaria.com.br",
          "carlos@oticavisao.com.br",
          "bianca@studiobella.com.br",
        ][index] ?? "cliente@exemplo.com",
    },
    assignedTo: index === 0 ? { id: "nasa-1", name: "Rafael" } : null,
    businessName:
      ["Padaria do Bairro", "Ótica Visão", "Studio Bella"][index] ?? null,
    requestedAt: order.status === "ACCOUNT_REVIEW" ? null : daysAgo(index + 2),
    amountMismatch: index === 2,
    messagesCount: index === 0 ? 3 : 0,
  })),
  total: 3,
  page: 1,
  pageSize: 30,
};

export const previewAdminOrderDetail = {
  ...previewOrderDetail,
  organization: {
    id: "org-0",
    name: "Padaria do Bairro",
    slug: "padaria-do-bairro",
  },
  owner: {
    id: "u-0",
    name: "Marina Souza",
    email: "marina@padaria.com.br",
    phone: "(11) 98888-7777",
  },
  assignedTo: { id: "nasa-1", name: "Rafael" },
  pendingPurchase: {
    amountMismatch: false,
    amountBrlCents: 185_000,
    paidAt: daysAgo(12),
    stripeSessionId: "cs_test_preview",
  },
  serviceFeePercent: 40,
  setupFeeBrlCents: 45_000,
  hasBusinessManager: false,
  metricsOrganizationId: "org-agencia",
  metaAdCampaignId: null,
  internalNotes:
    "Cliente respondeu rápido no WhatsApp. Verba pode subir no próximo ciclo.",
  events: previewOrderDetail.events.map((event) => ({
    ...event,
    isClientVisible: true,
    actorUserId: null,
  })),
};

export const previewSettings = {
  id: "singleton",
  agencyOrganizationId: "org-agencia",
  defaultBroadcastTrackingId: null,
  salesTrackingId: "tracking-vendas",
  salesStatusId: null,
  defaultServiceFeePercent: 50,
  supportWhatsapp: "5511988887777",
  operationsTrackingId: "tracking-trafego",
  statusColumnMap: {} as Record<string, string>,
  briefingFormId: "form-briefing",
  partnerBusinessId: "1234567890",
  whatsappActivationTemplate: "trafego_ativacao",
  whatsappStatusTemplate: "trafego_status",
  whatsappOtpTemplate: "trafego_codigo",
  whatsappTemplateLanguage: "pt_BR",
  pixKey: "00.000.000/0001-00",
  pixHolderName: "Órbita Hub LTDA",
  pixBankName: "Inter",
  pixExpiryHours: 48,
  clientNotificationsEnabled: true,
  financeAccountId: null,
  financeRevenueCategoryId: null,
  financePassthroughCategoryId: null,
  updatedAt: daysAgo(20),
  updatedById: null,
};

/** Fase D — Release, acessos e recomendações do painel. */
export const previewRelease = {
  release: {
    about:
      "Padaria de bairro em Teresina, aberta há 12 anos. Produção própria de pães, bolos e salgados, com entrega no mesmo dia para a zona leste.",
    products: [
      "Pães artesanais",
      "Bolos por encomenda",
      "Salgados para festa",
      "Café da manhã",
    ],
    differentials: [
      "Fermentação natural, sem conservante",
      "Entrega em até 2 horas na zona leste",
      "Encomenda pelo WhatsApp, sem app",
    ],
    audience:
      "Famílias da zona leste de Teresina, 25 a 55 anos, que compram pão fresco durante a semana e encomendam bolo em datas comemorativas.",
    tone: "Próximo e caseiro, sem superlativo. Fala como quem atende no balcão.",
    offers: [
      "Combo café da manhã para 4 pessoas",
      "10% na primeira encomenda pelo WhatsApp",
    ],
    doNotSay: ["“o melhor pão da cidade”", "promessa de entrega em tempo fixo"],
  },
  sources: [
    {
      id: "src-1",
      kind: "site" as const,
      value: "https://padariadobairro.com.br",
      fileKey: null,
      extractedAt: "2026-09-12T14:03:00.000Z",
      chars: 4820,
      note: null,
    },
    {
      id: "src-2",
      kind: "pdf" as const,
      value: "cardapio-2026.pdf",
      fileKey: "preview/cardapio.pdf",
      extractedAt: "2026-09-12T14:03:00.000Z",
      chars: 2310,
      note: null,
    },
    {
      id: "src-3",
      kind: "instagram" as const,
      value: "@padariadobairro",
      fileKey: null,
      extractedAt: null,
      chars: null,
      note: "Guardado como referência — redes sociais não são lidas automaticamente.",
    },
  ],
  generatedAt: new Date("2026-09-12T14:04:00.000Z"),
  savedAt: new Date("2026-09-12T14:20:00.000Z"),
  accessChecklist: {
    "facebook-page": true,
    instagram: true,
    "instagram-linked": true,
    "business-manager": false,
    "partner-added": false,
  },
  partnerBusinessId: "123456789012345",
  supportWhatsapp: "5586998221810",
};

export const previewRecommendations = {
  creativeFormat: {
    format: "video" as const,
    label: "Vídeo",
    text: "Para prospecção no Meta com esse público, vídeo curto rende mais que imagem: mostra o produto saindo do forno e segura a atenção nos primeiros 3 segundos.",
  },
  budget: {
    level: "comfortable",
    dailyLabel: "R$ 66,67/dia",
    text: "A verba comporta o objetivo. Dá para testar dois criativos ao mesmo tempo e ainda ter volume para o algoritmo aprender.",
  },
  destination: {
    level: "ok",
    text: "WhatsApp é o destino certo para encomenda — o cliente fala com você sem precisar de site.",
  },
  nextSteps: [
    "Adicione a Órbita como parceira na sua conta de anúncios",
    "Envie 2 vídeos curtos, na vertical",
    "Revise as sugestões de texto e escolha uma",
    "Clique em Ativar campanha",
  ],
  copyAngle:
    "Pão fresco de verdade, entregue no mesmo dia — sem promessa que não cabe no anúncio.",
  generatedAt: "2026-09-12T14:25:00.000Z",
  writtenByModel: true,
};
