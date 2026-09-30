import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const BUILDER_PATH = "^/pages/(?!templates)[^/]+$";

export const PAGES_GUIDES: GuideDef[] = [
  {
    key: "pages.publish",
    app: "pages",
    title: "Publicar um site",
    summary: "Coloque o site do Pages no ar.",
    topicPattern: /\b(public\w*|coloc\w* no ar|atualiz\w*)\b.*\b(sites?|pages|landing|pagina (do pages|de venda))\b/,
    steps: [
      {
        anchor: "pagesList",
        route: "/pages",
        skipWhenPath: BUILDER_PATH,
        title: "Abra o site",
        message: "Clique em Editar no site que você quer publicar.",
        position: "top",
        advanceOn: "next",
        missingMessage: "Você ainda não tem site no Pages. Me peça: \"como crio um site?\"",
      },
      {
        anchor: "pagesPublishButton",
        title: "Clique em Publicar",
        message: "Eu salvo as mudanças antes. A publicação pode consumir Stars.",
        position: "bottom",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.pagePublished,
      },
    ],
    finish: {
      title: "Site no ar! 🌐",
      message: "Para usar seu próprio domínio, clique em Domínio no topo do editor.",
    },
  },
  {
    key: "pages.create",
    app: "pages",
    title: "Criar um site",
    summary: "Monte o site a partir de um modelo e caia no editor.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|faz\w*|novos?|novas?)\b.*\b(sites?|landing ?pages?|paginas? de vendas?|pages)\b/,
    steps: [
      {
        anchor: "pagesNewButton",
        route: "/pages",
        title: "Clique em Novo site",
        message: "Abre o assistente: modelo, objetivo, cores e nome.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "pagesWizard",
        title: "Siga o assistente",
        message:
          "Escolha um modelo (ou comece do zero), vá em Avançar até o fim e clique em Criar. Cada site custa 2.000 Stars.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.pageCreated,
        padding: 4,
      },
    ],
    finish: {
      title: "Site criado! 🎨",
      message: "No editor você troca textos e imagens. Quando estiver pronto, me peça: \"como publico o site?\"",
      resultLabel: "Abrir editor",
    },
  },
];
