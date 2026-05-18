/**
 * Alert Engine — núcleo do sistema de alertas.
 *
 * Recebe um evento tipado (vinculado a uma entrada do AlertCatalog) e:
 *  1. Busca todas AlertRule ativas para esse eventType (filtradas por org se
 *     o payload trouxer orgId).
 *  2. Valida payload contra paramsSchema de cada regra + bate condições
 *     paramétricas (ex: rule.params.statusId === payload.toStatusId).
 *  3. Checa idempotência via AlertDispatch (unique key derivada do payload).
 *  4. Resolve audiência → lista de userIds.
 *  5. Cria AdminNotification(s) com severity / displaySurface / requiresAck.
 *  6. Publica Pusher event "alert:new" em private-user-${userId}
 *     (ou private-org-${orgId} se whole_org / >10 destinatários).
 *
 * Pré-requisito: migração MANUAL_alerts_foundation.sql aplicada + db:generate.
 */

import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { getAlertEvent, type Audience } from "./alert-catalog";
import {
  isSeverity,
  resolveDisplaySurface,
  requiresAckBySeverity,
  type Severity,
  type DisplaySurface,
} from "./severity";
import { resolveAudience } from "./audience-resolver";

const ORG_CHANNEL_THRESHOLD = 10;

export interface DispatchOpts {
  /** Pula busca de regras e dispara direto (ex: broadcast manual). */
  bypassRules?: {
    title: string;
    body: string;
    severity: Severity;
    audience: Audience;
    actionUrl?: string | null;
    orgId: string | null;
    createdBy: string;
  };
}

export interface DispatchResult {
  dispatchedCount: number;
  ruleMatches: number;
  skippedByCooldown: number;
}

/**
 * Ponto de entrada principal — chamado por:
 *  - Subscribers de eventBus (event-based rules)
 *  - Crons time-based (lead.stale, integration.whatsapp_down, etc)
 *  - Broadcast manual via opts.bypassRules
 */
export async function dispatchAlert<P extends Record<string, unknown>>(
  eventType: string,
  payload: P,
  opts: DispatchOpts = {},
): Promise<DispatchResult> {
  // Path 1: broadcast direto (sem matchear regras)
  if (opts.bypassRules) {
    return dispatchBroadcast(eventType, payload, opts.bypassRules);
  }

  // Path 2: matchear regras configuradas
  const def = getAlertEvent(eventType);
  if (!def) {
    console.warn(`[alert-engine] eventType desconhecido: ${eventType}`);
    return { dispatchedCount: 0, ruleMatches: 0, skippedByCooldown: 0 };
  }

  const payloadParsed = def.payloadSchema.safeParse(payload);
  if (!payloadParsed.success) {
    console.error(
      `[alert-engine] payload inválido pra ${eventType}:`,
      payloadParsed.error.issues,
    );
    return { dispatchedCount: 0, ruleMatches: 0, skippedByCooldown: 0 };
  }

  const orgIdFromPayload = (payload as { orgId?: string }).orgId ?? null;

  // Busca regras ativas — globais (orgId=null) OU da org do payload.
  const rules = await prisma.alertRule.findMany({
    where: {
      eventType,
      isActive: true,
      OR: [
        { organizationId: null },
        ...(orgIdFromPayload ? [{ organizationId: orgIdFromPayload }] : []),
      ],
    },
  });

  if (rules.length === 0) {
    console.log(
      `[alert-engine] ${eventType} disparado mas 0 regras ativas (org=${orgIdFromPayload ?? "n/a"}).`,
    );
  }

  let dispatchedCount = 0;
  let ruleMatches = 0;
  let skippedByCooldown = 0;

  for (const rule of rules) {
    // Valida params da regra contra paramsSchema
    const paramsParsed = def.paramsSchema.safeParse(rule.params ?? {});
    if (!paramsParsed.success) {
      console.warn(
        `[alert-engine] regra ${rule.id} tem params inválidos:`,
        paramsParsed.error.issues,
      );
      continue;
    }

    // Casa condições paramétricas (ex: statusId da regra === toStatusId do payload)
    if (!matchesParametricConditions(rule.params, payload)) {
      console.log(
        `[alert-engine] regra ${rule.id} (${eventType}) não casou params:`,
        { ruleParams: rule.params, payload },
      );
      continue;
    }

    ruleMatches++;

    // Idempotência via AlertDispatch
    const entityKey = def.entityKey(payload);
    try {
      await prisma.alertDispatch.create({
        data: { alertRuleId: rule.id, entityKey },
      });
    } catch {
      // unique violation → já disparou
      skippedByCooldown++;
      continue;
    }

    // Cooldown opcional (em minutos)
    if (rule.cooldownMinutes && rule.cooldownMinutes > 0) {
      const since = new Date(Date.now() - rule.cooldownMinutes * 60_000);
      const recent = await prisma.alertDispatch.count({
        where: { alertRuleId: rule.id, dispatchedAt: { gte: since } },
      });
      if (recent > 1) {
        // o atual já conta — se há outro recente além dele, cooldown ativo
        skippedByCooldown++;
        continue;
      }
    }

    // Resolve audiência
    const audience = parseAudience(rule.audience);
    if (!audience) {
      console.warn(`[alert-engine] regra ${rule.id} tem audience inválida.`);
      continue;
    }
    const userIds = await resolveAudience(audience, {
      orgId: orgIdFromPayload,
      leadId: (payload as { leadId?: string }).leadId ?? null,
      responsibleId:
        (payload as { responsibleId?: string }).responsibleId ?? null,
      participantUserIds:
        (payload as { participantUserIds?: string[] }).participantUserIds,
      // Fallback: regras antigas salvas com kind=user sem userIds (criadas
      // antes do fix em create-rule/update-rule) viram silenciosamente
      // descartadas. Aqui assumimos que "user" = criador da regra.
      explicitUserIds:
        audience.kind === "user" && (!audience.userIds || audience.userIds.length === 0)
          ? rule.createdBy
            ? [rule.createdBy]
            : []
          : undefined,
    });

    if (userIds.length === 0) {
      console.warn(
        `[alert-engine] regra ${rule.id} (${eventType}) casou mas audiência ${audience.kind} resolveu pra 0 users.`,
      );
      continue;
    }

    const severity = isSeverity(rule.severity) ? rule.severity : "info";
    const displaySurface = (rule.displaySurface ??
      resolveDisplaySurface(severity)) as DisplaySurface;
    const requiresAck = requiresAckBySeverity(severity);

    // Cria notification + publica Pusher
    const count = await deliverToUsers({
      userIds,
      orgId: orgIdFromPayload,
      audience,
      severity,
      displaySurface,
      requiresAck,
      title: renderTitle(def.label, payload),
      body: renderBody(rule.description ?? def.description, payload),
      alertRuleId: rule.id,
      eventType,
      eventPayload: payload,
      createdBy: rule.createdBy ?? "SYSTEM",
    });
    dispatchedCount += count;
  }

  return { dispatchedCount, ruleMatches, skippedByCooldown };
}

// ─── Path: broadcast direto ─────────────────────────────────────────────────

async function dispatchBroadcast(
  eventType: string,
  payload: Record<string, unknown>,
  bypass: NonNullable<DispatchOpts["bypassRules"]>,
): Promise<DispatchResult> {
  const userIds = await resolveAudience(bypass.audience, {
    orgId: bypass.orgId,
    leadId: null,
    responsibleId: null,
  });
  if (userIds.length === 0) {
    return { dispatchedCount: 0, ruleMatches: 0, skippedByCooldown: 0 };
  }
  const severity = bypass.severity;
  const displaySurface = resolveDisplaySurface(severity);
  const requiresAck = requiresAckBySeverity(severity);

  const count = await deliverToUsers({
    userIds,
    orgId: bypass.orgId,
    audience: bypass.audience,
    severity,
    displaySurface,
    requiresAck,
    title: bypass.title,
    body: bypass.body,
    alertRuleId: null,
    eventType,
    eventPayload: payload,
    createdBy: bypass.createdBy,
    actionUrl: bypass.actionUrl ?? null,
  });

  return { dispatchedCount: count, ruleMatches: 0, skippedByCooldown: 0 };
}

// ─── Delivery (DB + Pusher) ─────────────────────────────────────────────────

interface DeliverArgs {
  userIds: string[];
  orgId: string | null;
  audience: Audience;
  severity: Severity;
  displaySurface: DisplaySurface;
  requiresAck: boolean;
  title: string;
  body: string;
  alertRuleId: string | null;
  eventType: string;
  eventPayload: Record<string, unknown>;
  createdBy: string;
  actionUrl?: string | null;
}

async function deliverToUsers(args: DeliverArgs): Promise<number> {
  const {
    userIds,
    orgId,
    audience,
    severity,
    displaySurface,
    requiresAck,
    title,
    body,
    alertRuleId,
    eventType,
    eventPayload,
    createdBy,
    actionUrl,
  } = args;

  // Estratégia de canal Pusher:
  //   - whole_org OU > threshold → publica 1x em private-org-{orgId}
  //   - caso contrário → publica N x em private-user-{userId}
  const useOrgChannel =
    audience.kind === "whole_org" || userIds.length > ORG_CHANNEL_THRESHOLD;

  // Cria 1 notification por user (targetType="user") — modelo atual já suporta.
  // Quando whole_org, criamos UMA notif com targetType="org" e leitura é por user
  // (AdminNotificationRead). Isso evita N rows duplicadas e mantém compat com
  // o NotificationBell existente.
  if (useOrgChannel && orgId && audience.kind === "whole_org") {
    await prisma.adminNotification.create({
      data: {
        title,
        body,
        type: severity, // legado mantém "type"; severity é a fonte autoritativa
        severity,
        displaySurface,
        requiresAck,
        appKey: deriveAppKey(eventType),
        actionUrl: actionUrl ?? null,
        targetType: "org",
        targetId: orgId,
        organizationId: orgId,
        createdBy,
        alertRuleId,
        eventType,
        eventPayload: eventPayload as never,
      },
    });
  } else {
    await prisma.adminNotification.createMany({
      data: userIds.map((uid) => ({
        title,
        body,
        type: severity,
        severity,
        displaySurface,
        requiresAck,
        appKey: deriveAppKey(eventType),
        actionUrl: actionUrl ?? null,
        targetType: "user",
        targetId: uid,
        organizationId: orgId,
        createdBy,
        alertRuleId,
        eventType,
        eventPayload: eventPayload as never,
      })),
    });
  }

  // Pusher — best-effort, não bloqueia DB write se falhar
  try {
    const event = "alert:new";
    const data = {
      severity,
      displaySurface,
      requiresAck,
      title,
      body,
      actionUrl: actionUrl ?? null,
      eventType,
    };
    if (useOrgChannel && orgId) {
      await pusherServer.trigger(`private-org-${orgId}`, event, data);
    } else {
      // Pusher tem `triggerBatch` mas requer setup; iterar é OK até 100 users.
      await Promise.all(
        userIds.map((uid) =>
          pusherServer.trigger(`private-user-${uid}`, event, data),
        ),
      );
    }
  } catch (err) {
    console.error("[alert-engine] pusher trigger falhou:", err);
  }

  return userIds.length;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseAudience(raw: unknown): Audience | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: string; userIds?: unknown };
  if (typeof r.kind !== "string") return null;
  const userIds = Array.isArray(r.userIds)
    ? (r.userIds.filter((x) => typeof x === "string") as string[])
    : undefined;
  return { kind: r.kind as Audience["kind"], userIds };
}

/**
 * Bate condições paramétricas básicas. Convenções de naming:
 *
 *   - `statusId`, `tagId`, `formId`: match exato. Engine também aceita
 *     prefixo `to{X}` no payload (ex: `statusId` → `toStatusId`).
 *   - `min{Field}` (ex: `minDaysOverdue`): payload.field deve ser ≥ valor.
 *     Útil pra thresholds tipo "ação atrasada há pelo menos N dias".
 *   - `max{Field}` (ex: `maxMinutes`): payload.field deve ser ≤ valor.
 *
 * Se a regra restringe mas o payload nem traz o campo, deixa passar
 * (ex: form.submitted sem formId → match qualquer form).
 */
function matchesParametricConditions(
  ruleParams: unknown,
  payload: Record<string, unknown>,
): boolean {
  if (!ruleParams || typeof ruleParams !== "object") return true;
  for (const [key, value] of Object.entries(ruleParams)) {
    if (value === undefined || value === null) continue;

    // Convenção min{Field}: payload.field >= value
    if (key.length > 3 && key.startsWith("min") && /[A-Z]/.test(key[3]!)) {
      const payloadKey = key[3]!.toLowerCase() + key.slice(4);
      const payloadValue = payload[payloadKey];
      if (payloadValue === undefined) continue;
      if (typeof payloadValue !== "number" || typeof value !== "number") {
        continue;
      }
      if (payloadValue < value) return false;
      continue;
    }

    // Convenção max{Field}: payload.field <= value
    if (key.length > 3 && key.startsWith("max") && /[A-Z]/.test(key[3]!)) {
      const payloadKey = key[3]!.toLowerCase() + key.slice(4);
      const payloadValue = payload[payloadKey];
      if (payloadValue === undefined) continue;
      if (typeof payloadValue !== "number" || typeof value !== "number") {
        continue;
      }
      if (payloadValue > value) return false;
      continue;
    }

    // Default: igualdade exata. statusId → toStatusId; tagId → tagId; etc.
    const payloadKey = key in payload ? key : `to${capitalize(key)}`;
    const payloadValue = payload[payloadKey];
    if (payloadValue === undefined) continue;
    if (payloadValue !== value) return false;
  }
  return true;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deriveAppKey(eventType: string): string {
  return eventType.split(".")[0] ?? "alerts";
}

function renderTitle(defaultLabel: string, _payload: unknown): string {
  // Por enquanto: usa label do catálogo. Fase futura: templates por regra.
  return defaultLabel;
}

function renderBody(description: string, _payload: unknown): string {
  return description;
}
