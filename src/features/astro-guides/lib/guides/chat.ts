import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const CONVERSATION_PATH = "^/tracking-chat/[^/]+";
const TRACKING_SETTINGS_PATH = "^/tracking/[^/]+/settings";

export const CHAT_GUIDES: GuideDef[] = [
  {
    key: "chat.attendance-first-responder",
    app: "chat",
    title: "Configurar quem atende primeiro",
    summary: "Escolha se a equipe ou a IA responde primeiro e os tempos da mensagem de espera e dos avisos.",
    topicPattern:
      /\b(quem (responde|atende) primeiro|equipe primeiro|ia primeiro|mensagem (fixa|de espera)|aguard\w* atendimento|em atendimento|tempo (de|da) (espera|ia)|avis\w* (ao|pro|para o) dono)\b/,
    steps: [
      {
        anchor: "chatSettingsButton",
        route: "/tracking-chat",
        skipWhenPath: TRACKING_SETTINGS_PATH,
        title: "Abra as configurações do funil",
        message: "Cada funil tem a sua regra de atendimento. Clique na engrenagem.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "settingsChatbotTab",
        title: "Vá em Fluxo de atendimento",
        message: "Aqui ficam as regras da IA deste funil.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "chatbotIaCapabilitiesTab",
        title: "Abra \"O que o Astro pode fazer\"",
        message: "A seção Atendimento fica nesta aba.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "attendanceSettingsSection",
        title: "Escolha quem responde primeiro",
        message: "Equipe primeiro: sai a mensagem fixa e a IA entra se ninguém responder. IA primeiro: a IA responde na hora. Ajuste os tempos e salve.",
        position: "top",
        advanceOn: "next",
      },
    ],
    finish: {
      title: "Atendimento configurado ✨",
      message: "As etiquetas \"Aguard. atendimento\" e \"Em atendimento\" passam a seguir essa regra neste funil.",
    },
  },
  {
    key: "chat.connect-whatsapp",
    app: "chat",
    title: "Conectar o WhatsApp",
    summary: "Crie a instância do funil e leia o QR Code com o celular.",
    topicPattern: /\b(conect\w*|lig\w*|vincul\w*|integr\w*|configur\w*|coloc\w*|ativ\w*)\b.*\b(whats\w*|zap|numeros?|celular|instancias?|qr ?code)\b/,
    spaceHelp: { categorySlug: "nasachat", featureSlug: "conectar-whatsapp" },
    steps: [
      {
        anchor: "chatSettingsButton",
        route: "/tracking-chat",
        skipWhenPath: TRACKING_SETTINGS_PATH,
        title: "Abra as configurações do funil",
        message: "Cada funil tem o seu número de WhatsApp. Clique na engrenagem.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "settingsInstanceTab",
        skipWhenVisible: "whatsappInstancesPanel",
        title: "Vá em Integrações",
        message: "É aqui que moram os números de WhatsApp do funil.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "whatsappCreateFirstInstance",
        title: "Clique em Criar primeira instância",
        message: "A instância é o número de WhatsApp que vai atender esse funil.",
        position: "bottom",
        advanceOn: "click",
        missingMessage:
          "Esse funil já tem um número. Para reconectar, clique em \"Conectar Agora\" na instância e leia o QR Code.",
      },
      {
        anchor: "whatsappProviderChoice",
        title: "Escolha Uazapi (não-oficial)",
        message: "É a opção que conecta pelo QR Code, com o seu número atual. A API Oficial tem outro caminho.",
        position: "left",
        advanceOn: "next",
      },
      {
        anchor: "whatsappInstanceName",
        title: "Dê um nome à instância",
        message: "Algo como \"Vendas\" ou o nome da loja. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "whatsappInstanceSubmit",
        title: "Clique em Criar",
        message: "O QR Code abre logo em seguida.",
        position: "top",
        advanceOn: "click",
      },
      {
        anchor: "whatsappQrDialog",
        title: "Leia o QR Code com o celular",
        message:
          "No WhatsApp do celular: Configurações → Aparelhos conectados → Conectar aparelho, e aponte para o QR Code.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.whatsappConnected,
      },
    ],
    finish: {
      title: "WhatsApp conectado! ✅",
      message: "As conversas desse número já começam a chegar no Chat.",
      resultLabel: "Abrir o Chat",
    },
  },
  {
    key: "chat.reply-conversation",
    app: "chat",
    title: "Responder uma conversa",
    summary: "Abra a conversa e mande a resposta pelo WhatsApp.",
    topicPattern:
      /\b(respond\w*|atend\w*|envi\w*|mand\w*|escrev\w*|fal\w*|convers\w*)\b.*\b(conversas?|mensage\w*|clientes?|leads?|chat|whats\w*)\b/,
    spaceHelp: { categorySlug: "nasachat", featureSlug: "atender-conversa" },
    steps: [
      {
        anchor: "chatConversationList",
        route: "/tracking-chat",
        skipWhenPath: CONVERSATION_PATH,
        title: "Escolha a conversa",
        message: "As mais recentes ficam no topo. Clique na conversa que você quer responder.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "chatComposer",
        title: "Escreva e envie",
        message: "Digite a resposta e aperte Enter. Shift + Enter pula linha.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.chatMessageSent,
        missingMessage:
          "Esse funil ainda não tem WhatsApp conectado, por isso não dá para responder. Me peça: \"como conecto o WhatsApp?\"",
      },
    ],
    finish: {
      title: "Mensagem enviada! 💬",
      message: "O cliente recebe no WhatsApp dele, e a resposta fica no histórico do lead.",
    },
  },
];
