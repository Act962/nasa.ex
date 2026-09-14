import "server-only";
import prisma from "@/lib/prisma";
import {
  briefingResponseLabel,
  buildBriefingAnswers,
  type BriefingAnswerSource,
} from "@/features/trafego/lib/briefing-form-spec";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * As respostas do wizard viram uma resposta do formulário "Briefing TrafeGO"
 * no card do lead — é o ícone de formulário que o gestor abre no tracking.
 *
 * `authorKind: LEAD` porque foi o cliente quem respondeu; `SYSTEM` significa
 * "criada em branco por automação". Não passa pela procedure
 * `form.createResponseForLead` (exige participante e cobra Stars).
 */

async function loadBriefingForm() {
  const settings = await loadTrafegoSettings();
  if (!settings.briefingFormId) return null;
  return prisma.form.findUnique({
    where: { id: settings.briefingFormId },
    select: { id: true, organizationId: true },
  });
}

async function leadBelongsToOrganization(leadId: string, organizationId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true },
  });
  return Boolean(lead);
}

async function writeBriefingResponse(params: {
  formId: string;
  leadId: string;
  existingResponseId: string | null;
  source: BriefingAnswerSource;
}): Promise<string> {
  const jsonResponse = JSON.stringify(buildBriefingAnswers(params.source));
  const label = briefingResponseLabel(params.source);
  const now = new Date();

  if (params.existingResponseId) {
    const existing = await prisma.formResponses.findFirst({
      where: { id: params.existingResponseId, formId: params.formId },
      select: { id: true, labelManuallyEdited: true },
    });
    if (existing) {
      await prisma.formResponses.update({
        where: { id: existing.id },
        data: {
          jsonResponse,
          leadId: params.leadId,
          completedAt: now,
          ...(existing.labelManuallyEdited ? {} : { label }),
        },
      });
      return existing.id;
    }
  }

  const created = await prisma.formResponses.create({
    data: {
      formId: params.formId,
      leadId: params.leadId,
      jsonResponse,
      label,
      labelManuallyEdited: false,
      completedAt: now,
      authorKind: "LEAD",
    },
    select: { id: true },
  });
  await prisma.form.update({
    where: { id: params.formId },
    data: { responses: { increment: 1 } },
  });
  return created.id;
}

const asText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Cria a resposta assim que a compra pendente (e o card) existem. */
export async function createBriefingResponseForPending(pendingId: string): Promise<string | null> {
  const form = await loadBriefingForm();
  if (!form) return null;

  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { id: pendingId },
    select: {
      id: true,
      email: true,
      phone: true,
      companyName: true,
      briefing: true,
      platform: true,
      campaignType: true,
      objective: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      setupFeeBrlCents: true,
      amountBrlCents: true,
      hasBusinessManager: true,
      phoneVerifiedAt: true,
      socialHandle: true,
      socialProfile: true,
      hasOfficialNumber: true,
      officialNumber: true,
      officialNumberCheck: true,
      leadId: true,
      briefingResponseId: true,
    },
  });
  if (!pending?.leadId) return null;
  if (!(await leadBelongsToOrganization(pending.leadId, form.organizationId))) return null;

  const briefing = (pending.briefing ?? {}) as Record<string, unknown>;
  const businessName = asText(briefing.businessName) ?? pending.companyName;

  const responseId = await writeBriefingResponse({
    formId: form.id,
    leadId: pending.leadId,
    existingResponseId: pending.briefingResponseId,
    source: {
      businessName,
      businessNiche: asText(briefing.businessNiche),
      platform: pending.platform,
      campaignType: pending.campaignType,
      objective: pending.objective,
      targetAudience: asText(briefing.targetAudience),
      destinationUrl: asText(briefing.destinationUrl),
      whatsappNumber: asText(briefing.whatsappNumber) ?? pending.phone,
      adBudgetBrlCents: pending.adBudgetBrlCents,
      serviceFeeBrlCents: pending.serviceFeeBrlCents,
      setupFeeBrlCents: pending.setupFeeBrlCents,
      totalBrlCents: pending.amountBrlCents,
      hasBusinessManager: pending.hasBusinessManager,
      phoneVerifiedAt: pending.phoneVerifiedAt,
      socialHandle: pending.socialHandle,
      socialProfile: pending.socialProfile,
      hasOfficialNumber: pending.hasOfficialNumber,
      officialNumber: pending.officialNumber,
      officialNumberCheck: pending.officialNumberCheck,
      notes: asText(briefing.notes),
      contact: { name: businessName, email: pending.email, phone: pending.phone },
    },
  });

  if (responseId !== pending.briefingResponseId) {
    await prisma.trafegoPendingPurchase.update({
      where: { id: pending.id },
      data: { briefingResponseId: responseId },
    });
  }
  return responseId;
}

/**
 * Reescreve a resposta com os dados do pedido (código, briefing editado no
 * painel). Chamado quando o pedido nasce e sempre que o briefing muda.
 */
export async function upsertBriefingResponseForOrder(orderId: string): Promise<string | null> {
  const form = await loadBriefingForm();
  if (!form) return null;

  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      leadId: true,
      businessName: true,
      businessNiche: true,
      platform: true,
      campaignType: true,
      objective: true,
      targetAudience: true,
      destinationUrl: true,
      whatsappNumber: true,
      notes: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      setupFeeBrlCents: true,
      totalBrlCents: true,
      hasBusinessManager: true,
      phoneVerifiedAt: true,
      socialHandle: true,
      socialProfile: true,
      hasOfficialNumber: true,
      officialNumber: true,
      officialNumberCheck: true,
      owner: { select: { name: true, email: true, phone: true } },
      pendingPurchase: { select: { id: true, phone: true, briefingResponseId: true } },
    },
  });
  if (!order?.leadId) return null;
  if (!(await leadBelongsToOrganization(order.leadId, form.organizationId))) return null;

  const existingResponseId =
    order.pendingPurchase?.briefingResponseId ??
    (
      await prisma.formResponses.findFirst({
        where: { formId: form.id, leadId: order.leadId, label: { startsWith: order.code } },
        select: { id: true },
      })
    )?.id ??
    null;

  const responseId = await writeBriefingResponse({
    formId: form.id,
    leadId: order.leadId,
    existingResponseId,
    source: {
      orderCode: order.code,
      businessName: order.businessName,
      businessNiche: order.businessNiche,
      platform: order.platform,
      campaignType: order.campaignType,
      objective: order.objective,
      targetAudience: order.targetAudience,
      destinationUrl: order.destinationUrl,
      whatsappNumber: order.whatsappNumber,
      adBudgetBrlCents: order.adBudgetBrlCents,
      serviceFeeBrlCents: order.serviceFeeBrlCents,
      setupFeeBrlCents: order.setupFeeBrlCents,
      totalBrlCents: order.totalBrlCents,
      hasBusinessManager: order.hasBusinessManager,
      phoneVerifiedAt: order.phoneVerifiedAt,
      socialHandle: order.socialHandle,
      socialProfile: order.socialProfile,
      hasOfficialNumber: order.hasOfficialNumber,
      officialNumber: order.officialNumber,
      officialNumberCheck: order.officialNumberCheck,
      notes: order.notes,
      contact: {
        name: order.owner.name,
        email: order.owner.email,
        phone: order.pendingPurchase?.phone ?? order.owner.phone,
      },
    },
  });

  if (order.pendingPurchase && responseId !== order.pendingPurchase.briefingResponseId) {
    await prisma.trafegoPendingPurchase.update({
      where: { id: order.pendingPurchase.id },
      data: { briefingResponseId: responseId },
    });
  }
  return responseId;
}
