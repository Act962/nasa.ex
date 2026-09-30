import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const PLANNER_PATH = "^/nasa-planner/[^/]+$";

export const PLANNER_GUIDES: GuideDef[] = [
  {
    key: "planner.create-post",
    app: "planner",
    title: "Criar um post no Planner",
    summary: "Planeje o post de rede social dentro do planner.",
    topicPattern: /\b(cri\w*|plane\w*|agend\w*|mont\w*|fac\w*|faz\w*|novos?)\b.*\b(posts?|postage(m|ns)|publicacoes?|conteudos?)\b/,
    steps: [
      {
        anchor: "plannerList",
        route: "/nasa-planner",
        skipWhenPath: PLANNER_PATH,
        title: "Abra o planner",
        message: "Clique no planner onde o post vai entrar.",
        position: "top",
        advanceOn: "next",
        missingMessage: "Você ainda não tem planner. Me peça: \"como crio um planner?\"",
      },
      {
        anchor: "plannerPostsTab",
        title: "Abra a aba Posts",
        message: "É onde ficam os posts planejados.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "plannerNewPostButton",
        title: "Clique em Novo Post",
        message: "Abre o formulário do post.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "plannerPostTitle",
        title: "Dê um título ao post",
        message: "Só a equipe vê. Legenda, tipo e data são opcionais. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "plannerPostSubmit",
        title: "Clique em Criar Post",
        message: "Ele entra no calendário do planner.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.plannerPostCreated,
      },
    ],
    finish: {
      title: "Post criado! 📝",
      message: "Abra o post para anexar a arte e mudar o status até a publicação.",
    },
  },
  {
    key: "planner.create",
    app: "planner",
    title: "Criar um planner",
    summary: "Monte o planejamento de conteúdo de uma empresa.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|faz\w*|novos?|novas?)\b.*\b(planners?|planejamentos?|calendario editorial)\b/,
    steps: [
      {
        anchor: "plannerNewButton",
        route: "/nasa-planner",
        title: "Clique em Novo Planner",
        message: "Um planner reúne posts, campanhas e mapas mentais de uma empresa.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "plannerOrgPicker",
        title: "Escolha a empresa",
        message: "Clique aqui, escolha a empresa na lista e depois em Próximo.",
        position: "left",
        advanceOn: "next",
      },
      {
        anchor: "plannerName",
        title: "Dê um nome ao planner",
        message: "Ex.: \"Planner Q4 2026\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "plannerSubmit",
        title: "Clique em Criar Planner",
        message: "Só libera com nome e empresa escolhidos.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.plannerCreated,
      },
    ],
    finish: {
      title: "Planner criado! 🗓️",
      message: "Agora crie os posts. Se quiser, me peça: \"como crio um post no planner?\"",
      resultLabel: "Abrir planner",
    },
  },
];
