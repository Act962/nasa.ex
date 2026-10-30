import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const TRAFEGO_GUIDES: GuideDef[] = [
  // Antes de "trafego.order": publicar pelo painel é mais específico que pedir campanha (spec 0124).
  {
    key: "trafego.publish",
    app: "trafego",
    title: "Publicar uma campanha de WhatsApp pelo painel",
    summary: "Monte o anúncio a partir de um post do Instagram e publique você mesmo.",
    topicPattern:
      /\b(public\w*|sub\w*|coloc\w* no ar|cri\w*|mont\w*)\b.*\b(campanhas?|anuncios?)\b.*\b(pelo painel|no painel|eu mesm\w*|sozinh\w*|por conta propria|post do instagram)\b/,
    steps: [
      {
        anchor: "trafegoPublishTab",
                title: "Abra a aba Publicar",
        message: "Dentro da campanha, a aba Publicar monta o anúncio passo a passo. Só o dono ou um administrador vê.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "Abra uma campanha em Minhas campanhas. A aba Publicar aparece para o dono e os administradores da empresa.",
      },
      {
        anchor: "trafegoCreateDraft",
        title: "Crie o rascunho",
        message: "Escolha público, post e verba. O rascunho nasce pausado na sua conta: nada vai ao ar ainda.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.trafegoDraftCreated,
      },
      {
        anchor: "trafegoPublishCampaign",
        title: "Publique",
        message: "Confira o rascunho e clique em Publicar. A Meta revisa o anúncio antes de entregar.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.trafegoCampaignPublished,
      },
    ],
    finish: {
      title: "Campanha publicada! 🚀",
      message: "Acompanhe as conversas e a verba usada na aba Desempenho.",
    },
  },
  {
    key: "trafego.order",
    app: "trafego",
    title: "Pedir uma campanha de tráfego pago",
    summary: "Monte o pedido no trafeGO; nossa equipe coloca no ar.",
    topicPattern:
      /\b(cri\w*|mont\w*|fac\w*|faz\w*|ped\w*|contrat\w*|coloc\w*|anunc\w*|impulsion\w*|novas?)\b.*\b(trafego|trafeg\w*|anuncios?|ads|campanhas? (paga|de trafego|no meta|no google|no instagram)|impulsionamento)\b/,
    steps: [
      {
        anchor: "trafegoNewCampaign",
        route: "/trafego/painel",
        title: "Clique em Nova campanha",
        message: "Abre o assistente do trafeGO. Se você já pediu antes, ele reaproveita os seus dados.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "trafegoStartButton",
        skipWhenVisible: "trafegoWizard",
        title: "Clique em Montar minha campanha",
        message: "Abre as etapas do pedido.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "trafegoWizard",
        title: "Siga as etapas",
        message:
          "Escolha o canal, o objetivo, conte sobre o negócio e defina o investimento. Nada é cobrado até você clicar em \"Finalizar e contratar\" no fim.",
        position: "top",
        advanceOn: "next",
        padding: 4,
      },
    ],
    finish: {
      title: "Você está no caminho! 🚀",
      message:
        "Depois de contratar, a equipe coloca a campanha no ar e o andamento aparece em trafeGO → Minhas campanhas.",
    },
  },
];
