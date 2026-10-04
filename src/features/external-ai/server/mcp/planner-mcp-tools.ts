import "server-only";
import { addDays, startOfDay } from "date-fns";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { NasaPlannerPostSource, NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { ensureDefaultPlanner } from "@/features/nasa-planner/server/cross-org";
import { getBrandKit } from "@/features/nasa-planner/server/brand-kit/brand-kit";
import { submitPostForApproval } from "@/features/nasa-planner/server/approval";
import { DEFAULT_SLOT_RULES, expandSlotRules } from "@/features/nasa-planner/lib/publish-slots";
import { assertCallerOrganization, type ExternalAiCaller } from "../access-tokens";
import { LOCAL_UPLOAD_PREFIX, createLocalUploadUrl, isLocalUploadEnabled } from "../local-upload";

/**
 * Tools do MCP do ÓRBITA para IAs externas (spec 0065, RF-3). Leem o Planner e deixam rascunhos;
 * nenhuma aprova, programa ou publica (CA-5).
 */

const FORMATS = ["STATIC", "CAROUSEL", "REEL", "STORY"] as const;
const FORMAT_LABEL: Record<(typeof FORMATS)[number], string> = { STATIC: "Feed", CAROUSEL: "Carrossel", REEL: "Reel", STORY: "Story" };
const EDITABLE_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.IDEA, NasaPlannerPostStatus.DRAFT, NasaPlannerPostStatus.CHANGES_REQUESTED];
const MAX_RANGE_DAYS = 31;
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

const VIDEO_TEMPLATES_PATH = "/skills/orbita-planner/orbita-remotion.zip";
const VIDEO_TEMPLATES = [
  {
    id: "PostReel",
    format: "REEL",
    output: "MP4 1080x1920",
    command: "npx remotion render PostReel out/reel.mp4 --props=props/reel.json",
    props: "{ brand, scenes: [{ headline, body?, durationSec?, mediaUrl? }], cta?, hashtags? }",
  },
  { id: "StoryFrame", format: "STORY", output: "MP4 1080x1920", command: "npx remotion render StoryFrame out/story.mp4 --props=props/story.json", props: "{ brand, headline, body?, cta?, mediaUrl?, durationSec? }" },
  {
    id: "CarouselSlide",
    format: "CAROUSEL",
    output: "PNG 1080x1350 (um por card)",
    command: "npx remotion still CarouselSlide out/card-1.png --props=props/card-1.json",
    props: "{ brand, index, total, headline, body?, variant: cover|content|cta, mediaUrl? }",
  },
  { id: "FeedPost", format: "STATIC", output: "PNG 1080x1350", command: "npx remotion still FeedPost out/feed.png --props=props/feed.json", props: "{ brand, headline, body?, cta?, mediaUrl? }" },
] as const;

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const asResult = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

async function runTool(work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return asResult(await work());
  } catch (error) {
    return asError(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

/** Chave do R2, upload local ou URL → URL absoluta que a IA externa consegue abrir. */
async function toAbsoluteMediaUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${APP_ORIGIN}${value}`;
  return getPublicMediaUrl(value).catch(() => null);
}

/** Tema fixo do dia da semana (spec 0067), no fuso de São Paulo. */
async function findWeekdayTheme(organizationId: string, intendedAtIso: string | undefined) {
  if (!intendedAtIso) return undefined;
  const weekday = new Date(new Date(intendedAtIso).getTime() - SAO_PAULO_OFFSET_MS).getUTCDay();
  const weekdayTheme = await prisma.nasaPlannerWeekdayTheme.findUnique({ where: { organizationId_weekday: { organizationId, weekday } }, select: { theme: true } });
  return weekdayTheme?.theme;
}

async function loadEditablePost(caller: ExternalAiCaller, postId: string) {
  const post = await prisma.nasaPlannerPost.findUnique({ where: { id: postId }, select: { id: true, organizationId: true, type: true, status: true } });
  if (!post) throw new Error("Post não encontrado.");
  await assertCallerOrganization(caller, post.organizationId, "create");
  return post;
}

export function registerPlannerMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "list_clients",
    { description: "Empresas (clientes) liberadas nesta chave, com o status do Kit da Marca e as contas de Instagram conectadas." },
    () =>
      runTool(async () => {
        const organizations = await prisma.organization.findMany({ where: { id: { in: caller.organizationIds } }, select: { id: true, name: true } });
        return Promise.all(
          organizations.map(async (organization) => {
            const [kit, accounts] = await Promise.all([
              getBrandKit(organization.id),
              prisma.metaPublishAccount.findMany({ where: { organizationId: organization.id, kind: "IG_BUSINESS", status: "ACTIVE" }, select: { igUsername: true } }),
            ]);
            return {
              organizationId: organization.id,
              name: organization.name,
              brandName: kit.brandName || organization.name,
              brandKitComplete: kit.completeness.isComplete,
              brandKitMissing: kit.completeness.missing,
              instagramAccounts: accounts.map((account) => `@${account.igUsername}`),
            };
          }),
        );
      }),
  );

  server.registerTool(
    "get_brand_kit",
    {
      description: "Kit da Marca da empresa: nome, voz, público, cores, fontes, logos (URLs), fundos, produtos, materiais, posts de referência, hashtags e CTAs. Leia antes de criar qualquer conteúdo.",
      inputSchema: { organizationId: z.string() },
    },
    ({ organizationId }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "view");
        const kit = await getBrandKit(organizationId);
        const weekdayThemes = await prisma.nasaPlannerWeekdayTheme.findMany({ where: { organizationId }, orderBy: { weekday: "asc" }, select: { weekday: true, theme: true } });
        const logos = Object.fromEntries(await Promise.all(Object.entries(kit.logos).map(async ([variant, value]) => [variant, await toAbsoluteMediaUrl(value)] as const)));
        const assets = await Promise.all(
          kit.assets.map(async (asset) => ({ kind: asset.kind, title: asset.title, description: asset.description, price: asset.price, url: asset.url, fileUrl: await toAbsoluteMediaUrl(asset.fileKey) })),
        );
        return {
          brandName: kit.brandName || kit.organization.name,
          slogan: kit.slogan,
          voiceTone: kit.voiceTone,
          audience: kit.audience,
          positioning: kit.positioning,
          palette: kit.palette,
          fonts: { heading: kit.fontHeading, body: kit.fontBody },
          logos,
          keyMessages: kit.keyMessages,
          forbiddenWords: kit.forbiddenWords,
          hashtags: kit.defaultHashtags.map((hashtag) => `#${hashtag}`),
          ctas: kit.defaultCtas,
          website: kit.website,
          assets,
          weekdayThemes: weekdayThemes.map((weekdayTheme) => ({ weekday: WEEKDAY_NAMES[weekdayTheme.weekday], theme: weekdayTheme.theme })),
          completeness: kit.completeness,
        };
      }),
  );

  server.registerTool(
    "get_video_templates",
    {
      description:
        "Modelos Remotion do ÓRBITA (Reel, Story, card de carrossel, post de feed) para renderizar no seu computador, com o `brand` já preenchido pelo Kit da Marca. Depois suba o arquivo com request_upload_url e anexe com attach_media.",
      inputSchema: { organizationId: z.string() },
    },
    ({ organizationId }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "view");
        const [kit, igAccount] = await Promise.all([
          getBrandKit(organizationId),
          prisma.metaPublishAccount.findFirst({ where: { organizationId, kind: "IG_BUSINESS", status: "ACTIVE" }, select: { igUsername: true } }),
        ]);
        const logoUrl = await toAbsoluteMediaUrl(kit.logos.white ?? kit.logos.color ?? kit.organization.logo);
        return {
          downloadUrl: `${APP_ORIGIN}${VIDEO_TEMPLATES_PATH}`,
          setup: ["curl -L -o orbita-remotion.zip <downloadUrl>", "unzip orbita-remotion.zip && cd orbita-remotion", "npm install"],
          brand: {
            brandName: kit.brandName || kit.organization.name,
            handle: igAccount?.igUsername ? `@${igAccount.igUsername}` : null,
            palette: kit.palette,
            logoUrl,
            fontHeading: kit.fontHeading,
            fontBody: kit.fontBody,
            website: kit.website,
          },
          templates: VIDEO_TEMPLATES,
          tips: [
            "Escreva o JSON de props (brand + conteúdo) em props/<nome>.json e renderize com o comando do modelo.",
            "Palavra entre asteriscos no título (*assim*) fica na cor de destaque da marca.",
            "Use as hashtags e CTAs do get_brand_kit; nada de palavras proibidas.",
            "Carrossel: um `remotion still CarouselSlide` por card (index 1..total; variant cover no 1º e cta no último).",
          ],
        };
      }),
  );

  server.registerTool(
    "list_calendar",
    {
      description: "Posts da empresa num período (padrão: próximos 14 dias), com formato, status e horário.",
      inputSchema: { organizationId: z.string(), fromIso: z.string().optional(), toIso: z.string().optional() },
    },
    ({ organizationId, fromIso, toIso }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "view");
        const from = fromIso ? new Date(fromIso) : startOfDay(new Date());
        const to = toIso ? new Date(toIso) : addDays(from, 14);
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw new Error(`Período máximo de ${MAX_RANGE_DAYS} dias.`);
        const posts = await prisma.nasaPlannerPost.findMany({
          where: { organizationId, OR: [{ scheduledAt: { gte: from, lte: to } }, { publishedAt: { gte: from, lte: to } }] },
          orderBy: { scheduledAt: "asc" },
          take: 60,
          select: { id: true, title: true, type: true, status: true, scheduledAt: true, publishedAt: true },
        });
        return posts.map((post) => ({ ...post, format: FORMAT_LABEL[post.type as keyof typeof FORMAT_LABEL] ?? post.type }));
      }),
  );

  server.registerTool(
    "list_open_slots",
    {
      description: "Horários sugeridos e livres para publicar (cadência da empresa ou padrão), padrão: próximos 7 dias.",
      inputSchema: { organizationId: z.string(), fromIso: z.string().optional(), toIso: z.string().optional() },
    },
    ({ organizationId, fromIso, toIso }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "view");
        const from = fromIso ? new Date(fromIso) : new Date();
        const to = toIso ? new Date(toIso) : addDays(from, 7);
        const [customSlots, takenPosts] = await Promise.all([
          prisma.nasaPlannerPublishSlot.findMany({ where: { organizationId, isActive: true } }),
          prisma.nasaPlannerPost.findMany({ where: { organizationId, scheduledAt: { gte: from, lt: to } }, select: { scheduledAt: true } }),
        ]);
        const rules = customSlots.length
          ? customSlots.map((slot) => ({ weekday: slot.weekday, minuteOfDay: slot.minuteOfDay, postTypes: slot.postTypes, label: "Horário da cadência" }))
          : DEFAULT_SLOT_RULES;
        const takenHours = new Set(takenPosts.map((post) => Math.floor((post.scheduledAt?.getTime() ?? 0) / 3_600_000)));
        return expandSlotRules(rules, from, to)
          .filter((slot) => slot.startsAt.getTime() > Date.now() && !takenHours.has(Math.floor(slot.startsAt.getTime() / 3_600_000)))
          .map((slot) => ({ startsAt: slot.startsAt.toISOString(), formats: slot.postTypes, label: slot.label }));
      }),
  );

  server.registerTool(
    "create_draft",
    {
      description: "Cria um rascunho no Planner (vai para a Caixa de criações, com a sua origem). Não aprova nem programa. Depois anexe a mídia com attach_media.",
      inputSchema: {
        organizationId: z.string(),
        format: z.enum(FORMATS),
        title: z.string().min(2).max(200),
        script: z.string().max(10_000).optional(),
        objective: z.string().max(200).optional().describe("Objetivo / gatilho. Sem ele, usa o tema fixo do dia da semana (get_brand_kit → weekdayThemes)."),
        cta: z.string().max(300).optional(),
        caption: z.string().max(2200).optional(),
        hashtags: z.array(z.string()).max(30).optional(),
        intendedAtIso: z.string().optional().describe("Horário sugerido (ISO). O humano confirma ao programar."),
      },
    },
    ({ organizationId, format, title, script, objective, cta, caption, hashtags, intendedAtIso }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "create");
        const plannerId = await ensureDefaultPlanner(organizationId);
        const igAccount = await prisma.metaPublishAccount.findFirst({ where: { organizationId, kind: "IG_BUSINESS", status: "ACTIVE" }, select: { igUserId: true } });
        const post = await prisma.nasaPlannerPost.create({
          data: {
            organizationId,
            plannerId,
            createdById: caller.userId,
            type: format,
            status: NasaPlannerPostStatus.DRAFT,
            title,
            script,
            objective: objective ?? (await findWeekdayTheme(organizationId, intendedAtIso)),
            cta,
            caption,
            hashtags: (hashtags ?? []).map((hashtag) => hashtag.replace(/^#/, "")),
            scheduledAt: intendedAtIso ? new Date(intendedAtIso) : null,
            targetNetworks: ["INSTAGRAM"],
            targetIgAccountId: igAccount?.igUserId ?? null,
            source: NasaPlannerPostSource.MCP,
            sourceActorLabel: caller.label,
          },
          select: { id: true },
        });
        return { postId: post.id, status: "DRAFT", link: `${APP_ORIGIN}/nasa-planner?post=${post.id}`, next: "Anexe a mídia com attach_media e envie com submit_for_approval." };
      }),
  );

  server.registerTool(
    "attach_media",
    {
      description: "Anexa imagem ou vídeo (URL pública https) a um rascunho. Carrossel: cada chamada adiciona um card na ordem. Reel e vídeo de Story: kind=video.",
      inputSchema: { postId: z.string(), mediaUrl: z.string().url(), kind: z.enum(["image", "video"]), headline: z.string().max(200).optional() },
    },
    ({ postId, mediaUrl, kind, headline }) =>
      runTool(async () => {
        const post = await loadEditablePost(caller, postId);
        if (!EDITABLE_STATUSES.includes(post.status)) throw new Error("Só dá para anexar mídia em rascunho ou em ajuste.");
        if (post.type === "CAROUSEL") {
          const lastSlide = await prisma.nasaPlannerPostSlide.findFirst({ where: { postId }, orderBy: { order: "desc" }, select: { order: true } });
          const order = (lastSlide?.order ?? 0) + 1;
          await prisma.nasaPlannerPostSlide.create({ data: { postId, order, imageKey: kind === "image" ? mediaUrl : null, videoKey: kind === "video" ? mediaUrl : null, headline } });
          return { postId, attached: `card ${order}` };
        }
        await prisma.nasaPlannerPost.update({ where: { id: postId }, data: kind === "video" ? { videoKey: mediaUrl } : { thumbnail: mediaUrl } });
        return { postId, attached: kind };
      }),
  );

  server.registerTool(
    "request_upload_url",
    {
      description: "URL assinada (PUT, 1 h) para subir um arquivo local ao armazenamento do ÓRBITA. Depois chame attach_media com o publicUrl devolvido.",
      inputSchema: { organizationId: z.string(), fileName: z.string(), contentType: z.string() },
    },
    ({ organizationId, fileName, contentType }) =>
      runTool(async () => {
        await assertCallerOrganization(caller, organizationId, "create");
        const extension = fileName.split(".").pop() ?? "bin";
        if (isLocalUploadEnabled()) {
          const localUpload = createLocalUploadUrl(APP_ORIGIN, `${LOCAL_UPLOAD_PREFIX}${organizationId}/${uuidv4()}.${extension}`);
          return { ...localUpload, method: "PUT", headers: { "Content-Type": contentType } };
        }
        const key = `external-ai/${organizationId}/${uuidv4()}.${extension}`;
        const uploadUrl = await getSignedUrl(S3, new PutObjectCommand({ Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!, Key: key, ContentType: contentType }), { expiresIn: 3600 });
        return { uploadUrl, method: "PUT", headers: { "Content-Type": contentType }, publicUrl: await getPublicMediaUrl(key) };
      }),
  );

  server.registerTool(
    "submit_for_approval",
    { description: "Envia o rascunho para aprovação humana (o aprovador recebe aviso no ÓRBITA e no WhatsApp).", inputSchema: { postId: z.string() } },
    ({ postId }) =>
      runTool(async () => {
        await loadEditablePost(caller, postId);
        const { checklist } = await submitPostForApproval({ postId, actorId: caller.userId, note: `Enviado por ${caller.label}` });
        return { postId, status: "PENDING_APPROVAL", brandChecklist: checklist };
      }),
  );

  server.registerTool(
    "get_review_feedback",
    { description: "Status do post e os comentários da revisão (pedidos de ajuste, aprovação).", inputSchema: { postId: z.string() } },
    ({ postId }) =>
      runTool(async () => {
        const post = await prisma.nasaPlannerPost.findUnique({ where: { id: postId }, select: { organizationId: true, status: true, title: true } });
        if (!post) throw new Error("Post não encontrado.");
        await assertCallerOrganization(caller, post.organizationId, "view");
        const reviews = await prisma.nasaPlannerPostReview.findMany({ where: { postId }, orderBy: { createdAt: "asc" }, select: { kind: true, body: true, createdAt: true } });
        return { postId, title: post.title, status: post.status, reviews };
      }),
  );
}
