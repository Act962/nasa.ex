import type { GuideDef } from "../types";

// Integrações e NERP terminam em login fora da plataforma (Meta, Google, NERP):
// o guia leva até o botão e o cartão final explica a volta.

export const INTEGRATIONS_GUIDES: GuideDef[] = [
  {
    key: "nerp.send-quote",
    app: "nerp",
    title: "Enviar o valor de um pedido do catálogo",
    summary: "Mande ao cliente o valor negociado do pedido; ele aprova e o Astro cobra.",
    topicPattern: /\b(envi\w*|mand\w*|pass\w*|inform\w*|coloc\w*)\b.*\b(valor|preco|orcamento)\b.*\b(pedido|catalogo)\b/,
    steps: [
      {
        anchor: "catalogOrderSendQuote",
        title: "Clique em Enviar valor",
        message: "Digite o preço de cada item, o frete e o desconto. O cliente recebe o total no WhatsApp para aprovar.",
        position: "left",
        advanceOn: "click",
        missingMessage:
          "Abra o lead do pedido, vá em Detalhes → Produtos/Serviços. O botão aparece em pedido do catálogo que ainda não tem cobrança.",
      },
    ],
    finish: {
      title: "Valor a caminho! 💰",
      message: "Quando o cliente aprovar, o Astro pergunta a forma de pagamento e envia o PIX ou o link.",
    },
  },
  {
    key: "nerp.connect",
    app: "nerp",
    title: "Conectar o NERP",
    summary: "Ligue a conta do NERP para trazer produtos, lojas e pedidos.",
    topicPattern: /\b(conect\w*|lig\w*|integr\w*|vincul\w*|ativ\w*)\b.*\bn ?erp\b/,
    steps: [
      {
        anchor: "nerpConnectButton",
        route: "/nerp",
        title: "Clique em Conectar com nerp",
        message: "Você entra na sua conta do NERP, autoriza e volta para a ÓRBITA.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "O NERP já está conectado nesta empresa. Os atalhos dele aparecem nesta tela.",
      },
    ],
    finish: {
      title: "Quase lá! 🔌",
      message: "Depois de autorizar no NERP, você volta para cá e ele aparece como conectado.",
    },
  },
  {
    key: "integrations.connect",
    app: "integrations",
    title: "Conectar uma integração",
    summary: "Ligue Instagram, Meta, Google e outras ferramentas.",
    topicPattern:
      /\b(conect\w*|lig\w*|integr\w*|instal\w*|vincul\w*|ativ\w*|orbit\w*|coloc\w*)\b.*\b(integrac\w*|satelites?|facebook|meta|google|gmail|instagram dm|ferramentas?|apps? externos?|marketplace)\b/,
    steps: [
      {
        anchor: "integrationsSearch",
        route: "/integrations",
        title: "Busque a integração",
        message: "Digite o nome, como \"Meta\" ou \"Google\". Depois clique em Continuar.",
        position: "bottom",
        advanceOn: "input",
      },
      {
        anchor: "integrationsConnectButton",
        title: "Clique em Conectar",
        message: "No cartão da integração que você buscou.",
        position: "right",
        advanceOn: "click",
        missingMessage:
          "Não achei o botão Conectar. A integração pode já estar conectada (aparece Reconfigurar) ou seu papel não tem permissão.",
      },
      {
        anchor: "integrationsConfigDialog",
        title: "Siga a janela",
        message:
          "Com login (Facebook ou Google), você autoriza no site deles e volta para cá. Sem login, preencha as chaves e salve.",
        position: "left",
        advanceOn: "next",
        padding: 4,
      },
    ],
    finish: {
      title: "Integração a caminho! 🔗",
      message: "Quando terminar, ela aparece como conectada no marketplace.",
    },
  },
];
