import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const NO_ACCESS_MESSAGE =
  "Não achei o Financeiro liberado para você. O acesso é por lista: peça ao dono da empresa para te incluir.";

export const PAYMENT_GUIDES: GuideDef[] = [
  {
    key: "payment.register-payment",
    app: "payment",
    title: "Dar baixa numa conta",
    summary: "Registre que a conta foi paga ou recebida.",
    topicPattern:
      /\b(marc\w*|registr\w*|baix\w*|quit\w*|confirm\w*)\b.*\b(pagos?|pagas?|pagamentos?|recebid\w*|recebimentos?|quitad\w*)\b|\bd(ar|ou|a) baixa\b/,
    steps: [
      {
        anchor: "paymentTabsBar",
        route: "/payment",
        skipWhenVisible: "paymentOpenEntryMenu",
        title: "Abra Receita ou Despesa",
        message: "Receita tem o que você vai receber; Despesa, o que vai pagar. Clique na aba onde está a conta.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: NO_ACCESS_MESSAGE,
      },
      {
        // A tabela inteira fica clicável: o usuário escolhe qual conta pagar, e o
        // passo avança sozinho quando o menu de qualquer uma abre.
        anchor: "paymentEntriesTable",
        skipWhenVisible: "paymentRegisterPayment",
        title: "Abra o menu da conta",
        message: "Clique nos três pontinhos (⋯) da conta que foi paga. Só contas em aberto têm essa opção.",
        position: "top",
        advanceOn: "next",
        padding: 4,
        missingMessage:
          "Não achei conta em aberto nesta aba. Confira o filtro de período, troque de aba ou lance uma conta antes.",
      },
      {
        anchor: "paymentRegisterPayment",
        title: "Clique em Registrar pagamento",
        message: "Abre a confirmação do valor pago.",
        position: "left",
        advanceOn: "click",
        missingMessage:
          "O menu da conta não está aberto. Volte um passo e clique nos três pontinhos (⋯) de uma conta em aberto.",
      },
      {
        anchor: "paymentPaidAmount",
        title: "Quanto foi pago?",
        message: "O valor total fecha a conta. Um valor menor deixa ela como parcial. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "paymentConfirmPay",
        title: "Clique em Confirmar Pagamento",
        message: "A conta sai de \"em aberto\" e entra no fluxo de caixa.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.paymentRegistered,
      },
    ],
    finish: {
      title: "Pagamento registrado! 💸",
      message: "Ele já aparece no fluxo de caixa e no painel do Financeiro.",
    },
  },
  {
    key: "payment.create-payable",
    app: "payment",
    title: "Lançar uma conta a pagar",
    summary: "Registre uma despesa com valor e vencimento.",
    topicPattern:
      /\b(lanc\w*|registr\w*|cadastr\w*|cri\w*|adicion\w*|coloc\w*|anot\w*|inclu\w*|novas?)\b.*\b(a pagar|despesas?|saidas?|gastos?|boletos?|fornecedor\w*)\b/,
    steps: [
      {
        anchor: "paymentNewPayableButton",
        route: "/payment?tab=payables",
        title: "Clique em Nova Despesa",
        message: "Aqui ficam as contas que a empresa tem para pagar.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: NO_ACCESS_MESSAGE,
      },
      {
        anchor: "paymentEntryDescription",
        title: "O que é essa conta?",
        message: "Ex.: \"Aluguel de outubro\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "paymentEntryAmount",
        title: "Qual o valor?",
        message: "O vencimento já vem com a data de hoje — ajuste no campo ao lado se precisar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "paymentEntrySave",
        title: "Clique em Salvar",
        message: "Categoria, conta bancária e fornecedor são opcionais.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.payableCreated,
      },
    ],
    finish: {
      title: "Despesa lançada! 📉",
      message: "Quando pagar, me peça: \"como dou baixa numa conta?\"",
    },
  },
  {
    key: "payment.create-receivable",
    app: "payment",
    title: "Lançar uma conta a receber",
    summary: "Registre uma receita com valor e vencimento.",
    topicPattern:
      /\b(lanc\w*|registr\w*|cadastr\w*|cri\w*|adicion\w*|coloc\w*|anot\w*|inclu\w*|novas?)\b.*\b(a receber|receitas?|entradas?|recebimentos?|cobrancas?|vendas?)\b/,
    steps: [
      {
        anchor: "paymentNewReceivableButton",
        route: "/payment?tab=receivables",
        title: "Clique em Nova Receita",
        message: "Aqui ficam os valores que a empresa tem para receber.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: NO_ACCESS_MESSAGE,
      },
      {
        anchor: "paymentEntryDescription",
        title: "Do que é esse valor?",
        message: "Ex.: \"Mensalidade da Maria\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "paymentEntryAmount",
        title: "Qual o valor?",
        message: "O vencimento já vem com a data de hoje — ajuste no campo ao lado se precisar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "paymentEntrySave",
        title: "Clique em Salvar",
        message: "Cliente, categoria e parcelas são opcionais (ficam em \"Mais opções\").",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.receivableCreated,
      },
    ],
    finish: {
      title: "Receita lançada! 📈",
      message: "Quando o cliente pagar, me peça: \"como dou baixa numa conta?\"",
    },
  },
];
