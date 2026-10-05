import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { addDays, startOfDay } from "date-fns";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { getBrandKit } from "@/features/nasa-planner/server/brand-kit/brand-kit";
import { getPlannerPostMetrics } from "@/features/nasa-planner/server/publishing/post-metrics";
import { PLANNER_ACTION_TYPES, type CreateDraftsProposalPayload } from "./executors";
import { resolvePlannerOrganization, toToolError } from "./planner-access";

/** Astro conhecendo o Planner (spec 0063, RF-7): leitura direta; criar e programar só por proposta confirmada. */

const organizationField = z.string().optional().describe("ID interno da empresa (cliente), só se o usuário pediu outro cliente e você tem o ID. Na dúvida, OMITA: usa a empresa atual.");
const POST_FORMATS = ["STATIC", "CAROUSEL", "REEL", "STORY"] as const;
const FORMAT_LABEL: Record<(typeof POST_FORMATS)[number], string> = { STATIC: "Feed", CAROUSEL: "Carrossel", REEL: "Reel", STORY: "Story" };
const LIST_LIMIT = 40;
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
// Link completo: com caminho relativo o modelo às vezes inventa "https://nasa-planner?...".
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
const appLink = (path: string) => `${APP_ORIGIN}${path}`;
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(/,/g, "").replace(/ (\d{2}:\d{2})$/, " às $1");

const POST_SUMMARY_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  scheduledAt: true,
  publishedAt: true,
  externalIgPermalink: true,
  caption: true,
} as const;

type PostSummaryRow = { id: string; title: string | null; type: string; status: string; scheduledAt: Date | null; publishedAt: Date | null; externalIgPermalink: string | null; caption: string | null };

const toPostSummary = (post: PostSummaryRow) => ({
  id: post.id,
  title: post.title ?? "(sem título)",
  format: FORMAT_LABEL[post.type as keyof typeof FORMAT_LABEL] ?? post.type,
  status: post.status,
  scheduledAt: post.scheduledAt?.toISOString() ?? null,
  publishedAt: post.publishedAt?.toISOString() ?? null,
  permalink: post.externalIgPermalink,
  captionPreview: post.caption?.slice(0, 140) ?? null,
  link: appLink(`/nasa-planner?post=${post.id}`),
});

export function buildPlannerReadTools(ctx: AgentContext): ToolSet {
  return {
    planner_calendar: tool({
      description: "Posts do Planner num período (programados, publicados e com horário pretendido). Use para 'o que está programado esta semana', 'o que saiu ontem'.",
      inputSchema: z.object({
        organizationId: organizationField,
        fromIso: z.string().optional().describe("Início (ISO). Padrão: hoje."),
        toIso: z.string().optional().describe("Fim (ISO). Padrão: 7 dias depois do início."),
      }),
      execute: async ({ organizationId, fromIso, toIso }) => {
        const access = await resolvePlannerOrganization(ctx, organizationId, "view");
        if ("error" in access) return access;
        const from = fromIso ? new Date(fromIso) : startOfDay(new Date());
        const to = toIso ? new Date(toIso) : addDays(from, 7);
        const posts = await prisma.nasaPlannerPost.findMany({
          where: { organizationId: access.organizationId, OR: [{ scheduledAt: { gte: from, lte: to } }, { publishedAt: { gte: from, lte: to } }] },
          orderBy: [{ scheduledAt: "asc" }, { publishedAt: "asc" }],
          take: LIST_LIMIT,
          select: POST_SUMMARY_SELECT,
        });
        return { from: from.toISOString(), to: to.toISOString(), posts: posts.map(toPostSummary) };
      },
    }),
    planner_drafts_and_approvals: tool({
      description: "Rascunhos, ideias, pedidos de ajuste e posts esperando aprovação no Planner.",
      inputSchema: z.object({ organizationId: organizationField }),
      execute: async ({ organizationId }) => {
        const access = await resolvePlannerOrganization(ctx, organizationId, "view");
        if ("error" in access) return access;
        const posts = await prisma.nasaPlannerPost.findMany({
          where: { organizationId: access.organizationId, status: { in: ["IDEA", "DRAFT", "CHANGES_REQUESTED", "PENDING_APPROVAL", "APPROVED"] } },
          orderBy: { updatedAt: "desc" },
          take: LIST_LIMIT,
          select: POST_SUMMARY_SELECT,
        });
        const summaries = posts.map(toPostSummary);
        return {
          pendingApproval: summaries.filter((post) => post.status === "PENDING_APPROVAL"),
          approvedNotScheduled: summaries.filter((post) => post.status === "APPROVED"),
          drafts: summaries.filter((post) => ["IDEA", "DRAFT", "CHANGES_REQUESTED"].includes(post.status)),
        };
      },
    }),
    planner_search_posts: tool({
      description: "Acha posts do Planner pelo nome/título (ou trecho da legenda). Use antes de planner_post_details quando o usuário cita o post pelo nome.",
      inputSchema: z.object({ organizationId: organizationField, query: z.string().min(2).describe("Parte do título ou da legenda.") }),
      execute: async ({ organizationId, query }) => {
        const access = await resolvePlannerOrganization(ctx, organizationId, "view");
        if ("error" in access) return access;
        const posts = await prisma.nasaPlannerPost.findMany({
          where: {
            organizationId: access.organizationId,
            OR: [{ title: { contains: query, mode: "insensitive" } }, { caption: { contains: query, mode: "insensitive" } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: POST_SUMMARY_SELECT,
        });
        return { posts: posts.map(toPostSummary) };
      },
    }),
    planner_post_details: tool({
      description: "Detalhes de um post (legenda, roteiro, status) e, se publicado, curtidas, comentários e alcance lidos na Meta.",
      inputSchema: z.object({ postId: z.string() }),
      execute: async ({ postId }) => {
        try {
          const { post } = await assertPostAccess(ctx.userId, postId, "view");
          const metrics = post.externalIgPostId ? await getPlannerPostMetrics(postId) : null;
          return {
            ...toPostSummary({ ...post, caption: post.caption }),
            script: post.script,
            caption: post.caption,
            hashtags: post.hashtags,
            publishError: post.publishError,
            metrics: metrics?.metrics ?? null,
          };
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
    planner_brand_kit_status: tool({
      description: "Situação do Kit da Marca (o que falta para o Astro criar conteúdo) e um resumo da identidade.",
      inputSchema: z.object({ organizationId: organizationField }),
      execute: async ({ organizationId }) => {
        const access = await resolvePlannerOrganization(ctx, organizationId, "view");
        if ("error" in access) return access;
        const kit = await getBrandKit(access.organizationId);
        const weekdayThemes = await prisma.nasaPlannerWeekdayTheme.findMany({ where: { organizationId: access.organizationId }, orderBy: { weekday: "asc" }, select: { weekday: true, theme: true } });
        return {
          weekdayThemes: weekdayThemes.map((weekdayTheme) => ({ weekday: WEEKDAY_NAMES[weekdayTheme.weekday], theme: weekdayTheme.theme })),
          completeness: kit.completeness,
          voiceTone: kit.voiceTone,
          audience: kit.audience,
          palette: kit.palette,
          brandName: kit.brandName || kit.organization.name,
          fonts: { heading: kit.fontHeading, body: kit.fontBody },
          keyMessages: kit.keyMessages,
          forbiddenWords: kit.forbiddenWords,
          brandHashtags: kit.defaultHashtags.map((hashtag) => `#${hashtag}`),
          brandCtas: kit.defaultCtas,
          products: kit.assets.filter((asset) => asset.kind === "PRODUCT").map((asset) => ({ title: asset.title, price: asset.price })),
          link: appLink(`/nasa-planner?tab=kit&org=${access.organizationId}`),
        };
      },
    }),
  };
}

export function buildPlannerWriteTools(ctx: AgentContext): ToolSet {
  return {
    propose_planner_drafts: tool({
      description:
        "Propõe criar rascunho(s) no Planner — um por formato, com a mesma ideia. Escreva título, roteiro, legenda e hashtags no tom do Kit da Marca. Nada é criado antes do usuário confirmar o cartão.",
      inputSchema: z.object({
        organizationId: organizationField,
        formats: z.array(z.enum(POST_FORMATS)).min(1).max(4),
        title: z.string().min(2).max(200),
        script: z.string().max(10_000).optional(),
        caption: z.string().max(2200).optional(),
        hashtags: z.array(z.string()).max(30).optional(),
        intendedAtIso: z.string().optional().describe("Horário pretendido (ISO). SÓ se o usuário disse quando publicar; senão omita."),
      }),
      execute: async ({ organizationId, ...draft }) => {
        const access = await resolvePlannerOrganization(ctx, organizationId, "create");
        if ("error" in access) return access;
        const payload: CreateDraftsProposalPayload = { organizationId: access.organizationId, ...draft };
        return createPendingAction({
          ctx,
          actionType: PLANNER_ACTION_TYPES.createDrafts,
          payload: { ...payload },
          title: draft.formats.length > 1 ? `Criar ${draft.formats.length} rascunhos no Planner` : "Criar rascunho no Planner",
          lines: [
            { label: "Título", value: draft.title },
            { label: "Formatos", value: draft.formats.map((format) => FORMAT_LABEL[format]).join(", ") },
            ...(draft.script ? [{ label: "Roteiro", value: draft.script.slice(0, 600) }] : []),
            ...(draft.caption ? [{ label: "Legenda", value: draft.caption.slice(0, 400) }] : []),
            ...(draft.hashtags?.length ? [{ label: "Hashtags", value: draft.hashtags.map((hashtag) => `#${hashtag.replace(/^#/, "")}`).join(" ") }] : []),
            ...(draft.intendedAtIso ? [{ label: "Quando", value: formatWhen(draft.intendedAtIso) }] : []),
          ],
        });
      },
    }),
    propose_planner_schedule: tool({
      description: "Propõe programar um post APROVADO para um horário. Post não aprovado precisa passar pela aprovação na tela antes.",
      inputSchema: z.object({ postId: z.string(), scheduledAtIso: z.string().describe("Data e hora (ISO, com fuso).") }),
      execute: async ({ postId, scheduledAtIso }) => {
        try {
          const { post } = await assertPostAccess(ctx.userId, postId, "schedule");
          if (post.status !== "APPROVED" && post.status !== "SCHEDULED") {
            return { error: `O post está "${post.status}". Ele precisa ser aprovado no Planner antes de programar.`, link: appLink(`/nasa-planner?post=${postId}`) };
          }
          return createPendingAction({
            ctx,
            actionType: PLANNER_ACTION_TYPES.schedulePost,
            payload: { postId, scheduledAtIso },
            title: "Programar post",
            lines: [
              { label: "Post", value: post.title ?? "(sem título)" },
              { label: "Quando", value: formatWhen(scheduledAtIso) },
            ],
          });
        } catch (error) {
          return toToolError(error);
        }
      },
    }),
  };
}
