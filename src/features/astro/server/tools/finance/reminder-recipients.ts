import "server-only";
import prisma from "@/lib/prisma";
import type { ReminderRecipient } from "@/features/payment/schemas/reminders";

// Resolve destinatários pedidos em linguagem natural (spec 0017, CA-1):
// contactId direto, nome casado em PaymentContact ou contato avulso com
// telefone/e-mail. Nome ambíguo nunca é escolhido pelo Astro.

const NAME_MATCH_LIMIT = 6;

export interface ReminderRecipientInput {
  contactId?: string;
  name?: string;
  phone?: string;
  email?: string;
}

interface RecipientCandidate {
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export type RecipientResolution =
  | { isResolved: true; recipients: ReminderRecipient[] }
  | { isResolved: false; error: string; candidates?: RecipientCandidate[] };

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function buildRecipient(contact: RecipientCandidate, input: ReminderRecipientInput): ReminderRecipient {
  return {
    contactId: contact.contactId,
    name: contact.name,
    phone: input.phone?.trim() || contact.phone || undefined,
    email: input.email?.trim() || contact.email || undefined,
  };
}

async function findContactsByName(organizationId: string, name: string): Promise<RecipientCandidate[]> {
  const contacts = await prisma.paymentContact.findMany({
    where: { organizationId, isActive: true, name: { contains: name.trim(), mode: "insensitive" } },
    select: { id: true, name: true, phone: true, email: true },
    orderBy: { name: "asc" },
    take: NAME_MATCH_LIMIT,
  });
  return contacts.map((contact) => ({
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
  }));
}

async function resolveSingleRecipient(
  organizationId: string,
  input: ReminderRecipientInput,
): Promise<{ recipient: ReminderRecipient } | { error: string; candidates?: RecipientCandidate[] }> {
  if (input.contactId) {
    const contact = await prisma.paymentContact.findFirst({
      where: { id: input.contactId, organizationId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!contact) return { error: `contactId "${input.contactId}" não é um contato desta organização.` };
    return {
      recipient: buildRecipient(
        { contactId: contact.id, name: contact.name, phone: contact.phone, email: contact.email },
        input,
      ),
    };
  }

  const requestedName = input.name?.trim();
  if (!requestedName) {
    if (input.phone || input.email) {
      return { recipient: { name: input.phone ?? input.email ?? "Destinatário", phone: input.phone, email: input.email } };
    }
    return { error: "Cada destinatário precisa de contactId, nome, telefone ou e-mail." };
  }

  const candidates = await findContactsByName(organizationId, requestedName);
  const exactMatches = candidates.filter(
    (candidate) => normalizeName(candidate.name) === normalizeName(requestedName),
  );
  const chosen = exactMatches.length === 1 ? exactMatches[0] : candidates.length === 1 ? candidates[0] : null;
  if (chosen) return { recipient: buildRecipient(chosen, input) };

  if (candidates.length > 1) {
    return {
      error: `Encontrei ${candidates.length} contatos para "${requestedName}". Pergunte ao usuário qual deles e chame de novo com o contactId escolhido.`,
      candidates,
    };
  }

  if (input.phone || input.email) {
    return { recipient: { name: requestedName, phone: input.phone, email: input.email } };
  }
  return {
    error: `Não achei "${requestedName}" nos contatos do financeiro. Peça o telefone ou e-mail ao usuário (ou o nome exato do contato).`,
  };
}

export async function resolveReminderRecipients(
  organizationId: string,
  inputs: ReminderRecipientInput[],
): Promise<RecipientResolution> {
  const recipients: ReminderRecipient[] = [];
  for (const input of inputs) {
    const resolution = await resolveSingleRecipient(organizationId, input);
    if ("error" in resolution) {
      return { isResolved: false, error: resolution.error, candidates: resolution.candidates };
    }
    const isDuplicate = recipients.some(
      (recipient) =>
        (recipient.contactId && recipient.contactId === resolution.recipient.contactId) ||
        (recipient.phone && recipient.phone === resolution.recipient.phone && recipient.email === resolution.recipient.email),
    );
    if (!isDuplicate) recipients.push(resolution.recipient);
  }
  return { isResolved: true, recipients };
}
