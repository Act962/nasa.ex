import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const BOARD_PATH = "^/tracking/[^/]+$";

export const TRACKING_GUIDES: GuideDef[] = [
  {
    key: "tracking.create-lead",
    app: "tracking",
    title: "Criar um lead",
    summary: "Do tracking até o lead salvo, com o link da ficha no fim.",
    topicPattern: /\b(cri\w*|cadastr\w*|adicion\w*|coloc\w*|inclu\w*|inser\w*|novos?|novas?)\b.*\bleads?\b|\bleads? novos?\b/,
    steps: [
      {
        anchor: "trackingList",
        route: "/tracking",
        skipWhenPath: BOARD_PATH,
        title: "Escolha o tracking",
        message: "Cada tracking é um funil de vendas. Clique no tracking onde o lead vai entrar.",
        position: "top",
        advanceOn: "click",
      },
      {
        anchor: "boardNewLeadButton",
        title: "Clique em Novo Lead",
        message: "É por aqui que todo lead entra no funil.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "leadSheetName",
        title: "Digite o nome do lead aqui",
        message: "Pode ser o nome da pessoa ou da empresa. Quando terminar, clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadSheetPhone",
        title: "Agora o WhatsApp",
        message: "Com o número certo, as conversas desse lead aparecem no Chat automaticamente.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadSheetSubmit",
        title: "Clique em Criar lead",
        message: "Assim que ele for salvo, eu te mando o link da ficha.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.leadCreated,
      },
    ],
    finish: {
      title: "Lead criado! 🎉",
      message: "Ele já está na primeira etapa do funil. Quer abrir a ficha dele?",
      resultLabel: "Abrir lead",
    },
  },
  {
    key: "tracking.create-tracking",
    app: "tracking",
    title: "Criar um tracking",
    summary: "Monte um funil novo e caia direto no board dele.",
    topicPattern: /\b(cri\w*|mont\w*|novos?|novas?|fac\w*)\b.*\b(trackings?|funil|funis|pipelines?)\b/,
    spaceHelp: { categorySlug: "tracking", featureSlug: "criar-novo-tracking" },
    steps: [
      {
        anchor: "trackingNewButton",
        route: "/tracking",
        title: "Clique em Novo tracking",
        message: "Um tracking é um funil: as colunas são as etapas e os cards são os leads.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "trackingCreateName",
        title: "Dê um nome ao tracking",
        message: "Algo que a equipe reconheça, como Vendas ou Pós-venda. Depois clique em Continuar.",
        position: "bottom",
        advanceOn: "input",
      },
      {
        anchor: "trackingCreateSubmit",
        title: "Clique em Criar",
        message: "Eu te levo para o board novo assim que ele for criado.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.trackingCreated,
      },
    ],
    finish: {
      title: "Tracking criado! 🚀",
      message: "Agora é só colocar os leads. Se quiser, me peça: \"como crio um lead?\"",
      resultLabel: "Abrir tracking",
    },
  },
  {
    key: "tracking.move-lead",
    app: "tracking",
    title: "Mover um lead de etapa",
    summary: "Arraste o card entre as colunas do board.",
    topicPattern: /\b(mov\w*|arrast\w*|mud\w*|pass\w*|avanc\w*|trocar?)\b.*\b(leads?|cards?|etapas?|colunas?)\b/,
    spaceHelp: { categorySlug: "tracking", featureSlug: "mover-leads-pelo-kanban" },
    steps: [
      {
        anchor: "trackingList",
        route: "/tracking",
        skipWhenPath: BOARD_PATH,
        title: "Escolha o tracking",
        message: "Clique no tracking onde está o lead.",
        position: "top",
        advanceOn: "click",
      },
      {
        anchor: "boardColumns",
        title: "Segure o card e arraste",
        message: "Cada coluna é uma etapa do funil. Arraste o card do lead até a coluna da nova etapa. Pode testar agora e depois clicar em Próximo.",
        position: "top",
        advanceOn: "next",
        padding: 0,
      },
    ],
    finish: {
      title: "Pronto! ✅",
      message: "Sempre que a negociação avançar, arraste o card. A mudança fica registrada no histórico do lead.",
    },
  },
  {
    key: "tracking.customize-board",
    app: "tracking",
    title: "Personalizar o board",
    summary: "Escolha quais campos aparecem nos cards e nas colunas.",
    topicPattern: /\b(personaliz\w*|escond\w*|ocult\w*|mostr\w*|exib\w*|configur\w*|tir\w*)\b.*\b(board|cards?|campos?|kanban|colunas?)\b/,
    steps: [
      {
        anchor: "trackingList",
        route: "/tracking",
        skipWhenPath: BOARD_PATH,
        title: "Escolha o tracking",
        message: "Clique no tracking que você quer personalizar.",
        position: "top",
        advanceOn: "click",
      },
      {
        anchor: "boardCustomizeButton",
        title: "Clique em Personalizar",
        message: "Só aparece para quem pode editar o tracking.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "boardCustomizeSheet",
        title: "Ligue e desligue os campos",
        message: "Cada chave mostra ou esconde um campo do card ou da coluna, para toda a equipe desse tracking.",
        position: "left",
        advanceOn: "next",
      },
    ],
    finish: {
      title: "Board do seu jeito ✨",
      message: "Dá para voltar aqui e mudar quando quiser.",
    },
  },
];
