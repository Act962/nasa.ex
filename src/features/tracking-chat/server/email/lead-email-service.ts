import "server-only";
import prisma from "@/lib/prisma";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";
import {
  getGmailThread,
  listGmailThreads,
  sendGmailMessage,
  type GmailAddress,
  type GmailThreadMessage,
} from "@/http/gmail/threads";
import { GmailApiError } from "@/http/gmail/client";

/**
 * Canal E-mail do Tracking Chat (spec 0030): e-mails trocados entre a caixa
 * Gmail da organização e os leads do tracking, lidos direto do Gmail (D-1) e
 * respondidos pela mesma conta (D-2).
 */

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Leads consultados por vez — a busca do Gmail precisa caber numa consulta (RNF-4). */
const MAX_LEAD_EMAILS = 50;
const MAX_THREADS = 30;
const LOOKBACK_QUERY = "newer_than:90d";

export class LeadEmailError extends Error {
  constructor(
    message: string,
    readonly code:
      | "gmail_not_connected"
      | "gmail_reconnect"
      | "tracking_not_found"
      | "recipient_not_lead"
      | "thread_not_lead",
  ) {
    super(message);
    this.name = "LeadEmailError";
  }
}

interface TrackingLeadEmail {
  leadId: string;
  leadName: string;
  email: string;
}

async function assertTrackingInOrganization(trackingId: string, organizationId: string) {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true },
  });
  if (!tracking) {
    throw new LeadEmailError("Tracking não encontrado nesta organização.", "tracking_not_found");
  }
}

/** E-mails dos leads do tracking, do lead mais recente para o mais antigo (CB-2). */
async function loadTrackingLeadEmails(trackingId: string) {
  const leads = await prisma.lead.findMany({
    where: { trackingId, isArchived: false, email: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: MAX_LEAD_EMAILS + 1,
    select: { id: true, name: true, email: true },
  });

  const byEmail = new Map<string, TrackingLeadEmail>();
  for (const lead of leads.slice(0, MAX_LEAD_EMAILS)) {
    const email = lead.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || byEmail.has(email)) continue;
    byEmail.set(email, { leadId: lead.id, leadName: lead.name, email });
  }
  return { byEmail, isPartial: leads.length > MAX_LEAD_EMAILS };
}

async function resolveOrgGmailToken(
  organizationId: string,
  scope: string,
): Promise<{ accessToken: string; mailboxEmail: string | null }> {
  // Sem `userId`: o canal usa a caixa da empresa, não o Gmail de quem está logado.
  const token = await resolveGoogleAccessToken({ organizationId, requiredScope: scope });
  if (token.ok) {
    return { accessToken: token.accessToken, mailboxEmail: token.accountEmail?.toLowerCase() ?? null };
  }
  if (token.reason === "no_integration") {
    throw new LeadEmailError(
      "Conecte o Gmail da empresa para ver e responder e-mails aqui.",
      "gmail_not_connected",
    );
  }
  throw new LeadEmailError(
    scope === GMAIL_SEND_SCOPE
      ? "A conexão do Gmail não tem permissão de envio. Reconecte o Gmail em Integrações."
      : "A conexão do Gmail expirou. Reconecte o Gmail em Integrações.",
    "gmail_reconnect",
  );
}

/**
 * Lead com o mesmo endereço da caixa conectada casaria com TODAS as conversas
 * da caixa (a empresa participa de todas). Esse endereço nunca identifica lead.
 */
function withoutMailbox(
  byEmail: Map<string, TrackingLeadEmail>,
  mailboxEmail: string | null,
): Map<string, TrackingLeadEmail> {
  if (!mailboxEmail || !byEmail.has(mailboxEmail)) return byEmail;
  const filtered = new Map(byEmail);
  filtered.delete(mailboxEmail);
  return filtered;
}

/** Erro do Gmail 401/403 vira pedido de reconexão (CB-3), não 500. */
function translateGmailError(error: unknown): never {
  if (error instanceof GmailApiError && (error.status === 401 || error.status === 403)) {
    throw new LeadEmailError(
      "O Gmail recusou o acesso. Reconecte o Gmail em Integrações.",
      "gmail_reconnect",
    );
  }
  throw error;
}

function buildParticipantQuery(emails: string[]): string {
  const terms = emails.flatMap((email) => [`from:${email}`, `to:${email}`]);
  // `{a b}` no Gmail é OU.
  return `${LOOKBACK_QUERY} {${terms.join(" ")}}`;
}

function findLeadInAddresses(
  addresses: GmailAddress[],
  byEmail: Map<string, TrackingLeadEmail>,
): TrackingLeadEmail | null {
  for (const address of addresses) {
    const lead = byEmail.get(address.email);
    if (lead) return lead;
  }
  return null;
}

export async function listLeadEmailThreads(params: {
  organizationId: string;
  trackingId: string;
}) {
  await assertTrackingInOrganization(params.trackingId, params.organizationId);
  const loaded = await loadTrackingLeadEmails(params.trackingId);
  const { accessToken, mailboxEmail } = await resolveOrgGmailToken(
    params.organizationId,
    GMAIL_READONLY_SCOPE,
  );
  const byEmail = withoutMailbox(loaded.byEmail, mailboxEmail);
  const isPartial = loaded.isPartial;
  if (byEmail.size === 0) {
    return { threads: [], isPartial: false, hasLeadEmails: false, unansweredLeadCount: 0 };
  }

  const threads = await listGmailThreads({
    accessToken,
    query: buildParticipantQuery([...byEmail.keys()]),
    maxResults: MAX_THREADS,
  }).catch(translateGmailError);

  const leadThreads = threads
    .map((thread) => {
      const lead = findLeadInAddresses(thread.participants, byEmail);
      // Só conversa com lead do tracking entra (CA-4).
      if (!lead) return null;
      return {
        threadId: thread.threadId,
        subject: thread.subject,
        snippet: thread.snippet,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        messageCount: thread.messageCount,
        // Última mensagem é do lead: a empresa ainda não respondeu.
        isAwaitingReply: thread.lastFrom.email === lead.email,
        lead,
      };
    })
    .filter((thread): thread is NonNullable<typeof thread> => thread !== null)
    .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));

  // Conta leads, não conversas: dois e-mails do mesmo lead são um lead esperando.
  const unansweredLeadCount = new Set(
    leadThreads.filter((thread) => thread.isAwaitingReply).map((thread) => thread.lead.leadId),
  ).size;

  return { threads: leadThreads, isPartial, hasLeadEmails: true, unansweredLeadCount };
}

async function loadThreadWithLead(params: {
  organizationId: string;
  trackingId: string;
  threadId: string;
  scope: string;
}) {
  await assertTrackingInOrganization(params.trackingId, params.organizationId);
  const loaded = await loadTrackingLeadEmails(params.trackingId);
  const { accessToken, mailboxEmail } = await resolveOrgGmailToken(
    params.organizationId,
    params.scope,
  );
  const byEmail = withoutMailbox(loaded.byEmail, mailboxEmail);
  const messages = await getGmailThread({ accessToken, threadId: params.threadId }).catch(
    translateGmailError,
  );

  const lead = findLeadInAddresses(
    messages.flatMap((message) => [message.from, ...message.to]),
    byEmail,
  );
  if (!lead) {
    throw new LeadEmailError(
      "Esta conversa não envolve nenhum lead deste tracking.",
      "thread_not_lead",
    );
  }
  return { accessToken, messages, lead };
}

function serializeMessage(message: GmailThreadMessage, lead: TrackingLeadEmail) {
  return {
    id: message.id,
    from: message.from,
    to: message.to,
    subject: message.subject,
    sentAt: message.sentAt.toISOString(),
    bodyText: message.bodyText,
    isFromLead: message.from.email === lead.email,
  };
}

export async function getLeadEmailThread(params: {
  organizationId: string;
  trackingId: string;
  threadId: string;
}) {
  const { messages, lead } = await loadThreadWithLead({ ...params, scope: GMAIL_READONLY_SCOPE });
  return {
    threadId: params.threadId,
    lead,
    subject: messages[0]?.subject ?? "(sem assunto)",
    messages: messages.map((message) => serializeMessage(message, lead)),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBodies(title: string | undefined, body: string) {
  const trimmedTitle = title?.trim();
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const htmlBody = `${trimmedTitle ? `<h2 style="margin:0 0 12px">${escapeHtml(trimmedTitle)}</h2>` : ""}${paragraphs}`;
  const textBody = trimmedTitle ? `${trimmedTitle}\n\n${body.trim()}` : body.trim();
  return { htmlBody, textBody };
}

export async function sendLeadEmail(params: {
  organizationId: string;
  trackingId: string;
  to: string;
  subject: string;
  title?: string;
  body: string;
  threadId?: string;
}) {
  await assertTrackingInOrganization(params.trackingId, params.organizationId);
  const { byEmail } = await loadTrackingLeadEmails(params.trackingId);
  const recipient = byEmail.get(params.to.trim().toLowerCase());
  // O envio sai pela conta da empresa: só para lead do tracking (RNF-3, D-3).
  if (!recipient) {
    throw new LeadEmailError(
      "Só é possível enviar para o e-mail de um lead deste tracking.",
      "recipient_not_lead",
    );
  }

  let inReplyTo: string | undefined;
  let references: string | undefined;
  if (params.threadId) {
    const thread = await loadThreadWithLead({
      organizationId: params.organizationId,
      trackingId: params.trackingId,
      threadId: params.threadId,
      scope: GMAIL_READONLY_SCOPE,
    });
    const lastMessage = thread.messages[thread.messages.length - 1];
    inReplyTo = lastMessage?.rfcMessageId || undefined;
    references = lastMessage?.references || undefined;
  }

  const { accessToken } = await resolveOrgGmailToken(params.organizationId, GMAIL_SEND_SCOPE);
  const { htmlBody, textBody } = buildBodies(params.title, params.body);
  const sent = await sendGmailMessage({
    accessToken,
    to: { email: recipient.email, name: recipient.leadName },
    subject: params.subject,
    htmlBody,
    textBody,
    threadId: params.threadId,
    inReplyTo,
    references,
  }).catch(translateGmailError);

  return { messageId: sent.id, threadId: sent.threadId, lead: recipient };
}

/**
 * Estado da conexão Gmail da organização, para o ícone do canal E-mail ficar
 * colorido só quando há caixa conectada — sem ler nenhuma mensagem.
 */
export async function getOrgGmailStatus(organizationId: string) {
  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: "GMAIL", isActive: true },
    select: { config: true },
  });
  if (!integration) return { connected: false, canSend: false, mailboxEmail: null };

  const config = (integration.config ?? {}) as { scopes?: string | string[]; userEmail?: string };
  const scopes = Array.isArray(config.scopes)
    ? config.scopes
    : (config.scopes ?? "").split(/[\s,]+/);
  return {
    connected: scopes.includes(GMAIL_READONLY_SCOPE),
    canSend: scopes.includes(GMAIL_SEND_SCOPE),
    mailboxEmail: config.userEmail ?? null,
  };
}

/** Leads do tracking com e-mail — o seletor de destinatário do "novo e-mail". */
export async function listTrackingLeadsWithEmail(params: {
  organizationId: string;
  trackingId: string;
}) {
  await assertTrackingInOrganization(params.trackingId, params.organizationId);
  const { byEmail } = await loadTrackingLeadEmails(params.trackingId);
  return [...byEmail.values()];
}
