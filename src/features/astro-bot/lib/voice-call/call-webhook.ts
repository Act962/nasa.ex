import "server-only";
import { z } from "zod";
import { sendOfficialCallAction } from "@/http/whats-oficial/calls";
import { resolveBotGate } from "../webhook-handler";
import { isCallEnabledForTracking } from "./call-config";
import { TrackingProviderBotChannel } from "../tracking-provider-channel";
import {
  CLIENT_TEXT_ONLY_MESSAGE,
  answerCall,
  countActiveCallsFor,
  endCall,
  hasActiveCallFor,
  type CallInstance,
} from "./call-session";
import { prepareClientCall } from "./client-call";

/** Cada chamada mantém conexões de áudio abertas no servidor (spec 0087, RS-7). */
const MAX_SIMULTANEOUS_CALLS_PER_ORGANIZATION = 5;

/**
 * Eventos de chamada do webhook oficial (campo `calls`), spec 0086.
 *
 * Tratado à parte das mensagens: nada aqui toca o caminho que grava conversas.
 * Quem chama esta função já conferiu a assinatura do webhook.
 */

const callEventSchema = z.object({
  id: z.string(),
  from: z.string().optional(),
  event: z.string(),
  direction: z.string().optional(),
  session: z.object({ sdp_type: z.string(), sdp: z.string() }).optional(),
});

const callsWebhookSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(z.object({ field: z.string(), value: z.object({ calls: z.array(callEventSchema).optional() }).passthrough() })),
    }),
  ),
});

type CallEvent = z.infer<typeof callEventSchema>;

/** Devolve os eventos de chamada do corpo, ou `null` quando o webhook não é de chamada. */
export function extractCallEvents(rawPayload: unknown): CallEvent[] | null {
  const parsed = callsWebhookSchema.safeParse(rawPayload);
  if (!parsed.success) return null;
  const callChanges = parsed.data.entry.flatMap((entry) => entry.changes).filter((change) => change.field === "calls");
  if (callChanges.length === 0) return null;
  return callChanges.flatMap((change) => change.value.calls ?? []);
}

async function handleIncomingCall(callEvent: CallEvent, instance: CallInstance): Promise<string> {
  const rejectSilently = async (reason: string) => {
    await sendOfficialCallAction(instance.accessToken, instance.phoneNumberId, { callId: callEvent.id, action: "reject" }).catch(
      (rejectError: unknown) =>
        console.warn("[astro-bot/chamada] recusa falhou:", rejectError instanceof Error ? rejectError.message.slice(0, 200) : "erro"),
    );
    return `rejected:${reason}`;
  };

  if (!isCallEnabledForTracking(instance.trackingId)) return rejectSilently("disabled");
  if (callEvent.direction !== "USER_INITIATED" || callEvent.session?.sdp_type !== "offer" || !callEvent.from) {
    return rejectSilently("unsupported_call");
  }
  // Mesmo portão do texto: só membro vinculado, com o Astro ativo neste tracking (RF-2, RS-1).
  const gate = await resolveBotGate({
    phone: callEvent.from,
    trackingId: instance.trackingId,
    trackingOrganizationId: instance.organizationId,
  });
  if (!gate.allowed || !gate.binding) return handleClientCall(callEvent as CallEvent & { from: string; session: { sdp: string } }, instance, rejectSilently);
  if (hasActiveCallFor(gate.binding.id)) return rejectSilently("already_in_call");

  const outcome = await answerCall({
    metaCallId: callEvent.id,
    sdpOffer: callEvent.session.sdp,
    callerPhone: callEvent.from,
    instance,
    binding: gate.binding,
  });
  return outcome.answered ? "answered" : `failed:${outcome.reason}`;
}

/** Quem ligou não é da equipe: é cliente. Atende com o agente do atendimento, se o tracking tiver a opção ligada. */
async function handleClientCall(
  callEvent: CallEvent & { from: string; session: { sdp: string } },
  instance: CallInstance,
  rejectSilently: (reason: string) => Promise<string>,
): Promise<string> {
  const decision = await prepareClientCall({ instance, callerPhone: callEvent.from });
  if (!decision.canAnswer) {
    const outcome = await rejectSilently(decision.reason);
    if (decision.shouldSendTextOnlyNotice) {
      await new TrackingProviderBotChannel(instance.trackingId)
        .sendText(callEvent.from, CLIENT_TEXT_ONLY_MESSAGE, { isImmediate: true })
        .catch(() => undefined);
    }
    return outcome;
  }
  if (hasActiveCallFor(decision.persona.callerKey)) return rejectSilently("already_in_call");
  if (countActiveCallsFor(instance.organizationId) >= MAX_SIMULTANEOUS_CALLS_PER_ORGANIZATION) return rejectSilently("organization_busy");
  const outcome = await answerCall({
    metaCallId: callEvent.id,
    sdpOffer: callEvent.session.sdp,
    callerPhone: callEvent.from,
    instance,
    client: decision.persona,
  });
  return outcome.answered ? "answered_client" : `failed:${outcome.reason}`;
}

export async function handleOfficialCallEvents(callEvents: CallEvent[], instance: CallInstance): Promise<string[]> {
  const outcomes: string[] = [];
  for (const callEvent of callEvents) {
    if (callEvent.event === "connect") {
      outcomes.push(await handleIncomingCall(callEvent, instance));
    } else if (callEvent.event === "terminate") {
      // A Meta já encerrou: só fecha o nosso lado e registra.
      await endCall(callEvent.id, { terminateOnMeta: false, reason: "encerrada_pela_meta" });
      outcomes.push("terminated");
    } else {
      outcomes.push(`ignored:${callEvent.event}`);
    }
  }
  return outcomes;
}
