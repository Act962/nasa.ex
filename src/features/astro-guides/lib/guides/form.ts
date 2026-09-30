import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const BUILDER_PATH = "^/form/builder/[^/]+";

export const FORM_GUIDES: GuideDef[] = [
  {
    key: "form.publish",
    app: "form",
    title: "Publicar um formulário",
    summary: "Coloque o formulário no ar e pegue o link.",
    topicPattern: /\b(public\w*|coloc\w* no ar|ativ\w*|compartilh\w*|divulg\w*)\b.*\b(formularios?|forms?)\b/,
    spaceHelp: { categorySlug: "cosmic", featureSlug: "publicar-formulario" },
    steps: [
      {
        anchor: "formList",
        route: "/form",
        skipWhenPath: BUILDER_PATH,
        title: "Abra o formulário",
        message: "Clique no formulário que você quer colocar no ar.",
        position: "top",
        advanceOn: "click",
        missingMessage: "Você ainda não tem formulário. Me peça: \"como crio um formulário?\"",
      },
      {
        anchor: "formPublishButton",
        title: "Clique em Publicar",
        message: "Eu salvo as últimas mudanças antes. Depois de publicado, o link aparece embaixo da tela.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.formPublished,
      },
    ],
    finish: {
      title: "Formulário no ar! 🚀",
      message: "Use o botão \"Compartilhar Link\" embaixo da tela. Cada resposta vira lead no tracking do formulário.",
      resultLabel: "Ver como o cliente vê",
    },
  },
  {
    key: "form.create",
    app: "form",
    title: "Criar um formulário",
    summary: "Crie o formulário e caia direto no editor.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|novos?|cadastr\w*)\b.*\b(formularios?|forms?|questionarios?|pesquisas?)\b/,
    spaceHelp: { categorySlug: "cosmic", featureSlug: "criar-formulario" },
    steps: [
      {
        anchor: "formCreateButton",
        route: "/form",
        title: "Clique em Criar formulário",
        message: "Cada formulário tem o seu link e o tracking onde as respostas viram leads.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "formCreateTitle",
        title: "Dê um nome ao formulário",
        message: "Ex.: \"Orçamento rápido\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "formCreateSubmit",
        title: "Clique em Criar",
        message: "Eu te levo para o editor, onde você arrasta os campos.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.formCreated,
      },
    ],
    finish: {
      title: "Formulário criado! 📝",
      message: "Arraste os campos da esquerda para montar. Quando terminar, me peça: \"como publico o formulário?\"",
    },
  },
];
