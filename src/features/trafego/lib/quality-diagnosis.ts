// Causa provável e correção por indicador vermelho (spec 0128, RF-7). Texto fixo, sem custo:
// a IA entra só quando o cliente pede a análise do Astro.

import type { AdMetrics } from "./order-ads-metrics";

/** Nome dos indicadores em português, para o Astro e o popover. */
export const AD_METRIC_LABELS: Record<keyof AdMetrics, string> = {
  spendCents: "Investido",
  conversations: "Conversas",
  costPerConversationCents: "Custo por conversa",
  conversationRate: "Taxa de conversa",
  ctr: "CTR",
  cpcCents: "CPC",
  cpmCents: "CPM",
  clicks: "Cliques",
  reach: "Alcance",
  impressions: "Impressões",
  frequency: "Frequência",
};

export interface IndicatorDiagnosis {
  title: string;
  cause: string;
  fix: string;
}

const DIAGNOSIS: Partial<Record<keyof AdMetrics, { above?: IndicatorDiagnosis; below?: IndicatorDiagnosis }>> = {
  costPerConversationCents: {
    above: {
      title: "Custo por conversa acima da média",
      cause: "O anúncio atrai cliques, mas poucas pessoas chegam a mandar mensagem.",
      fix: "Deixe a oferta e o próximo passo claros no texto (\"Chame no WhatsApp e agende\") e confira a mensagem inicial.",
    },
  },
  cpcCents: {
    above: {
      title: "Custo por clique acima da média",
      cause: "O criativo chama pouca atenção no feed: as pessoas passam sem clicar.",
      fix: "Teste um gancho visual forte no primeiro segundo (rosto, antes da explicação) e um título com o benefício.",
    },
  },
  cpmCents: {
    above: {
      title: "Custo para aparecer acima da média",
      cause: "O público está pequeno ou disputado, ou a Meta acha o anúncio pouco relevante.",
      fix: "Amplie a região ou a faixa de idade e melhore a qualidade do criativo antes de mexer na verba.",
    },
  },
  ctr: {
    below: {
      title: "Poucas pessoas clicam",
      cause: "A imagem ou o texto não despertam interesse em quem vê.",
      fix: "Mostre o resultado ou o serviço logo de cara e use uma chamada direta para a ação.",
    },
  },
  conversations: {
    below: {
      title: "Poucas conversas",
      cause: "O anúncio entrega pouco ou não convence a pessoa a mandar mensagem.",
      fix: "Reforce a oferta e o motivo para chamar agora; confira se o WhatsApp responde rápido.",
    },
  },
  clicks: {
    below: {
      title: "Poucos cliques",
      cause: "O anúncio aparece pouco ou chama pouca atenção.",
      fix: "Melhore o gancho visual e confira se a verba diária dá entrega suficiente.",
    },
  },
  reach: {
    below: {
      title: "Alcance abaixo da média",
      cause: "Pouca gente diferente está vendo o anúncio: verba baixa para o público ou público pequeno.",
      fix: "Amplie a região ou a idade, ou aumente a verba diária aos poucos (até 20% por vez).",
    },
  },
  impressions: {
    below: {
      title: "O anúncio aparece pouco",
      cause: "A Meta está entregando menos que a média: verba baixa, público pequeno ou anúncio ainda aprendendo.",
      fix: "Espere sair do aprendizado; se continuar baixo, amplie o público ou a verba diária.",
    },
  },
  conversationRate: {
    below: {
      title: "Quem clica não manda mensagem",
      cause: "A pessoa abre o WhatsApp e desiste: a mensagem inicial não ajuda ou o atendimento demora.",
      fix: "Use uma mensagem inicial pronta e objetiva (\"Quero agendar uma avaliação\") e responda em minutos.",
    },
  },
};

/** O que cada número quer dizer, para setas verdes e cinzas (sem problema a corrigir). */
const MEANING: Record<keyof AdMetrics, string> = {
  spendCents: "Quanto da verba este anúncio já usou. Mais ou menos gasto não é bom nem ruim por si.",
  conversations: "Pessoas que começaram uma conversa no WhatsApp depois de ver o anúncio.",
  costPerConversationCents: "Quanto custa, em média, cada conversa iniciada.",
  conversationRate: "De quem clicou no anúncio, quantos mandaram mensagem.",
  ctr: "De quem viu o anúncio, quantos clicaram.",
  cpcCents: "Quanto custa, em média, cada clique.",
  cpmCents: "Quanto custa o anúncio aparecer mil vezes.",
  clicks: "Quantas vezes as pessoas clicaram no anúncio.",
  reach: "Quantas pessoas diferentes viram o anúncio.",
  impressions: "Quantas vezes o anúncio apareceu.",
  frequency:
    "Quantas vezes, em média, cada pessoa viu o anúncio. Acima de 3 a 4 costuma cansar o público; aí vale trocar o criativo.",
};

export function describeMetricMeaning(metric: keyof AdMetrics): string {
  return MEANING[metric];
}

export function diagnoseIndicator(metric: keyof AdMetrics, direction: "up" | "down"): IndicatorDiagnosis | null {
  const entry = DIAGNOSIS[metric];
  if (!entry) return null;
  return (direction === "up" ? entry.above : entry.below) ?? null;
}

/** Aviso de tempo antes de mexer (RF-11). */
export function describeWaitBeforeChange(evaluateFrom: string | null): string | null {
  if (!evaluateFrom) return null;
  const formatted = evaluateFrom.split("-").reverse().join("/");
  return `Mexer agora reinicia o aprendizado da Meta. O ideal é esperar até ${formatted}.`;
}
