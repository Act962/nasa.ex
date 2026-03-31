"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Send,
  Minimize2,
  Maximize2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { integrations } from "@/data/integrations";
import type { Integration } from "@/types/integration";
import { CATEGORY_LABELS } from "@/types/integration";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickReply {
  label: string;
  value: string;
  link?: string; // if set, clicking navigates instead of sending message
}

interface Message {
  id: string;
  role: "astro" | "user";
  text: string;
  quickReplies?: QuickReply[];
  integration?: Integration;
}

// ─── ASTRO Intelligence ───────────────────────────────────────────────────────

const GREETING: Message = {
  id: "greeting",
  role: "astro",
  text: "Olá! Sou o **ASTRO** 👨‍🚀 Seu assistente inteligente do NASA.\n\nPosso te ajudar a instalar integrações, entender o **Método NASA**, configurar ferramentas e guiar sua operação comercial. Como posso ajudar?",
  quickReplies: [
    { label: "🔌 Instalar integração", value: "quero instalar uma integração" },
    { label: "🚀 Método NASA", value: "o que é o método nasa" },
    { label: "📊 Como usar o FORGE?", value: "como usar o forge" },
    {
      label: "📋 Ver todas funcionalidades",
      value: "quais são as funcionalidades",
    },
  ],
};

function generateId() {
  return Math.random().toString(36).slice(2);
}

function findIntegration(query: string): Integration | undefined {
  const q = query.toLowerCase();
  return integrations.find(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.slug.includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

// ─── Context extractor ────────────────────────────────────────────────────────

function getContext(history: Message[]) {
  // Last integration installed (from "Instalar X" user messages)
  const lastInstallMsg = [...history]
    .reverse()
    .find(
      (m) =>
        m.role === "user" &&
        /^Instalar .+/.test(m.text) &&
        !m.text.startsWith("Instalar outra") &&
        !m.text.startsWith("Instalar nova"),
    );
  const lastInstalledName = lastInstallMsg?.text.replace("Instalar ", "");
  const lastInstalledIntegration = lastInstalledName
    ? integrations.find((i) => i.name === lastInstalledName)
    : null;

  // Recent context: last 8 messages joined
  const recentContext = history
    .slice(-8)
    .map((m) => m.text.toLowerCase())
    .join(" ");

  return { lastInstalledIntegration, recentContext };
}

// ─── Response builder ─────────────────────────────────────────────────────────

function buildAstroResponse(
  input: string,
  history: Message[],
  pendingInstall?: Integration | null,
): Message[] {
  const q = input.toLowerCase();
  const msgs: Message[] = [];
  const id = () => generateId();
  const { lastInstalledIntegration, recentContext } = getContext(history);

  // ── Pending install from marketplace ──────────────────────────────────────
  if (pendingInstall) {
    return [
      {
        id: id(),
        role: "astro",
        text: `Vou te guiar para habilitar **${pendingInstall.name}** no NASA! 🚀\n\n${pendingInstall.description}\n\nApós habilitar, você precisará acessar a página da integração e inserir as credenciais da **sua conta** ${pendingInstall.name}.\n\nClique em **Confirmar** para habilitar.`,
        integration: pendingInstall,
        quickReplies: [
          { label: "✅ Confirmar", value: `__install:${pendingInstall.slug}` },
          {
            label: "📖 Ver detalhes",
            value: `detalhes ${pendingInstall.name}`,
            link: `/integrations/${pendingInstall.slug}`,
          },
          { label: "❌ Cancelar", value: "cancelar" },
        ],
      },
    ];
  }

  // ── Método NASA ────────────────────────────────────────────────────────────
  if (
    q.includes("método nasa") ||
    q.includes("metodo nasa") ||
    q.includes("metodologia") ||
    q.includes("processo de vendas") ||
    q.includes("necessidade") ||
    q.includes("sistematização") ||
    (q.includes("método") && recentContext.includes("nasa"))
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O **Método NASA** estrutura todo o processo comercial em 4 etapas: 🚀\n\n**N — Necessidade**\nEntenda o que o cliente precisa. Use o **Chat** para capturar leads e o **Tracking** para qualificá-los no pipeline.\n\n**A — Análise**\nAnalise o mercado e o perfil do cliente. Use **Insights** com dashboards e métricas em tempo real.\n\n**S — Sistematização**\nOrganize ferramentas e processos. Configure **Integrações**, **automações** e fluxos no Tracking.\n\n**A — Ação**\nExecute com propostas e contratos. Use o **FORGE** para enviar propostas, gerar contratos e fechar negócios.\n\n💡 Qual etapa você quer aprofundar?",
        quickReplies: [
          {
            label: "🎯 N — Necessidade (Chat)",
            value: "como usar o chat",
            link: "/chat",
          },
          {
            label: "📊 A — Análise (Insights)",
            value: "como usar insights",
            link: "/insights",
          },
          {
            label: "⚙️ S — Sistematizar (Integrações)",
            value: "quero instalar uma integração",
            link: "/integrations",
          },
          {
            label: "🔥 A — Ação (FORGE)",
            value: "como usar o forge",
            link: "/forge",
          },
        ],
      },
    ];
  }

  // ── Configure credentials / settings ──────────────────────────────────────
  if (
    q.includes("credenci") || // covers "credencial" and "credenciais"
    q.includes("configurar integração") ||
    q.includes("configurar agora") ||
    q.includes("como configuro") ||
    q.includes("como configur") ||
    q.includes("setup") ||
    q.includes("ativar integração")
  ) {
    if (lastInstalledIntegration) {
      return [
        {
          id: id(),
          role: "astro",
          text: `Para conectar o **${lastInstalledIntegration.name}** ao NASA, você precisará inserir suas próprias credenciais da conta que você já possui nessa plataforma. 🔑\n\nO NASA fornece o caminho — as credenciais são suas:\n\n1. Acesse a **página da integração** (botão abaixo)\n2. Clique em **Configurar**\n3. Insira os dados da sua conta ${lastInstalledIntegration.name} (Token, API Key ou Webhook)\n4. Salve — cada empresa do seu painel tem suas próprias credenciais\n\n💡 Essas informações são obtidas diretamente no painel da ${lastInstalledIntegration.name}.`,
          quickReplies: [
            {
              label: `⚙️ Abrir ${lastInstalledIntegration.name}`,
              value: `abrir ${lastInstalledIntegration.name}`,
              link: `/integrations/${lastInstalledIntegration.slug}`,
            },
            { label: "❓ O que é API Key?", value: "o que é api key" },
            {
              label: "🔌 Instalar outra integração",
              value: "quero instalar uma integração",
            },
          ],
        },
      ];
    }
    return [
      {
        id: id(),
        role: "astro",
        text: "O NASA oferece o caminho para conectar ferramentas — as credenciais são **suas próprias contas** em cada plataforma. 🔑\n\nCada empresa no seu painel pode ter credenciais diferentes para a mesma integração.\n\n📍 Para configurar: **Menu → Integrações → selecione a integração → Configurar**\n\nQual integração você quer conectar?",
        quickReplies: [
          {
            label: "🔌 Ver Integrações",
            value: "listar integrações",
            link: "/integrations",
          },
          {
            label: "💬 Configurar WhatsApp",
            value: "configurar whatsapp",
            link: "/integrations/whatsapp-business",
          },
          {
            label: "📷 Configurar Instagram",
            value: "configurar instagram",
            link: "/integrations/instagram-dm",
          },
        ],
      },
    ];
  }

  // ── API Key / Token / Webhook ──────────────────────────────────────────────
  if (
    q.includes("api key") ||
    q.includes("token") ||
    q.includes("webhook") ||
    q.includes("o que é api")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "**API Key** é uma chave da sua conta em outra plataforma que autoriza o NASA a se comunicar com ela. 🔑\n\nO NASA não gera essas credenciais — você as obtém diretamente na plataforma que deseja integrar:\n\n1. Acesse o painel/configurações da plataforma (ex: Meta Business Suite, Google Cloud Console, Telegram BotFather)\n2. Localize a seção **API**, **Desenvolvedor** ou **Integrações**\n3. Gere e copie sua chave ou token\n4. Cole no campo de configuração da integração no NASA\n\n💡 Cada empresa do seu painel no NASA pode ter tokens diferentes para a mesma ferramenta.",
        quickReplies: [
          {
            label: "🔌 Ir para Integrações",
            value: "listar integrações",
            link: "/integrations",
          },
          { label: "💬 Configurar WhatsApp", value: "configurar whatsapp" },
          { label: "🚀 Voltar ao início", value: "início" },
        ],
      },
    ];
  }

  // ── Category-specific intents — check BEFORE generic install ───────────────
  for (const [keyword, category] of [
    ["mensageiro", "messengers"],
    ["whatsapp provider", "whatsapp_providers"],
    ["provedor de whatsapp", "whatsapp_providers"],
    ["whatsapp", "messengers"],
    ["ecommerce", "ecommerce"],
    ["e-commerce", "ecommerce"],
    ["loja virtual", "ecommerce"],
    ["loja", "ecommerce"],
    ["marketing", "marketing"],
    ["pagamento", "payments"],
    ["gateway", "payments"],
    ["chatbot", "chatbots"],
    ["formulário", "forms"],
    ["analítica", "analytics"],
    ["analytics", "analytics"],
    ["documento", "documents"],
    ["assinatura digital", "documents"],
    ["workflow", "workflow"],
    ["ligação", "calls"],
    ["telefon", "calls"],
    ["crm externo", "crm_customization"],
    ["videoconferência", "productivity"],
    ["suporte", "live_chat"],
    ["chat ao vivo", "live_chat"],
    ["segmento", "industry"],
  ] as [string, string][]) {
    if (q.includes(keyword)) {
      const list = integrations
        .filter((i) => i.category === category)
        .slice(0, 5);
      const listText = list
        .map((i) => `• **${i.name}** — ${i.description.slice(0, 60)}...`)
        .join("\n");
      msgs.push({
        id: id(),
        role: "astro",
        text: `Integrações de **${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}** disponíveis:\n\n${listText}`,
        quickReplies: [
          ...list.slice(0, 3).map((i) => ({
            label: `Instalar ${i.name}`,
            value: `instalar ${i.name}`,
          })),
          {
            label: "🔌 Ver todas as categorias",
            value: "quero instalar uma integração",
          },
        ],
      });
      return msgs;
    }
  }

  // ── Generic install intent ─────────────────────────────────────────────────
  if (
    q.includes("instalar") ||
    q.includes("install") ||
    q.includes("integração") ||
    q.includes("integrar")
  ) {
    // Strip the verb prefix before searching so "instalar telegram" finds "Telegram"
    const searchTerm = q.replace(/^(instalar|install|integrar)\s+/i, "").trim();
    const found = findIntegration(searchTerm) || findIntegration(q);
    if (found) {
      return [
        {
          id: id(),
          role: "astro",
          text: `Encontrei **${found.name}**! 🎯\n\n${found.description}`,
          integration: found,
          quickReplies: [
            {
              label: `✅ Instalar ${found.name}`,
              value: `__install:${found.slug}`,
            },
            {
              label: "📖 Ver detalhes",
              value: `detalhes ${found.name}`,
              link: `/integrations/${found.slug}`,
            },
            {
              label: "🔍 Ver outras opções",
              value: "quero instalar uma integração",
            },
          ],
        },
      ];
    }

    return [
      {
        id: id(),
        role: "astro",
        text: "Temos integrações em diversas categorias! 🔌 Qual área você precisa integrar?",
        quickReplies: [
          {
            label: "💬 Mensageiros (WhatsApp, Telegram...)",
            value: "instalar mensageiro",
          },
          {
            label: "🛒 E-commerce (Shopify, Nuvemshop...)",
            value: "instalar ecommerce",
          },
          {
            label: "📣 Marketing (RD Station, Mailchimp...)",
            value: "instalar marketing",
          },
          {
            label: "💳 Pagamentos (Stripe, Asaas...)",
            value: "instalar pagamento",
          },
          {
            label: "🤖 Chatbots (Typebot, ManyChat...)",
            value: "instalar chatbot",
          },
          {
            label: "🔌 Todas as integrações",
            value: "listar integrações",
            link: "/integrations",
          },
        ],
      },
    ];
  }

  // ── FORGE ─────────────────────────────────────────────────────────────────
  if (
    q.includes("forge") ||
    q.includes("proposta") ||
    q.includes("contrato") ||
    q.includes("pagamento link")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O **FORGE** é o módulo de propostas e contratos do NASA! 🔥\n\nCom ele você pode:\n• Criar propostas com produtos e valores\n• Gerar links de pagamento\n• Criar e assinar contratos eletronicamente\n• Configurar modelos (padrões) de contrato\n• Alterar status: Enviada, Visualizada, Paga, Expirada\n\n📍 Acesse: **Menu → FORGE**",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          {
            label: "💳 Configurar gateway de pagamento",
            value: "configurar pagamento forge",
          },
          {
            label: "📄 Criar padrão de contrato",
            value: "criar padrão contrato",
          },
          { label: "📨 Como enviar proposta?", value: "como enviar proposta" },
        ],
      },
    ];
  }

  // ── Tracking / Pipeline / Leads ────────────────────────────────────────────
  if (
    q.includes("tracking") ||
    q.includes("lead") ||
    q.includes("pipeline") ||
    q.includes("funil") ||
    q.includes("oportunidade")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O **Tracking** é o CRM de vendas do NASA! 📊\n\nFuncionalidades:\n• Pipeline visual de leads (Kanban)\n• Múltiplos funis de vendas\n• Atribuição de leads a consultores\n• Automações por estágio\n• Histórico de interações\n\n📍 Acesse: **Menu → Trackings**",
        quickReplies: [
          {
            label: "📊 Abrir Tracking",
            value: "abrir tracking",
            link: "/tracking",
          },
          {
            label: "🤖 Criar automação de lead",
            value: "como criar automação",
          },
          {
            label: "🔌 Integrar WhatsApp ao CRM",
            value: "instalar whatsapp business",
          },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Automação ─────────────────────────────────────────────────────────────
  if (
    q.includes("automação") ||
    q.includes("automation") ||
    q.includes("workflow") ||
    q.includes("fluxo")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "As **Automações** do NASA funcionam por Workflows! ⚙️\n\nVocê pode criar fluxos que:\n• Movem leads entre estágios automaticamente\n• Enviam mensagens ao entrar em um estágio\n• Atribuem leads a consultores\n• Disparam webhooks e notificações\n• Enviam e-mail ou WhatsApp automaticamente\n\n📍 Acesse: **Menu → Tracking → [selecione o funil] → Automações**",
        quickReplies: [
          { label: "🔌 Integrar Zapier/Make", value: "instalar zapier" },
          {
            label: "💬 Enviar WhatsApp automático",
            value: "instalar whatsapp business",
          },
          { label: "📧 Automatizar e-mail", value: "instalar marketing" },
          {
            label: "⚙️ Ver Integrações",
            value: "listar integrações",
            link: "/integrations",
          },
        ],
      },
    ];
  }

  // ── Insights / Analytics ──────────────────────────────────────────────────
  if (
    q.includes("insight") ||
    q.includes("relatório") ||
    q.includes("dashboard") ||
    q.includes("métrica") ||
    q.includes("análise")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O módulo de **Insights** traz dashboards e relatórios em tempo real! 📊\n\nVocê visualiza:\n• Performance do pipeline de vendas\n• Leads por origem e canal\n• Taxa de conversão por etapa\n• Métricas de chat e atendimento\n• Relatórios de propostas (FORGE)\n\n📍 Acesse: **Menu → Insights**",
        quickReplies: [
          {
            label: "📊 Abrir Insights",
            value: "abrir insights",
            link: "/insights",
          },
          {
            label: "🔌 Integrar Google Analytics",
            value: "instalar analytics",
          },
          { label: "🚀 Método NASA — Análise", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Agenda / Agendamentos ──────────────────────────────────────────────────
  if (
    q.includes("agenda") ||
    q.includes("agendamento") ||
    q.includes("calendário") ||
    q.includes("horário")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O módulo de **Agendas** permite configurar calendários online! 📅\n\nFuncionalidades:\n• Link público para agendamento de reuniões\n• Configuração de horários disponíveis e bloqueios\n• Integração com Google Calendar\n• Chat de atendimento pré-agenda\n• Múltiplos tipos de agendamento\n\n📍 Acesse: **Menu → Agendas**",
        quickReplies: [
          {
            label: "📅 Abrir Agendas",
            value: "abrir agendas",
            link: "/agenda",
          },
          {
            label: "📅 Integrar Google Calendar",
            value: "instalar google workspace",
          },
          { label: "🔗 Integrar Calendly", value: "instalar calendly" },
        ],
      },
    ];
  }

  // ── Chat / Atendimento ────────────────────────────────────────────────────
  if (
    q.includes("chat") ||
    q.includes("atendimento") ||
    q.includes("conversa") ||
    q.includes("inbox")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O módulo de **Chat** é o seu inbox unificado de atendimento! 💬\n\nFuncionalidades:\n• Todas as conversas em um único lugar\n• WhatsApp, Instagram, Facebook, Telegram\n• Distribuição automática para consultores\n• Histórico completo de interações\n• Captura automática de leads\n\n📍 Acesse: **Menu → Chats**\n\n💡 Esta é a etapa **N (Necessidade)** do Método NASA — onde você identifica o que o cliente precisa.",
        quickReplies: [
          { label: "💬 Abrir Chat", value: "abrir chat", link: "/chat" },
          {
            label: "📱 Instalar WhatsApp Business",
            value: "instalar whatsapp business",
          },
          { label: "📷 Instalar Instagram DM", value: "instalar instagram dm" },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Funcionalidades gerais ─────────────────────────────────────────────────
  if (
    q.includes("funcionalidade") ||
    q.includes("recurso") ||
    q.includes("o que é") ||
    q.includes("sobre o nasa") ||
    q.includes("início") ||
    q.includes("inicio")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O **NASA** é uma plataforma completa de CRM e automação comercial! 🚀\n\nPrincipais módulos:\n• **Tracking** — pipeline de leads e CRM\n• **FORGE** — propostas e contratos\n• **Agendas** — agendamentos online\n• **Chat** — atendimento unificado\n• **Insights** — relatórios e dashboards\n• **Integrações** — +107 apps conectados\n\n🚀 Tudo estruturado pelo **Método NASA** (N-A-S-A).",
        quickReplies: [
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
          { label: "📊 FORGE", value: "como usar o forge", link: "/forge" },
          { label: "📅 Agendas", value: "como usar agendas", link: "/agenda" },
          {
            label: "🔌 Integrações",
            value: "listar integrações",
            link: "/integrations",
          },
        ],
      },
    ];
  }

  // ── List integrations ──────────────────────────────────────────────────────
  if (
    q.includes("listar") ||
    q.includes("lista") ||
    q.includes("todas") ||
    q.includes("marketplace")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: `Temos **${integrations.length} integrações** disponíveis em 19 categorias no Marketplace! 🔌\n\nDigite o nome de uma integração para instalá-la ou acesse o Marketplace para navegar por todas.`,
        quickReplies: [
          {
            label: "🏪 Abrir Marketplace",
            value: "abrir marketplace",
            link: "/integrations",
          },
          {
            label: "💬 WhatsApp Business",
            value: "instalar whatsapp business",
          },
          { label: "📣 RD Station", value: "instalar rd station" },
          { label: "💳 Stripe", value: "instalar stripe" },
        ],
      },
    ];
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  if (
    q.includes("cancelar") ||
    q.includes("não quero") ||
    q.includes("deixa pra lá")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "Tudo bem! 😊 Fico por aqui quando precisar.",
        quickReplies: [
          {
            label: "🔌 Instalar integração",
            value: "quero instalar uma integração",
          },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
          {
            label: "❓ Funcionalidades",
            value: "quais são as funcionalidades",
          },
        ],
      },
    ];
  }

  // ── Integration detail / context-aware fallback ────────────────────────────
  const cleanQ = q
    .replace(/^(instalar|install|integrar|configurar|detalhes?)\s+/i, "")
    .trim();
  const found = findIntegration(cleanQ) || findIntegration(q);
  if (found) {
    return [
      {
        id: id(),
        role: "astro",
        text: `Encontrei **${found.name}**! 🎯\n\n${found.description}`,
        integration: found,
        quickReplies: [
          {
            label: `✅ Instalar ${found.name}`,
            value: `__install:${found.slug}`,
          },
          {
            label: "📖 Ver detalhes",
            value: `detalhes ${found.name}`,
            link: `/integrations/${found.slug}`,
          },
          { label: "🔍 Ver outras integrações", value: "listar integrações" },
        ],
      },
    ];
  }

  // ── Default fallback ───────────────────────────────────────────────────────
  return [
    {
      id: id(),
      role: "astro",
      text: "Hmm, não entendi muito bem. 🤔 Posso te ajudar com:\n• Instalação de integrações (+107 apps)\n• **Método NASA** (N-A-S-A) de vendas\n• Configurações do FORGE\n• Automações e workflows\n• Navegação pela plataforma\n\nComo posso ajudar?",
      quickReplies: [
        {
          label: "🔌 Instalar integração",
          value: "quero instalar uma integração",
        },
        { label: "🚀 Método NASA", value: "o que é o método nasa" },
        { label: "📊 Funcionalidades", value: "quais são as funcionalidades" },
        { label: "🔥 FORGE", value: "como usar o forge" },
      ],
    },
  ];
}

// ─── Message bubble ────────────────────────────────────────────────────────────

function formatText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function MessageBubble({
  msg,
  onInstall,
  onSend,
}: {
  msg: Message;
  onInstall: (slug: string) => void;
  onSend: (value: string) => void;
}) {
  const { isInstalled } = useMarketplace();
  const [imgError, setImgError] = useState(false);
  const isAstro = msg.role === "astro";

  return (
    <div
      className={cn(
        "flex gap-2",
        isAstro ? "items-start" : "items-start flex-row-reverse",
      )}
    >
      {isAstro && (
        <div className="size-7 rounded-full bg-linear-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center shrink-0 text-sm shadow-sm mt-0.5">
          👨‍🚀
        </div>
      )}

      <div
        className={cn(
          "space-y-2 max-w-[82%]",
          !isAstro && "items-end flex flex-col",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isAstro
              ? "bg-muted/70 rounded-tl-sm"
              : "bg-[#7C3AED] text-white rounded-tr-sm",
          )}
        >
          <p className="whitespace-pre-line text-[13px]">
            {formatText(msg.text)}
          </p>
        </div>

        {/* Integration preview card */}
        {msg.integration && (
          <div className="border rounded-xl p-3 bg-card space-y-2 w-full shadow-sm">
            <div className="flex items-center gap-2">
              {msg.integration.icon.startsWith("http") && !imgError ? (
                <div className="size-8 rounded-lg overflow-hidden bg-white border flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={msg.integration.icon}
                    alt={msg.integration.name}
                    className="size-6 object-contain"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <span className="text-lg">
                  {msg.integration.icon.startsWith("http")
                    ? "🔌"
                    : msg.integration.icon}
                </span>
              )}
              <div>
                <p className="text-xs font-semibold">{msg.integration.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {CATEGORY_LABELS[msg.integration.category]}
                </p>
              </div>
              {isInstalled(msg.integration.slug) && (
                <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
              )}
            </div>
            {isInstalled(msg.integration.slug) ? (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Integração instalada e ativa
              </p>
            ) : (
              <Button
                size="sm"
                className="w-full h-7 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1"
                onClick={() => onInstall(msg.integration!.slug)}
              >
                <CheckCircle2 className="size-3" /> Confirmar instalação
              </Button>
            )}
          </div>
        )}

        {/* Quick replies — only for last astro message */}
        {isAstro && msg.quickReplies && (
          <div className="flex flex-wrap gap-1.5 mt-1 ml-9">
            {msg.quickReplies.map((qr) =>
              qr.link ? (
                <Link key={qr.value} href={qr.link}>
                  <button
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all",
                      "border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED]",
                      "dark:border-[#a78bfa]/30 dark:text-[#a78bfa]",
                    )}
                  >
                    {qr.label}
                  </button>
                </Link>
              ) : (
                <button
                  key={qr.value}
                  onClick={() => onSend(qr.value)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all",
                    "border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED]",
                    "dark:border-[#a78bfa]/30 dark:text-[#a78bfa]",
                  )}
                >
                  {qr.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Astronaut helmet SVG ─────────────────────────────────────────────────────

function AstroHelmetIcon() {
  return (
    <img
      src="/icon-astro.svg"
      alt="Astro"
      className="w-full h-full object-contain"
    />
  );
}

// ─── Main ASTRO component ─────────────────────────────────────────────────────

export function AstroAgent() {
  const {
    astroOpen,
    setAstroOpen,
    pendingInstall,
    clearPendingInstall,
    install,
    isInstalled,
  } = useMarketplace();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle pending install from marketplace
  useEffect(() => {
    if (pendingInstall && astroOpen) {
      setThinking(true);
      setTimeout(() => {
        const responses = buildAstroResponse("", messages, pendingInstall);
        setMessages((prev) => [...prev, ...responses]);
        setThinking(false);
        clearPendingInstall();
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInstall, astroOpen]);

  useEffect(() => {
    if (pendingInstall && !astroOpen) setHasNotification(true);
  }, [pendingInstall, astroOpen]);

  useEffect(() => {
    if (astroOpen) setHasNotification(false);
  }, [astroOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Handle install confirmation
      if (text.startsWith("__install:")) {
        const slug = text.replace("__install:", "");
        const integration = integrations.find((i) => i.slug === slug);
        if (integration) {
          if (isInstalled(slug)) {
            setMessages((prev) => [
              ...prev,
              {
                id: generateId(),
                role: "astro",
                text: `**${integration.name}** já está instalado! ✅`,
                quickReplies: [
                  {
                    label: "⚙️ Configurar",
                    value: `configurar credenciais`,
                    link: `/integrations/${slug}`,
                  },
                  {
                    label: "🔌 Instalar outra",
                    value: "quero instalar uma integração",
                  },
                ],
              },
            ]);
            return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "user",
              text: `Instalar ${integration.name}`,
            },
          ]);
          setThinking(true);
          await new Promise((r) => setTimeout(r, 800));
          install(slug);
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "astro",
              text: `🚀 **${integration.name}** foi habilitado no NASA!\n\nAgora acesse a página da integração e insira as credenciais da **sua conta** ${integration.name} — cada empresa do seu painel tem suas próprias credenciais.\n\n💡 O NASA fornece o caminho. As informações de acesso são suas.`,
              quickReplies: [
                {
                  label: `⚙️ Inserir credenciais`,
                  value: `configurar credenciais`,
                  link: `/integrations/${slug}`,
                },
                {
                  label: "❓ O que preciso inserir?",
                  value: "o que é api key",
                },
                {
                  label: "🔌 Instalar outra integração",
                  value: "quero instalar uma integração",
                },
              ],
            },
          ]);
          setThinking(false);
          return;
        }
      }

      // Add user message
      const userMsg: Message = { id: generateId(), role: "user", text };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        return updated;
      });
      setInput("");
      setThinking(true);

      await new Promise((r) => setTimeout(r, 700 + Math.random() * 400));

      // Pass full history (including new user msg) for context
      setMessages((prev) => {
        const responses = buildAstroResponse(text, prev);
        return [...prev, ...responses];
      });
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [install, isInstalled],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) sendMessage(input);
  };

  const resetChat = () => {
    setMessages([GREETING]);
    setInput("");
  };

  // Quick replies are shown only for the last astro message
  const lastAstroIndex =
    [...messages]
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.role === "astro")?.i ?? -1;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setAstroOpen(!astroOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg transition-all duration-300",
          "bg-linear-to-br from-[#7C3AED] to-[#a855f7] hover:scale-110 hover:shadow-[0_0_24px_rgba(124,58,237,0.5)]",
        )}
      >
        {hasNotification && !astroOpen && (
          <span className="absolute -top-1 -right-1 size-4 flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-4 bg-amber-400" />
          </span>
        )}
        <div className="size-full p-3">
          {astroOpen ? (
            <X className="size-full text-white" />
          ) : (
            <AstroHelmetIcon />
          )}
        </div>
      </button>

      {/* Chat panel */}
      {astroOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 w-[360px] rounded-2xl shadow-2xl border border-border/50 overflow-hidden",
            "bg-background/95 backdrop-blur-xl",
            "transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in",
            minimized ? "h-14" : "h-[540px]",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-[#7C3AED] to-[#a855f7] text-white shrink-0">
            <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-base">
              👨‍🚀
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-none">ASTRO</p>
              <p className="text-[10px] text-white/70 mt-0.5">
                Assistente Inteligente NASA
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-white/70 hover:text-white hover:bg-white/10"
                title="Reiniciar conversa"
                onClick={resetChat}
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setMinimized(!minimized)}
              >
                {minimized ? (
                  <Maximize2 className="size-3.5" />
                ) : (
                  <Minimize2 className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[426px]">
                {messages.map((msg, index) => (
                  <div key={msg.id}>
                    {/* Hide quick replies on older messages — only last astro msg shows them */}
                    <MessageBubble
                      msg={
                        index === lastAstroIndex
                          ? msg
                          : { ...msg, quickReplies: undefined }
                      }
                      onInstall={(slug) => sendMessage(`__install:${slug}`)}
                      onSend={sendMessage}
                    />
                  </div>
                ))}

                {/* Thinking indicator */}
                {thinking && (
                  <div className="flex gap-2 items-start">
                    <div className="size-7 rounded-full bg-linear-to-br from-[#7C3AED] to-[#a855f7] flex items-center justify-center text-sm shrink-0">
                      👨‍🚀
                    </div>
                    <div className="bg-muted/70 rounded-2xl rounded-tl-sm px-3.5 py-3">
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="size-1.5 rounded-full bg-[#7C3AED]/60 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte ao ASTRO..."
                  className="flex-1 h-9 text-sm bg-muted/40 border-transparent focus-visible:border-[#7C3AED]/50"
                  disabled={thinking}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-9 bg-[#7C3AED] hover:bg-[#6D28D9] text-white shrink-0"
                  disabled={!input.trim() || thinking}
                >
                  <Send className="size-3.5" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
