import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const CONVERSATION_PATH = "^/tracking-chat/[^/]+";
const TRACKING_SETTINGS_PATH = "^/tracking/[^/]+/settings";

export const CHAT_GUIDES: GuideDef[] = [
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
