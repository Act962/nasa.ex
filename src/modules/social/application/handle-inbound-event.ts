import type { Clock, Logger, RandomPicker } from "@/modules/shared/ports";
import {
  MAX_MESSAGE_CHARS,
  planMessageChunks,
  truncateToChars,
} from "../domain/message-chunker";
import { pickReplyVariant } from "../domain/reply-picker";
import { selectTrigger } from "../domain/trigger-selection";
import type {
  Channel,
  FlowStep,
  InboundEvent,
  ReplyToCommentConfig,
  SendDirectMessageConfig,
} from "../domain/types";
import type { AiReplyGenerator } from "../ports/ai-reply-generator";
import type { ChannelGateway, DispatchResult } from "../ports/channel-gateway";
import type {
  AutomationRepository,
  ContactRepository,
  InboundEventRepository,
  RunRepository,
  StepRunRecord,
} from "../ports/repositories";

export type HandleInboundEventDeps = {
  channel: Channel;
  automations: AutomationRepository;
  inboundEvents: InboundEventRepository;
  runs: RunRepository;
  contacts: ContactRepository;
  gateway: ChannelGateway;
  ai: AiReplyGenerator;
  clock: Clock;
  picker: RandomPicker;
  logger: Logger;
};

export type HandleInboundEventResult =
  | { outcome: "DUPLICATE" }
  | { outcome: "SKIPPED"; reason: string }
  | { outcome: "SENT"; automationId: string; runId: string }
  | {
      outcome: "FAILED";
      automationId: string;
      runId: string;
      error: string;
      /** A credencial foi recusada (401/403), não é falha pontual de envio. */
      authError: boolean;
    };

/**
 * Caso de uso central: um evento chegou, decide se responde e responde.
 *
 * Ordem deliberada, cada passo com o caso de borda que o motiva:
 *  1. autor é a própria conta      → CB-1, senão a automação conversa consigo
 *  2. registro de idempotência     → CA-4, a Meta reentrega o mesmo evento
 *  3. canal precisa reconectar     → CB-10, registra mas não envia
 *  4. seleção de UM gatilho        → CA-9/CB-8, nunca duas respostas
 *  5. reconferência de `isActive`  → CB-9, pode ter sido desligada no meio
 *  6. envio + trilha de execução
 *
 * Nada aqui conhece Prisma, HTTP ou Meta — tudo entra por port.
 */
export async function handleInboundEvent(
  event: InboundEvent,
  deps: HandleInboundEventDeps,
): Promise<HandleInboundEventResult> {
  const { channel, logger } = deps;

  if (event.actor.externalUserId === channel.externalAccountId) {
    return { outcome: "SKIPPED", reason: "Evento da própria conta" };
  }

  const registration = await deps.inboundEvents.registerOnce({
    channelId: channel.id,
    provider: event.provider,
    externalEventId: event.externalEventId,
    eventType: event.type,
    externalUserId: event.actor.externalUserId,
    externalContentId: event.content?.externalId,
  });

  if (!registration.isFirstTime) {
    return { outcome: "DUPLICATE" };
  }

  const inboundEventId = registration.inboundEventId;
  const skip = async (reason: string): Promise<HandleInboundEventResult> => {
    if (inboundEventId) {
      await deps.inboundEvents.markStatus(inboundEventId, "SKIPPED", reason);
    }
    return { outcome: "SKIPPED", reason };
  };

  if (channel.status !== "ACTIVE") {
    return skip("Canal desconectado");
  }

  const automations = await deps.automations.findActiveByChannel(channel.id);
  const selection = selectTrigger(automations, event);
  if (!selection) {
    return skip("Nenhum gatilho corresponde");
  }

  const fresh = await deps.automations.findById(selection.automation.id);
  if (!fresh?.isActive) {
    return skip("Automação desativada durante o processamento");
  }

  const contact = await deps.contacts.upsertFromInbound({
    channelId: channel.id,
    externalUserId: event.actor.externalUserId,
    username: event.actor.username,
    occurredAt: event.occurredAt,
  });

  const { runId } = await deps.runs.start({
    automationId: selection.automation.id,
    triggerId: selection.trigger.id,
    channelId: channel.id,
    inboundEventId,
    contactId: contact.contactId,
  });

  const sequenceIndex = await deps.runs.countByAutomation(
    selection.automation.id,
  );

  const steps = [...selection.trigger.steps]
    .filter((step) => step.isEnabled)
    .sort((left, right) => left.order - right.order);

  const stepRecords: StepRunRecord[] = [];
  let anySent = false;
  let firstError: string | null = null;
  let hasAuthError = false;

  for (const step of steps) {
    const startedAt = deps.clock.now().getTime();
    const { record, authError } = await executeStep({
      step,
      event,
      deps,
      organizationId: selection.automation.organizationId,
      sequenceIndex,
    });
    record.durationMs = deps.clock.now().getTime() - startedAt;
    stepRecords.push(record);

    if (authError) hasAuthError = true;
    if (record.status === "SENT") anySent = true;
    if (record.status === "FAILED" && !firstError) {
      firstError = record.error ?? "Falha no envio";
    }
  }

  if (anySent) {
    await deps.contacts.markOutbound(contact.contactId, deps.clock.now());
  }

  const runStatus = anySent ? "SENT" : firstError ? "FAILED" : "SKIPPED";
  await deps.runs.finish(runId, runStatus, stepRecords, firstError);

  if (inboundEventId) {
    await deps.inboundEvents.markStatus(
      inboundEventId,
      runStatus === "FAILED" ? "FAILED" : "MATCHED",
    );
  }

  if (runStatus === "FAILED") {
    logger.warn("Automação falhou ao responder", {
      automationId: selection.automation.id,
      error: firstError,
    });
    return {
      outcome: "FAILED",
      automationId: selection.automation.id,
      runId,
      error: firstError ?? "Falha no envio",
      authError: hasAuthError,
    };
  }

  return { outcome: "SENT", automationId: selection.automation.id, runId };
}

async function executeStep(input: {
  step: FlowStep;
  event: InboundEvent;
  deps: HandleInboundEventDeps;
  organizationId: string;
  sequenceIndex: number;
}): Promise<{ record: StepRunRecord; authError: boolean }> {
  const { step, event, deps } = input;
  const base: StepRunRecord = {
    stepId: step.id,
    kind: step.kind,
    status: "SKIPPED",
  };

  if (step.kind === "REPLY_TO_COMMENT") {
    if (!event.content || event.type !== "COMMENT_CREATED") {
      return {
        record: { ...base, error: "Resposta pública só existe em comentário" },
        authError: false,
      };
    }
    const config = step.config as ReplyToCommentConfig;
    const text = pickReplyVariant(config, deps.picker, input.sequenceIndex);
    if (!text) return { record: base, authError: false };

    const result = await deps.gateway.replyToComment({
      commentId: event.externalEventId,
      text: truncateToChars(text, MAX_MESSAGE_CHARS),
    });
    return toRecord(base, result);
  }

  const config = step.config as SendDirectMessageConfig;
  let text = config.text?.trim() ?? "";

  if (config.source === "AI") {
    const generated = await deps.ai.generate({
      organizationId: input.organizationId,
      prompt: config.aiPrompt ?? "",
      incomingText: event.text,
    });

    if (generated.ok) {
      text = generated.text;
    } else if (!text) {
      // Sem saldo ou sem saída da IA e sem texto estático de reserva: não
      // inventa resposta, registra o motivo (spec 0024 CB-16, RF-16).
      return {
        record: { ...base, error: `IA indisponível: ${generated.reason}` },
        authError: false,
      };
    }
  }

  if (!text) return { record: base, authError: false };

  const buttons = config.buttons.slice(0, 3);
  // Os botões só viajam no último bloco, então só ele usa o limite menor.
  const chunks = planMessageChunks(text, buttons.length > 0);
  if (chunks.length === 0) return { record: base, authError: false };

  const isCommentReply = event.type === "COMMENT_CREATED";
  let lastResult = await deps.gateway.sendDirectMessage({
    // Resposta privada a comentário usa `comment_id`; DM usa o id do usuário.
    commentId: isCommentReply ? event.externalEventId : undefined,
    externalUserId: isCommentReply ? undefined : event.actor.externalUserId,
    text: chunks[0],
    buttons: chunks.length === 1 ? buttons : undefined,
  });

  for (let index = 1; index < chunks.length && lastResult.ok; index += 1) {
    const isLast = index === chunks.length - 1;
    lastResult = await deps.gateway.sendDirectMessage({
      // Só o primeiro bloco pode usar `comment_id`: a partir do segundo a
      // conversa já existe e o destinatário passa a ser o usuário.
      externalUserId: event.actor.externalUserId,
      text: chunks[index],
      buttons: isLast ? buttons : undefined,
    });
  }

  return toRecord(base, lastResult);
}

/**
 * O gateway já distingue credencial recusada (401/403) de falha pontual pelo
 * status HTTP. Propagar esse sinal evita que o adapter tenha de adivinhar por
 * regex no texto do erro — que erraria em toda mensagem contendo "token".
 */
function toRecord(
  base: StepRunRecord,
  result: DispatchResult,
): { record: StepRunRecord; authError: boolean } {
  if (result.ok) {
    return {
      record: {
        ...base,
        status: "SENT",
        externalMessageId: result.externalMessageId ?? null,
      },
      authError: false,
    };
  }
  return {
    record: { ...base, status: "FAILED", error: result.error },
    authError: result.authError,
  };
}
