import { z } from "zod";

/**
 * Zod schema do `Agent.spec` JSON.
 *
 * Estrutura executável que define o comportamento do agente:
 *  - `goals`: lista ordenada de objetivos (qualify → propose → close, etc).
 *    Cada goal tem critério de conclusão (`completionCriteria`) avaliado por
 *    IA em cada turno, tools permitidos, e referências pra próximo goal em
 *    sucesso/falha.
 *  - `contextVars`: variáveis que o agente pode extrair da conversa
 *    (produto escolhido, opção do menu, etc) pra usar em mensagens
 *    interpoladas e tool params.
 *
 * Gerado pela função `generateAgentSpec` a partir de rawPrompt +
 * systemInstructions do user. Validado strict aqui antes de gravar em
 * `Agent.spec`. Se inválido, retorna erros por field path pro user editar.
 */

const goalSchema = z.object({
  /// ID único dentro do spec (referenciado por onSuccess/onFailure)
  id: z.string().min(1),
  name: z.string().min(1),
  /// Descrição do objetivo em português, usada pelo LLM como contexto
  description: z.string().optional(),
  /// Texto natural avaliado pela IA: "lead aceitou proposta",
  /// "lead escolheu opção A", "lead pediu agendar reunião"
  completionCriteria: z.string().min(1),
  /// Subset de tool names que o agente pode usar nesse goal.
  /// Listas completas em src/app/router/ia/ai-tracking/tools/
  /// + os novos: sendProposal, sendForm, sendAgenda, sendContract,
  /// sendNasaRoute, sendLinnker, moveLeadToTracking, transferToHuman,
  /// markGoalAchieved, scheduleFollowUp
  allowedTools: z.array(z.string()).min(1),
  /// Mensagem inicial — pode ser template ({lead.name}) ou prompt pra IA
  /// gerar livremente. null = primeira ação é tool não-mensagem.
  initialMessage: z.string().optional(),
  /// ID do próximo goal quando completionCriteria=true (null = fim sucesso)
  onSuccess: z.string().nullable().optional(),
  /// ID do próximo goal quando lead recusa/sai (null = fim com loss)
  onFailure: z.string().nullable().optional(),
});

export const agentSpecSchema = z
  .object({
    /// Lista de goals — primeiro item é entry point
    goals: z.array(goalSchema).min(1),
    /// Variáveis que o agente pode coletar da conversa.
    /// Ex: ["produto_escolhido", "valor_orcado", "urgencia"]
    contextVars: z.array(z.string()).default([]),
    /// Override de stopWords do nível Agent (opcional — se omitir, usa Agent.stopWords)
    stopWords: z.array(z.string()).optional(),
  })
  .superRefine((spec, ctx) => {
    // Cruza references — todo onSuccess/onFailure deve apontar a goal existente.
    const goalIds = new Set(spec.goals.map((g) => g.id));
    for (const g of spec.goals) {
      if (g.onSuccess && !goalIds.has(g.onSuccess)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goals", g.id, "onSuccess"],
          message: `goal "${g.id}" referencia onSuccess "${g.onSuccess}" inexistente`,
        });
      }
      if (g.onFailure && !goalIds.has(g.onFailure)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goals", g.id, "onFailure"],
          message: `goal "${g.id}" referencia onFailure "${g.onFailure}" inexistente`,
        });
      }
    }
  });

export type AgentSpec = z.infer<typeof agentSpecSchema>;
export type AgentGoal = z.infer<typeof goalSchema>;
