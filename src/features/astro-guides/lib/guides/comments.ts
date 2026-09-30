import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const COMMENTS_GUIDES: GuideDef[] = [
  {
    key: "comments.auto-reply",
    app: "comments",
    title: "Responder comentários automaticamente",
    summary: "Crie a automação que responde comentários do Instagram.",
    topicPattern:
      /\b(respond\w*|automat\w*|cri\w*|mont\w*|configur\w*)\b.*\b(comentarios?|comments?)\b|\bresposta automatica\b.*\b(instagram|comentarios?)\b/,
    steps: [
      {
        anchor: "commentsNewAutomation",
        route: "/comments?tab=automacoes",
        title: "Clique em Nova",
        message: "Cada automação diz em quais posts, com quais palavras e o que responder.",
        position: "bottom",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.commentAutomationCreated,
        missingMessage: "Primeiro conecte o Instagram. Me peça: \"como conecto o Instagram no Comments?\"",
      },
    ],
    finish: {
      title: "Automação criada! 💬",
      message:
        "No editor, defina o gatilho (onde e quais palavras) e a resposta (comentário e DM). Depois ative no botão do topo.",
    },
  },
  {
    key: "comments.connect-instagram",
    app: "comments",
    title: "Conectar o Instagram no Comments",
    summary: "Ligue a conta do Instagram para responder comentários.",
    topicPattern: /\b(conect\w*|lig\w*|integr\w*|vincul\w*|configur\w*)\b.*\binstagram\b/,
    steps: [
      {
        anchor: "commentsConnectInstagram",
        route: "/comments?tab=integracoes",
        title: "Clique em Conectar Instagram passo a passo",
        message: "Abre o passo a passo com as telas da Meta, do app até o token.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "O Instagram já está conectado. Para trocar a conta, use \"Trocar conta ou credenciais\".",
      },
      {
        anchor: "commentsConnectDialog",
        title: "Siga o passo a passo",
        message:
          "Cada etapa mostra onde clicar no painel da Meta. No fim você cola as credenciais e clica em Conectar — eu aviso quando der certo.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.instagramConnected,
        padding: 4,
      },
    ],
    finish: {
      title: "Instagram conectado! 📸",
      message: "Agora crie a automação. Se quiser, me peça: \"como respondo comentários automaticamente?\"",
    },
  },
];
