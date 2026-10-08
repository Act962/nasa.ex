import "server-only";
import { NasaPlannerPostSource, type NasaPlannerPostType } from "@/generated/prisma/enums";
import { registerProposalExecutor, type ProposalExecutionResult } from "@/features/astro/server/tools/_shared/proposals/types";
import { assertPostAccess, ensureDefaultPlanner } from "@/features/nasa-planner/server/cross-org";
import { schedulePlannerPost } from "@/features/nasa-planner/server/scheduling";
import {
  approveWithGroup,
  createPostsForInstagramAccounts,
  resolveInstagramAccountIdsByHandle,
  schedulePublishGroup,
  submitForApprovalWithGroup,
} from "@/features/nasa-planner/server/publish-group";
import { findDefaultInstagramAccountId } from "@/features/nasa-planner/server/publishing/instagram-channels";
import { PLANNER_APPROVE_ACTION_TYPE } from "@/features/nasa-planner/server/approval-whatsapp";
import { resolvePlannerOrganization } from "./planner-access";

/** Executores das propostas do Planner (spec 0063, RF-7): rodam só depois do "sim". */

export const PLANNER_ACTION_TYPES = {
  createDrafts: "planner.drafts.create",
  schedulePost: "planner.post.schedule",
} as const;

export interface CreateDraftsProposalPayload {
  organizationId: string;
  formats: NasaPlannerPostType[];
  title: string;
  script?: string;
  caption?: string;
  hashtags?: string[];
  intendedAtIso?: string;
  /** @ das contas do Instagram; com várias, o mesmo conteúdo sai em todas (spec 0074, RF-17). */
  instagramHandles?: string[];
}

export interface SchedulePostProposalPayload {
  postId: string;
  scheduledAtIso: string;
}

// Link completo: no WhatsApp só link absoluto é mostrado.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
const appLink = (path: string) => `${APP_ORIGIN}${path}`;
const CALENDAR_LINK = { label: "Abrir o Planner", href: appLink("/nasa-planner") };

registerProposalExecutor<CreateDraftsProposalPayload>(PLANNER_ACTION_TYPES.createDrafts, async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
  const access = await resolvePlannerOrganization(ctx, payload.organizationId, "create");
  if ("error" in access) return { ok: false, summary: access.error };
  const plannerId = await ensureDefaultPlanner(access.organizationId);
  const createdIds: string[] = [];
  let instagramAccountIds: string[];
  try {
    const defaultAccountId = await findDefaultInstagramAccountId(access.organizationId);
    instagramAccountIds = payload.instagramHandles?.length
      ? await resolveInstagramAccountIdsByHandle(access.organizationId, payload.instagramHandles)
      : defaultAccountId
        ? [defaultAccountId]
        : [];
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? error.message : "Não deu para achar as contas do Instagram." };
  }
  for (const format of payload.formats) {
    const [post] = await createPostsForInstagramAccounts(
      {
        organizationId: access.organizationId,
        plannerId,
        createdById: ctx.userId,
        type: format,
        status: "DRAFT",
        title: payload.title,
        script: payload.script,
        caption: payload.caption,
        hashtags: (payload.hashtags ?? []).map((hashtag) => hashtag.replace(/^#/, "")),
        scheduledAt: payload.intendedAtIso ? new Date(payload.intendedAtIso) : null,
        targetNetworks: ["INSTAGRAM"],
        source: NasaPlannerPostSource.ASTRO,
        sourceActorLabel: "Astro",
      },
      instagramAccountIds,
    );
    createdIds.push(post.id);
  }
  // Pelo WhatsApp o rascunho já segue para aprovação (spec 0064, RF-2): quem aprova recebe a prévia lá.
  const isFromWhatsapp = ctx.channel === "WHATSAPP";
  if (isFromWhatsapp) {
    for (const postId of createdIds) {
      await submitForApprovalWithGroup({ postId, actorId: ctx.userId }).catch((error: unknown) => console.warn("[astro/planner] envio para aprovação falhou", error));
    }
  }
  const createdLabel = createdIds.length > 1 ? `${createdIds.length} rascunhos criados no Planner` : "Rascunho criado no Planner";
  return {
    ok: true,
    summary: isFromWhatsapp ? `${createdLabel} e enviado para aprovação.` : `${createdLabel}.`,
    links: [{ label: "Abrir rascunho", href: appLink(`/nasa-planner?post=${createdIds[0]}`) }, CALENDAR_LINK],
    data: { postIds: createdIds },
  };
});

registerProposalExecutor<SchedulePostProposalPayload>(PLANNER_ACTION_TYPES.schedulePost, async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
  try {
    await assertPostAccess(ctx.userId, payload.postId, "schedule");
    await schedulePlannerPost(payload.postId, new Date(payload.scheduledAtIso));
    return { ok: true, summary: "Post programado.", links: [{ label: "Ver no calendário", href: appLink(`/nasa-planner?post=${payload.postId}`) }] };
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? error.message : "Não deu para programar." };
  }
});

/** "SIM" do aprovador no WhatsApp (spec 0064, RF-5): aprova e, se houver horário futuro, já programa. */
registerProposalExecutor<{ postId: string }>(PLANNER_APPROVE_ACTION_TYPE, async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
  try {
    const { post } = await assertPostAccess(ctx.userId, payload.postId, "approve");
    const scheduleAt = post.scheduledAt && post.scheduledAt.getTime() > Date.now() + 60_000 ? post.scheduledAt : undefined;
    await approveWithGroup({ postId: payload.postId, actorId: ctx.userId });
    // Programar é um segundo passo: post sem mídia é aprovado, mas não pode ser programado ainda.
    let scheduleProblem: string | null = null;
    if (scheduleAt) {
      await schedulePublishGroup({ postId: payload.postId, scheduledAt: scheduleAt }).catch((error: unknown) => {
        scheduleProblem = error instanceof Error ? error.message : "não deu para programar";
      });
    }
    const when = scheduleAt?.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const summary = !scheduleAt
      ? "Aprovado. Falta escolher o horário no Planner."
      : scheduleProblem
        ? `Aprovado. Não programei para ${when}: ${scheduleProblem}`
        : `Aprovado e programado para ${when}.`;
    return {
      ok: true,
      summary,
      links: [{ label: "Ver no Planner", href: appLink(`/nasa-planner?post=${payload.postId}`) }],
    };
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? error.message : "Não deu para aprovar." };
  }
});
