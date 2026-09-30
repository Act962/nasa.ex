import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const EDITOR_PATH = "^/linnker/[^/]+$";

export const LINNKER_GUIDES: GuideDef[] = [
  {
    key: "linnker.add-link",
    app: "linnker",
    title: "Adicionar um link no Linnker",
    summary: "Coloque um novo botão na sua página de links.",
    topicPattern: /\b(adicion\w*|coloc\w*|cri\w*|inclu\w*|novos?)\b.*\b(links?|botoes?|botao)\b.*\b(linnker|bio|pagina de links?)\b|\blinnker\b.*\b(adicion\w*|coloc\w*)\b/,
    steps: [
      {
        anchor: "linnkerList",
        route: "/linnker",
        skipWhenPath: EDITOR_PATH,
        title: "Abra a página",
        message: "Nos três pontinhos (⋯) do cartão, clique em Editar. Eu sigo com você lá dentro.",
        position: "top",
        advanceOn: "next",
        missingMessage: "Você ainda não tem página no Linnker. Me peça: \"como crio minha página de links?\"",
      },
      {
        anchor: "linnkerAddLinkButton",
        title: "Clique em Adicionar link",
        message: "Abre o formulário do novo botão.",
        position: "top",
        advanceOn: "click",
      },
      {
        anchor: "linnkerLinkTitle",
        title: "Qual o texto do botão?",
        message: "Ex.: \"Fale no WhatsApp\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "linnkerLinkUrl",
        title: "Para onde ele leva?",
        message: "Cole o endereço completo, com https://.",
        position: "left",
        advanceOn: "input",
        missingMessage: "Esse tipo de link não usa URL. Volte um passo ou clique em Adicionar.",
      },
      {
        anchor: "linnkerLinkSubmit",
        title: "Clique em Adicionar",
        message: "O botão aparece na página na hora.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.linnkerLinkCreated,
      },
    ],
    finish: {
      title: "Link adicionado! 🔗",
      message: "Arraste para mudar a ordem. Se a página ainda não está no ar, clique em Publicar no topo.",
    },
  },
  {
    key: "linnker.create",
    app: "linnker",
    title: "Criar minha página de links",
    summary: "Crie a página de bio com os seus links.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|faz\w*|novas?)\b.*\b(linnker|pagina de links?|link na bio|links? da bio|bio)\b/,
    steps: [
      {
        anchor: "linnkerNewButton",
        route: "/linnker",
        title: "Clique em Nova página",
        message: "Cada página tem o seu endereço público e os seus botões.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "linnkerCreateTitle",
        title: "Dê um título à página",
        message: "O endereço público é preenchido sozinho a partir dele. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "linnkerCreateSubmit",
        title: "Clique em Criar página",
        message: "Ela nasce como rascunho; você publica quando quiser.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.linnkerPageCreated,
      },
    ],
    finish: {
      title: "Página criada! ✨",
      message: "Agora adicione os seus links. Se quiser, me peça: \"como adiciono um link no Linnker?\"",
      resultLabel: "Abrir editor",
    },
  },
];
