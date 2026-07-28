/**
 * Gera a Action configurada a partir de uma resposta FINALIZADA do formulário.
 * Chamado sincronamente pós-commit no handler de submit, isolado em try/catch —
 * uma falha aqui nunca derruba o submit já commitado.
 *
 * Regras de negócio (ver plano Form → Actions):
 *  - Config desabilitada / sem template → no-op.
 *  - Título = tokens (campo→valor da resposta / literal→texto) concatenados.
 *  - Capa = imagem de um campo ImageUpload (índice escolhido), key verbatim.
 *  - Vencimento = preset relativo ao horário do envio.
 *  - Sem workspace/coluna resolvível → skip gracioso (conexão é opcional).
 *  - createdBy = dono do form (submit é anônimo).
 */
import dayjs from "dayjs";
import { Prisma } from "@/generated/prisma/client";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { readValue } from "@/features/form/lib/derive-response-label";
import {
  resolveGenerateActionsConfig,
  type ActionTemplate,
  type DueDatePreset,
  type TitleToken,
} from "@/features/form/lib/generate-actions-config";
import { recordLeadHistory } from "@/app/router/leads/utils/history";

type GenerateActionsInput = {
  form: {
    id: string;
    userId: string;
    organizationId: string;
    name: string;
    jsonBlock: unknown;
    /** FormSettings.trackingId — usado no fallback automático de workspace. */
    trackingId: string | null;
  };
  formResponse: {
    id: string;
    jsonResponse: unknown;
    leadId: string | null;
  };
  /** Valor cru de FormSettings.generateActionsConfig. */
  config: unknown;
};

export type GenerateActionsResult =
  | { created: string[] }
  | { skipped: "disabled" | "no_target" };

function parseJsonResponse(jsonResponse: unknown): Record<string, unknown> {
  if (!jsonResponse) return {};
  if (typeof jsonResponse === "string") {
    try {
      const parsed = JSON.parse(jsonResponse);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof jsonResponse === "object") {
    return jsonResponse as Record<string, unknown>;
  }
  return {};
}

function buildTitle(
  tokens: TitleToken[],
  response: Record<string, unknown>,
  fallback: string,
): string {
  const composed = tokens
    .map((token) =>
      token.type === "literal"
        ? token.text
        : readValue(response[token.blockId]) ?? "",
    )
    .join("")
    .trim();
  return composed || fallback;
}

/** Lê a key da imagem escolhida (meta.images[index], com fallback pro CSV `value`). */
function resolveCoverKey(
  entry: unknown,
  index: number,
): string | null {
  if (!entry || typeof entry !== "object") return null;
  const meta = (entry as { meta?: { images?: Array<{ url?: unknown }> } }).meta;
  const image = meta?.images?.[index];
  if (image && typeof image.url === "string" && image.url.trim()) {
    return image.url;
  }
  const value = (entry as { value?: unknown }).value;
  if (typeof value === "string" && value.trim()) {
    const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
    return parts[index] ?? null;
  }
  return null;
}

function resolveDueDate(preset: DueDatePreset | null, now: dayjs.Dayjs): Date | null {
  if (!preset) return null;
  switch (preset.preset) {
    case "today":
      return now.endOf("day").toDate();
    case "tomorrow":
      return now.add(1, "day").endOf("day").toDate();
    case "in_days":
      return now.add(preset.days, "day").endOf("day").toDate();
    case "end_of_week":
      return now.endOf("week").toDate();
    default:
      return null;
  }
}

async function resolveTarget(
  template: ActionTemplate,
  form: GenerateActionsInput["form"],
): Promise<{ workspaceId: string; columnId: string; trackingId: string | null } | null> {
  const workspace = template.workspaceId
    ? await prisma.workspace.findFirst({
        where: { id: template.workspaceId, organizationId: form.organizationId },
        select: { id: true, trackingId: true },
      })
    : form.trackingId
      ? await prisma.workspace.findFirst({
          where: { organizationId: form.organizationId, trackingId: form.trackingId },
          orderBy: { createdAt: "asc" },
          select: { id: true, trackingId: true },
        })
      : null;

  if (!workspace) return null;

  const column = template.columnId
    ? await prisma.workspaceColumn.findFirst({
        where: { id: template.columnId, workspaceId: workspace.id },
        select: { id: true },
      })
    : await prisma.workspaceColumn.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { order: "asc" },
        select: { id: true },
      });

  if (!column) return null;

  return {
    workspaceId: workspace.id,
    columnId: column.id,
    trackingId: workspace.trackingId,
  };
}

export async function generateActionsForResponse(
  input: GenerateActionsInput,
): Promise<GenerateActionsResult> {
  const { form, formResponse } = input;
  const config = resolveGenerateActionsConfig(input.config);
  if (!config.enabled || !config.template) return { skipped: "disabled" };

  const template = config.template;
  const target = await resolveTarget(template, form);
  if (!target) return { skipped: "no_target" };

  const response = parseJsonResponse(formResponse.jsonResponse);
  const title = buildTitle(template.title, response, form.name);
  const coverImage = template.coverImage
    ? resolveCoverKey(response[template.coverImage.blockId], template.coverImage.index)
    : null;
  const dueDate = resolveDueDate(template.dueDate, dayjs());

  const firstAction = await prisma.action.findFirst({
    where: { columnId: target.columnId },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  const order = firstAction
    ? Prisma.Decimal.sub(firstAction.order, 1)
    : new Prisma.Decimal(0);

  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.action.create({
      data: {
        title,
        coverImage,
        dueDate,
        workspaceId: target.workspaceId,
        columnId: target.columnId,
        trackingId: target.trackingId,
        organizationId: form.organizationId,
        createdBy: form.userId,
        leadId: formResponse.leadId ?? undefined,
        order,
        formResponseId: formResponse.id,
      },
      select: { id: true },
    });

    if (formResponse.leadId) {
      await recordLeadHistory({
        leadId: formResponse.leadId,
        userId: form.userId,
        action: LeadAction.ACTIVE,
        notes: `Ação criada pelo formulário: ${title}`,
        tx,
      });
    }

    return created;
  });

  return { created: [action.id] };
}
