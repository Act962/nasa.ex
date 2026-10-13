import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const LEAD_PAGE_PATH = "^/contatos/[^/]+";

export const CONTACTS_GUIDES: GuideDef[] = [
  {
    key: "contacts.member.create",
    app: "contacts",
    title: "Cadastrar um vinculado do lead",
    summary: "Ligue filhos, filiais ou unidades a um lead, sem pôr cada um no funil.",
    topicPattern:
      /\b(cri\w*|cadastr\w*|adicion\w*|coloc\w*|inclu\w*|vincul\w*|lig\w*|novos?|novas?)\b.*\b(vinculad\w*|dependentes?|filiais|filial|filhos?|filhas?|unidades?)\b/,
    steps: [
      {
        anchor: "contactsSearchField",
        route: "/contatos",
        skipWhenPath: LEAD_PAGE_PATH,
        title: "Clique em Buscar contato",
        message: "Vamos abrir o lead titular: quem contrata ou paga.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "contactsSearchDialog",
        skipWhenPath: LEAD_PAGE_PATH,
        title: "Escolha o titular",
        message: "Digite o nome ou o telefone e clique no lead.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.contactOpened,
      },
      {
        anchor: "leadMembersTab",
        skipWhenVisible: "leadMembersNewButton",
        title: "Abra a aba Vinculados",
        message: "Aqui fica o organograma: o titular em cima e quem está ligado a ele abaixo.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "leadMembersNewButton",
        title: "Clique em Novo vinculado",
        message: "Vinculado não entra no funil e não precisa de telefone.",
        position: "left",
        advanceOn: "click",
        missingMessage: "Só quem participa do tracking deste lead pode cadastrar vinculados.",
      },
      {
        anchor: "leadMemberName",
        title: "Digite o nome",
        message: "Em \"Fica abaixo de\" você monta os níveis; em \"Cobrança\" escolhe se a conta sai no titular ou em nome dele.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadMemberSave",
        title: "Clique em Salvar",
        message: "Ele aparece no organograma na hora.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.leadMemberSaved,
      },
    ],
    finish: {
      title: "Vinculado cadastrado! 🌳",
      message: "Ao preencher uma ficha para este lead, escolha em \"Para quem é esta ficha?\". O link do cliente mostra o organograma com as fichas de cada um.",
    },
  },
  {
    key: "contacts.find",
    app: "contacts",
    title: "Encontrar um contato",
    summary: "Busque pelo nome ou telefone e abra a ficha.",
    topicPattern:
      /\b(ach\w*|busc\w*|procur\w*|encontr\w*|pesquis\w*|localiz\w*|ver)\b.*\b(contatos?|leads?|clientes?|fichas?)\b/,
    steps: [
      {
        anchor: "contactsSearchField",
        route: "/contatos",
        title: "Clique em Buscar contato",
        message: "Abre a busca com todos os leads da empresa.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "contactsSearchDialog",
        title: "Digite e escolha",
        message: "Digite o nome ou o telefone e clique no contato para abrir a ficha.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.contactOpened,
      },
    ],
    finish: {
      title: "Achou! 🔎",
      message: "Na ficha ficam as conversas, a jornada, os formulários e as propostas desse contato.",
    },
  },
  {
    key: "contacts.create",
    app: "contacts",
    title: "Cadastrar um contato",
    summary: "Cadastre o contato e escolha em qual funil ele entra.",
    topicPattern:
      /\b(cri\w*|cadastr\w*|adicion\w*|coloc\w*|inclu\w*|inser\w*|salv\w*|novos?|novas?)\b.*\b(contatos?|clientes?)\b/,
    steps: [
      {
        anchor: "contactsNewLeadButton",
        route: "/contatos",
        title: "Clique em Adicionar novo lead",
        message: "Todo contato entra num funil (tracking), para a equipe acompanhar.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "Em tela pequena, o botão fica no menu ⋯ do topo, em \"Novo lead\".",
      },
      {
        anchor: "leadSheetTracking",
        title: "Escolha o funil",
        message: "É o tracking onde o contato vai aparecer. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadSheetName",
        title: "Digite o nome",
        message: "Da pessoa ou da empresa.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadSheetPhone",
        title: "Agora o WhatsApp",
        message: "Com o número certo, as conversas desse contato aparecem no Chat.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "leadSheetSubmit",
        title: "Clique em Criar lead",
        message: "Assim que ele for salvo, eu te mando o link da ficha.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.leadCreated,
      },
    ],
    finish: {
      title: "Contato cadastrado! 🎉",
      message: "Ele já está na primeira etapa do funil escolhido.",
      resultLabel: "Abrir ficha",
    },
  },
];
