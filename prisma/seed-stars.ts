import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ── Full app catalog with display metadata ────────────────────────────────────
const APP_CATALOG = [
  // ── Mensageiros ──────────────────────────────────────────────────────────────
  { appSlug: "whatsapp-business",  monthlyCost: 80,  setupCost: 0,  priceBrl: 49, displayName: "WhatsApp Business",  iconEmoji: "💬", category: "messengers", description: "Receba e envie mensagens do WhatsApp, capture leads e gerencie conversas direto no CRM." },
  { appSlug: "instagram-dm",       monthlyCost: 60,  setupCost: 0,  priceBrl: 49, displayName: "Instagram DM",       iconEmoji: "📸", category: "messengers", description: "Gerencie DMs do Instagram, responda leads e integre ao pipeline de vendas." },
  { appSlug: "telegram",           monthlyCost: 40,  setupCost: 0,  priceBrl: 0,  displayName: "Telegram",           iconEmoji: "✈️",  category: "messengers", description: "Conecte bots e canais do Telegram para capturar e nutrir leads automaticamente." },
  { appSlug: "facebook-messenger", monthlyCost: 60,  setupCost: 0,  priceBrl: 49, displayName: "Facebook Messenger", iconEmoji: "💙", category: "messengers", description: "Integre o Messenger do Facebook e responda mensagens pelo CRM." },
  { appSlug: "tiktok",             monthlyCost: 50,  setupCost: 20, priceBrl: 49, displayName: "TikTok",             iconEmoji: "🎵", category: "messengers", description: "Capture leads e mensagens do TikTok Business direto no NASA." },
  { appSlug: "linkedin",           monthlyCost: 50,  setupCost: 20, priceBrl: 49, displayName: "LinkedIn",           iconEmoji: "💼", category: "messengers", description: "Integre conexões e mensagens do LinkedIn ao CRM e pipeline." },
  { appSlug: "slack",              monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Slack",              iconEmoji: "🟦", category: "messengers", description: "Receba notificações e alertas do NASA diretamente no seu workspace Slack." },
  { appSlug: "discord",            monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Discord",            iconEmoji: "🎮", category: "messengers", description: "Conecte servidores Discord para capturar leads e enviar notificações." },

  // ── CRM & Vendas ─────────────────────────────────────────────────────────────
  { appSlug: "kommo",              monthlyCost: 60,  setupCost: 30, priceBrl: 49, displayName: "Kommo",              iconEmoji: "🤝", category: "crm", description: "Sincronize leads, negócios e conversas entre o Kommo e o NASA." },
  { appSlug: "hubspot",            monthlyCost: 80,  setupCost: 30, priceBrl: 49, displayName: "HubSpot",            iconEmoji: "🟠", category: "crm", description: "Integre contatos, pipelines e automações do HubSpot ao NASA." },
  { appSlug: "salesforce",         monthlyCost: 100, setupCost: 50, priceBrl: 49, displayName: "Salesforce",         iconEmoji: "☁️",  category: "crm", description: "Sincronize dados do Salesforce com o CRM NASA em tempo real." },
  { appSlug: "pipedrive",          monthlyCost: 60,  setupCost: 20, priceBrl: 49, displayName: "Pipedrive",          iconEmoji: "🔵", category: "crm", description: "Importe negócios e atividades do Pipedrive para o pipeline NASA." },
  { appSlug: "rd-station",         monthlyCost: 60,  setupCost: 20, priceBrl: 49, displayName: "RD Station CRM",    iconEmoji: "🟢", category: "crm", description: "Sincronize leads e funil de vendas do RD Station CRM com o NASA." },
  { appSlug: "agendor",            monthlyCost: 40,  setupCost: 10, priceBrl: 0,  displayName: "Agendor",            iconEmoji: "📋", category: "crm", description: "Migre e sincronize dados do Agendor para o NASA CRM." },
  { appSlug: "piperun",            monthlyCost: 40,  setupCost: 10, priceBrl: 0,  displayName: "Piperun",            iconEmoji: "🔄", category: "crm", description: "Integre negócios e pipeline do Piperun ao NASA." },

  // ── Marketing ────────────────────────────────────────────────────────────────
  { appSlug: "meta-ads",           monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "Meta Ads",           iconEmoji: "📢", category: "marketing", description: "Importe leads do Facebook e Instagram Ads diretamente no pipeline NASA." },
  { appSlug: "google-ads",         monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "Google Ads",         iconEmoji: "🎯", category: "marketing", description: "Capture leads do Google Ads e acompanhe conversões no NASA." },
  { appSlug: "rd-station-mkt",     monthlyCost: 50,  setupCost: 20, priceBrl: 49, displayName: "RD Station Mkt",     iconEmoji: "📣", category: "marketing", description: "Sincronize leads e fluxos de automação do RD Station Marketing." },
  { appSlug: "active-campaign",    monthlyCost: 50,  setupCost: 20, priceBrl: 49, displayName: "ActiveCampaign",     iconEmoji: "📬", category: "marketing", description: "Integre automações de e-mail e segmentação do ActiveCampaign." },
  { appSlug: "mailchimp",          monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Mailchimp",          iconEmoji: "🐒", category: "marketing", description: "Sincronize listas e campanhas do Mailchimp com leads NASA." },
  { appSlug: "leadlovers",         monthlyCost: 40,  setupCost: 0,  priceBrl: 0,  displayName: "Leadlovers",         iconEmoji: "🎣", category: "marketing", description: "Conecte funis e leads do Leadlovers ao CRM e pipeline NASA." },

  // ── IA & Automação ───────────────────────────────────────────────────────────
  { appSlug: "openai",             monthlyCost: 60,  setupCost: 10, priceBrl: 49, displayName: "OpenAI / ChatGPT",   iconEmoji: "🤖", category: "ai", description: "Potencialize o ASTRO com GPT-4. Resumos, análises e respostas inteligentes." },
  { appSlug: "google-gemini",      monthlyCost: 50,  setupCost: 10, priceBrl: 49, displayName: "Google Gemini",      iconEmoji: "✨", category: "ai", description: "Integre o Gemini para análises multimodais e automação inteligente." },
  { appSlug: "anthropic",          monthlyCost: 60,  setupCost: 10, priceBrl: 49, displayName: "Anthropic Claude",   iconEmoji: "🧠", category: "ai", description: "Use o Claude da Anthropic para análises contextuais profundas no ASTRO." },
  { appSlug: "zapier",             monthlyCost: 50,  setupCost: 0,  priceBrl: 0,  displayName: "Zapier",             iconEmoji: "⚡", category: "ai", description: "Automatize ações entre NASA e +5.000 apps via Zapier." },
  { appSlug: "make",               monthlyCost: 50,  setupCost: 0,  priceBrl: 0,  displayName: "Make (Integromat)",  iconEmoji: "🔧", category: "ai", description: "Construa fluxos de automação complexos entre NASA e centenas de ferramentas." },
  { appSlug: "n8n",                monthlyCost: 40,  setupCost: 0,  priceBrl: 0,  displayName: "n8n",                iconEmoji: "🔀", category: "ai", description: "Automações self-hosted ilimitadas conectando NASA a qualquer sistema." },

  // ── Pagamentos ───────────────────────────────────────────────────────────────
  { appSlug: "stripe",             monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Stripe",             iconEmoji: "💳", category: "payments", description: "Processe pagamentos internacionais e gerencie assinaturas com Stripe." },
  { appSlug: "asaas",              monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Asaas",              iconEmoji: "🏦", category: "payments", description: "PIX, boleto e cartão via Asaas, integrado ao FORGE e ao CRM." },
  { appSlug: "mercado-pago",       monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "Mercado Pago",       iconEmoji: "💰", category: "payments", description: "Receba pagamentos via Mercado Pago com notificação automática no CRM." },
  { appSlug: "hotmart",            monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "Hotmart",            iconEmoji: "🔥", category: "payments", description: "Capture leads e compras do Hotmart direto no pipeline de vendas." },
  { appSlug: "pagseguro",          monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "PagSeguro",          iconEmoji: "💵", category: "payments", description: "Integre cobranças do PagSeguro com notificações automáticas no NASA." },

  // ── Formulários ──────────────────────────────────────────────────────────────
  { appSlug: "typeform",           monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Typeform",           iconEmoji: "📝", category: "forms", description: "Capture leads qualificados via formulários Typeform direto no pipeline." },
  { appSlug: "google-forms",       monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Google Forms",       iconEmoji: "📋", category: "forms", description: "Sincronize respostas do Google Forms como leads no CRM NASA." },
  { appSlug: "jotform",            monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "JotForm",            iconEmoji: "📄", category: "forms", description: "Envie respostas de formulários JotForm para o funil de vendas." },
  { appSlug: "tally",              monthlyCost: 15,  setupCost: 0,  priceBrl: 0,  displayName: "Tally",              iconEmoji: "🗂️",  category: "forms", description: "Converta respostas de forms Tally em leads automáticos no NASA." },

  // ── Analytics ────────────────────────────────────────────────────────────────
  { appSlug: "google-analytics",   monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Google Analytics",   iconEmoji: "📊", category: "analytics", description: "Correlacione dados de tráfego do GA4 com o funil de vendas NASA." },
  { appSlug: "hotjar",             monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Hotjar",             iconEmoji: "🔥", category: "analytics", description: "Visualize comportamento de usuários e correlacione com leads gerados." },
  { appSlug: "looker-studio",      monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Looker Studio",      iconEmoji: "🔭", category: "analytics", description: "Exporte dados do NASA para dashboards visuais no Looker Studio." },

  // ── E-Commerce ───────────────────────────────────────────────────────────────
  { appSlug: "shopify",            monthlyCost: 80,  setupCost: 30, priceBrl: 49, displayName: "Shopify",            iconEmoji: "🛍️",  category: "ecommerce", description: "Capture pedidos e clientes do Shopify como leads no CRM NASA." },
  { appSlug: "woocommerce",        monthlyCost: 60,  setupCost: 20, priceBrl: 49, displayName: "WooCommerce",        iconEmoji: "🛒", category: "ecommerce", description: "Sincronize compras do WooCommerce com o pipeline de vendas." },
  { appSlug: "nuvemshop",          monthlyCost: 60,  setupCost: 20, priceBrl: 49, displayName: "Nuvemshop",          iconEmoji: "☁️",  category: "ecommerce", description: "Integre pedidos e clientes da Nuvemshop ao funil NASA." },
  { appSlug: "mercado-livre",      monthlyCost: 60,  setupCost: 20, priceBrl: 49, displayName: "Mercado Livre",      iconEmoji: "🟡", category: "ecommerce", description: "Capture compradores e perguntas do ML como leads no CRM." },

  // ── Assinatura Digital ───────────────────────────────────────────────────────
  { appSlug: "docusign",           monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "DocuSign",           iconEmoji: "✍️",  category: "documents", description: "Envie e assine contratos via DocuSign direto do FORGE." },
  { appSlug: "clicksign",          monthlyCost: 40,  setupCost: 0,  priceBrl: 49, displayName: "ClickSign",          iconEmoji: "✅", category: "documents", description: "Assinatura digital de contratos brasileiros integrada ao FORGE." },
  { appSlug: "d4sign",             monthlyCost: 30,  setupCost: 0,  priceBrl: 49, displayName: "D4Sign",             iconEmoji: "📜", category: "documents", description: "Assine documentos com validade jurídica via D4Sign no FORGE." },
  { appSlug: "google-drive",       monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Google Drive",       iconEmoji: "📁", category: "documents", description: "Sincronize arquivos do Drive com o N.Box da organização NASA." },

  // ── Produtividade ────────────────────────────────────────────────────────────
  { appSlug: "google-workspace",   monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Google Workspace",   iconEmoji: "🏢", category: "productivity", description: "Integre Gmail, Calendar e Drive do Google Workspace ao NASA." },
  { appSlug: "microsoft-365",      monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Microsoft 365",      iconEmoji: "💻", category: "productivity", description: "Conecte Outlook, Teams e OneDrive do M365 ao NASA." },
  { appSlug: "zoom",               monthlyCost: 30,  setupCost: 0,  priceBrl: 0,  displayName: "Zoom",               iconEmoji: "📹", category: "productivity", description: "Agende reuniões Zoom vinculadas a leads e appointments do NASA." },
  { appSlug: "calendly",           monthlyCost: 20,  setupCost: 0,  priceBrl: 0,  displayName: "Calendly",           iconEmoji: "📅", category: "productivity", description: "Sincronize agendamentos do Calendly com a Agenda NASA." },
];

async function main() {
  // ── Plans — usuários ilimitados em todos os planos ────────────────────────
  // maxUsers = 999999 = ilimitado; custo por usuário = 30★/mês (user-seat)
  const plans = [
    { slug: "suit",         name: "Suit",         monthlyStars: 0,     priceMonthly: 0,   maxUsers: 999999, rolloverPct: 0  },
    { slug: "earth",        name: "Earth",        monthlyStars: 1000,  priceMonthly: 197, maxUsers: 999999, rolloverPct: 20 },
    { slug: "explore",      name: "Explore",      monthlyStars: 3000,  priceMonthly: 397, maxUsers: 999999, rolloverPct: 25 },
    { slug: "constellation",name: "Constellation",monthlyStars: 20000, priceMonthly: 797, maxUsers: 999999, rolloverPct: 30 },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where:  { slug: plan.slug },
      update: {},
      create: plan,
    });
  }

  // ── Star packages ──────────────────────────────────────────────────────────
  const packages = [
    { id: "pkg_100",  stars: 100,  priceBrl: 19,  label: "100 ★"    },
    { id: "pkg_500",  stars: 500,  priceBrl: 79,  label: "500 ★"    },
    { id: "pkg_1000", stars: 1000, priceBrl: 139, label: "1.000 ★"  },
    { id: "pkg_3000", stars: 3000, priceBrl: 349, label: "3.000 ★"  },
    { id: "pkg_5000", stars: 5000, priceBrl: 549, label: "5.000 ★"  },
  ];

  for (const pkg of packages) {
    await prisma.starPackage.upsert({
      where:  { id: pkg.id },
      update: {},
      create: pkg,
    });
  }

  // ── App star costs ─────────────────────────────────────────────────────────
  // Custo por usuário ativo/mês (regra global)
  await prisma.appStarCost.upsert({
    where:  { appSlug: "user-seat" },
    update: { monthlyCost: 30, displayName: "Usuário Ativo", iconEmoji: "👤", category: "platform",
              description: "Cada usuário ativo custa 30★/mês. Usuários ilimitados em qualquer plano.", isPublic: false },
    create: { appSlug: "user-seat", monthlyCost: 30, setupCost: 0,
              displayName: "Usuário Ativo", iconEmoji: "👤", category: "platform",
              description: "Cada usuário ativo custa 30★/mês. Usuários ilimitados em qualquer plano.", isPublic: false },
  });

  for (const app of APP_CATALOG) {
    await prisma.appStarCost.upsert({
      where:  { appSlug: app.appSlug },
      update: {
        monthlyCost: app.monthlyCost,
        setupCost:   app.setupCost,
        priceBrl:    app.priceBrl,
        displayName: app.displayName,
        iconEmoji:   app.iconEmoji,
        category:    app.category,
        description: app.description,
        isPublic:    true,
      },
      create: {
        appSlug:     app.appSlug,
        monthlyCost: app.monthlyCost,
        setupCost:   app.setupCost,
        priceBrl:    app.priceBrl,
        displayName: app.displayName,
        iconEmoji:   app.iconEmoji,
        category:    app.category,
        description: app.description,
        isPublic:    true,
      },
    });
  }

  console.log(`✅ Seed concluído — ${plans.length} planos, ${packages.length} pacotes, ${APP_CATALOG.length} apps.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
