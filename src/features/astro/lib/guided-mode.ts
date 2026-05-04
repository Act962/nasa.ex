import type { WizardProvider, WizardStep } from "@/features/integrations/store/connection-wizard-store";

export type GuidedContext = {
  provider: WizardProvider | null;
  step: WizardStep;
  error: string | null;
};

const PROVIDER_LABEL: Record<WizardProvider, string> = {
  meta: "Meta",
  google: "Google",
};

export function getGuidedMessage(ctx: GuidedContext): string {
  if (!ctx.provider) return "";
  const p = PROVIDER_LABEL[ctx.provider];

  if (ctx.error) {
    return `Algo deu errado: ${ctx.error}. Posso te ajudar a tentar de novo? Você pode reiniciar o processo a qualquer momento.`;
  }

  switch (ctx.step) {
    case "welcome":
      return `Vou te ajudar a conectar a ${p}. Você vai ser redirecionado para a janela oficial — revise as permissões antes de aprovar. Tudo passa por OAuth, sem copy/paste de tokens.`;
    case "authorize":
      return `Estou aguardando você concluir a autorização na ${p}. Se a janela não abriu, clique em "Tentar de novo".`;
    case "select":
      return `Selecione abaixo quais contas quer conectar. Por padrão deixei tudo marcado, mas você pode escolher só as que importam.`;
    case "confirm":
      return `Tudo pronto. Confirme abaixo que vou salvar as credenciais com segurança e ativar as integrações.`;
  }
}

export function getGuidedQuickReplies(ctx: GuidedContext): string[] {
  if (!ctx.provider) return [];

  if (ctx.error) {
    return ["É normal isso acontecer?", "Como reinicio?", "Quero falar com suporte"];
  }

  switch (ctx.step) {
    case "welcome":
      return ["É seguro?", "Por que precisam dessas permissões?", "Posso revogar depois?"];
    case "authorize":
      return ["A janela não abriu", "Preciso de outra conta", "Cancelar"];
    case "select":
      return ["Qual conta escolher?", "Posso escolher mais depois?", "Quero todas"];
    case "confirm":
      return ["O que acontece depois?", "Já posso ver os KPIs?", "Confirmar agora"];
  }
}

const FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["seguro", "segurança", "criptograf"],
    answer:
      "Usamos OAuth oficial — você autoriza direto na Meta ou Google, e o NASA recebe um token criptografado. Nunca pedimos sua senha. Pode revogar tudo a qualquer momento na conta da plataforma.",
  },
  {
    keywords: ["revogar", "cancelar", "desconectar", "remover"],
    answer:
      "É só ir em Configurações → Integrações → Desconectar. O token é revogado direto na Meta/Google. Você também pode revogar manualmente em facebook.com/settings (ou myaccount.google.com).",
  },
  {
    keywords: ["ads_management", "permiss", "scope", "escopo", "por que"],
    answer:
      "ads_management permite que o NASA leia E ajuste suas campanhas direto pelo painel de Insights. ads_read sozinho seria só leitura — mas a gente perderia a função de pausar/ativar campanhas pelo NASA.",
  },
  {
    keywords: ["janela", "popup", "abriu", "redirec"],
    answer:
      "Se nada abriu, pode ser bloqueador de pop-ups do navegador ou cookie 3rd-party. Tente o botão 'Tentar de novo' — vamos abrir na mesma aba dessa vez.",
  },
  {
    keywords: ["minha conta", "não vejo", "não aparece", "não encontra"],
    answer:
      "Se a conta não aparece na lista, é porque o usuário Facebook/Google que você usou não tem acesso a ela. Volte ao início e use a conta que administra a página/conta de anúncios.",
  },
  {
    keywords: ["depois", "próximo", "kpi", "dashboard"],
    answer:
      "Assim que confirmar, vou ativar tudo: KPIs reais aparecem em Insights, mensagens caem no NBox, e você pode gerenciar campanhas direto pelo painel.",
  },
];

export function getFaqAnswer(query: string): string | null {
  const q = query.toLowerCase();
  for (const f of FAQ) {
    if (f.keywords.some((k) => q.includes(k))) return f.answer;
  }
  return null;
}
