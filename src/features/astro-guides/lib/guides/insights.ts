import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const INSIGHTS_GUIDES: GuideDef[] = [
  {
    key: "insights.save-report",
    app: "insights",
    title: "Salvar um relatório do Insights",
    summary: "Guarde a visão atual e gere um link para compartilhar.",
    topicPattern: /\b(salv\w*|cri\w*|ger\w*|compartilh\w*|export\w*|guard\w*)\b.*\b(relatorios?|reports?|dashboards?|insights?)\b/,
    steps: [
      {
        anchor: "insightsSaveReportButton",
        route: "/insights",
        title: "Clique em Salvar Relatório",
        message: "O ícone de marcador na lateral. Os filtros escolhidos entram no relatório.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "insightsReportName",
        title: "Confira o nome",
        message: "Já vem preenchido; ajuste se quiser. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "insightsReportSave",
        title: "Clique em Salvar",
        message: "Se ligar o link público, qualquer pessoa com o link vê o relatório.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.reportSaved,
      },
    ],
    finish: {
      title: "Relatório salvo! 📊",
      message: "Todos os relatórios ficam em Insights → Relatórios.",
    },
  },
  {
    key: "insights.add-indicator",
    app: "insights",
    title: "Adicionar um indicador no Insights",
    summary: "Escolha os KPIs que aparecem para toda a empresa.",
    topicPattern:
      /\b(adicion\w*|coloc\w*|fix\w*|mostr\w*|escolh\w*|cri\w*|personaliz\w*)\b.*\b(indicador(es)?|kpis?|metricas?|graficos?)\b/,
    steps: [
      {
        anchor: "insightsAddInsightButton",
        route: "/insights",
        title: "Clique em Adicionar Insight",
        message: "Cada seção do painel tem o seu. Escolha a seção do app que você quer acompanhar.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "Só o dono da empresa ou um moderador pode escolher os indicadores do painel.",
      },
      {
        anchor: "insightsAddInsightSheet",
        title: "Marque os indicadores",
        message: "Cada marcação salva sozinha e aparece para todos da empresa. Quando terminar, clique em Próximo.",
        position: "left",
        advanceOn: "next",
        padding: 4,
      },
    ],
    finish: {
      title: "Painel atualizado! 📈",
      message: "Desmarque quando quiser esconder um indicador de novo.",
    },
  },
];
