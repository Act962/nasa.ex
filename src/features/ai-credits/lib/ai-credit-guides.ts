import type { AiCreditProvider } from "./ai-credit-types";

/** Passo a passo para recarregar o provedor de IA e informar o saldo no ÓRBITA (spec 0055, RF-13). */

export interface AiCreditGuideStep {
  title: string;
  instruction: string;
  link?: { href: string; label: string };
  tip?: string;
  /** Aviso importante (custo, privacidade): aparece em destaque. */
  warning?: string;
}

export interface AiCreditGuide {
  providerLabel: string;
  dashboardUrl: string;
  steps: AiCreditGuideStep[];
  /** O provedor tem nível gratuito sem saldo (Gemini). */
  hasFreeTier: boolean;
}

export const AI_CREDIT_GUIDES: Record<AiCreditProvider, AiCreditGuide> = {
  openai: {
    providerLabel: "OpenAI",
    dashboardUrl: "https://platform.openai.com/home",
    hasFreeTier: false,
    steps: [
      {
        title: "Abra o painel da OpenAI",
        instruction:
          "Entre com a conta da empresa. Na página inicial (Lar/Home) aparece o card “Saldo credor” (Credit balance): é o crédito que ainda resta.",
        link: { href: "https://platform.openai.com/home", label: "Abrir a OpenAI" },
      },
      {
        title: "Adicione créditos",
        instruction:
          "No card “Saldo credor”, clique em “Adicionar créditos” (Add to credit balance), escolha o valor em dólar e confirme com o cartão.",
        link: { href: "https://platform.openai.com/settings/organization/billing/overview", label: "Abrir o faturamento" },
        tip: "Ative a recarga automática (Auto recharge) no faturamento: quando o saldo baixar de um valor, a OpenAI recarrega sozinha e o ASTRO nunca para.",
      },
      {
        title: "Confira o limite de gasto do mês",
        instruction:
          "Em Limites (Limits), o orçamento mensal (Monthly budget) corta a API quando o gasto do mês chega nele — mesmo com saldo sobrando. Deixe o orçamento acima do gasto previsto.",
        link: { href: "https://platform.openai.com/settings/organization/limits", label: "Abrir os limites" },
        warning: "Se o card “gastos do mês” mostrar algo como “$ 0,16 / $ 5,00”, os $ 5,00 são esse teto: ao chegar nele, a IA para.",
      },
      {
        title: "Copie o saldo",
        instruction: "Volte à página inicial e anote o valor de “Saldo credor” (ex.: $ 4,17). Ele é o número que o ÓRBITA precisa.",
        link: { href: "https://platform.openai.com/home", label: "Voltar à página inicial" },
      },
    ],
  },
  google: {
    providerLabel: "Gemini (Google AI Studio)",
    dashboardUrl: "https://aistudio.google.com/app/usage?timeRange=last-28-days",
    hasFreeTier: true,
    steps: [
      {
        title: "Abra o uso da API Gemini",
        instruction:
          "Entre no Google AI Studio com a conta da empresa. Ao lado do título “Utilização da API Gemini” aparece o selo do plano: “Nível gratuito” ou pago.",
        link: { href: "https://aistudio.google.com/app/usage?timeRange=last-28-days", label: "Abrir o Google AI Studio" },
      },
      {
        title: "Nível gratuito: não há saldo",
        instruction:
          "No nível gratuito o Google não cobra e não existe crédito para acabar. O limite é de quantidade: pedidos por minuto e por dia (menu “Limite de taxa”). Passando dele, a API recusa até o limite renovar. No próximo passo, escolha “Nível gratuito”: o ÓRBITA para de avisar saldo e continua mostrando o consumo.",
        warning:
          "No nível gratuito o Google pode usar o conteúdo enviado para melhorar os produtos dele. Como o ASTRO manda dados de clientes, ative o faturamento (plano pago) antes de usar o Gemini em produção.",
      },
      {
        title: "Plano pago: veja o crédito ou o orçamento",
        instruction:
          "Com o faturamento ativo, abra “Uso e faturamento → Cobrança” no menu do AI Studio. Lá aparecem o crédito disponível e o orçamento definido na conta do Google Cloud. Anote o valor em dólar.",
        tip: "Defina um alerta de orçamento no Google Cloud: ele avisa por e-mail antes de a conta parar.",
      },
    ],
  },
  anthropic: {
    providerLabel: "Anthropic",
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    hasFreeTier: false,
    steps: [
      {
        title: "Abra o faturamento da Anthropic",
        instruction: "Entre no Console da Anthropic com a conta da empresa. Em Billing aparece o saldo de créditos (Credit balance).",
        link: { href: "https://console.anthropic.com/settings/billing", label: "Abrir a Anthropic" },
      },
      {
        title: "Compre créditos e anote o saldo",
        instruction: "Clique em “Buy credits”, escolha o valor e confirme. Depois anote o saldo que aparece em Billing.",
        tip: "Ative a recarga automática (Auto reload) para o saldo nunca zerar.",
      },
    ],
  },
};
