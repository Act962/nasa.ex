import "server-only";
import prisma from "@/lib/prisma";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";
import { publishLeadCreated } from "@/features/leads/realtime/publish";
import { gmailFetch } from "@/http/gmail/client";
import { listGmailMessages } from "@/http/gmail/list-messages";
import { parseAddress } from "@/http/gmail/threads";

// E-mail de remetente novo vira lead no funil escolhido (spec 0045). Sem estado de leitura:
// janela de 24 h + "o e-mail já está num lead da empresa" deduplica (D-1).

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const NEW_SENDERS_QUERY = "in:inbox category:primary newer_than:1d -from:me";
const MAX_MESSAGES_PER_RUN = 50;
const AUTOMATED_SENDER_PATTERN = /(no-?reply|mailer-daemon|postmaster|notifications?|bounce)/i;

type EmailLeadCaptureConfig = { trackingId: string | null };

type GmailMetadataMessage = { payload?: { headers?: { name: string; value: string }[] } };

async function findGmailIntegration(organizationId: string) {
  return prisma.platformIntegration.findFirst({
    where: { organizationId, platform: "GMAIL", isActive: true },
    select: { id: true, config: true },
  });
}

function readCaptureConfig(config: unknown): EmailLeadCaptureConfig {
  const capture = (config as { emailLeadCapture?: { trackingId?: unknown } } | null)?.emailLeadCapture;
  return { trackingId: typeof capture?.trackingId === "string" ? capture.trackingId : null };
}

export async function getEmailLeadCapture(organizationId: string): Promise<EmailLeadCaptureConfig> {
  const integration = await findGmailIntegration(organizationId);
  return readCaptureConfig(integration?.config ?? null);
}

/** Liga (trackingId) ou desliga (null). Lê o config na hora e mescla: o refresh do token grava no mesmo JSON (D-2). */
export async function setEmailLeadCapture(organizationId: string, trackingId: string | null) {
  const integration = await findGmailIntegration(organizationId);
  if (!integration) throw new Error("gmail_not_connected");
  const currentConfig = (integration.config ?? {}) as Record<string, unknown>;
  await prisma.platformIntegration.update({
    where: { id: integration.id },
    data: { config: { ...currentConfig, emailLeadCapture: { trackingId } } as object },
  });
}

async function resolveEntryStatusId(trackingId: string) {
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return firstStatus?.id ?? null;
}

async function readSender(accessToken: string, messageId: string) {
  const message = await gmailFetch<GmailMetadataMessage>(`/messages/${encodeURIComponent(messageId)}`, {
    accessToken,
    searchParams: { format: "metadata", metadataHeaders: "From" },
  });
  const fromHeader = message.payload?.headers?.find((header) => header.name.toLowerCase() === "from")?.value ?? "";
  return parseAddress(fromHeader);
}

export async function captureNewEmailSenders(organizationId: string) {
  const integration = await findGmailIntegration(organizationId);
  const { trackingId } = readCaptureConfig(integration?.config ?? null);
  if (!integration || !trackingId) return { created: 0, reason: "disabled" as const };

  const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
  const statusId = tracking ? await resolveEntryStatusId(tracking.id) : null;
  if (!tracking || !statusId) return { created: 0, reason: "tracking_unavailable" as const };

  const token = await resolveGoogleAccessToken({ organizationId, requiredScope: GMAIL_READONLY_SCOPE });
  if (!token.ok) return { created: 0, reason: "gmail_unavailable" as const };
  const mailboxEmail = token.accountEmail?.toLowerCase() ?? null;

  const messages = await listGmailMessages({
    accessToken: token.accessToken,
    query: NEW_SENDERS_QUERY,
    maxResults: MAX_MESSAGES_PER_RUN,
  });

  const handledEmails = new Set<string>();
  let createdCount = 0;
  for (const messageRef of messages) {
    const sender = await readSender(token.accessToken, messageRef.id).catch(() => null);
    const email = sender?.email?.trim().toLowerCase();
    if (!email || handledEmails.has(email)) continue;
    handledEmails.add(email);
    if (email === mailboxEmail || AUTOMATED_SENDER_PATTERN.test(email)) continue;

    const existingLead = await prisma.lead.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, tracking: { organizationId } },
      select: { id: true },
    });
    if (existingLead) continue;

    const topOfColumn = await prisma.lead.findFirst({ where: { statusId }, orderBy: { order: "asc" }, select: { order: true } });
    const lead = await prisma.lead.create({
      data: {
        name: sender?.name?.trim() || email,
        email,
        source: "GMAIL",
        trackingId: tracking.id,
        statusId,
        order: topOfColumn ? Number(topOfColumn.order) - 1 : 0,
        statusEnteredAt: new Date(),
      },
      select: { id: true },
    });
    createdCount += 1;
    await publishLeadCreated({ leadId: lead.id, trackingId: tracking.id, statusId }).catch((error) =>
      console.error("[email-lead-capture] publish_failed", error),
    );
  }
  return { created: createdCount, reason: "ok" as const };
}

/** Empresas com a captura ligada — o cron roda uma a uma. */
export async function listOrganizationsWithEmailLeadCapture(): Promise<string[]> {
  const integrations = await prisma.platformIntegration.findMany({
    where: { platform: "GMAIL", isActive: true },
    select: { organizationId: true, config: true },
  });
  return integrations
    .filter((integration) => readCaptureConfig(integration.config).trackingId)
    .map((integration) => integration.organizationId);
}
