import type { GuideDef } from "../types";

export const TRAFEGO_GUIDES: GuideDef[] = [
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
