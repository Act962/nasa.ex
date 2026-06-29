import "server-only";

import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { generatePublicSlug } from "@/features/public-calendar/utils/slug";
import type { ParsedEvent } from "./parse-event-html";

/**
 * Recebe um `ParsedEvent` (vindo do parser de URL OU de imagem) e cria
 * uma `Action` `isPublic=true` no workspace do user (provisiona se
 * preciso). Devolve `{ event, missingFields }`.
 *
 * Lista de "missingFields" inclui campos importantes que ficaram null
 * após o parse. UI usa pra alertar o user que ainda precisa preencher
 * antes de publicar de fato.
 */

export type CreateEventFromParsedInput = {
  parsed: ParsedEvent & { eventCategory?: string | null };
  /**
   * URL original importada. Sempre vira `registrationUrl` (sobrescreve
   * o que o parser achou).
   */
  sourceUrl: string | null;
  /**
   * Key S3/R2 da imagem de cover (já uploadada). null pra "sem capa".
   */
  coverImageKey: string | null;
  userId: string;
  userName: string;
};

export type CreateEventFromParsedResult = {
  event: {
    id: string;
    publicSlug: string | null;
    title: string;
    workspaceId: string;
  };
  /** Campos importantes que ficaram vazios — UI alerta. */
  missingFields: string[];
};

const FIELD_LABELS: Record<string, string> = {
  startDate: "datas",
  eventCategory: "categoria do evento",
  cityOrAddress: "endereço",
  coverImage: "imagem de capa",
};

export async function createEventFromParsed(
  input: CreateEventFromParsedInput,
): Promise<CreateEventFromParsedResult | null> {
  const { parsed, sourceUrl, coverImageKey, userId, userName } = input;

  if (!parsed.title) return null;

  // ── 1. Garantir organização ─────────────────────────────────────
  let membership = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) {
    const orgName = `${userName.split(" ")[0]} — Espaço`;
    const baseSlug = orgName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    const slug = `${baseSlug || "espaco"}-${userId.slice(-6)}`;

    const newOrg = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        createdAt: new Date(),
        members: { create: { userId, role: "owner", createdAt: new Date() } },
      },
      select: { id: true },
    });
    membership = { organizationId: newOrg.id };
  }

  const organizationId = membership.organizationId;

  // ── 2. Garantir workspace + colunas ─────────────────────────────
  let workspace = await prisma.workspace.findFirst({
    where: {
      organizationId,
      isArchived: false,
      OR: [{ members: { some: { userId } } }, { createdBy: userId }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, columns: { orderBy: { order: "asc" }, take: 1 } },
  });

  if (!workspace) {
    const created = await prisma.workspace.create({
      data: {
        name: "Meu Workspace",
        organizationId,
        createdBy: userId,
        members: { create: { userId, role: "OWNER" } },
        columns: {
          createMany: {
            data: [
              { name: "Para fazer", order: 0 },
              { name: "Em progresso", order: 1 },
              { name: "Em revisão", order: 2 },
              { name: "Concluído", order: 3 },
            ],
          },
        },
      },
      select: { id: true, columns: { orderBy: { order: "asc" }, take: 1 } },
    });
    workspace = created;
  }

  const firstColumn = workspace.columns[0];
  if (!firstColumn) return null;

  // ── 3. Slug público único ───────────────────────────────────────
  let publicSlug: string | undefined;
  for (let i = 0; i < 3; i++) {
    const candidate = generatePublicSlug(parsed.title);
    const exists = await prisma.action.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });
    if (!exists) {
      publicSlug = candidate;
      break;
    }
  }

  // ── 4. Order (top da coluna) ────────────────────────────────────
  const firstAction = await prisma.action.findFirst({
    where: { columnId: firstColumn.id, workspaceId: workspace.id },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  const newOrder = firstAction
    ? Prisma.Decimal.sub(firstAction.order, 1)
    : new Prisma.Decimal(0);

  const startDate = parsed.startDate ? new Date(parsed.startDate) : null;
  const endDate = parsed.endDate ? new Date(parsed.endDate) : null;

  // EventCategory enum check — só aceita valores conhecidos.
  const VALID_CATEGORIES = new Set([
    "WORKSHOP",
    "PALESTRA",
    "LANCAMENTO",
    "WEBINAR",
    "NETWORKING",
    "CURSO",
    "REUNIAO",
    "HACKATHON",
    "CONFERENCIA",
    "OUTRO",
  ]);
  const eventCategory =
    parsed.eventCategory && VALID_CATEGORIES.has(parsed.eventCategory)
      ? (parsed.eventCategory as
          | "WORKSHOP"
          | "PALESTRA"
          | "LANCAMENTO"
          | "WEBINAR"
          | "NETWORKING"
          | "CURSO"
          | "REUNIAO"
          | "HACKATHON"
          | "CONFERENCIA"
          | "OUTRO")
      : undefined;

  // ── 5. Cria a Action ────────────────────────────────────────────
  const action = await prisma.action.create({
    data: {
      title: parsed.title,
      description: parsed.description ?? undefined,
      priority: "MEDIUM",
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      dueDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      workspaceId: workspace.id,
      organizationId,
      order: newOrder,
      columnId: firstColumn.id,
      createdBy: userId,
      isPublic: true,
      publicSlug,
      publishedAt: new Date(),
      coverImage: coverImageKey ?? undefined,
      city: parsed.city ?? undefined,
      state: parsed.state ?? undefined,
      address: parsed.address ?? undefined,
      // sourceUrl SEMPRE vira registrationUrl (URL importada é o canônico)
      registrationUrl: sourceUrl ?? parsed.registrationUrl ?? undefined,
      eventCategory,
      participants: { create: [{ userId }] },
    },
    select: {
      id: true,
      publicSlug: true,
      title: true,
      workspaceId: true,
    },
  });

  // ── 6. Detecta campos importantes faltando ──────────────────────
  const missing: string[] = [];
  if (!parsed.startDate) missing.push(FIELD_LABELS.startDate);
  if (!eventCategory) missing.push(FIELD_LABELS.eventCategory);
  if (!parsed.city && !parsed.address) missing.push(FIELD_LABELS.cityOrAddress);
  if (!coverImageKey) missing.push(FIELD_LABELS.coverImage);

  return { event: action, missingFields: missing };
}
