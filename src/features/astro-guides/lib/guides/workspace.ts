import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const WORKSPACE_PATH = "^/workspaces/[^/]+";

export const WORKSPACE_GUIDES: GuideDef[] = [
  {
    key: "workspace.create-action",
    app: "workspace",
    title: "Criar uma ação no workspace",
    summary: "Cadastre a tarefa da equipe dentro do workspace.",
    topicPattern: /\b(cri\w*|cadastr\w*|adicion\w*|coloc\w*|novas?|lanc\w*)\b.*\b(acao|acoes|tarefas?|atividades?|demandas?)\b/,
    steps: [
      {
        anchor: "workspaceList",
        route: "/workspaces",
        skipWhenPath: WORKSPACE_PATH,
        title: "Abra o workspace",
        message: "Clique no workspace onde a ação vai entrar.",
        position: "top",
        advanceOn: "click",
        missingMessage: "Você ainda não tem workspace. Me peça: \"como crio um workspace?\"",
      },
      {
        anchor: "actionNewButton",
        title: "Clique em Nova ação",
        message: "Cada ação é uma tarefa com responsável, prazo e etapa.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "actionCreateTitle",
        title: "O que precisa ser feito?",
        message: "Ex.: \"Enviar orçamento para a Maria\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "actionCreateSubmit",
        title: "Clique em Criar ação",
        message: "Responsável, prazo e prioridade são opcionais — dá para ajustar depois.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.actionCreated,
      },
    ],
    finish: {
      title: "Ação criada! ✅",
      message: "Ela entra na primeira etapa do workspace. Arraste para as próximas conforme o trabalho anda.",
    },
  },
  {
    key: "workspace.create",
    app: "workspace",
    title: "Criar um workspace",
    summary: "Monte o espaço de tarefas de uma equipe ou projeto.",
    topicPattern: /\b(cri\w*|mont\w*|novos?|novas?|fac\w*|abr\w*)\b.*\b(workspaces?|espacos? de trabalho|quadros?)\b/,
    steps: [
      {
        anchor: "workspaceNewButton",
        route: "/workspaces",
        title: "Clique em Novo workspace",
        message: "Um workspace é o quadro de tarefas de uma equipe ou projeto.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "workspaceCreateName",
        title: "Dê um nome ao workspace",
        message: "Ex.: \"Marketing\" ou \"Onboarding de clientes\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "workspaceCreateSubmit",
        title: "Clique em Criar workspace",
        message: "Ele já nasce com as etapas padrão. Eu te levo para ele.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.workspaceCreated,
      },
    ],
    finish: {
      title: "Workspace criado! 🗂️",
      message: "Agora crie as ações da equipe. Se quiser, me peça: \"como crio uma ação?\"",
      resultLabel: "Abrir workspace",
    },
  },
];
