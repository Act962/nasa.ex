import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const FORGE_GUIDES: GuideDef[] = [
  {
    key: "forge.share-proposal",
    app: "forge",
    title: "Enviar a proposta ao cliente",
    summary: "Copie o link da proposta para mandar ao cliente.",
    topicPattern:
      /\b(envi\w*|mand\w*|compartilh\w*|copi\w*|pass\w*)\b.*\b(propostas?|orcamentos?)\b|\blink (da|de) proposta\b/,
    steps: [
      {
        anchor: "forgeProposalsTab",
        route: "/forge",
        title: "Abra a aba Propostas",
        message: "Todas as propostas da empresa ficam aqui.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "forgeProposalShareButton",
        title: "Clique em Copiar link",
        message: "É o ícone de compartilhar no card da proposta. O cliente abre, vê os itens e aceita por ali.",
        position: "left",
        advanceOn: "click",
        missingMessage: "Nenhuma proposta com link por aqui. Me peça: \"como crio uma proposta?\"",
      },
    ],
    finish: {
      title: "Link copiado! 📋",
      message: "Cole na conversa do cliente. Para mandar direto pelo WhatsApp, use o Forge dentro do Chat do lead.",
    },
  },
  {
    key: "forge.create-proposal",
    app: "forge",
    title: "Criar uma proposta",
    summary: "Monte a proposta com os produtos e gere o link para o cliente.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|faz\w*|ger\w*|elabor\w*|novas?)\b.*\b(propostas?|orcamentos?)\b/,
    spaceHelp: { categorySlug: "forge", featureSlug: "criar-proposta" },
    steps: [
      {
        anchor: "forgeProposalsTab",
        route: "/forge",
        title: "Abra a aba Propostas",
        message: "Todas as propostas da empresa ficam aqui.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "forgeNewProposalButton",
        title: "Clique em Nova Proposta",
        message: "Abre o formulário da proposta.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "forgeProposalTitle",
        title: "Dê um título à proposta",
        message: "O cliente vê esse título. Ex.: \"Social Media — Janeiro\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "forgeProposalAddProduct",
        title: "Adicione os produtos",
        message: "Clique em Adicionar e escolha o produto: o valor entra sozinho. Quando terminar, clique em Próximo.",
        position: "left",
        advanceOn: "next",
      },
      {
        anchor: "forgeProposalSave",
        title: "Clique em Salvar Proposta",
        message: "Ela aparece na lista de propostas assim que for salva.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.proposalCreated,
      },
    ],
    finish: {
      title: "Proposta criada! 📄",
      message: "Para mandar ao cliente, use o botão de copiar link no card da proposta. Se quiser, me peça: \"como envio a proposta?\"",
    },
  },
  {
    key: "forge.create-product",
    app: "forge",
    title: "Cadastrar um produto",
    summary: "Cadastre o produto ou serviço que entra nas propostas.",
    topicPattern: /\b(cri\w*|cadastr\w*|adicion\w*|coloc\w*|inclu\w*|novos?)\b.*\b(produtos?|servicos?|itens?)\b/,
    steps: [
      {
        anchor: "forgeProductsTab",
        route: "/forge",
        title: "Abra a aba Produtos",
        message: "Aqui fica o catálogo que você usa nas propostas.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "forgeNewProductButton",
        title: "Clique em Novo Produto",
        message: "Abre o cadastro do produto.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "forgeProductName",
        title: "Digite o nome do produto",
        message: "É o nome que aparece na proposta. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "forgeProductSku",
        title: "Agora o código (SKU)",
        message: "Um código curto só seu, para achar o produto rápido. Ex.: SMS-001.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "forgeProductValue",
        title: "Qual o valor?",
        message: "O valor por unidade. Na proposta ele é multiplicado pela quantidade.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "forgeProductSave",
        title: "Clique em Salvar Produto",
        message: "Pronto para entrar nas suas propostas.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.productCreated,
      },
    ],
    finish: {
      title: "Produto cadastrado! 📦",
      message: "Ele já aparece na lista ao criar uma proposta.",
    },
  },
];
