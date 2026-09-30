import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

// Space Station e STAR FRIENDS: os apps de relacionamento com o cliente.

export const ENGAGEMENT_GUIDES: GuideDef[] = [
  {
    key: "star-friends.create-reward",
    app: "star-friends",
    title: "Criar um prêmio no STAR FRIENDS",
    summary: "Cadastre o prêmio que o cliente troca pelas estrelas.",
    topicPattern:
      /\b(cri\w*|cadastr\w*|adicion\w*|mont\w*|novos?)\b.*\b(premios?|recompensas?|cartoes? de troca|brindes?|fidelidade|star friends)\b/,
    steps: [
      {
        anchor: "starFriendsRewardsTab",
        route: "/star-friends",
        title: "Abra Cartões e prêmios",
        message: "Aqui ficam os prêmios que o cliente pode trocar.",
        position: "bottom",
        advanceOn: "click",
        missingMessage:
          "O STAR FRIENDS ainda não está instalado nesta empresa. Instale na própria tela do app e me peça de novo.",
      },
      {
        anchor: "starFriendsNewReward",
        title: "Clique em Novo prêmio",
        message: "Só quem pode configurar o programa vê esse botão.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "Seu papel não pode editar os prêmios. Peça a quem administra o STAR FRIENDS.",
      },
      {
        anchor: "starFriendsRewardName",
        title: "Dê um nome ao prêmio",
        message: "Ex.: \"Café grátis\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "starFriendsRewardCost",
        title: "Quantas estrelas custa?",
        message: "Cada compra do cliente vale estrelas; ele troca quando juntar esse total.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "starFriendsRewardSave",
        title: "Clique em Salvar",
        message: "O prêmio já aparece para os participantes.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.rewardSaved,
      },
    ],
    finish: {
      title: "Prêmio criado! 🎁",
      message: "Quando um cliente pedir a troca, ela aparece na aba Resgates.",
    },
  },
  {
    key: "space-station.create",
    app: "space-station",
    title: "Criar a Space Station da empresa",
    summary: "Defina o @ e a bio do mundo virtual da empresa.",
    topicPattern: /\b(cri\w*|mont\w*|configur\w*|ativ\w*|fac\w*|faz\w*)\b.*\b(space station|estacao|mundo virtual|metaverso)\b/,
    steps: [
      {
        anchor: "stationNick",
        route: "/space-station",
        title: "Escolha o @ da estação",
        message: "Só letras minúsculas, números, _ e -. Depois de criado, ele não muda (o campo fica travado). Clique em Continuar.",
        position: "right",
        advanceOn: "input",
      },
      {
        anchor: "stationSubmit",
        title: "Clique em Criar Space Station",
        message: "Se a estação já existe, o botão se chama Salvar Perfil. A bio é opcional.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.stationSaved,
      },
    ],
    finish: {
      title: "Space Station pronta! 🪐",
      message: "Agora escolha o tema do mundo logo abaixo e clique em Abrir Space Station para entrar.",
    },
  },
];
