import type { Prisma } from "@/generated/prisma/client";
import {
  placeLeadInFormTarget,
  resolveAndPlaceLeadForForm,
} from "@/features/form/server/lib/resolve-and-place-lead-for-form";
import type { AppPrismaClient } from "@/lib/prisma";
import type { TrackingParams } from "@/lib/tracking/tracking-params";
import { tenantScope, type TenantScope } from "@/modules/shared/domain/tenant-scope";
import type { BoardPosition, LeadContact, LeadIdentity, LeadPlacement } from "../domain/submission";
import type {
  FormSubmissionRepository,
  PublishedForm,
  RecordedSubmission,
  SubmissionContent,
  SubmissionStore,
} from "../ports/form-submission-repository";

// As queries são as do handler de origem (`router/form/public/submut-response.ts`),
// transcritas sem reescrever. O posicionamento do lead continua no helper de
// `features/form`: pertence ao domínio de leads e não migra neste piloto.

const LEAD_CONTACT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  publicToken: true,
} satisfies Prisma.LeadSelect;

class PrismaSubmissionStore implements SubmissionStore {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async findPublishedForm(formId: string): Promise<{ form: PublishedForm; tenant: TenantScope } | null> {
    const form = await this.tx.form.findUnique({
      where: { id: formId, published: true },
      select: {
        userId: true,
        name: true,
        jsonBlock: true,
        organizationId: true,
        settings: {
          select: {
            trackingId: true,
            statusId: true,
            whatsappChats: true,
            whatsappMessage: true,
            generateActionsConfig: true,
          },
        },
      },
    });
    if (!form) return null;

    return {
      form: {
        id: formId,
        userId: form.userId,
        name: form.name,
        jsonBlock: form.jsonBlock,
        organizationId: form.organizationId,
        settings: form.settings
          ? {
              ...form.settings,
              whatsappChats: (form.settings.whatsappChats ?? []) as unknown[],
            }
          : null,
      },
      tenant: tenantScope(form.organizationId),
    };
  }

  async findExistingTagIds(tagIds: readonly string[]): Promise<string[]> {
    const tags = await this.tx.tag.findMany({
      where: { id: { in: [...tagIds] } },
      select: { id: true },
    });
    return tags.map((tag) => tag.id);
  }

  findOpenDraft(formId: string, responseId: string) {
    return this.tx.formResponses.findFirst({
      where: { id: responseId, formId, completedAt: null },
      select: { id: true, leadId: true },
    });
  }

  findLeadContact(leadId: string): Promise<LeadContact | null> {
    return this.tx.lead.findUnique({ where: { id: leadId }, select: LEAD_CONTACT_SELECT });
  }

  async attachTagsToLead(leadId: string, tagIds: readonly string[]): Promise<void> {
    await this.tx.leadTag.createMany({
      data: tagIds.map((tagId) => ({ leadId, tagId })),
      skipDuplicates: true,
    });
  }

  async attachTagToLeadIfExists(leadId: string, tagId: string): Promise<boolean> {
    const tag = await this.tx.tag.findUnique({ where: { id: tagId }, select: { id: true } });
    if (!tag) return false;

    await this.tx.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      create: { leadId, tagId },
      update: {},
    });
    return true;
  }

  placeKnownLead(leadId: string, target: BoardPosition): Promise<LeadPlacement | null> {
    return placeLeadInFormTarget(this.tx, leadId, target.trackingId, target.statusId);
  }

  resolveAndPlaceLead(
    tenant: TenantScope,
    input: { identity: LeadIdentity; target: BoardPosition; origin: unknown },
  ): Promise<LeadPlacement> {
    return resolveAndPlaceLeadForForm(this.tx, {
      organizationId: tenant.organizationId,
      phone: input.identity.phone,
      formTrackingId: input.target.trackingId,
      formStatusId: input.target.statusId,
      leadData: input.identity,
      trackingParams: input.origin as TrackingParams | undefined,
    });
  }

  async setLeadEmail(leadId: string, email: string): Promise<void> {
    await this.tx.lead.update({ where: { id: leadId }, data: { email } });
  }

  async findLeadPublicToken(leadId: string): Promise<string | null> {
    const lead = await this.tx.lead.findUnique({ where: { id: leadId }, select: { publicToken: true } });
    return lead?.publicToken ?? null;
  }

  async finalizeDraft(formId: string, draftId: string, content: SubmissionContent): Promise<RecordedSubmission> {
    await this.tx.formResponses.update({
      where: { id: draftId },
      data: {
        jsonResponse: content.jsonResponse,
        label: content.label,
        completedAt: content.completedAt,
      },
    });
    const form = await this.tx.form.findUnique({
      where: { id: formId },
      select: { responses: true, userId: true, organizationId: true },
    });

    return {
      responseId: draftId,
      label: content.label,
      responseCount: form?.responses ?? 0,
      formOwnerId: form?.userId ?? "",
      organizationId: form?.organizationId ?? "",
    };
  }

  async createSubmission(
    formId: string,
    content: SubmissionContent & { leadId: string | null },
  ): Promise<RecordedSubmission> {
    const form = await this.tx.form.update({
      where: { id: formId, published: true },
      data: {
        formSubmissions: {
          create: {
            jsonResponse: content.jsonResponse,
            ...(content.leadId && { leadId: content.leadId }),
            label: content.label,
            completedAt: content.completedAt,
            // Envio público: quem preencheu foi o próprio lead (spec 0005, D-2).
            authorKind: "LEAD",
          },
        },
        responses: { increment: 1 },
      },
      select: {
        responses: true,
        userId: true,
        organizationId: true,
        formSubmissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, label: true },
        },
      },
    });
    const createdResponse = form.formSubmissions[0];

    return {
      responseId: createdResponse?.id ?? null,
      label: createdResponse?.label ?? null,
      responseCount: form.responses,
      formOwnerId: form.userId,
      organizationId: form.organizationId,
    };
  }
}

export class PrismaFormSubmissionRepository implements FormSubmissionRepository {
  constructor(private readonly prisma: AppPrismaClient) {}

  async findCompletedSubmission(formId: string, responseId: string): Promise<{ lead: LeadContact | null } | null> {
    return this.prisma.formResponses.findFirst({
      where: { id: responseId, formId, completedAt: { not: null } },
      select: { lead: { select: LEAD_CONTACT_SELECT } },
    });
  }

  transaction<TResult>(work: (store: SubmissionStore) => Promise<TResult>): Promise<TResult> {
    return this.prisma.$transaction((tx) => work(new PrismaSubmissionStore(tx)));
  }
}
