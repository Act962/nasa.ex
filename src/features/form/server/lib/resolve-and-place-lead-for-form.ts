import { Prisma } from "@/generated/prisma/client";
import {
  trackingToLeadData,
  type TrackingParams,
} from "@/lib/tracking/tracking-params";

// Coloca o lead no tracking/coluna configurados no formulário quando uma
// resposta é submetida. Regra (Mod 2): se a pessoa (mesmo telefone) já existe
// na org, realoca a MESMA linha de lead — move de coluna se já está no tracking
// do form, ou muda de tracking se está em outro — em vez de criar duplicata.

type Tx = Prisma.TransactionClient;

export type PlaceLeadOutcome = "created" | "moved" | "relocated" | "reused";

export type PlacedLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  publicToken: string | null;
  responsibleId: string | null;
};

export type PlaceLeadResult = {
  lead: PlacedLead;
  outcome: PlaceLeadOutcome;
  /** Posição anterior — presente em `moved`/`relocated`/`reused`. */
  from: { trackingId: string; statusId: string } | null;
  to: { trackingId: string; statusId: string };
};

const PLACED_LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  publicToken: true,
  responsibleId: true,
} satisfies Prisma.LeadSelect;

// Menor `order` = topo da coluna (board ordena por [statusId, order] asc).
async function computeTopOrder(
  tx: Tx,
  trackingId: string,
  statusId: string,
): Promise<Prisma.Decimal> {
  const top = await tx.lead.findFirst({
    where: { trackingId, statusId },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  return top ? Prisma.Decimal.sub(top.order, 1000) : new Prisma.Decimal(1000);
}

type ExistingLeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  publicToken: string | null;
  responsibleId: string | null;
  trackingId: string;
  statusId: string;
};

// Move/realoca uma linha de lead já conhecida para o tracking/coluna do form.
async function placeExistingLead(
  tx: Tx,
  existing: ExistingLeadRow,
  formTrackingId: string,
  formStatusId: string,
): Promise<PlaceLeadResult> {
  const from = { trackingId: existing.trackingId, statusId: existing.statusId };
  const to = { trackingId: formTrackingId, statusId: formStatusId };

  const alreadyInTarget =
    existing.trackingId === formTrackingId &&
    existing.statusId === formStatusId;

  if (alreadyInTarget) {
    return {
      lead: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        publicToken: existing.publicToken,
        responsibleId: existing.responsibleId,
      },
      outcome: "reused",
      from,
      to,
    };
  }

  const order = await computeTopOrder(tx, formTrackingId, formStatusId);
  const now = new Date();
  const updated = await tx.lead.update({
    where: { id: existing.id },
    data: {
      trackingId: formTrackingId,
      statusId: formStatusId,
      order,
      statusEnteredAt: now,
      lastStatusChangeAt: now,
    },
    select: PLACED_LEAD_SELECT,
  });

  return {
    lead: updated,
    outcome: existing.trackingId === formTrackingId ? "moved" : "relocated",
    from,
    to,
  };
}

export type ResolveAndPlaceLeadInput = {
  organizationId: string;
  phone: string | null;
  formTrackingId: string;
  formStatusId: string;
  leadData: { name: string; email: string | null; phone: string | null };
  trackingParams?: TrackingParams;
};

// Fluxo sem draft (submit direto): resolve o lead pelo telefone na org inteira e
// o posiciona no tracking/coluna do form — movendo/realocando o existente ou
// criando um novo.
export async function resolveAndPlaceLeadForForm(
  tx: Tx,
  input: ResolveAndPlaceLeadInput,
): Promise<PlaceLeadResult> {
  const { organizationId, phone, formTrackingId, formStatusId, leadData } =
    input;

  const existingRows = phone
    ? await tx.lead.findMany({
        where: { phone, tracking: { organizationId } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          publicToken: true,
          responsibleId: true,
          trackingId: true,
          statusId: true,
        },
      })
    : [];

  // Prefere a linha que já está no tracking do form (evita colisão de
  // unique(phone, trackingId) ao realocar outra linha pra esse tracking).
  const target =
    existingRows.find((row) => row.trackingId === formTrackingId) ??
    existingRows[0];

  if (target) {
    return placeExistingLead(tx, target, formTrackingId, formStatusId);
  }

  const created = await tx.lead.create({
    data: {
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      trackingId: formTrackingId,
      statusId: formStatusId,
      source: "FORM",
      statusEnteredAt: new Date(),
      ...trackingToLeadData(input.trackingParams),
    },
    select: PLACED_LEAD_SELECT,
  });

  return {
    lead: created,
    outcome: "created",
    from: null,
    to: { trackingId: formTrackingId, statusId: formStatusId },
  };
}

// Fluxo com draft (stepMode): o lead já foi resolvido no save-partial. Garante
// que ESSA linha específica termine no tracking/coluna do form ao finalizar.
export async function placeLeadInFormTarget(
  tx: Tx,
  leadId: string,
  formTrackingId: string,
  formStatusId: string,
): Promise<PlaceLeadResult | null> {
  const existing = await tx.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      publicToken: true,
      responsibleId: true,
      trackingId: true,
      statusId: true,
    },
  });
  if (!existing) return null;
  return placeExistingLead(tx, existing, formTrackingId, formStatusId);
}
