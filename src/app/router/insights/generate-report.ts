import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ORPCError } from "@orpc/server";

export const generateReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      period: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      modules: z.array(z.string()),
      tracking: z
        .object({
          totalLeads: z.number(),
          wonLeads: z.number(),
          activeLeads: z.number(),
          conversionRate: z.number(),
        })
        .optional(),
      chat: z
        .object({
          totalConversations: z.number(),
          totalMessages: z.number(),
          attendedConversations: z.number(),
          unattendedConversations: z.number(),
          attendanceRate: z.number(),
        })
        .optional(),
      forge: z
        .object({
          totalProposals: z.number(),
          rascunho: z.number(),
          enviadas: z.number(),
          visualizadas: z.number(),
          pagas: z.number(),
          expiradas: z.number(),
          canceladas: z.number(),
          revenueTotal: z.number(),
          revenuePipeline: z.number(),
          totalContracts: z.number(),
          contractsAtivo: z.number(),
        })
        .optional(),
      spacetime: z
        .object({
          total: z.number(),
          pending: z.number(),
          confirmed: z.number(),
          done: z.number(),
          cancelled: z.number(),
          noShow: z.number(),
          withLead: z.number(),
          conversionRate: z.number(),
        })
        .optional(),
      nasaPlanner: z
        .object({
          total: z.number(),
          draft: z.number(),
          published: z.number(),
          scheduled: z.number(),
          starsSpent: z.number(),
          byNetwork: z.record(z.string(), z.number()),
        })
        .optional(),
      metaAds: z
        .object({
          spend: z.number(),
          roas: z.number(),
          leads: z.number(),
          clicks: z.number(),
          impressions: z.number(),
          ctr: z.number(),
          cpl: z.number(),
        })
        .optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "ANTHROPIC_API_KEY não configurada" });
    }

    const anthropic = createAnthropic({ apiKey: anthropicApiKey });

    const fmtBRL = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const fmtN = (n: number) => n.toLocaleString("pt-BR");

    const period =
      input.period.startDate && input.period.endDate
        ? `${new Date(input.period.startDate).toLocaleDateString("pt-BR")} a ${new Date(input.period.endDate).toLocaleDateString("pt-BR")}`
        : "período selecionado";

    const orgName = context.org.name;

    const sections: string[] = [];

    if (input.tracking) {
      const t = input.tracking;
      sections.push(`**TRACKING (CRM de Leads)**
- Total de leads: ${fmtN(t.totalLeads)}
- Leads ativos: ${fmtN(t.activeLeads)}
- Leads ganhos: ${fmtN(t.wonLeads)}
- Taxa de conversão: ${t.conversionRate.toFixed(1)}%`);
    }

    if (input.chat) {
      const c = input.chat;
      sections.push(`**CHAT (Atendimento)**
- Conversas totais: ${fmtN(c.totalConversations)}
- Mensagens recebidas: ${fmtN(c.totalMessages)}
- Conversas atendidas: ${fmtN(c.attendedConversations)}
- Conversas não atendidas: ${fmtN(c.unattendedConversations)}
- Taxa de atendimento: ${c.attendanceRate.toFixed(1)}%`);
    }

    if (input.forge) {
      const f = input.forge;
      sections.push(`**FORGE (Propostas Comerciais)**
- Total de propostas: ${fmtN(f.totalProposals)}
- Propostas pagas: ${fmtN(f.pagas)}
- Receita fechada: ${fmtBRL(f.revenueTotal)}
- Pipeline em aberto: ${fmtBRL(f.revenuePipeline)}
- Enviadas: ${fmtN(f.enviadas)} | Visualizadas: ${fmtN(f.visualizadas)}
- Expiradas: ${fmtN(f.expiradas)} | Canceladas: ${fmtN(f.canceladas)}
- Contratos ativos: ${fmtN(f.contractsAtivo)} de ${fmtN(f.totalContracts)}`);
    }

    if (input.spacetime) {
      const s = input.spacetime;
      sections.push(`**SPACETIME (Agendamentos)**
- Total de agendamentos: ${fmtN(s.total)}
- Realizados: ${fmtN(s.done)} (${s.conversionRate.toFixed(1)}%)
- Confirmados: ${fmtN(s.confirmed)} | Pendentes: ${fmtN(s.pending)}
- Cancelados: ${fmtN(s.cancelled)} | No-show: ${fmtN(s.noShow)}
- Com lead vinculado: ${fmtN(s.withLead)}`);
    }

    if (input.nasaPlanner) {
      const n = input.nasaPlanner;
      const networks = Object.entries(n.byNetwork)
        .map(([net, count]) => `${net}: ${count}`)
        .join(", ");
      sections.push(`**NASA PLANNER (Conteúdo)**
- Posts criados: ${fmtN(n.total)}
- Publicados: ${fmtN(n.published)} | Agendados: ${fmtN(n.scheduled)} | Rascunhos: ${fmtN(n.draft)}
- Stars consumidas (IA): ${fmtN(n.starsSpent)}
- Por rede: ${networks || "nenhum"}`);
    }

    if (input.metaAds) {
      const m = input.metaAds;
      sections.push(`**META ADS (Tráfego Pago)**
- Investimento: ${fmtBRL(m.spend)}
- ROAS: ${m.roas.toFixed(2)}x
- Leads gerados: ${fmtN(m.leads)} | CPL: ${fmtBRL(m.cpl)}
- Cliques: ${fmtN(m.clicks)} | CTR: ${m.ctr.toFixed(2)}%
- Impressões: ${fmtN(m.impressions)}`);
    }

    const dataText = sections.join("\n\n");

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      system: `Você é um analista de marketing e negócios especialista em análise de dados.
Sua função é gerar relatórios profissionais, objetivos e estratégicos para gestores e clientes.
Escreva em português do Brasil, de forma clara, direta e profissional.
Use linguagem positiva mas honesta. Aponte pontos de atenção e oportunidades.
Estruture o relatório em seções com títulos em negrito.
Não use markdown excessivo — apenas **negrito** para títulos e destaques chave.`,
      prompt: `Gere um relatório de análise completo para ${orgName} referente ao período: ${period}.

Dados disponíveis:
${dataText}

O relatório deve conter:
1. **Resumo Executivo** — visão geral dos principais resultados
2. **Destaques Positivos** — o que performou bem e por quê
3. **Pontos de Atenção** — o que precisa de melhoria imediata
4. **Cruzamento de Dados** — insights entre os apps (ex: Meta Ads vs Chat vs Tracking)
5. **Recomendações Estratégicas** — ações concretas para o próximo período

Seja específico com os números. Calcule taxas e ratios relevantes. Máximo de 400 palavras.`,
    });

    return { report: text, period, orgName };
  });
