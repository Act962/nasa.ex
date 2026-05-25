import "server-only";
import { generateText } from "ai";
import type { GetStepTools } from "inngest";
import { sendText } from "@/http/uazapi/send-text";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { loadAgentContext, type AgentEventData } from "./context";
import { defaultModel } from "./model";
import { buildSystemPrompt } from "./system-prompt";
import { splitForWhatsapp } from "./split-message";
import { persistOutboundMessage } from "./persist";
import { buildAgentTools } from "../server/tools";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

type Step = GetStepTools<typeof inngest>;

interface RunArgs {
  step: Step;
  data: AgentEventData;
}

const INTER_MESSAGE_DELAY_MS = 600;

export async function runWhatsappAgent({ step, data }: RunArgs) {
  // Não envolvemos load-context em step.run: o serializador do Inngest
  // converte o retorno em JsonifyObject, o que quebra o tipo de ModelMessage[]
  // (e o AgentContext que é passado pras tools). Re-executar em retry é barato.
  const ctx = await loadAgentContext(data);

  if (!ctx.instance) return { skipped: true, reason: "no_whatsapp_instance" };
  if (!ctx.settings) return { skipped: true, reason: "no_ai_settings" };
  if (!ctx.lead.isActive) return { skipped: true, reason: "lead_inactive" };
  if (ctx.lead.statusFlow === "FINISHED")
    return { skipped: true, reason: "lead_finished" };
  if (!ctx.lead.phone) return { skipped: true, reason: "lead_no_phone" };
  // Conversa truly vazia (sem msgs, ou só mídias sem texto/caption). O SDK
  // rejeita `messages: []` com `AI_InvalidPromptError`. Próxima inbound
  // reativa o agente naturalmente.
  if (ctx.history.length === 0)
    return { skipped: true, reason: "empty_history" };

  // ── Barramento por STARS ──────────────────────────────────────────────
  // Verifica grace period e suspensão ANTES de gastar tokens com IA. Org
  // suspensa = silêncio total; em grace com saldo 0 = fallback humano.
  const orgState = await prisma.organization.findUnique({
    where: { id: data.organizationId },
    select: {
      starsBalance: true,
      starsBonusBalance: true,
      starsGraceStartedAt: true,
      starsSuspendedAt: true,
    },
  });
  if (orgState?.starsSuspendedAt) {
    return { skipped: true, reason: "stars_suspended" };
  }
  const totalStars =
    (orgState?.starsBalance ?? 0) + (orgState?.starsBonusBalance ?? 0);
  if (orgState?.starsGraceStartedAt && totalStars <= 0) {
    // Conta em grace E sem saldo → não responde IA. Mensagem de fallback
    // pra não deixar o lead "no escuro".
    await step.run("send-grace-fallback", async () => {
      await sendText(
        ctx.instance!.apiKey,
        {
          number: ctx.lead.phone!,
          text: "Estamos com você! Em instantes um atendente humano retornará. Obrigado pela paciência.",
          delay: 0,
        },
        ctx.instance!.baseUrl,
      );
    });
    return { skipped: true, reason: "stars_grace_no_balance" };
  }

  // Cobrança 2★ por resposta gerada (registry: `chat_ai_message`).
  // Se não tem saldo → não chama LLM (já validamos acima, mas double-check).
  const charge = await chargeStarsByAction(data.organizationId, "chat_ai_message", {
    description: "Resposta IA WhatsApp",
    appSlug: "chat_ai_message",
  });
  if (!charge.success) {
    await step.run("send-no-balance-fallback", async () => {
      await sendText(
        ctx.instance!.apiKey,
        {
          number: ctx.lead.phone!,
          text: "Estamos com você! Em instantes um atendente humano retornará.",
          delay: 0,
        },
        ctx.instance!.baseUrl,
      );
    });
    return { skipped: true, reason: "stars_insufficient" };
  }

  const baseSystem = buildSystemPrompt({
    settings: ctx.settings!,
    orgName: ctx.organization.name,
    leadName: ctx.lead.name,
    currentTags: ctx.lead.leadTags,
    availableTags: ctx.availableTags,
    availableButtonPresets: ctx.availableButtonPresets,
  });

  // Apêndice ao system prompt quando o disparo veio da automação de ociosidade
  // com instrução de reabertura: não há nova msg do lead, o agente precisa
  // tomar iniciativa pra reengajar de forma natural.
  const systemPrompt =
    ctx.trigger === "idle-reopen-with-instruction"
      ? `${baseSystem}\n\n# Reabertura automática\n\nO lead está ocioso${
          ctx.idleMinutes ? ` há cerca de ${ctx.idleMinutes} minutos` : ""
        } desde a última interação. Não chegou nenhuma nova mensagem do lead. Reabra a conversa de forma natural e curta pra reengajar — referência o contexto anterior se fizer sentido. Evite parecer automático.`
      : baseSystem;

  const aiResult = await step.run("run-agent", async () => {
    const result = await generateText({
      model: defaultModel(),
      system: systemPrompt,
      tools: buildAgentTools(ctx),
      messages: ctx.history,
      stopWhen: ({ steps }) => steps.length >= 6,
    });
    return {
      text: result.text.trim(),
      toolCalls: result.toolCalls.length,
    };
  });

  if (aiResult.text) {
    await step.run("send-final-text", async () => {
      const parts = splitForWhatsapp(aiResult.text);
      for (let i = 0; i < parts.length; i++) {
        const chunk = parts[i];
        const res = await sendText(
          ctx.instance!.apiKey,
          {
            number: ctx.lead.phone!,
            text: chunk,
            delay: INTER_MESSAGE_DELAY_MS,
          },
          ctx.instance!.baseUrl,
        );
        await persistOutboundMessage({
          conversationId: ctx.conversation.id,
          leadId: ctx.lead.id,
          trackingId: ctx.trackingId,
          body: chunk,
          senderName: ctx.settings?.assistantName ?? "IA",
          externalMessageId: res.messageid,
        });
        if (i < parts.length - 1) {
          await new Promise((r) => setTimeout(r, INTER_MESSAGE_DELAY_MS));
        }
      }
      return { sent: parts.length };
    });
  }

  return {
    ok: true,
    sentText: !!aiResult.text,
    toolCalls: aiResult.toolCalls,
  };
}
