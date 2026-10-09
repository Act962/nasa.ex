import "server-only";
import type { UserWhatsappBinding } from "@/generated/prisma/client";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { checkAstroPermission } from "@/features/astro/actions/permission-gate";
import { matchIntentPattern } from "@/features/astro/actions/match-intent-pattern";
import {
  discardPendingTaskImage,
  peekPendingTaskImage,
  setPendingTaskImage,
} from "@/features/astro/actions/workspace/pending-image";
import { downloadBotTaskImage } from "./inbound-media";
import { MENU_ID_PREFIX } from "./menu/menu-tree";
import type { BotButton, BotCommandResult, BotInboundMedia } from "./types";

// Imagem enviada pela equipe para entrar numa demanda do Workspace (spec 0080).

const IMAGE_CHOICE_PREFIX = `${MENU_ID_PREFIX}img:`;
const ATTACH_PROMPT = "quero anexar a imagem em uma demanda";
const CREATE_PROMPT = "quero criar uma demanda";
const TASK_CAPTION = /\b(demandas?|tarefas?|atividades?|workspace)\b/;
const TASK_IMAGE_ACTION_KEYS = new Set(["action.create", "action.attach_image"]);

const IMAGE_CHOICE_BUTTONS: BotButton[] = [
  { id: `${IMAGE_CHOICE_PREFIX}attach`, text: "Anexar a uma demanda", interactiveOnly: true },
  { id: `${IMAGE_CHOICE_PREFIX}create`, text: "Criar demanda", interactiveOnly: true },
  { id: `${IMAGE_CHOICE_PREFIX}ignore`, text: "Ignorar", interactiveOnly: true },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * A imagem é para o Workspace? Com o Astro Financeiro ligado, só quando a legenda fala de
 * demanda — foto sem legenda continua sendo boleto ou nota (RF-4). Sem ele, toda imagem é.
 */
export function isTaskImage(caption: string, isFinanceEnabled: boolean): boolean {
  return !isFinanceEnabled || TASK_CAPTION.test(normalize(caption));
}

export type TaskImageOutcome =
  | { kind: "reply"; result: Pick<BotCommandResult, "status" | "reply" | "buttons"> }
  /** A legenda já diz o que fazer: segue como pedido escrito, com a imagem guardada. */
  | { kind: "text"; text: string };

export async function receiveTaskImage(params: {
  binding: UserWhatsappBinding;
  trackingId: string;
  media: BotInboundMedia;
  caption: string;
  ctx: AgentContext;
}): Promise<TaskImageOutcome> {
  const { binding, ctx } = params;
  const sessionId = ctx.sessionId ?? binding.id;

  const permission = await checkAstroPermission({ ctx, appKey: "workspace", action: "edit" });
  if (!permission.ok) return { kind: "reply", result: { status: "media_forbidden", reply: `🔒 ${permission.error}` } };

  const downloaded = await downloadBotTaskImage({ binding, trackingId: params.trackingId, media: params.media });
  if (!downloaded.isDownloaded) return { kind: "reply", result: { status: downloaded.status, reply: downloaded.reply } };

  // Segunda imagem antes de destinar a primeira: vale a mais recente (a chave é uma só por conversa).
  try {
    await setPendingTaskImage(sessionId, { body: downloaded.body, fileName: downloaded.fileName, mimeType: downloaded.mimeType });
  } catch (uploadError) {
    // Credencial do armazenamento recusada ou bucket fora do ar: sem isto o bot ficava mudo.
    console.error("[astro-bot/task-image] upload_failed", { bindingId: binding.id, uploadError });
    return {
      kind: "reply",
      result: {
        status: "media_failed",
        reply: "❌ Recebi a imagem, mas não consegui guardá-la. Tenta de novo daqui a pouco; se continuar, avise o administrador.",
      },
    };
  }

  const captionActionKey = params.caption ? matchIntentPattern(params.caption)?.candidates[0]?.action : undefined;
  if (captionActionKey && TASK_IMAGE_ACTION_KEYS.has(captionActionKey)) return { kind: "text", text: params.caption };

  return {
    kind: "reply",
    result: {
      status: "ok",
      reply: "Recebi a imagem. O que faço com ela?\nResponda *anexar* (em uma demanda que já existe), *criar* (demanda nova) ou *ignorar*.",
      buttons: IMAGE_CHOICE_BUTTONS,
    },
  };
}

export type TaskImageChoice =
  | { kind: "prompt"; prompt: string }
  | { kind: "reply"; reply: string };

/**
 * Resposta à pergunta "o que faço com a imagem?": clique no botão, ou a palavra digitada enquanto
 * há imagem esperando. `null` = a mensagem não é sobre a imagem.
 */
export async function resolveTaskImageChoice(params: {
  sessionId: string;
  interactiveReplyId?: string;
  text: string;
  isAwaitingAnswer: boolean;
}): Promise<TaskImageChoice | null> {
  const clickedChoice = params.interactiveReplyId?.startsWith(IMAGE_CHOICE_PREFIX)
    ? params.interactiveReplyId.slice(IMAGE_CHOICE_PREFIX.length)
    : undefined;
  // A palavra digitada só é lida como resposta se houver imagem esperando — e só então vale consultar o armazenamento.
  const typedWord = params.interactiveReplyId || params.isAwaitingAnswer ? "" : normalize(params.text);
  const typedChoice = /^(anexar|anexa|anexe)$/.test(typedWord)
    ? "attach"
    : /^(criar|cria|crie|nova)$/.test(typedWord)
      ? "create"
      : /^(ignorar|ignora|ignore|descartar)$/.test(typedWord)
        ? "ignore"
        : undefined;
  if (!clickedChoice && !typedChoice) return null;
  const hasPendingImage = Boolean(await peekPendingTaskImage(params.sessionId));
  if (!hasPendingImage) return clickedChoice ? { kind: "reply", reply: "Essa imagem já expirou. Mande de novo." } : null;
  const choice = clickedChoice ?? typedChoice;
  if (!choice) return null;

  if (choice === "attach") return { kind: "prompt", prompt: ATTACH_PROMPT };
  if (choice === "create") return { kind: "prompt", prompt: CREATE_PROMPT };
  await discardPendingTaskImage(params.sessionId);
  return { kind: "reply", reply: "Ok, descartei a imagem." };
}
