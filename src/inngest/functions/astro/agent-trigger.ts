import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { AiAgentMode } from "@/generated/prisma/enums";

/**
 * Trigger de sub-agente — STUB. Sessão 3 implementa o handler real:
 *   1. Resolve `AiAgentConfig` para `agentKey + organizationId`.
 *   2. Se mode = MANUAL → no-op (não faz nada; usuário precisa pedir).
 *   3. Se mode = TRIGGER → chama o sub-agente, persiste a sugestão como
 *      uma `AiSession` com `context = { scope: "trigger", ... }` e
 *      retorna o id para a UI buscar via Pusher/Realtime.
 *   4. Se mode = AUTO → executa diretamente (com guard-rails de confiança).
 *
 * Eventos previstos:
 *   - `astro/conversation.message-received` (Closer reage a mensagem do lead)
 *   - `astro/lead.created` (Closer prepara primeiro contato)
 *   - `astro/action.due-soon` (Task Agent envia lembrete via canal)
 */
export const astroAgentTrigger = inngest.createFunction(
  { id: "astro-agent-trigger", retries: 1 },
  { event: "astro/conversation.message-received" },
  async ({ event, step }) => {
    const { organizationId, conversationId } = event.data as {
      organizationId: string;
      conversationId: string;
    };

    const config = await step.run("load-closer-config", async () => {
      return prisma.aiAgentConfig.findUnique({
        where: {
          organizationId_agentKey: {
            organizationId,
            agentKey: "closer",
          },
        },
      });
    });

    if (!config?.enabled || config.mode === AiAgentMode.MANUAL) {
      return { skipped: true, reason: "closer disabled or MANUAL" };
    }

    // TODO Sessão 3: rodar runSubAgent + persistir sugestão.
    return {
      stub: true,
      organizationId,
      conversationId,
      mode: config.mode,
    };
  },
);
