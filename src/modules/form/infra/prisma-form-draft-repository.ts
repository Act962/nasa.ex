import type { AppPrismaClient } from "@/lib/prisma";
import { trackingToLeadData, type TrackingParams } from "@/lib/tracking/tracking-params";
import { tenantScope, type TenantScope } from "@/modules/shared/domain/tenant-scope";
import type { BoardPosition, LeadIdentity } from "../domain/submission";
import type { DraftForm, FormDraftRepository, OpenDraft } from "../ports/form-draft-repository";

// Queries transcritas de `router/form/public/save-partial-response.ts`.

export class PrismaFormDraftRepository implements FormDraftRepository {
  constructor(private readonly prisma: AppPrismaClient) {}

  async findOpenDraft(formId: string, responseId: string): Promise<OpenDraft | null> {
    const draft = await this.prisma.formResponses.findFirst({
      where: { id: responseId, formId, completedAt: null },
      select: { id: true, leadId: true, labelManuallyEdited: true, form: { select: { jsonBlock: true } } },
    });
    if (!draft) return null;

    return {
      id: draft.id,
      leadId: draft.leadId,
      labelManuallyEdited: draft.labelManuallyEdited,
      formJsonBlock: draft.form.jsonBlock,
    };
  }

  async updateDraft(draftId: string, changes: { jsonResponse: string; label?: string | null }): Promise<void> {
    await this.prisma.formResponses.update({ where: { id: draftId }, data: changes });
  }

  async findPublishedForm(formId: string): Promise<{ form: DraftForm; tenant: TenantScope } | null> {
    const form = await this.prisma.form.findUnique({
      where: { id: formId, published: true },
      select: {
        id: true,
        jsonBlock: true,
        organizationId: true,
        settings: { select: { trackingId: true, statusId: true } },
      },
    });
    if (!form) return null;

    const { trackingId, statusId } = form.settings ?? {};
    return {
      form: {
        id: form.id,
        jsonBlock: form.jsonBlock,
        target: trackingId && statusId ? { trackingId, statusId } : null,
      },
      tenant: tenantScope(form.organizationId),
    };
  }

  async findLeadIdByPhone(tenant: TenantScope, phone: string, trackingId: string): Promise<string | null> {
    const inFormTracking = await this.prisma.lead.findUnique({
      where: { phone_trackingId: { phone, trackingId } },
      select: { id: true },
    });
    if (inFormTracking) return inFormTracking.id;

    const anyInOrganization = await this.prisma.lead.findFirst({
      where: { phone, tracking: { organizationId: tenant.organizationId } },
      select: { id: true },
    });
    return anyInOrganization?.id ?? null;
  }

  async createLead(input: { identity: LeadIdentity; target: BoardPosition; origin: unknown }): Promise<string> {
    const lead = await this.prisma.lead.create({
      data: {
        name: input.identity.name,
        email: input.identity.email,
        phone: input.identity.phone,
        trackingId: input.target.trackingId,
        statusId: input.target.statusId,
        source: "FORM",
        ...trackingToLeadData(input.origin as TrackingParams | undefined),
      },
      select: { id: true },
    });
    return lead.id;
  }

  createDraft(
    formId: string,
    content: { jsonResponse: string; leadId: string | null; label: string | null },
  ): Promise<{ id: string; leadId: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.formResponses.create({
        data: {
          jsonResponse: content.jsonResponse,
          formId,
          ...(content.leadId && { leadId: content.leadId }),
          label: content.label,
          labelManuallyEdited: false,
          // Rascunho público: preenchido pelo lead (spec 0005, D-2).
          authorKind: "LEAD",
        },
        select: { id: true, leadId: true },
      });
      await tx.form.update({ where: { id: formId }, data: { responses: { increment: 1 } } });
      return draft;
    });
  }
}
