import "server-only";
import prisma from "@/lib/prisma";
import { canAstroRead } from "@/features/astro/actions/permission-gate";
import { TrackingProviderBotChannel } from "@/features/astro-bot/lib/tracking-provider-channel";
import { MENU_ROOT_ID } from "@/features/astro-bot/lib/menu/menu-tree";
import { startOfBrazilDay } from "@/features/form-records/lib/next-due-window";

// Avisos das fichas no WhatsApp do prestador (spec 0081, parte C): resumo do dia na hora escolhida
// e lista do que vence em N dias. Cada pessoa liga o seu; vai para o número dela liberado no ASTRO.

export const RECORDS_DAILY_NOTICE = "RECORDS_DAILY";
export const RECORDS_DUE_SOON_NOTICE = "RECORDS_DUE_SOON";
export const DEFAULT_DAILY_HOUR = 7;
export const DEFAULT_DAYS_BEFORE = 3;
export const MAX_DAYS_BEFORE = 30;

const DAY_MS = 24 * 60 * 60_000;
const BRAZIL_OFFSET_MS = 3 * 60 * 60_000;
const MAX_LINES = 20;
/** Sem resumo do dia ligado, o aviso de prazo sai a esta hora. */
const DUE_SOON_FALLBACK_HOUR = 8;

export interface NoticeParams {
  /** Hora de Brasília (0–23) do resumo do dia. */
  hour?: number;
  daysBefore?: number;
  /** Dia de Brasília ("2026-10-09") do último envio ou da última checagem sem nada a enviar. */
  lastRunOn?: string;
  /** Motivo do último envio que falhou, para a tela explicar. */
  lastError?: string | null;
}

export function readNoticeParams(rawParams: unknown): NoticeParams {
  const params = (rawParams ?? {}) as Record<string, unknown>;
  const toInteger = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : undefined);
  return {
    hour: toInteger(params.hour),
    daysBefore: toInteger(params.daysBefore),
    lastRunOn: typeof params.lastRunOn === "string" ? params.lastRunOn : undefined,
    lastError: typeof params.lastError === "string" ? params.lastError : null,
  };
}

function brazilDayKey(now: Date): string {
  return new Date(now.getTime() - BRAZIL_OFFSET_MS).toISOString().slice(0, 10);
}

function brazilHour(now: Date): number {
  return new Date(now.getTime() - BRAZIL_OFFSET_MS).getUTCHours();
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

/** Número e tracking por onde o aviso sai: o número liberado da pessoa e um funil habilitado para o ASTRO. */
export async function resolveNoticeChannel(params: { userId: string; organizationId: string }) {
  const binding = await prisma.userWhatsappBinding.findFirst({
    where: { userId: params.userId, organizationId: params.organizationId, isActive: true, botConfig: { isActive: true } },
    select: { phoneE164: true, organizationBotConfigId: true },
  });
  if (!binding) return null;
  const enabledTracking = await prisma.astroBotTracking.findFirst({
    where: { botConfigId: binding.organizationBotConfigId, tracking: { isArchived: false } },
    orderBy: { createdAt: "asc" },
    select: { trackingId: true },
  });
  return enabledTracking ? { phone: binding.phoneE164, trackingId: enabledTracking.trackingId } : null;
}

interface DueRecordLine {
  clientName: string;
  label: string;
  nextDueAt: Date;
}

async function listDueRecords(organizationId: string, window: { gte?: Date; lt: Date }): Promise<{ total: number; lines: DueRecordLine[] }> {
  const where = { organizationId, nextDueAt: window };
  const [total, records] = await Promise.all([
    prisma.formRecord.count({ where }),
    prisma.formRecord.findMany({
      where,
      orderBy: { nextDueAt: "asc" },
      take: MAX_LINES,
      select: { leadId: true, label: true, nextDueAt: true, form: { select: { name: true } } },
    }),
  ]);
  const leadIds = [...new Set(records.map((record) => record.leadId).filter((leadId): leadId is string => Boolean(leadId)))];
  const leads =
    leadIds.length > 0
      ? await prisma.lead.findMany({ where: { id: { in: leadIds }, tracking: { organizationId } }, select: { id: true, name: true } })
      : [];
  const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));
  return {
    total,
    lines: records.map((record) => ({
      clientName: record.leadId ? (leadNameById.get(record.leadId) ?? "Cliente removido") : "Sem cliente",
      label: record.label ? `${record.form.name} · ${record.label}` : record.form.name,
      nextDueAt: record.nextDueAt!,
    })),
  };
}

function toBullets(lines: DueRecordLine[], describe: (line: DueRecordLine) => string, total: number): string {
  const bullets = lines.map((line) => `• ${line.clientName} — ${line.label} — ${describe(line)}`).join("\n");
  return total > lines.length ? `${bullets}\n_e mais ${total - lines.length}_` : bullets;
}

/** Texto do resumo do dia, ou `null` quando não há nada previsto nem vencido. */
export async function buildDailyRecordsMessage(organizationId: string, now = new Date()): Promise<string | null> {
  const today = startOfBrazilDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const [plannedToday, overdue] = await Promise.all([
    listDueRecords(organizationId, { gte: today, lt: tomorrow }),
    listDueRecords(organizationId, { lt: today }),
  ]);
  if (plannedToday.total === 0 && overdue.total === 0) return null;
  const plannedLabel = `${plannedToday.total} ${plannedToday.total === 1 ? "prevista" : "previstas"}`;
  const overdueLabel = overdue.total > 0 ? ` e ${overdue.total} ${overdue.total === 1 ? "vencida" : "vencidas"}` : "";
  const sections = [
    plannedToday.total > 0 ? toBullets(plannedToday.lines, () => "hoje", plannedToday.total) : null,
    overdue.total > 0
      ? toBullets(
          overdue.lines,
          (line) => {
            const daysLate = Math.max(1, Math.round((today.getTime() - startOfBrazilDay(line.nextDueAt).getTime()) / DAY_MS));
            return daysLate === 1 ? "venceu ontem" : `venceu há ${daysLate} dias`;
          },
          overdue.total,
        )
      : null,
  ].filter(Boolean);
  return `📋 *Fichas de hoje*\n${plannedLabel}${overdueLabel}\n\n${sections.join("\n")}`;
}

/** Texto do aviso de prazo, ou `null` quando nada vence daqui a `daysBefore` dias. */
export async function buildDueSoonMessage(organizationId: string, daysBefore: number, now = new Date()): Promise<string | null> {
  const dueDay = new Date(startOfBrazilDay(now).getTime() + daysBefore * DAY_MS);
  const dueSoon = await listDueRecords(organizationId, { gte: dueDay, lt: new Date(dueDay.getTime() + DAY_MS) });
  if (dueSoon.total === 0) return null;
  const title = daysBefore === 1 ? "Vencem amanhã" : `Vencem em ${daysBefore} dias`;
  return `⏰ *${title}*\n\n${toBullets(dueSoon.lines, (line) => formatDay(line.nextDueAt), dueSoon.total)}`;
}

/**
 * Envia os avisos que estão na hora. Roda de 15 em 15 minutos: cada aviso sai uma vez por dia por
 * pessoa, porque o dia é marcado ANTES do envio — reinício ou repetição do agendador não duplica.
 */
export async function sendDueRecordNotices(now = new Date()): Promise<{ checked: number; sent: number; failed: number }> {
  const preferences = await prisma.userNotificationPreference.findMany({
    where: { notifType: { in: [RECORDS_DAILY_NOTICE, RECORDS_DUE_SOON_NOTICE] }, whatsApp: true },
    select: { id: true, userId: true, organizationId: true, notifType: true, params: true },
  });
  const dayKey = brazilDayKey(now);
  const currentHour = brazilHour(now);
  let sent = 0;
  let failed = 0;

  for (const preference of preferences) {
    const params = readNoticeParams(preference.params);
    if (params.lastRunOn === dayKey) continue;

    const isDaily = preference.notifType === RECORDS_DAILY_NOTICE;
    // O aviso de prazo acompanha a hora do resumo do dia da mesma pessoa; sem ele, sai às 8h.
    const dailyOfSameUser = preferences.find(
      (other) => other.notifType === RECORDS_DAILY_NOTICE && other.userId === preference.userId && other.organizationId === preference.organizationId,
    );
    const sendHour = isDaily
      ? (params.hour ?? DEFAULT_DAILY_HOUR)
      : (readNoticeParams(dailyOfSameUser?.params).hour ?? DUE_SOON_FALLBACK_HOUR);
    if (currentHour < sendHour) continue;

    const markRun = (lastError: string | null) =>
      prisma.userNotificationPreference.update({
        where: { id: preference.id },
        data: { params: { ...params, lastRunOn: dayKey, lastError } },
      });
    await markRun(null);

    try {
      const ctx = { userId: preference.userId, organizationId: preference.organizationId, restrictToOrgId: preference.organizationId, route: {} };
      if (!(await canAstroRead(ctx as never, "formularios"))) continue;
      const channel = await resolveNoticeChannel({ userId: preference.userId, organizationId: preference.organizationId });
      if (!channel) {
        await markRun("Sem número liberado no ASTRO.");
        continue;
      }
      const message = isDaily
        ? await buildDailyRecordsMessage(preference.organizationId, now)
        : await buildDueSoonMessage(preference.organizationId, params.daysBefore ?? DEFAULT_DAYS_BEFORE, now);
      if (!message) continue;
      await new TrackingProviderBotChannel(channel.trackingId).sendButtons(channel.phone, {
        bodyText: message,
        buttons: [{ id: MENU_ROOT_ID, text: "Menu", interactiveOnly: true }],
      });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      console.error("[form-records/notices] envio falhou", { preferenceId: preference.id, sendError });
      // Na API oficial, fora da janela de 24h só sai template: a tela mostra o motivo.
      await markRun(sendError instanceof Error ? sendError.message.slice(0, 200) : "Falha no envio.").catch(() => undefined);
    }
  }
  return { checked: preferences.length, sent, failed };
}

export interface RecordNoticeSettings {
  boundPhone: string | null;
  daily: { isOn: boolean; hour: number; lastError: string | null };
  dueSoon: { isOn: boolean; daysBefore: number; lastError: string | null };
}

export async function getRecordNoticeSettings(params: { userId: string; organizationId: string }): Promise<RecordNoticeSettings> {
  const [preferences, channel] = await Promise.all([
    prisma.userNotificationPreference.findMany({
      where: { userId: params.userId, organizationId: params.organizationId, notifType: { in: [RECORDS_DAILY_NOTICE, RECORDS_DUE_SOON_NOTICE] } },
      select: { notifType: true, whatsApp: true, params: true },
    }),
    resolveNoticeChannel(params),
  ]);
  const daily = preferences.find((preference) => preference.notifType === RECORDS_DAILY_NOTICE);
  const dueSoon = preferences.find((preference) => preference.notifType === RECORDS_DUE_SOON_NOTICE);
  const dailyParams = readNoticeParams(daily?.params);
  const dueSoonParams = readNoticeParams(dueSoon?.params);
  return {
    boundPhone: channel?.phone ?? null,
    daily: { isOn: daily?.whatsApp ?? false, hour: dailyParams.hour ?? DEFAULT_DAILY_HOUR, lastError: dailyParams.lastError ?? null },
    dueSoon: { isOn: dueSoon?.whatsApp ?? false, daysBefore: dueSoonParams.daysBefore ?? DEFAULT_DAYS_BEFORE, lastError: dueSoonParams.lastError ?? null },
  };
}

/** Liga, desliga ou ajusta um aviso. Mudar a hora ou os dias libera um novo envio no mesmo dia. */
export async function saveRecordNotice(params: {
  userId: string;
  organizationId: string;
  notifType: typeof RECORDS_DAILY_NOTICE | typeof RECORDS_DUE_SOON_NOTICE;
  isOn: boolean;
  hour?: number;
  daysBefore?: number;
}): Promise<void> {
  const key = { userId: params.userId, organizationId: params.organizationId, notifType: params.notifType };
  const existing = await prisma.userNotificationPreference.findUnique({ where: { userId_organizationId_notifType: key }, select: { params: true } });
  const previous = readNoticeParams(existing?.params);
  const nextParams = { hour: params.hour ?? previous.hour, daysBefore: params.daysBefore ?? previous.daysBefore };
  const cleanParams = Object.fromEntries(Object.entries(nextParams).filter(([, value]) => value !== undefined));
  await prisma.userNotificationPreference.upsert({
    where: { userId_organizationId_notifType: key },
    create: { ...key, inApp: false, whatsApp: params.isOn, params: cleanParams },
    update: { whatsApp: params.isOn, params: cleanParams },
  });
}
