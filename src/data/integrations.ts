import type { Integration } from "@/types/integration";

export const integrations: Integration[] = [
  // ── MESSENGERS ──────────────────────────────────────────────────────────────
  {
    id: "whatsapp-business",
    slug: "whatsapp-business",
    name: "WhatsApp Business",
    description:
      "Receba e envie mensagens diretamente pelo WhatsApp Business. Integre conversas, leads e automações.",
    category: "messengers",
    status: "installed",
    icon: "https://www.google.com/s2/favicons?domain=whatsapp.com&sz=128",
    tags: ["Popular", "Instalado"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Green WhatsApp logo floating in deep space, stars background, nebula",
    credentials: [
      {
        key: "phone_number_id",
        label: "Phone Number ID",
        type: "text",
        placeholder: "123456789012345",
        helpText:
          "Encontre em Meta Business Suite → WhatsApp → Configurações da API",
        helpUrl:
          "https://business.facebook.com/settings/whatsapp-business-accounts",
        required: true,
      },
      {
        key: "access_token",
        label: "Token de Acesso Permanente",
        type: "password",
        placeholder: "EAABs0mething...",
        helpText:
          "Gere em Meta Business → Configurações do Sistema → Token de Acesso do Sistema",
        helpUrl:
          "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
        required: true,
      },
      {
        key: "verify_token",
        label: "Token de Verificação do Webhook",
        type: "text",
        placeholder: "meu_token_secreto_123",
        helpText:
          "Crie qualquer string secreta. Use o mesmo valor ao configurar o Webhook na Meta",
        required: true,
      },
    ],
  },
  {
    id: "instagram-dm",
    slug: "instagram-dm",
    name: "Instagram DM",
    description:
      "Gerencie mensagens diretas do Instagram, capture leads e responda através do NASA.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=instagram.com&sz=128",
    tags: ["Social"],
    hubPageEnabled: true,
    spaceImagePrompt: "Instagram gradient logo in space, cosmic background",
    oauthProvider: "meta",
    manualFallback: true,
    credentials: [
      {
        key: "instagram_account_id",
        label: "ID da Conta Instagram Business",
        type: "text",
        placeholder: "17841400000000000",
        helpText:
          "Acesse Meta Business Suite → Instagram → Configurações → ID da Conta",
        helpUrl: "https://business.facebook.com/settings/instagram-accounts",
        required: true,
      },
      {
        key: "access_token",
        label: "Token de Acesso da Página",
        type: "password",
        placeholder: "EAABs0mething...",
        helpText:
          "Gere em Meta Developers com permissões instagram_basic, instagram_manage_messages e pages_messaging",
        helpUrl:
          "https://developers.facebook.com/docs/instagram-api/getting-started",
        required: true,
      },
    ],
  },
  {
    id: "telegram",
    slug: "telegram",
    name: "Telegram",
    description:
      "Conecte bots e canais do Telegram para capturar e nutrir leads automaticamente.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=telegram.org&sz=128",
    tags: ["Bot"],
    hubPageEnabled: true,
    spaceImagePrompt: "Telegram blue logo in outer space with satellite",
    credentials: [
      {
        key: "bot_token",
        label: "Token do Bot",
        type: "password",
        placeholder: "1234567890:ABCDefghIJKlmnoPQRstuVWXyz",
        helpText:
          "Crie um bot enviando /newbot para @BotFather no Telegram e copie o token gerado",
        helpUrl: "https://t.me/BotFather",
        required: true,
      },
    ],
  },
  {
    id: "facebook-messenger",
    slug: "facebook-messenger",
    name: "Facebook Messenger",
    description:
      "Integre o Messenger do Facebook e responda mensagens diretamente pelo CRM.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=messenger.com&sz=128",
    tags: ["Meta"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Facebook Messenger logo floating in nebula, purple-blue space",
    oauthProvider: "meta",
    manualFallback: true,
    credentials: [
      {
        key: "page_id",
        label: "ID da Página do Facebook",
        type: "text",
        placeholder: "123456789012345",
        helpText:
          'Acesse sua Página no Facebook → Sobre → ID da Página (campo "Informações da Página")',
        helpUrl: "https://www.facebook.com/pages/",
        required: true,
      },
      {
        key: "page_access_token",
        label: "Token de Acesso da Página",
        type: "password",
        placeholder: "EAABs0mething...",
        helpText:
          "Gere em Meta Developers → Sua App → Ferramentas → Graph API Explorer",
        helpUrl: "https://developers.facebook.com/tools/explorer/",
        required: true,
      },
      {
        key: "verify_token",
        label: "Token de Verificação do Webhook",
        type: "text",
        placeholder: "meu_webhook_token",
        helpText:
          "Crie qualquer string secreta e use o mesmo valor ao configurar o Webhook no Meta",
        required: true,
      },
    ],
  },
  {
    id: "tiktok",
    slug: "tiktok",
    name: "TikTok",
    description:
      "Capture leads e mensagens do TikTok. Conecte sua conta Business e gerencie tudo pelo NASA.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=tiktok.com&sz=128",
    tags: ["Social", "Novo"],
    hubPageEnabled: true,
    spaceImagePrompt: "TikTok logo floating in neon space with music notes",
    credentials: [
      {
        key: "client_key",
        label: "Client Key (App ID)",
        type: "text",
        placeholder: "awxxxxxxxxxxxxx",
        helpText:
          "Acesse TikTok for Developers → Gerenciar Apps → selecione seu app → Chaves e Credenciais",
        helpUrl: "https://developers.tiktok.com/",
        required: true,
      },
      {
        key: "client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        helpText:
          "Disponível na mesma página de Chaves e Credenciais do seu app",
        helpUrl: "https://developers.tiktok.com/",
        required: true,
      },
    ],
  },
  {
    id: "linkedin",
    slug: "linkedin",
    name: "LinkedIn",
    description:
      "Conecte sua página do LinkedIn para capturar leads, gerenciar mensagens e analisar performance comercial.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=linkedin.com&sz=128",
    tags: ["Social", "B2B"],
    hubPageEnabled: true,
    spaceImagePrompt: "LinkedIn blue logo in professional space environment",
    credentials: [
      {
        key: "client_id",
        label: "Client ID",
        type: "text",
        placeholder: "86xxxxxxxxxx",
        helpText:
          "Acesse LinkedIn Developers → Meus Apps → selecione seu app → Credenciais OAuth 2.0",
        helpUrl: "https://www.linkedin.com/developers/apps",
        required: true,
      },
      {
        key: "client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "xxxxxxxxxxxxxxxx",
        helpText:
          "Disponível na aba Credenciais OAuth 2.0 do seu app no LinkedIn Developers",
        helpUrl: "https://www.linkedin.com/developers/apps",
        required: true,
      },
    ],
  },
  {
    id: "discord",
    slug: "discord",
    name: "Discord",
    description:
      "Notificações e alertas de novos leads diretamente em canais do Discord.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=discord.com&sz=128",
    tags: ["Notificações"],
    hubPageEnabled: false,
  },
  {
    id: "slack",
    slug: "slack",
    name: "Slack",
    description:
      "Receba notificações de leads, propostas e contratos em tempo real no Slack.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=slack.com&sz=128",
    tags: ["Notificações"],
    hubPageEnabled: true,
    spaceImagePrompt: "Slack colorful logo in zero gravity space station",
    credentials: [
      {
        key: "bot_token",
        label: "Bot User OAuth Token",
        type: "password",
        placeholder: "Cole aqui o Bot User OAuth Token do Slack",
        helpText:
          "Acesse api.slack.com/apps → selecione seu app → OAuth & Permissions → Bot User OAuth Token",
        helpUrl: "https://api.slack.com/apps",
        required: true,
      },
      {
        key: "webhook_url",
        label: "Incoming Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/T.../B.../xxx...",
        helpText:
          "Em api.slack.com/apps → Incoming Webhooks → Adicionar novo Webhook ao Workspace",
        helpUrl: "https://api.slack.com/apps",
        required: false,
      },
    ],
  },
  {
    id: "microsoft-teams",
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    description:
      "Envie alertas e relatórios de vendas diretamente para canais do Teams.",
    category: "messengers",
    status: "available",
    icon: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
    tags: ["Empresarial"],
    hubPageEnabled: false,
  },

  // ── WHATSAPP PROVIDERS ───────────────────────────────────────────────────────
  {
    id: "360dialog",
    slug: "360dialog",
    name: "360dialog",
    description:
      "Provedor oficial Meta Business para WhatsApp com alta taxa de entrega e API robusta.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/360dialog.com",
    tags: ["Oficial Meta"],
    hubPageEnabled: true,
    spaceImagePrompt: "WhatsApp API provider logo in cosmic digital space",
  },
  {
    id: "twilio-whatsapp",
    slug: "twilio-whatsapp",
    name: "Twilio WhatsApp",
    description:
      "Use o Twilio como canal de WhatsApp com APIs confiáveis e alta escalabilidade.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/twilio.com",
    tags: ["Global"],
    hubPageEnabled: false,
  },
  {
    id: "zenvia-whatsapp",
    slug: "zenvia-whatsapp",
    name: "Zenvia",
    description:
      "Solução brasileira para WhatsApp Business com suporte local e plataforma completa.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/zenvia.com",
    tags: ["Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "infobip",
    slug: "infobip",
    name: "Infobip",
    description:
      "Plataforma global de comunicação com suporte completo ao WhatsApp Business API.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/infobip.com",
    tags: ["Global", "Enterprise"],
    hubPageEnabled: false,
  },
  {
    id: "take-blip-wp",
    slug: "take-blip-wp",
    name: "Take Blip",
    description:
      "Provedor WhatsApp com IA nativa para automação de conversas e suporte ao cliente.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/take.net",
    tags: ["IA", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "gupshup",
    slug: "gupshup",
    name: "Gupshup",
    description:
      "API de mensagens para WhatsApp e SMS com alta escalabilidade e preços competitivos.",
    category: "whatsapp_providers",
    status: "available",
    icon: "https://logo.clearbit.com/gupshup.io",
    tags: ["API"],
    hubPageEnabled: false,
  },

  // ── LIVE CHAT ────────────────────────────────────────────────────────────────
  {
    id: "intercom",
    slug: "intercom",
    name: "Intercom",
    description:
      "Plataforma de suporte e engajamento com chat ao vivo, bots e CRM integrado.",
    category: "live_chat",
    status: "available",
    icon: "https://logo.clearbit.com/intercom.com",
    tags: ["SaaS", "Popular"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Intercom customer support logo in modern space digital environment",
  },
  {
    id: "crisp",
    slug: "crisp",
    name: "Crisp",
    description:
      "Chat ao vivo com CRM embutido, chatbots e base de conhecimento para equipes de suporte.",
    category: "live_chat",
    status: "available",
    icon: "https://logo.clearbit.com/crisp.chat",
    tags: ["Freemium"],
    hubPageEnabled: false,
  },
  {
    id: "tawk-to",
    slug: "tawk-to",
    name: "Tawk.to",
    description:
      "Chat ao vivo gratuito com painel centralizado para múltiplos agentes.",
    category: "live_chat",
    status: "available",
    icon: "https://logo.clearbit.com/tawk.to",
    tags: ["Gratuito"],
    hubPageEnabled: false,
  },
  {
    id: "livechat",
    slug: "livechat",
    name: "LiveChat",
    description:
      "Software profissional de chat ao vivo com análises avançadas e integrações.",
    category: "live_chat",
    status: "available",
    icon: "https://logo.clearbit.com/livechat.com",
    tags: ["Empresarial"],
    hubPageEnabled: false,
  },
  {
    id: "chatwoot",
    slug: "chatwoot",
    name: "Chatwoot",
    description:
      "Plataforma open-source de suporte ao cliente com chat, email e redes sociais.",
    category: "live_chat",
    status: "available",
    icon: "https://logo.clearbit.com/chatwoot.com",
    tags: ["Open Source"],
    hubPageEnabled: false,
  },

  // ── FORMS ────────────────────────────────────────────────────────────────────
  {
    id: "yay-forms",
    slug: "yay-forms",
    name: "Yay! Forms",
    description:
      "Formulários inteligentes com IA para captura de leads de alta qualidade.",
    category: "forms",
    status: "view_only",
    icon: "https://logo.clearbit.com/yayforms.com",
    tags: ["IA", "Visualizar"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Yay Forms colorful survey floating in space, form fields orbiting",
  },
  {
    id: "typeform",
    slug: "typeform",
    name: "Typeform",
    description:
      "Formulários conversacionais bonitos e envolventes para captura de leads.",
    category: "forms",
    status: "available",
    icon: "https://logo.clearbit.com/typeform.com",
    tags: ["Popular", "Design"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Typeform elegant form design in space, minimalist cosmic background",
  },
  {
    id: "google-forms",
    slug: "google-forms",
    name: "Google Forms",
    description:
      "Sincronize respostas de formulários Google diretamente como leads no NASA.",
    category: "forms",
    status: "available",
    icon: "https://logo.clearbit.com/google.com",
    tags: ["Google", "Gratuito"],
    hubPageEnabled: false,
  },
  {
    id: "jotform",
    slug: "jotform",
    name: "JotForm",
    description:
      "Criador de formulários com mais de 10.000 templates e integrações nativas.",
    category: "forms",
    status: "available",
    icon: "https://logo.clearbit.com/jotform.com",
    tags: ["Templates"],
    hubPageEnabled: false,
  },
  {
    id: "tally",
    slug: "tally",
    name: "Tally",
    description:
      "Formulários gratuitos e sem limite com aparência moderna tipo Notion.",
    category: "forms",
    status: "available",
    icon: "https://logo.clearbit.com/tally.so",
    tags: ["Gratuito", "Novo"],
    hubPageEnabled: false,
  },
  {
    id: "fillout",
    slug: "fillout",
    name: "Fillout",
    description:
      "Formulários avançados com lógica condicional e integrações poderosas.",
    category: "forms",
    status: "available",
    icon: "https://logo.clearbit.com/fillout.com",
    tags: ["Lógica"],
    hubPageEnabled: false,
  },

  // ── ECOMMERCE ────────────────────────────────────────────────────────────────
  {
    id: "shopify",
    slug: "shopify",
    name: "Shopify",
    description:
      "Sincronize clientes, pedidos e abandono de carrinho como leads no CRM.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/shopify.com",
    tags: ["Popular", "Global"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Shopify green logo in cosmic e-commerce space, shopping bags floating",
  },
  {
    id: "woocommerce",
    slug: "woocommerce",
    name: "WooCommerce",
    description:
      "Integre sua loja WordPress/WooCommerce e gerencie clientes como leads.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/woocommerce.com",
    tags: ["WordPress"],
    hubPageEnabled: false,
  },
  {
    id: "nuvemshop",
    slug: "nuvemshop",
    name: "Nuvemshop",
    description:
      "A maior plataforma de e-commerce da América Latina integrada ao seu CRM.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/nuvemshop.com.br",
    tags: ["Brasileiro", "Popular"],
    hubPageEnabled: true,
    spaceImagePrompt: "Nuvemshop cloud logo in Latin American space market",
  },
  {
    id: "vtex",
    slug: "vtex",
    name: "VTEX",
    description:
      "Plataforma enterprise de e-commerce com integração completa de pedidos e clientes.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/vtex.com",
    tags: ["Enterprise", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "mercado-livre",
    slug: "mercado-livre",
    name: "Mercado Livre",
    description:
      "Importe perguntas e compradores do Mercado Livre como leads automaticamente.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/mercadolivre.com.br",
    tags: ["Marketplace", "Popular"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Mercado Livre yellow logo in space marketplace, products orbiting",
  },
  {
    id: "tray",
    slug: "tray",
    name: "Tray Commerce",
    description:
      "Sincronize clientes e vendas da plataforma Tray diretamente no CRM.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/tray.com.br",
    tags: ["Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "yampi",
    slug: "yampi",
    name: "Yampi",
    description:
      "Checkout transparente e loja virtual com integração nativa ao pipeline.",
    category: "ecommerce",
    status: "available",
    icon: "https://logo.clearbit.com/yampi.com.br",
    tags: ["Checkout"],
    hubPageEnabled: false,
  },

  // ── INDUSTRY ─────────────────────────────────────────────────────────────────
  {
    id: "imoveis",
    slug: "imoveis",
    name: "Imobiliário",
    description:
      "Integração com portais imobiliários (ZAP, Viva Real, OLX) e CRM especializado.",
    category: "industry",
    status: "available",
    icon: "🏠",
    tags: ["Segmento"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Real estate house floating in space, city skyline from orbit",
  },
  {
    id: "educacao",
    slug: "educacao",
    name: "Educação / EAD",
    description:
      "Conecte plataformas EAD (Hotmart, Eduzz, Kiwify) ao pipeline de matrículas.",
    category: "industry",
    status: "available",
    icon: "🎓",
    tags: ["Segmento", "EAD"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Education graduation cap orbiting educational space station",
  },
  {
    id: "saude",
    slug: "saude",
    name: "Saúde & Clínicas",
    description:
      "Fluxos de agendamento e nutrição de leads para consultórios e clínicas.",
    category: "industry",
    status: "available",
    icon: "🏥",
    tags: ["Segmento", "LGPD"],
    hubPageEnabled: false,
  },
  {
    id: "automotivo",
    slug: "automotivo",
    name: "Automotivo",
    description:
      "Integração com plataformas de venda de veículos e gestão de test drives.",
    category: "industry",
    status: "available",
    icon: "🚗",
    tags: ["Segmento"],
    hubPageEnabled: false,
  },
  {
    id: "juridico",
    slug: "juridico",
    name: "Jurídico",
    description:
      "Fluxos de captação e qualificação de leads para escritórios de advocacia.",
    category: "industry",
    status: "available",
    icon: "⚖️",
    tags: ["Segmento", "LGPD"],
    hubPageEnabled: false,
  },

  // ── CHATBOTS ─────────────────────────────────────────────────────────────────
  {
    id: "chatplace",
    slug: "chatplace",
    name: "ChatPlace",
    description:
      "Plataforma brasileira de chatbots para WhatsApp e redes sociais com IA.",
    category: "chatbots",
    status: "view_only",
    icon: "https://logo.clearbit.com/chatplace.com.br",
    tags: ["Visualizar", "Brasileiro"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Chatbot robot floating in space, conversation bubbles orbiting",
  },
  {
    id: "mymento",
    slug: "mymento",
    name: "mymento",
    description:
      "Assistente virtual inteligente para automação de atendimento e vendas.",
    category: "chatbots",
    status: "view_only",
    icon: "🤖",
    tags: ["Visualizar", "IA"],
    hubPageEnabled: false,
  },
  {
    id: "typebot",
    slug: "typebot",
    name: "Typebot",
    description:
      "Crie chatbots visuais open-source e integre com WhatsApp e web.",
    category: "chatbots",
    status: "available",
    icon: "https://logo.clearbit.com/typebot.io",
    tags: ["Open Source", "Visual"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Typebot visual flow builder in space, nodes connected by glowing lines",
  },
  {
    id: "manychat",
    slug: "manychat",
    name: "ManyChat",
    description:
      "Automação de marketing via chatbot no Instagram, Facebook e WhatsApp.",
    category: "chatbots",
    status: "available",
    icon: "https://logo.clearbit.com/manychat.com",
    tags: ["Popular", "Marketing"],
    hubPageEnabled: false,
  },
  {
    id: "dialogflow",
    slug: "dialogflow",
    name: "Dialogflow (Google)",
    description:
      "NLU do Google para criar chatbots inteligentes com processamento de linguagem natural.",
    category: "chatbots",
    status: "available",
    icon: "https://logo.clearbit.com/cloud.google.com",
    tags: ["IA", "Google", "NLP"],
    hubPageEnabled: false,
  },
  {
    id: "botconversa",
    slug: "botconversa",
    name: "BotConversa",
    description:
      "Plataforma brasileira de chatbot para WhatsApp com fluxos visuais fáceis.",
    category: "chatbots",
    status: "available",
    icon: "https://logo.clearbit.com/botconversa.com.br",
    tags: ["Brasileiro", "WhatsApp"],
    hubPageEnabled: false,
  },

  // ── CALLS ────────────────────────────────────────────────────────────────────
  {
    id: "api4com",
    slug: "api4com",
    name: "API4Com",
    description:
      "Discagem automática e gestão de chamadas integrada ao seu pipeline.",
    category: "calls",
    status: "view_only",
    icon: "📞",
    tags: ["Visualizar", "Discagem"],
    hubPageEnabled: true,
    spaceImagePrompt: "Phone call satellite communication in deep space",
  },
  {
    id: "avantiiva",
    slug: "avantiiva",
    name: "Avantiiva",
    description:
      "Solução de telefonia cloud com discadora e gravação de chamadas.",
    category: "calls",
    status: "view_only",
    icon: "☎️",
    tags: ["Visualizar", "Gravação"],
    hubPageEnabled: false,
  },
  {
    id: "twilio-voice",
    slug: "twilio-voice",
    name: "Twilio Voice",
    description:
      "API de voz programável para chamadas outbound/inbound com gravação.",
    category: "calls",
    status: "available",
    icon: "https://logo.clearbit.com/twilio.com",
    tags: ["API", "Global"],
    hubPageEnabled: false,
  },
  {
    id: "zenvia-voice",
    slug: "zenvia-voice",
    name: "Zenvia Voice",
    description:
      "Solução brasileira de voz com discadora automática e relatórios detalhados.",
    category: "calls",
    status: "available",
    icon: "https://logo.clearbit.com/zenvia.com",
    tags: ["Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "nuvemfone",
    slug: "nuvemfone",
    name: "Nuvemfone",
    description:
      "PABX virtual brasileiro com URA, filas e integração nativa ao CRM.",
    category: "calls",
    status: "available",
    icon: "☁️",
    tags: ["PABX", "Brasileiro"],
    hubPageEnabled: false,
  },

  // ── MARKETING ────────────────────────────────────────────────────────────────
  {
    id: "tiktok",
    slug: "tiktok",
    name: "TikTok",
    description:
      "Capture leads do TikTok Ads e orgânico diretamente no funil de vendas.",
    category: "marketing",
    status: "installed",
    icon: "https://logo.clearbit.com/tiktok.com",
    tags: ["Instalado", "Social", "Ads"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "TikTok music notes and phone floating in cosmic space with stars",
  },
  {
    id: "rd-station",
    slug: "rd-station",
    name: "RD Station",
    description:
      "Sincronize leads e automações do RD Station Marketing com o NASA CRM.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/rdstation.com",
    tags: ["Brasileiro", "Popular", "Email"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "RD Station rocket logo launching into digital marketing space",
  },
  {
    id: "active-campaign",
    slug: "active-campaign",
    name: "ActiveCampaign",
    description:
      "CRM de marketing com automação de email, SMS e comportamento de leads.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/activecampaign.com",
    tags: ["Email", "Automação"],
    hubPageEnabled: false,
  },
  {
    id: "hubspot-marketing",
    slug: "hubspot-marketing",
    name: "HubSpot Marketing",
    description:
      "Sincronize contatos, negócios e campanhas de email do HubSpot.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/hubspot.com",
    tags: ["Enterprise", "Email"],
    hubPageEnabled: false,
  },
  {
    id: "mailchimp",
    slug: "mailchimp",
    name: "Mailchimp",
    description:
      "Adicione leads a listas e sequências de email marketing do Mailchimp.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/mailchimp.com",
    tags: ["Email", "Popular"],
    hubPageEnabled: false,
  },
  {
    id: "google-ads",
    slug: "google-ads",
    name: "Google Ads",
    description:
      "Importe leads de formulários do Google Ads e rastreie conversões.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/ads.google.com",
    tags: ["Ads", "Google"],
    hubPageEnabled: true,
    oauthProvider: "google",
  },
  {
    id: "facebook-ads",
    slug: "facebook-ads",
    name: "Facebook Lead Ads",
    description:
      "Capture leads de campanhas Lead Ads do Facebook automaticamente.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/facebook.com",
    tags: ["Ads", "Meta"],
    hubPageEnabled: true,
    oauthProvider: "meta",
    spaceImagePrompt:
      "Facebook blue logo in advertising space, lead forms floating",
  },
  {
    id: "leadlovers",
    slug: "leadlovers",
    name: "Leadlovers",
    description:
      "Plataforma brasileira de automação de marketing digital com email e SMS.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/leadlovers.com",
    tags: ["Brasileiro", "Email"],
    hubPageEnabled: false,
  },
  {
    id: "klavio",
    slug: "klavio",
    name: "Klaviyo",
    description:
      "Automação de marketing para e-commerce com segmentação avançada.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/klaviyo.com",
    tags: ["E-commerce", "Email"],
    hubPageEnabled: false,
  },
  {
    id: "brevo",
    slug: "brevo",
    name: "Brevo (Sendinblue)",
    description:
      "Email marketing e automação com planos acessíveis e IPs dedicados.",
    category: "marketing",
    status: "available",
    icon: "https://logo.clearbit.com/brevo.com",
    tags: ["Email", "Freemium"],
    hubPageEnabled: false,
  },

  // ── PAYMENTS ─────────────────────────────────────────────────────────────────
  {
    id: "pagseguro",
    slug: "pagseguro",
    name: "PagSeguro",
    description:
      "Receba pagamentos via boleto, PIX e cartão com checkout do PagSeguro.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/pagseguro.uol.com.br",
    tags: ["Brasileiro", "Boleto"],
    hubPageEnabled: false,
  },
  {
    id: "mercado-pago",
    slug: "mercado-pago",
    name: "Mercado Pago",
    description:
      "Gerencie cobranças e pagamentos via Mercado Pago integrado ao FORGE.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/mercadopago.com.br",
    tags: ["Brasileiro", "Popular"],
    hubPageEnabled: false,
  },
  {
    id: "stripe",
    slug: "stripe",
    name: "Stripe",
    description:
      "API de pagamentos global para assinaturas, links e cobranças recorrentes.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/stripe.com",
    tags: ["Global", "API"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Stripe payment purple logo floating in financial digital space",
  },
  {
    id: "asaas",
    slug: "asaas",
    name: "Asaas",
    description:
      "Fintech brasileira para cobranças, boletos, PIX e assinaturas.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/asaas.com",
    tags: ["Brasileiro", "Fintech"],
    hubPageEnabled: false,
  },
  {
    id: "vindi",
    slug: "vindi",
    name: "Vindi",
    description:
      "Plataforma de recorrência e assinaturas com gestão completa de cobranças.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/vindi.com.br",
    tags: ["Recorrência", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "pagarme",
    slug: "pagarme",
    name: "Pagar.me",
    description:
      "Gateway de pagamentos para marketplace e plataformas digitais brasileiras.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/pagar.me",
    tags: ["Marketplace", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "cielo",
    slug: "cielo",
    name: "Cielo",
    description:
      "Integre a maior adquirente do Brasil para pagamentos físicos e online.",
    category: "payments",
    status: "available",
    icon: "https://logo.clearbit.com/cielo.com.br",
    tags: ["Adquirente", "Brasileiro"],
    hubPageEnabled: false,
  },

  // ── INTEGRATION SERVICES ─────────────────────────────────────────────────────
  {
    id: "zapier",
    slug: "zapier",
    name: "Zapier",
    description: "Conecte o NASA com mais de 5.000 apps sem código via Zapier.",
    category: "integration_services",
    status: "view_only",
    icon: "https://logo.clearbit.com/zapier.com",
    tags: ["Visualizar", "No-code", "Popular"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Zapier orange Z logo connecting apps in space with lightning bolts",
  },
  {
    id: "pluga",
    slug: "pluga",
    name: "Pluga",
    description:
      "Automações entre apps brasileiras e internacionais sem precisar codar.",
    category: "integration_services",
    status: "view_only",
    icon: "https://logo.clearbit.com/pluga.co",
    tags: ["Visualizar", "Brasileiro", "No-code"],
    hubPageEnabled: false,
  },
  {
    id: "make",
    slug: "make",
    name: "Make (Integromat)",
    description:
      "Automações visuais avançadas com lógica complexa e mais de 1.500 apps.",
    category: "integration_services",
    status: "available",
    icon: "https://logo.clearbit.com/make.com",
    tags: ["Visual", "Avançado"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Make automation circular modules orbiting each other in purple space",
  },
  {
    id: "n8n",
    slug: "n8n",
    name: "n8n",
    description:
      "Automação open-source self-hosted com workflows avançados e flexíveis.",
    category: "integration_services",
    status: "available",
    icon: "https://logo.clearbit.com/n8n.io",
    tags: ["Open Source", "Self-hosted"],
    hubPageEnabled: false,
  },
  {
    id: "pabbly",
    slug: "pabbly",
    name: "Pabbly Connect",
    description:
      "Automações sem limite de tarefas com preço fixo e mais de 1.000 integrações.",
    category: "integration_services",
    status: "available",
    icon: "https://logo.clearbit.com/pabbly.com",
    tags: ["Ilimitado"],
    hubPageEnabled: false,
  },
  {
    id: "activepieces",
    slug: "activepieces",
    name: "Activepieces",
    description:
      "Alternativa open-source ao Zapier com foco em privacidade e customização.",
    category: "integration_services",
    status: "available",
    icon: "https://logo.clearbit.com/activepieces.com",
    tags: ["Open Source", "Novo"],
    hubPageEnabled: false,
  },

  // ── WORKFLOW ─────────────────────────────────────────────────────────────────
  {
    id: "trello",
    slug: "trello",
    name: "Trello",
    description:
      "Sincronize leads como cartões no Trello e acompanhe o progresso visual.",
    category: "workflow",
    status: "available",
    icon: "https://logo.clearbit.com/trello.com",
    tags: ["Kanban", "Popular"],
    hubPageEnabled: false,
  },
  {
    id: "asana",
    slug: "asana",
    name: "Asana",
    description:
      "Crie tarefas no Asana automaticamente ao mover leads no pipeline.",
    category: "workflow",
    status: "available",
    icon: "https://logo.clearbit.com/asana.com",
    tags: ["Tarefas", "Equipes"],
    hubPageEnabled: false,
  },
  {
    id: "notion",
    slug: "notion",
    name: "Notion",
    description:
      "Sincronize dados de leads e propostas com bases de dados do Notion.",
    category: "workflow",
    status: "available",
    icon: "https://logo.clearbit.com/notion.so",
    tags: ["Base de dados"],
    hubPageEnabled: false,
  },
  {
    id: "clickup",
    slug: "clickup",
    name: "ClickUp",
    description:
      "Gestão de projetos e tarefas integrada ao pipeline de leads e clientes.",
    category: "workflow",
    status: "available",
    icon: "https://logo.clearbit.com/clickup.com",
    tags: ["Projetos", "All-in-one"],
    hubPageEnabled: false,
  },
  {
    id: "monday",
    slug: "monday",
    name: "Monday.com",
    description: "Acompanhe projetos e processos de clientes integrado ao CRM.",
    category: "workflow",
    status: "available",
    icon: "https://logo.clearbit.com/monday.com",
    tags: ["Projetos", "Visual"],
    hubPageEnabled: false,
  },

  // ── ANALYTICS ────────────────────────────────────────────────────────────────
  {
    id: "relatorios-mkt",
    slug: "relatorios-mkt",
    name: "Relatórios de Marketing e Vendas",
    description: "Dashboard completo de marketing e vendas integrado ao NASA.",
    category: "analytics",
    status: "view_only",
    icon: "📊",
    tags: ["Visualizar", "Dashboard"],
    hubPageEnabled: false,
  },
  {
    id: "dashboards-k2on",
    slug: "dashboards-k2on",
    name: "Dashboards K2ON",
    description: "Painéis interativos de análise de performance e conversão.",
    category: "analytics",
    status: "view_only",
    icon: "📈",
    tags: ["Visualizar", "KPI"],
    hubPageEnabled: false,
  },
  {
    id: "stract",
    slug: "stract",
    name: "Stract",
    description:
      "Análise e atribuição de marketing com dados unificados de múltiplas fontes.",
    category: "analytics",
    status: "view_only",
    icon: "https://logo.clearbit.com/stract.com",
    tags: ["Visualizar", "Atribuição"],
    hubPageEnabled: false,
  },
  {
    id: "summdash",
    slug: "summdash",
    name: "SummDash",
    description:
      "Dashboards automáticos de resumo de métricas de vendas e marketing.",
    category: "analytics",
    status: "view_only",
    icon: "🔢",
    tags: ["Visualizar", "Resumo"],
    hubPageEnabled: false,
  },
  {
    id: "google-analytics",
    slug: "google-analytics",
    name: "Google Analytics",
    description:
      "Rastreie o comportamento de leads no site e correlacione com conversões.",
    category: "analytics",
    status: "available",
    icon: "https://logo.clearbit.com/analytics.google.com",
    tags: ["Google", "Gratuito"],
    hubPageEnabled: false,
  },
  {
    id: "hotjar",
    slug: "hotjar",
    name: "Hotjar",
    description:
      "Mapas de calor e gravações de sessão para otimizar páginas de captura.",
    category: "analytics",
    status: "available",
    icon: "https://logo.clearbit.com/hotjar.com",
    tags: ["Heatmap", "UX"],
    hubPageEnabled: false,
  },
  {
    id: "looker-studio",
    slug: "looker-studio",
    name: "Looker Studio",
    description:
      "Crie dashboards personalizados conectando dados do NASA ao Looker Studio.",
    category: "analytics",
    status: "available",
    icon: "https://logo.clearbit.com/lookerstudio.google.com",
    tags: ["Google", "BI", "Gratuito"],
    hubPageEnabled: false,
  },

  // ── DOCUMENTS ────────────────────────────────────────────────────────────────
  {
    id: "docusign",
    slug: "docusign",
    name: "DocuSign",
    description:
      "Assine contratos eletronicamente com o líder global em assinaturas digitais.",
    category: "documents",
    status: "available",
    icon: "https://logo.clearbit.com/docusign.com",
    tags: ["Assinatura", "Global"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "DocuSign pen and contract floating in secure digital space",
  },
  {
    id: "clicksign",
    slug: "clicksign",
    name: "Clicksign",
    description:
      "Assinatura eletrônica brasileira com validade jurídica e planos acessíveis.",
    category: "documents",
    status: "available",
    icon: "https://logo.clearbit.com/clicksign.com",
    tags: ["Assinatura", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "d4sign",
    slug: "d4sign",
    name: "D4Sign",
    description:
      "Solução de assinatura digital com cofre de documentos e segurança avançada.",
    category: "documents",
    status: "available",
    icon: "https://logo.clearbit.com/d4sign.com.br",
    tags: ["Assinatura", "Brasileiro", "Segurança"],
    hubPageEnabled: false,
  },
  {
    id: "google-drive",
    slug: "google-drive",
    name: "Google Drive",
    description:
      "Salve documentos, propostas e contratos diretamente no Google Drive.",
    category: "documents",
    status: "available",
    icon: "https://logo.clearbit.com/drive.google.com",
    tags: ["Google", "Cloud"],
    hubPageEnabled: false,
  },
  {
    id: "dropbox",
    slug: "dropbox",
    name: "Dropbox",
    description:
      "Armazene e compartilhe documentos de clientes sincronizados no Dropbox.",
    category: "documents",
    status: "available",
    icon: "https://logo.clearbit.com/dropbox.com",
    tags: ["Cloud", "Storage"],
    hubPageEnabled: false,
  },

  // ── LEAD CUSTOMIZATION ───────────────────────────────────────────────────────
  {
    id: "leadstaker",
    slug: "leadstaker",
    name: "Leadstaker",
    description:
      "Identifique visitantes anônimos do seu site e converta em leads qualificados.",
    category: "lead_customization",
    status: "view_only",
    icon: "🎯",
    tags: ["Visualizar", "Enriquecimento"],
    hubPageEnabled: false,
  },
  {
    id: "clearbit",
    slug: "clearbit",
    name: "Clearbit",
    description:
      "Enriqueça leads automaticamente com dados de empresa, cargo e LinkedIn.",
    category: "lead_customization",
    status: "available",
    icon: "https://logo.clearbit.com/clearbit.com",
    tags: ["Enriquecimento", "B2B"],
    hubPageEnabled: false,
  },
  {
    id: "apollo",
    slug: "apollo",
    name: "Apollo.io",
    description:
      "Base de dados de mais de 275M de contatos B2B para prospecção.",
    category: "lead_customization",
    status: "available",
    icon: "https://logo.clearbit.com/apollo.io",
    tags: ["B2B", "Prospecção"],
    hubPageEnabled: false,
  },
  {
    id: "hunter",
    slug: "hunter",
    name: "Hunter.io",
    description:
      "Encontre emails corporativos verificados de prospects e decisores.",
    category: "lead_customization",
    status: "available",
    icon: "https://logo.clearbit.com/hunter.io",
    tags: ["Email", "Prospecção"],
    hubPageEnabled: false,
  },

  // ── PRODUCTIVITY ─────────────────────────────────────────────────────────────
  {
    id: "taplink",
    slug: "taplink",
    name: "Taplink",
    description: "Link na bio com formulários de captura integrados ao NASA.",
    category: "productivity",
    status: "view_only",
    icon: "https://logo.clearbit.com/taplink.cc",
    tags: ["Visualizar", "Link na Bio"],
    hubPageEnabled: false,
  },
  {
    id: "google-workspace",
    slug: "google-workspace",
    name: "Google Workspace",
    description:
      "Sincronize contatos e calendários do Google Workspace com o CRM.",
    category: "productivity",
    status: "available",
    icon: "https://logo.clearbit.com/workspace.google.com",
    tags: ["Google", "Empresarial"],
    hubPageEnabled: false,
  },
  {
    id: "microsoft-365",
    slug: "microsoft-365",
    name: "Microsoft 365",
    description: "Integre Outlook, Teams e OneDrive com o pipeline de vendas.",
    category: "productivity",
    status: "available",
    icon: "https://logo.clearbit.com/microsoft.com",
    tags: ["Microsoft", "Empresarial"],
    hubPageEnabled: false,
  },
  {
    id: "zoom",
    slug: "zoom",
    name: "Zoom",
    description: "Agende e inicie reuniões Zoom diretamente do perfil do lead.",
    category: "productivity",
    status: "available",
    icon: "https://logo.clearbit.com/zoom.us",
    tags: ["Videoconferência"],
    hubPageEnabled: false,
  },
  {
    id: "calendly",
    slug: "calendly",
    name: "Calendly",
    description:
      "Agendamentos automáticos com criação de leads ao marcar reuniões.",
    category: "productivity",
    status: "available",
    icon: "https://logo.clearbit.com/calendly.com",
    tags: ["Agendamento", "Popular"],
    hubPageEnabled: true,
    spaceImagePrompt:
      "Calendly calendar floating in space with appointment slots orbiting",
  },
  {
    id: "linktree",
    slug: "linktree",
    name: "Linktree",
    description:
      "Capture leads via link na bio do Linktree com integração direta.",
    category: "productivity",
    status: "available",
    icon: "https://logo.clearbit.com/linktr.ee",
    tags: ["Link na Bio"],
    hubPageEnabled: false,
  },

  // ── FIELD CUSTOMIZATION ──────────────────────────────────────────────────────
  {
    id: "custom-fields",
    slug: "custom-fields",
    name: "Campos Personalizados",
    description:
      "Adicione campos customizados ilimitados ao perfil de leads e oportunidades.",
    category: "field_customization",
    status: "available",
    icon: "🔧",
    tags: ["Nativo"],
    hubPageEnabled: false,
  },
  {
    id: "data-mapper",
    slug: "data-mapper",
    name: "Mapeador de Dados",
    description:
      "Mapeie campos entre o NASA e outros sistemas durante importações.",
    category: "field_customization",
    status: "available",
    icon: "🗺️",
    tags: ["Importação"],
    hubPageEnabled: false,
  },

  // ── DUPLICATE MANAGEMENT ─────────────────────────────────────────────────────
  {
    id: "dedup-pro",
    slug: "dedup-pro",
    name: "Deduplicação de Leads",
    description:
      "Detecte e mescle leads duplicados automaticamente por email, telefone ou nome.",
    category: "duplicate_management",
    status: "available",
    icon: "🔍",
    tags: ["Limpeza", "Automático"],
    hubPageEnabled: false,
  },
  {
    id: "lead-merger",
    slug: "lead-merger",
    name: "Mesclagem de Contatos",
    description:
      "Mescle múltiplos registros de um mesmo contato mantendo o histórico completo.",
    category: "duplicate_management",
    status: "available",
    icon: "🔗",
    tags: ["Mesclagem"],
    hubPageEnabled: false,
  },

  // ── CRM CUSTOMIZATION ────────────────────────────────────────────────────────
  {
    id: "nova-database",
    slug: "nova-database",
    name: "Carregamento via NOVA",
    description:
      "Importe e sincronize bases de dados de leads via integração NOVA.",
    category: "crm_customization",
    status: "installed",
    icon: "🚀",
    tags: ["Instalado", "Importação"],
    hubPageEnabled: false,
  },
  {
    id: "pipedrive",
    slug: "pipedrive",
    name: "Pipedrive",
    description:
      "Migre e sincronize negócios, contatos e atividades do Pipedrive.",
    category: "crm_customization",
    status: "available",
    icon: "https://logo.clearbit.com/pipedrive.com",
    tags: ["CRM", "Migração"],
    hubPageEnabled: false,
  },
  {
    id: "agendor",
    slug: "agendor",
    name: "Agendor",
    description:
      "CRM brasileiro popular com migração assistida de dados para o NASA.",
    category: "crm_customization",
    status: "available",
    icon: "https://logo.clearbit.com/agendor.com.br",
    tags: ["CRM", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "rd-crm",
    slug: "rd-crm",
    name: "RD Station CRM",
    description: "Importe negócios e contatos do RD Station CRM para o NASA.",
    category: "crm_customization",
    status: "available",
    icon: "https://logo.clearbit.com/rdstation.com",
    tags: ["CRM", "Brasileiro", "Migração"],
    hubPageEnabled: false,
  },
  {
    id: "piperun",
    slug: "piperun",
    name: "Piperun",
    description:
      "Migre funil de vendas, histórico e contatos do Piperun para o NASA.",
    category: "crm_customization",
    status: "available",
    icon: "https://logo.clearbit.com/piperun.com",
    tags: ["CRM", "Brasileiro"],
    hubPageEnabled: false,
  },
  {
    id: "nectar",
    slug: "nectar",
    name: "Nectar CRM",
    description:
      "Importação e sincronização de dados do Nectar CRM com histórico completo.",
    category: "crm_customization",
    status: "available",
    icon: "https://logo.clearbit.com/nectarcrm.com.br",
    tags: ["CRM", "Brasileiro"],
    hubPageEnabled: false,
  },
];

export const getIntegrationBySlug = (slug: string) =>
  integrations.find((i) => i.slug === slug);

export const getIntegrationsByCategory = (category: string) =>
  integrations.filter((i) => i.category === category);

export const getInstalledIntegrations = () =>
  integrations.filter((i) => i.status === "installed");
