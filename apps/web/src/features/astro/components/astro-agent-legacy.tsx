"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  ExternalLink,
  Youtube,
  BookOpen,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { integrations } from "@/data/integrations";
import type { Integration } from "@/types/integration";
import { CATEGORY_LABELS } from "@/types/integration";
import { orpc } from "@/lib/orpc";
import {
  suggestSpaceHelp,
  type SuggesterFeature,
  type SuggesterTrack,
  type SpaceHelpResource,
} from "../lib/space-help-suggester";
import { parseYoutubeId } from "@/features/space-help/lib/youtube";
import { useConnectionWizardStore } from "@/features/integrations/store/connection-wizard-store";
import { getGuidedMessage, getGuidedQuickReplies, getFaqAnswer } from "../lib/guided-mode";

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
  spaceHelpResources?: SpaceHelpResource[];
}

// ─── ASTRO Intelligence ───────────────────────────────────────────────────────

const GREETING: Message = {
  id: "greeting",
  role: "astro",
  text: "Olá! Sou o **ASTRO** 👨‍🚀 Seu assistente inteligente do NASA.\n\nConheço toda a plataforma e o **Space Help** com tutoriais ricos (prints + vídeos). Pergunte como fazer qualquer coisa: \"como conectar WhatsApp\", \"como criar uma tag\", \"como usar Forge\"...",
  quickReplies: [
    { label: "📚 Hub Space Help", value: "abrir space help", link: "/space-help" },
    { label: "🎓 Rotas de Conhecimento", value: "rotas de conhecimento", link: "/space-help/trilhas" },
    { label: "🚀 Método NASA", value: "o que é o método nasa" },
    { label: "🔌 Instalar integração", value: "quero instalar uma integração" },
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
  spaceHelpFeatures: SuggesterFeature[] = [],
  spaceHelpTracks: SuggesterTrack[] = [],
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
        text: `Vou te guiar para habilitar **${pendingInstall.name}** no NASA! 🚀\n\n${pendingInstall.description}\n\nApós habilitar, acesse a página da integração e insira as credenciais da **sua conta** ${pendingInstall.name}.\n\nClique em **Confirmar** para habilitar.`,
        integration: pendingInstall,
        quickReplies: [
          { label: "✅ Confirmar", value: `__install:${pendingInstall.slug}` },
          { label: "📖 Ver detalhes", value: `detalhes ${pendingInstall.name}`, link: `/integrations/${pendingInstall.slug}` },
          { label: "❌ Cancelar", value: "cancelar" },
        ],
      },
    ];
  }

  // ── Space Help — tutoriais ricos (prints + vídeos + links) ───────────────
  // Roda primeiro: se a query casa com algum tutorial/trilha, prioriza isso.
  // Excluímos casos onde já temos branch dedicado (método NASA, Stars, integração específica)
  // para não atrapalhar fluxos importantes.
  const isExplicitOtherIntent =
    q.includes("método nasa") || q.includes("metodo nasa") ||
    q.includes("o que são stars") || q.includes("o que sao stars") ||
    q.startsWith("instalar ") || q.startsWith("__install:") ||
    q === "início" || q === "inicio" ||
    /^detalhes\s+/.test(q);

  if (!isExplicitOtherIntent && (spaceHelpFeatures.length > 0 || spaceHelpTracks.length > 0)) {
    const resources = suggestSpaceHelp(input, spaceHelpFeatures, spaceHelpTracks, 3);
    if (resources.length > 0) {
      const featureCount = resources.filter((r) => r.kind === "feature").length;
      const trackCount = resources.filter((r) => r.kind === "track").length;
      const intro =
        trackCount > 0 && featureCount > 0
          ? `Encontrei tutoriais e trilhas que podem te ajudar! 📚`
          : trackCount > 0
            ? `Olha que trilha bacana pra você! 🎓`
            : `Encontrei tutorial(is) com print e passo a passo! 📸`;
      return [
        {
          id: id(),
          role: "astro",
          text: intro,
          spaceHelpResources: resources,
          quickReplies: [
            { label: "🎓 Ver todas as trilhas", value: "trilhas academy", link: "/space-help/trilhas" },
            { label: "📚 Hub Space Help", value: "abrir space help", link: "/space-help" },
            { label: "🔍 Outra dúvida", value: "ajuda" },
          ],
        },
      ];
    }
  }

  // ── Método NASA ────────────────────────────────────────────────────────────
  if (
    q.includes("método nasa") || q.includes("metodo nasa") ||
    q.includes("metodologia") || q.includes("processo de vendas") ||
    q.includes("sistematização") ||
    (q.includes("método") && recentContext.includes("nasa"))
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "O **Método NASA** estrutura todo o processo comercial em 4 etapas: 🚀\n\n**N — Necessidade**\nEntenda o que o cliente precisa. Use o **Chat** para capturar leads e o **Tracking** para qualificá-los.\n\n**A — Análise**\nAnalise o perfil e comportamento. Use **Insights** com dashboards em tempo real.\n\n**S — Sistematização**\nOrganize processos. Configure **Integrações**, **Automações**, **Agendas** e **Workspace**.\n\n**A — Ação**\nExecute com velocidade. Use o **FORGE** para enviar propostas, gerar contratos e fechar negócios.\n\n💡 Qual etapa você quer aprofundar?",
        quickReplies: [
          { label: "🎯 N — Chat & Leads", value: "como usar o chat", link: "/chat" },
          { label: "📊 A — Insights", value: "como usar insights", link: "/insights" },
          { label: "⚙️ S — Workspace", value: "como usar workspace", link: "/workspaces" },
          { label: "🔥 A — FORGE", value: "como usar o forge", link: "/forge" },
        ],
      },
    ];
  }

  // ── Stars ──────────────────────────────────────────────────────────────────
  if (
    q.includes("star") || q.includes("estrela") || q.includes("crédito") ||
    q.includes("saldo de star") || q.includes("stars")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "⭐ **Stars** são os créditos da plataforma NASA!\n\nCada funcionalidade de IA (chat com IA, agendamento por IA, geração de conteúdo) consome Stars. Elas funcionam como \"combustível\" para os recursos inteligentes.\n\n**Como funcionam:**\n• Seu plano define o saldo mensal de Stars\n• Cada organização tem seu próprio saldo\n• Admin pode distribuir Stars entre usuários\n• Pode ser por pool compartilhado, divisão igual ou orçamento individual\n\n**Modos de distribuição:**\n• **Pool da org** — todos compartilham o saldo\n• **Igual** — dividido igualmente entre membros ativos\n• **Personalizado** — cada membro tem seu orçamento\n\n📍 Acesse: **Menu → Admin → Stars**",
        quickReplies: [
          { label: "⭐ Ver saldo de Stars", value: "ver saldo stars", link: "/admin/stars" },
          { label: "📦 Ver planos", value: "quais são os planos", link: "/plans" },
          { label: "🏆 Space Points", value: "o que são space points" },
        ],
      },
    ];
  }

  // ── Space Points ───────────────────────────────────────────────────────────
  if (
    q.includes("space point") || q.includes("ponto") || q.includes("gamificação") ||
    q.includes("ranking") || q.includes("premiação") || q.includes("recompensa")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🏆 **Space Points** é o sistema de gamificação do NASA!\n\nMembros acumulam pontos ao realizar ações dentro da plataforma (fechar leads, completar tarefas, etc.).\n\n**Como funciona:**\n• Administrador configura as **regras de pontuação** (ex: fechar lead = 50 pts)\n• Membros veem seus pontos em tempo real\n• **Ranking** mostra os melhores da equipe\n• Admin pode definir **prêmios** para o pódio\n\n**Configuração:**\n📍 **Admin → Space Points → Regras**\n\nÉ uma excelente forma de motivar a equipe comercial! 🚀",
        quickReplies: [
          { label: "🏆 Ver ranking", value: "ver ranking space points", link: "/space-points" },
          { label: "⭐ O que são Stars?", value: "o que são stars" },
          { label: "👥 Gerenciar membros", value: "como gerenciar membros" },
        ],
      },
    ];
  }

  // ── Planos / Plans ─────────────────────────────────────────────────────────
  if (
    q.includes("plano") || q.includes("plan") || q.includes("assinatura") ||
    q.includes("upgrade") || q.includes("preço") || q.includes("mensalidade")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📦 O NASA oferece diferentes **planos de assinatura** com níveis de recursos e Stars mensais.\n\nCada plano define:\n• Quantidade de **Stars** mensais (créditos de IA)\n• Número máximo de **usuários**\n• Percentual de **rollover** (Stars não usadas passam para o próximo mês)\n• Acesso a funcionalidades avançadas\n\n💡 Quanto maior o plano, mais Stars e usuários disponíveis.\n\n📍 Acesse: **Menu → Planos** (página inicial) ou fale com o administrador.",
        quickReplies: [
          { label: "📦 Ver planos", value: "ver planos", link: "/plans" },
          { label: "⭐ O que são Stars?", value: "o que são stars" },
          { label: "🚀 Funcionalidades", value: "quais são as funcionalidades" },
        ],
      },
    ];
  }

  // ── Padrões NASA / Templates ───────────────────────────────────────────────
  if (
    q.includes("padrão") || q.includes("padrões") || q.includes("template") ||
    q.includes("modelo") || q.includes("exemplo") || q.includes("pré-configurado")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "✨ **Padrões NASA** são configurações prontas criadas pela NASA para você começar rápido!\n\nDisponíveis para:\n• **Tracking** — funis de vendas completos (status, tags, automações, agendas)\n• **Workspace** — quadros ágeis com colunas e automações prontas\n• **Propostas** — modelos de proposta com produtos\n• **Contratos** — contratos com cláusulas e variáveis dinâmicas\n\n**Como usar:**\n1. Acesse a seção desejada (ex: Trackings)\n2. Role até **Padrões NASA disponíveis** no final\n3. Clique em **Usar** — tudo é copiado para sua conta\n\n💡 Ótimo para novos usuários que querem começar sem configurar tudo do zero!",
        quickReplies: [
          { label: "📊 Padrões de Tracking", value: "como usar tracking", link: "/tracking" },
          { label: "📋 Padrões de Workspace", value: "como usar workspace", link: "/workspaces" },
          { label: "🔥 Padrões FORGE", value: "como usar o forge", link: "/forge" },
          { label: "⚙️ Admin de Padrões", value: "admin padrões", link: "/admin/patterns" },
        ],
      },
    ];
  }

  // ── Workspace ──────────────────────────────────────────────────────────────
  if (
    q.includes("workspace") || q.includes("quadro") || q.includes("kanban") ||
    q.includes("projeto") || q.includes("tarefa") || q.includes("ação") ||
    q.includes("task") || q.includes("board")
  ) {
    if (
      q.includes("automação") || q.includes("automatizar") || q.includes("workspace automation")
    ) {
      return [
        {
          id: id(),
          role: "astro",
          text: "⚙️ **Automações do Workspace** executam ações automáticas baseadas em gatilhos!\n\nExemplos:\n• Mover card para coluna quando responsável é atribuído\n• Notificar membros ao concluir uma ação\n• Alertar quando ação está atrasada\n\n**Como criar:**\n📍 **Workspace → [abra o workspace] → Configurações → Automações → Nova Automação**\n\nDefina o **gatilho**, as **condições** e as **ações** a executar.",
          quickReplies: [
            { label: "📋 Abrir Workspace", value: "abrir workspace", link: "/workspaces" },
            { label: "✨ Usar padrão Workspace", value: "padrões nasa" },
            { label: "⚙️ Automações Tracking", value: "como criar automação tracking" },
          ],
        },
      ];
    }
    return [
      {
        id: id(),
        role: "astro",
        text: "📋 O **Workspace** é o gerenciador de projetos e tarefas do NASA!\n\nFuncionalidades:\n• **Quadro Kanban** com colunas personalizáveis\n• **Ações** (tarefas) com responsáveis, datas, prioridade e subtarefas\n• **Tags** para categorizar ações\n• **Automações** para mover e notificar automaticamente\n• **Membros** com diferentes permissões\n• **Padrões NASA** com modelos prontos\n\n**Tipos de ação:** Tarefa, Ação, Reunião, Nota\n**Prioridades:** Nenhuma, Baixa, Média, Alta, Urgente\n\n📍 Acesse: **Menu → Workspace**",
        quickReplies: [
          { label: "📋 Abrir Workspace", value: "abrir workspace", link: "/workspaces" },
          { label: "✨ Usar padrão Workspace", value: "padrões nasa" },
          { label: "⚙️ Automações do Workspace", value: "como criar automação workspace" },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Configure credentials / settings ──────────────────────────────────────
  if (
    q.includes("credenci") || q.includes("configurar integração") ||
    q.includes("configurar agora") || q.includes("como configuro") ||
    q.includes("como configur") || q.includes("setup") || q.includes("ativar integração")
  ) {
    if (lastInstalledIntegration) {
      return [
        {
          id: id(),
          role: "astro",
          text: `Para conectar o **${lastInstalledIntegration.name}** ao NASA, insira as credenciais da sua conta nessa plataforma. 🔑\n\n1. Acesse a **página da integração** (botão abaixo)\n2. Clique em **Configurar**\n3. Insira Token, API Key ou Webhook da sua conta ${lastInstalledIntegration.name}\n4. Salve — cada empresa tem suas próprias credenciais\n\n💡 As credenciais são obtidas diretamente no painel da ${lastInstalledIntegration.name}.`,
          quickReplies: [
            { label: `⚙️ Abrir ${lastInstalledIntegration.name}`, value: `abrir ${lastInstalledIntegration.name}`, link: `/integrations/${lastInstalledIntegration.slug}` },
            { label: "❓ O que é API Key?", value: "o que é api key" },
            { label: "🔌 Instalar outra", value: "quero instalar uma integração" },
          ],
        },
      ];
    }
    return [
      {
        id: id(),
        role: "astro",
        text: "O NASA oferece o caminho para conectar ferramentas — as credenciais são **suas próprias contas** em cada plataforma. 🔑\n\nCada empresa no seu painel pode ter credenciais diferentes para a mesma integração.\n\n📍 Para configurar: **Menu → Integrações → selecione a integração → Configurar**",
        quickReplies: [
          { label: "🔌 Ver Integrações", value: "listar integrações", link: "/integrations" },
          { label: "💬 Configurar WhatsApp", value: "configurar whatsapp", link: "/integrations/whatsapp-business" },
          { label: "📷 Configurar Instagram", value: "configurar instagram", link: "/integrations/instagram-dm" },
        ],
      },
    ];
  }

  // ── API Key / Token / Webhook ──────────────────────────────────────────────
  if (q.includes("api key") || q.includes("token") || q.includes("webhook") || q.includes("o que é api")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "**API Key** é uma chave da sua conta em outra plataforma que autoriza o NASA a se comunicar com ela. 🔑\n\n1. Acesse o painel da plataforma (ex: Meta Business Suite, Google Cloud Console)\n2. Localize a seção **API**, **Desenvolvedor** ou **Integrações**\n3. Gere e copie sua chave\n4. Cole no campo de configuração da integração no NASA\n\n💡 Cada empresa do seu painel pode ter tokens diferentes para a mesma ferramenta.",
        quickReplies: [
          { label: "🔌 Ir para Integrações", value: "listar integrações", link: "/integrations" },
          { label: "💬 Configurar WhatsApp", value: "configurar whatsapp" },
          { label: "🚀 Voltar ao início", value: "início" },
        ],
      },
    ];
  }

  // ── FORGE — detalhes específicos ───────────────────────────────────────────
  if (q.includes("como enviar proposta") || q.includes("enviar proposta")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📄 **Como enviar uma proposta no FORGE:**\n\n1. Acesse **FORGE → Propostas**\n2. Clique em **Nova Proposta**\n3. Preencha título, cliente, produtos e valores\n4. Defina desconto (percentual ou fixo) se necessário\n5. Salve e mude o status para **Enviada**\n6. Copie o **link público** (ícone compartilhar) e envie ao cliente\n\n💡 O cliente acessa o link sem precisar de login e pode visualizar a proposta. Quando visualizado, o status muda automaticamente para **Visualizada**.",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "📋 Criar contrato após proposta", value: "como gerar contrato" },
          { label: "💳 Configurar pagamento", value: "configurar pagamento forge" },
        ],
      },
    ];
  }

  if (q.includes("como gerar contrato") || q.includes("gerar contrato") || q.includes("contrato a partir")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📋 **Como gerar um contrato a partir de uma proposta:**\n\n1. Acesse **FORGE → Propostas**\n2. No card da proposta, clique em **···** (mais opções)\n3. Selecione **Gerar Contrato**\n4. Preencha datas, valor e adicione os **assinantes** (nome + e-mail)\n5. Escreva o conteúdo ou use um **Padrão de contrato**\n6. Salve e compartilhe os links de assinatura\n\n💡 Cada assinante recebe um **link individual** para assinar eletronicamente. Você pode enviar por **WhatsApp** ou **e-mail** diretamente pelo sistema.",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "📄 Padrões de contrato", value: "padrões nasa" },
          { label: "🔗 Enviar para assinatura", value: "como assinar contrato" },
        ],
      },
    ];
  }

  if (q.includes("assinar contrato") || q.includes("assinatura") || q.includes("assinar")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "✍️ **Assinatura eletrônica no FORGE:**\n\nO cliente assina pelo **link individual** gerado para ele:\n\n1. No contrato, clique em **compartilhar** (ícone ao lado do contrato)\n2. Você verá todos os assinantes com seus links\n3. Envie por **WhatsApp** ou **E-mail** diretamente pela tela\n4. O cliente acessa o link e assina sem precisar de conta\n5. Quando assinar, o status do contrato atualiza automaticamente\n\n💡 Você acompanha em tempo real quem assinou e quem ainda não assinou.",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "📋 Criar contrato", value: "como gerar contrato" },
          { label: "📄 Padrões de contrato", value: "padrões nasa" },
        ],
      },
    ];
  }

  if (q.includes("produto") || q.includes("produto forge") || q.includes("catálogo")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📦 **Produtos no FORGE:**\n\nAntes de criar propostas, cadastre seus produtos/serviços:\n\n📍 **FORGE → Produtos → Novo Produto**\n\nCampos:\n• **Nome** e **SKU** (código único)\n• **Valor** unitário\n• **Unidade** (un, hr, mês, projeto...)\n• **Descrição** do produto\n\nNa proposta, adicione os produtos do catálogo e defina quantidade, valor e desconto por item.",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "📨 Criar proposta", value: "como enviar proposta" },
          { label: "✨ Padrões NASA FORGE", value: "padrões nasa" },
        ],
      },
    ];
  }

  if (q.includes("configurar pagamento forge") || q.includes("gateway de pagamento") || q.includes("link de pagamento")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "💳 **Gateways de Pagamento no FORGE:**\n\nVocê pode adicionar links de pagamento nas propostas:\n\n📍 **FORGE → ⚙️ Configurações → Gateways de Pagamento**\n\nGateways suportados:\n• Stripe\n• Asaas\n• PagBank\n• PagSeguro\n• Mercado Pago\n• Banco do Brasil\n• Caixa Econômica\n• PIX\n\nApós configurar, ao criar uma proposta você pode anexar um link de pagamento e o cliente paga diretamente pela proposta.",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "💳 Instalar Stripe", value: "instalar stripe" },
          { label: "💳 Instalar Asaas", value: "instalar asaas" },
        ],
      },
    ];
  }

  // ── FORGE geral ────────────────────────────────────────────────────────────
  if (q.includes("forge") || q.includes("proposta") || q.includes("contrato")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🔥 O **FORGE** é o módulo comercial completo do NASA!\n\n**Propostas:**\n• Criar com produtos, descontos e validade\n• Link público para o cliente visualizar\n• Status: Rascunho → Enviada → Visualizada → Paga\n\n**Contratos:**\n• Gerados a partir de propostas ou do zero\n• Assinatura eletrônica individual por link\n• Envio por WhatsApp ou e-mail\n\n**Produtos:** Catálogo com SKU, valor e unidade\n**Padrões:** Modelos prontos de proposta e contrato\n\n📍 Acesse: **Menu → FORGE**",
        quickReplies: [
          { label: "🔥 Abrir FORGE", value: "abrir forge", link: "/forge" },
          { label: "📨 Enviar proposta", value: "como enviar proposta" },
          { label: "📋 Gerar contrato", value: "como gerar contrato" },
          { label: "✨ Padrões FORGE", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Tracking — detalhes específicos ───────────────────────────────────────
  if (q.includes("como criar automação") || q.includes("criar workflow") || q.includes("automação tracking") || q.includes("workflow tracking")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🤖 **Automações (Workflows) no Tracking:**\n\nCrie fluxos automáticos para seus leads!\n\n📍 **Tracking → [seu funil] → Configurações → Automações → Novo Workflow**\n\n**Gatilhos disponíveis:**\n• Novo lead criado\n• Lead movido de status\n• Lead recebe tag\n• IA finalizou atendimento\n\n**Ações disponíveis:**\n• Enviar mensagem WhatsApp\n• Mover lead para status\n• Atribuir responsável\n• Aplicar tag ou temperatura\n• Marcar como ganho/perdido\n• Aguardar X horas/dias\n• Disparar webhook HTTP\n\n💡 Combine gatilhos e ações para criar fluxos complexos!",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "💬 Integrar WhatsApp", value: "instalar whatsapp business" },
          { label: "✨ Usar padrão com workflows", value: "padrões nasa" },
        ],
      },
    ];
  }

  if (q.includes("status do tracking") || q.includes("estágio") || q.includes("coluna do tracking") || q.includes("configurar funil")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🎯 **Configurando os Status do Tracking:**\n\nOs status são as colunas do seu funil de vendas (Kanban).\n\n📍 **Tracking → [seu funil] → Configurações → Status**\n\nVocê pode:\n• Criar novos status com nome e cor\n• Reordenar por drag & drop\n• Cada tracking tem seus próprios status\n\n**Exemplo de funil B2B:**\nProspecção → Qualificação → Proposta → Negociação → Fechado\n\n💡 Use **Padrões NASA** para ter um funil completo pronto em segundos!",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "✨ Usar padrão de funil", value: "padrões nasa" },
          { label: "🤖 Criar automação", value: "como criar automação tracking" },
        ],
      },
    ];
  }

  if (q.includes("consultor") || q.includes("atribuir lead") || q.includes("responsável lead")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "👤 **Consultores e Atribuição de Leads no Tracking:**\n\nVocê pode definir consultores responsáveis por leads:\n\n📍 **Tracking → [funil] → Configurações → Consultores**\n\n• Adicione membros como consultores do funil\n• Defina **limite máximo** de leads por consultor\n• Atribua leads manualmente pelo card\n• Use automações para **atribuição automática**\n\n💡 Quando um lead é atribuído a um consultor, ele aparece na fila dele e fica visível no dashboard de performance.",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "👥 Gerenciar membros", value: "como gerenciar membros" },
          { label: "🤖 Automação de atribuição", value: "como criar automação tracking" },
        ],
      },
    ];
  }

  if (q.includes("tag") || q.includes("etiqueta")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🏷️ **Tags no NASA:**\n\nTags servem para categorizar e filtrar leads no Tracking.\n\n📍 **Tracking → [funil] → Configurações → Tags**\n\n• Crie tags com nome, cor, ícone e descrição\n• Aplique tags aos leads manualmente ou por automação\n• Filtre leads por tag no Kanban\n• Widgets de Insights podem exibir leads por tag\n\n**Dica:** Use tags como \"Quente\", \"Follow-up\", \"Decisor\", \"Enterprise\" para qualificar oportunidades rapidamente.",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "🤖 Criar automação com tag", value: "como criar automação tracking" },
          { label: "✨ Padrão com tags prontas", value: "padrões nasa" },
        ],
      },
    ];
  }

  if (q.includes("ia do tracking") || q.includes("assistente de vendas") || q.includes("ia de atendimento") || q.includes("configurar ia") || q.includes("ai settings")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🤖 **IA de Atendimento no Tracking:**\n\nCada funil pode ter um assistente de IA configurado para atender leads no chat!\n\n📍 **Tracking → [funil] → Configurações → IA**\n\n**Configurações:**\n• **Nome do assistente** (ex: \"Nora\", \"Max\")\n• **Prompt** — instrução de como a IA deve se comportar\n• **Frase de encerramento** — mensagem final antes de transferir para humano\n\n💡 A IA qualifica o lead antes de passá-lo para um consultor, economizando tempo da equipe!\n\nUse **Padrões NASA** que já vêm com IA pré-configurada.",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "⭐ Ver saldo de Stars (IA consome)", value: "o que são stars" },
          { label: "✨ Padrão com IA configurada", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Tracking / Pipeline / Leads geral ─────────────────────────────────────
  if (
    q.includes("tracking") || q.includes("lead") ||
    q.includes("pipeline") || q.includes("funil") || q.includes("oportunidade") ||
    q.includes("crm") || q.includes("kanban de venda")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📊 O **Tracking** é o CRM de vendas do NASA!\n\n**Funcionalidades:**\n• Pipeline visual (Kanban) com colunas personalizáveis\n• Múltiplos funis por organização\n• Tags, temperatura e origem de leads\n• Consultores com limite de leads\n• Histórico completo de interações\n• **IA de atendimento** por funil\n• Workflows de automação\n• Integração com Chat e Agenda\n\n📍 Acesse: **Menu → Trackings**",
        quickReplies: [
          { label: "📊 Abrir Tracking", value: "abrir tracking", link: "/tracking" },
          { label: "🤖 Criar automação", value: "como criar automação tracking" },
          { label: "🤖 Configurar IA do funil", value: "ia do tracking" },
          { label: "✨ Usar padrão de funil", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Agenda — detalhes específicos ──────────────────────────────────────────
  if (q.includes("chat de agendamento") || q.includes("chat público") || q.includes("chatbot de agenda")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "💬 **Chat de Agendamento:**\n\nAntes de confirmar o horário, o cliente passa por um **chat de IA** que coleta informações!\n\nComo funciona:\n1. Cliente acessa o link público da agenda\n2. Inicia um chat com a IA (configurada por você)\n3. A IA coleta nome, telefone e motivo\n4. O cliente escolhe o horário disponível\n5. Agendamento confirmado — lead criado no Tracking\n\n📍 Configure a IA: **Tracking → [funil] → Agendas → [agenda] → Configurações**\n\n⭐ O chat de IA consome **Stars**.",
        quickReplies: [
          { label: "📅 Abrir Agendas", value: "abrir agendas", link: "/agenda" },
          { label: "⭐ O que são Stars?", value: "o que são stars" },
          { label: "🤖 Configurar IA", value: "ia do tracking" },
        ],
      },
    ];
  }

  if (q.includes("horário disponível") || q.includes("bloquear data") || q.includes("disponibilidade agenda")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📅 **Configurando Disponibilidade da Agenda:**\n\n📍 **Tracking → [funil] → Agendas → [agenda] → Disponibilidade**\n\n**Disponibilidade semanal:**\n• Ative os dias da semana (Seg–Dom)\n• Defina os horários de início e fim\n• Adicione múltiplos intervalos por dia\n\n**Bloqueios específicos:**\n• Bloqueie datas pontuais (feriados, folgas)\n• Configure disponibilidade especial para uma data\n\n**Duração do slot:** Configure em minutos (ex: 30min, 1h) nas configurações da agenda.",
        quickReplies: [
          { label: "📅 Abrir Agendas", value: "abrir agendas", link: "/agenda" },
          { label: "💬 Chat de agendamento", value: "chat de agendamento" },
          { label: "✨ Padrão com agenda", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Agenda geral ───────────────────────────────────────────────────────────
  if (
    q.includes("agenda") || q.includes("agendamento") ||
    q.includes("calendário") || q.includes("horário") ||
    q.includes("reunião") || q.includes("appointment")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📅 O módulo de **Agendas** permite criar calendários de agendamento online!\n\n**Funcionalidades:**\n• Link público para clientes agendarem\n• **Chat de IA** antes do agendamento (coleta informações)\n• Disponibilidade por dia da semana + horários\n• Bloqueio de datas específicas\n• Duração do slot configurável\n• Integração com Tracking (cria lead automaticamente)\n• Múltiplos responsáveis por agenda\n\n📍 Acesse: **Tracking → [funil] → Configurações → Agendas**\n\n⭐ O chat de IA pré-agendamento consome Stars.",
        quickReplies: [
          { label: "📅 Abrir Agendas", value: "abrir agendas", link: "/agenda" },
          { label: "💬 Chat de agendamento", value: "chat de agendamento" },
          { label: "📅 Configurar disponibilidade", value: "horário disponível" },
          { label: "✨ Padrão com agenda", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Chat / Atendimento ─────────────────────────────────────────────────────
  if (
    q.includes("chat") || q.includes("atendimento") ||
    q.includes("conversa") || q.includes("inbox") || q.includes("mensagem")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "💬 O **Chat** é o inbox unificado de atendimento do NASA!\n\n**Funcionalidades:**\n• Todas as conversas em um único lugar\n• WhatsApp, Instagram, Facebook, Telegram\n• IA de atendimento por funil\n• Distribuição automática para consultores\n• Histórico completo de interações\n• Captura automática de leads no Tracking\n• Envio de arquivos e mídias\n\n📍 Acesse: **Menu → Chats**\n\n💡 Esta é a etapa **N (Necessidade)** do Método NASA.",
        quickReplies: [
          { label: "💬 Abrir Chat", value: "abrir chat", link: "/chat" },
          { label: "📱 Instalar WhatsApp", value: "instalar whatsapp business" },
          { label: "📷 Instalar Instagram DM", value: "instalar instagram dm" },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Insights / Analytics ───────────────────────────────────────────────────
  if (
    q.includes("insight") || q.includes("relatório") || q.includes("dashboard") ||
    q.includes("métrica") || q.includes("análise") || q.includes("performance")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📊 O módulo de **Insights** traz dashboards e relatórios em tempo real!\n\n**Você visualiza:**\n• Performance do pipeline de vendas\n• Leads por origem e canal\n• Taxa de conversão por etapa\n• Métricas de chat e atendimento\n• Relatórios de propostas FORGE\n• Ranking de consultores\n\n💡 É a etapa **A (Análise)** do Método NASA — onde você toma decisões baseadas em dados.\n\n📍 Acesse: **Menu → Insights**",
        quickReplies: [
          { label: "📊 Abrir Insights", value: "abrir insights", link: "/insights" },
          { label: "🔌 Integrar Google Analytics", value: "instalar analytics" },
          { label: "🚀 Método NASA — Análise", value: "o que é o método nasa" },
        ],
      },
    ];
  }

  // ── Automação geral ────────────────────────────────────────────────────────
  if (
    q.includes("automação") || q.includes("automation") ||
    q.includes("fluxo automático") || q.includes("automatizar")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "⚙️ O NASA tem dois tipos de **Automação**:\n\n**1. Workflows no Tracking**\nFluxos para leads: mover estágio, enviar mensagem, atribuir consultor, disparar webhook.\n📍 Tracking → [funil] → Configurações → Automações\n\n**2. Automações no Workspace**\nRegras para tarefas: mover card, notificar membros, alertar atraso.\n📍 Workspace → [projeto] → Configurações → Automações\n\nAmbas funcionam com **gatilhos** → **condições** → **ações**.",
        quickReplies: [
          { label: "🤖 Automação no Tracking", value: "como criar automação tracking" },
          { label: "📋 Automação no Workspace", value: "como criar automação workspace" },
          { label: "🔌 Integrar Zapier/Make", value: "instalar zapier" },
          { label: "✨ Padrões com automações", value: "padrões nasa" },
        ],
      },
    ];
  }

  // ── Membros / Organização / Permissões ─────────────────────────────────────
  if (
    q.includes("membro") || q.includes("usuário") || q.includes("equipe") ||
    q.includes("permissão") || q.includes("convite") || q.includes("convidar") ||
    q.includes("organização") || q.includes("admin")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "👥 **Gerenciamento de Membros e Organização:**\n\n**Funções (roles):**\n• **Owner** — controle total\n• **Admin** — gerencia membros e configurações\n• **Moderador** — pode criar Padrões NASA\n• **Member** — acesso padrão\n\n**Como convidar:**\n📍 **Configurações da Org → Membros → Convidar**\n\n**Admin:**\n📍 **Menu → Admin** — painel administrativo com:\n• Gerenciamento de membros e roles\n• Configuração de Stars e distribuição\n• Space Points e rankings\n• Padrões NASA (templates)\n• Logs de atividade",
        quickReplies: [
          { label: "⚙️ Abrir Admin", value: "abrir admin", link: "/admin" },
          { label: "⭐ Configurar Stars", value: "o que são stars" },
          { label: "🏆 Space Points", value: "o que são space points" },
        ],
      },
    ];
  }

  // ── NBox (arquivos/documentos) ─────────────────────────────────────────────
  if (
    q.includes("nbox") || q.includes("arquivo") || q.includes("documento") ||
    q.includes("pasta") || q.includes("storage") || q.includes("armazenamento")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📁 O **NBox** é o sistema de armazenamento de arquivos e documentos do NASA!\n\n**Funcionalidades:**\n• Organização em **pastas**\n• Upload de qualquer tipo de arquivo\n• Compartilhamento entre membros da organização\n• Associação de arquivos a leads\n\n📍 Acesse: **Menu → NBox**\n\n💡 Ótimo para centralizar contratos, apresentações, mídias e materiais comerciais usados pela equipe.",
        quickReplies: [
          { label: "📁 Abrir NBox", value: "abrir nbox", link: "/nbox" },
          { label: "🔥 FORGE (contratos)", value: "como gerar contrato" },
          { label: "🚀 Funcionalidades", value: "quais são as funcionalidades" },
        ],
      },
    ];
  }

  // ── NASA Planner ───────────────────────────────────────────────────────────
  if (
    q.includes("planner") || q.includes("nasa planner") ||
    q.includes("planejador") || q.includes("conteúdo") || q.includes("post")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "📅 O **NASA Planner** é o planejador de conteúdo e tarefas estratégicas!\n\nVocê pode:\n• Criar posts e planejamentos com data e hora\n• Organizar iniciativas por período\n• Visualizar calendário de conteúdo\n• Colaborar com a equipe no planejamento\n\n📍 Acesse: **Menu → NASA Planner**",
        quickReplies: [
          { label: "📅 Abrir NASA Planner", value: "abrir nasa planner", link: "/nasa-planner" },
          { label: "📋 Workspace (tarefas)", value: "como usar workspace" },
          { label: "🚀 Funcionalidades", value: "quais são as funcionalidades" },
        ],
      },
    ];
  }

  // ── Funcionalidades gerais / Sobre o NASA ──────────────────────────────────
  if (
    q.includes("funcionalidade") || q.includes("recurso") ||
    q.includes("sobre o nasa") || q.includes("o que faz") ||
    q.includes("início") || q.includes("inicio") || q.includes("ajuda")
  ) {
    return [
      {
        id: id(),
        role: "astro",
        text: "🚀 O **NASA** é uma plataforma completa de CRM e automação comercial!\n\n**Módulos principais:**\n• **Tracking** — CRM, pipeline, leads, IA de atendimento\n• **FORGE** — propostas, contratos, assinatura eletrônica\n• **Workspace** — gestão de projetos e tarefas\n• **Agendas** — agendamento online com chat de IA\n• **Chat** — inbox unificado de atendimento\n• **Insights** — dashboards e relatórios\n• **NBox** — armazenamento de arquivos\n• **Stars** — créditos de IA\n• **Space Points** — gamificação\n• **Padrões NASA** — templates prontos\n• **Integrações** — +107 apps conectados\n\n🚀 Tudo estruturado pelo **Método NASA** (N-A-S-A).",
        quickReplies: [
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
          { label: "✨ Padrões NASA", value: "padrões nasa" },
          { label: "🔥 FORGE", value: "como usar o forge" },
          { label: "⭐ Stars", value: "o que são stars" },
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
    ["assinatura digital", "documents"],
    ["workflow integration", "workflow"],
    ["ligação", "calls"],
    ["telefon", "calls"],
    ["crm externo", "crm_customization"],
    ["videoconferência", "productivity"],
    ["suporte ao vivo", "live_chat"],
    ["chat ao vivo", "live_chat"],
    ["segmento de", "industry"],
  ] as [string, string][]) {
    if (q.includes(keyword)) {
      const list = integrations.filter((i) => i.category === category).slice(0, 5);
      const listText = list.map((i) => `• **${i.name}** — ${i.description.slice(0, 60)}...`).join("\n");
      msgs.push({
        id: id(),
        role: "astro",
        text: `Integrações de **${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}** disponíveis:\n\n${listText}`,
        quickReplies: [
          ...list.slice(0, 3).map((i) => ({ label: `Instalar ${i.name}`, value: `instalar ${i.name}` })),
          { label: "🔌 Ver todas as categorias", value: "quero instalar uma integração" },
        ],
      });
      return msgs;
    }
  }

  // ── Generic install intent ─────────────────────────────────────────────────
  if (q.includes("instalar") || q.includes("install") || q.includes("integração") || q.includes("integrar")) {
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
            { label: `✅ Instalar ${found.name}`, value: `__install:${found.slug}` },
            { label: "📖 Ver detalhes", value: `detalhes ${found.name}`, link: `/integrations/${found.slug}` },
            { label: "🔍 Ver outras opções", value: "quero instalar uma integração" },
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
          { label: "💬 Mensageiros (WhatsApp, Telegram...)", value: "instalar mensageiro" },
          { label: "🛒 E-commerce (Shopify, Nuvemshop...)", value: "instalar ecommerce" },
          { label: "📣 Marketing (RD Station, Mailchimp...)", value: "instalar marketing" },
          { label: "💳 Pagamentos (Stripe, Asaas...)", value: "instalar pagamento" },
          { label: "🤖 Chatbots (Typebot, ManyChat...)", value: "instalar chatbot" },
          { label: "🔌 Todas as integrações", value: "listar integrações", link: "/integrations" },
        ],
      },
    ];
  }

  // ── List integrations ──────────────────────────────────────────────────────
  if (q.includes("listar") || q.includes("lista") || q.includes("todas") || q.includes("marketplace")) {
    return [
      {
        id: id(),
        role: "astro",
        text: `Temos **${integrations.length} integrações** disponíveis em 19 categorias no Marketplace! 🔌\n\nDigite o nome de uma integração para instalá-la ou acesse o Marketplace para navegar por todas.`,
        quickReplies: [
          { label: "🏪 Abrir Marketplace", value: "abrir marketplace", link: "/integrations" },
          { label: "💬 WhatsApp Business", value: "instalar whatsapp business" },
          { label: "📣 RD Station", value: "instalar rd station" },
          { label: "💳 Stripe", value: "instalar stripe" },
        ],
      },
    ];
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  if (q.includes("cancelar") || q.includes("não quero") || q.includes("deixa pra lá")) {
    return [
      {
        id: id(),
        role: "astro",
        text: "Tudo bem! 😊 Fico por aqui quando precisar.",
        quickReplies: [
          { label: "🔌 Instalar integração", value: "quero instalar uma integração" },
          { label: "🚀 Método NASA", value: "o que é o método nasa" },
          { label: "❓ Funcionalidades", value: "quais são as funcionalidades" },
        ],
      },
    ];
  }

  // ── Integration detail / context-aware fallback ────────────────────────────
  const cleanQ = q.replace(/^(instalar|install|integrar|configurar|detalhes?)\s+/i, "").trim();
  const found = findIntegration(cleanQ) || findIntegration(q);
  if (found) {
    return [
      {
        id: id(),
        role: "astro",
        text: `Encontrei **${found.name}**! 🎯\n\n${found.description}`,
        integration: found,
        quickReplies: [
          { label: `✅ Instalar ${found.name}`, value: `__install:${found.slug}` },
          { label: "📖 Ver detalhes", value: `detalhes ${found.name}`, link: `/integrations/${found.slug}` },
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
      text: "Hmm, não entendi muito bem. 🤔 Posso te ajudar com:\n\n• **Tracking** — CRM e pipeline de vendas\n• **FORGE** — propostas e contratos\n• **Workspace** — gestão de tarefas\n• **Agendas** — agendamento online\n• **Stars** — créditos de IA\n• **Padrões NASA** — templates prontos\n• **Integrações** — +107 apps\n• **Método NASA** — metodologia comercial\n\nComo posso ajudar?",
      quickReplies: [
        { label: "🚀 Método NASA", value: "o que é o método nasa" },
        { label: "✨ Padrões NASA", value: "padrões nasa" },
        { label: "🔌 Instalar integração", value: "quero instalar uma integração" },
        { label: "📋 Todas funcionalidades", value: "quais são as funcionalidades" },
      ],
    },
  ];
}

// ─── Space Help resource card ──────────────────────────────────────────────────

function SpaceHelpResourceCard({ resource }: { resource: SpaceHelpResource }) {
  const youtubeId = parseYoutubeId(resource.youtubeUrl ?? null);
  const youtubeThumb = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
  const previewSrc = resource.screenshotUrl || youtubeThumb;
  const isTrack = resource.kind === "track";

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm w-full">
      {/* Thumbnail / Print */}
      {previewSrc ? (
        <div className="relative aspect-video w-full bg-muted overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={resource.title}
            className="size-full object-cover"
          />
          {youtubeId && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="size-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 24 24" fill="white" className="size-5 ml-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
          <div className="absolute top-1.5 left-1.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
              {isTrack ? <GraduationCap className="size-2.5" /> : <BookOpen className="size-2.5" />}
              {isTrack ? "TRILHA" : resource.categoryName?.toUpperCase() ?? "TUTORIAL"}
            </span>
          </div>
        </div>
      ) : (
        <div className="aspect-video w-full bg-linear-to-br from-violet-500/10 via-fuchsia-500/5 to-amber-500/5 flex items-center justify-center">
          <Sparkles className="size-8 text-violet-500/60" />
        </div>
      )}

      {/* Body */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-[12px] font-bold leading-tight">{resource.title}</p>
          {resource.summary && (
            <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
              {resource.summary}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap text-[9px] text-muted-foreground">
          {isTrack && resource.lessonCount != null && (
            <span className="flex items-center gap-0.5">
              <BookOpen className="size-2.5" />
              {resource.lessonCount} aulas
            </span>
          )}
          {!isTrack && resource.stepCount != null && resource.stepCount > 0 && (
            <span className="flex items-center gap-0.5">
              <BookOpen className="size-2.5" />
              {resource.stepCount} passos
            </span>
          )}
          {isTrack && (resource.rewardStars ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-amber-600">
              ⭐ {resource.rewardStars} STARs
            </span>
          )}
          {isTrack && (resource.rewardSpacePoints ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-violet-600">
              ✨ {resource.rewardSpacePoints} SP
            </span>
          )}
          {resource.youtubeUrl && (
            <span className="flex items-center gap-0.5 text-red-500">
              <Youtube className="size-2.5" />
              vídeo
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5">
          <Link href={resource.url} className="flex-1">
            <Button
              size="sm"
              className="w-full h-7 text-[11px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1"
            >
              {isTrack ? "Iniciar trilha" : "Ver tutorial"}
              <ExternalLink className="size-3" />
            </Button>
          </Link>
          {resource.youtubeUrl && (
            <a
              href={resource.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1 border-red-500/30 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500"
                title="Abrir vídeo no YouTube"
              >
                <Youtube className="size-3" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
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

        {/* Space Help resource cards (prints + vídeos + links) */}
        {msg.spaceHelpResources && msg.spaceHelpResources.length > 0 && (
          <div className="space-y-2 w-full">
            {msg.spaceHelpResources.map((resource, idx) => (
              <SpaceHelpResourceCard key={`${resource.url}-${idx}`} resource={resource} />
            ))}
          </div>
        )}

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

  // ── Space Help data (categorias + features + tracks) ────────────────────
  const { data: spaceHelpCategoriesData } = useQuery({
    ...orpc.spaceHelp.listCategories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: spaceHelpTracksData } = useQuery({
    ...orpc.spaceHelp.listTracks.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const spaceHelpFeatures = useMemo<SuggesterFeature[]>(() => {
    const cats = spaceHelpCategoriesData?.categories ?? [];
    const out: SuggesterFeature[] = [];
    for (const cat of cats) {
      for (const f of cat.features ?? []) {
        out.push({
          id: f.id,
          slug: f.slug,
          title: f.title,
          summary: f.summary ?? null,
          youtubeUrl: f.youtubeUrl ?? null,
          category: { slug: cat.slug, name: cat.name },
          firstStepScreenshotUrl: f.steps?.[0]?.screenshotUrl ?? null,
          stepCount: f._count?.steps ?? 0,
        });
      }
    }
    return out;
  }, [spaceHelpCategoriesData]);

  const spaceHelpTracks = useMemo<SuggesterTrack[]>(() => {
    const tracks = spaceHelpTracksData?.tracks ?? [];
    return tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      subtitle: t.subtitle ?? null,
      description: t.description ?? null,
      coverUrl: t.coverUrl ?? null,
      rewardStars: t.rewardStars ?? 0,
      rewardSpacePoints: t.rewardSpacePoints ?? 0,
      lessonCount: t.lessonCount ?? 0,
    }));
  }, [spaceHelpTracksData]);

  // Handle pending install from marketplace
  useEffect(() => {
    if (pendingInstall && astroOpen) {
      setThinking(true);
      setTimeout(() => {
        const responses = buildAstroResponse(
          "",
          messages,
          pendingInstall,
          spaceHelpFeatures,
          spaceHelpTracks,
        );
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

  const wizardProvider = useConnectionWizardStore((s) => s.provider);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Guided mode (Connection Wizard) — try FAQ first
      if (wizardProvider) {
        const faq = getFaqAnswer(text);
        if (faq) {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: "user", text },
            { id: generateId(), role: "astro", text: faq },
          ]);
          return;
        }
      }

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
        const responses = buildAstroResponse(
          text,
          prev,
          null,
          spaceHelpFeatures,
          spaceHelpTracks,
        );
        return [...prev, ...responses];
      });
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [install, isInstalled, spaceHelpFeatures, spaceHelpTracks],
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
        data-tour="astro-button"
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
              {/* Guided mode banner (Connection Wizard) */}
              <GuidedModeBanner onSend={sendMessage} />
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

function GuidedModeBanner({ onSend }: { onSend: (text: string) => void }) {
  const provider = useConnectionWizardStore((s) => s.provider);
  const step = useConnectionWizardStore((s) => s.currentStep);
  const error = useConnectionWizardStore((s) => s.error);
  if (!provider) return null;
  const message = getGuidedMessage({ provider, step, error });
  const replies = getGuidedQuickReplies({ provider, step, error });
  return (
    <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 px-4 py-3">
      <div className="flex items-start gap-2">
        <Sparkles className="size-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Modo guiado · {provider === "meta" ? "Meta" : "Google"}
          </p>
          <p className="text-xs leading-relaxed text-foreground/80 mt-1">{message}</p>
          {replies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {replies.map((r) => (
                <button
                  key={r}
                  onClick={() => onSend(r)}
                  className="rounded-full border border-amber-300/60 bg-white/60 dark:bg-background/60 px-2.5 py-1 text-[11px] hover:bg-amber-100 dark:hover:bg-amber-950/30 transition"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
