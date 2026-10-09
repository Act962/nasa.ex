import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { canAstroRead, checkAstroPermission } from "@/features/astro/actions/permission-gate";
import { clearGuidedSlot } from "@/features/astro/actions/guided-slots";
import type { BotButton } from "../types";
import {
  ANSWER_ID_PREFIX,
  MENU_APPS,
  MENU_APPS_ID,
  MENU_END_ID,
  MENU_ID_PREFIX,
  MENU_ROOT_ID,
  ROOT_SHORTCUT_APP_IDS,
  SEARCH_ANSWER_ID,
  type MenuApp,
} from "./menu-tree";

// Navegação do menu (spec 0079). Tudo aqui é código: não usa IA nem cobra Stars (RNF-1).

const APP_ID_PREFIX = `${MENU_ID_PREFIX}app:`;
const ITEM_ID_PREFIX = `${MENU_ID_PREFIX}do:`;
const MENU_STATE_TTL_MS = 15 * 60_000;
const MAX_LIST_OPTIONS = 10;

const GREETING = /^(oi+e?|ola|opa|e ai|eai|bom dia|boa tarde|boa noite)( astro)?$/;
const MENU_WORD = /^(menu|menu principal|opcoes|ajuda|inicio|voltar ao menu|voltar ao inicio)$/;

export type MenuOutcome =
  | { kind: "reply"; reply: string; buttons: BotButton[]; listButtonLabel?: string }
  /** Folha escolhida: a frase segue o caminho de um pedido escrito. */
  | { kind: "prompt"; prompt: string };

interface MenuState {
  optionIds: string[];
  expiresAt: number;
}

// Em número sem botões o menu sai numerado; a resposta "2" só faz sentido com a lista que foi enviada.
const globalForMenu = globalThis as unknown as { astroBotMenuStates?: Map<string, MenuState> };
const menuStates = (globalForMenu.astroBotMenuStates ??= new Map<string, MenuState>());

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function remember(bindingId: string, buttons: BotButton[]): void {
  menuStates.set(bindingId, { optionIds: buttons.map((button) => button.id), expiresAt: Date.now() + MENU_STATE_TTL_MS });
}

/** Há um menu enviado e ainda sem resposta? O aviso de inatividade usa isto. */
export function hasOpenMenu(bindingId: string): boolean {
  const state = menuStates.get(bindingId);
  return Boolean(state && state.optionIds.length > 0 && state.expiresAt > Date.now());
}

export function clearMenuState(bindingId: string): void {
  menuStates.delete(bindingId);
}

function greetingFor(normalizedText: string, firstName: string): string {
  const salutation = /bom dia/.test(normalizedText)
    ? "Bom dia"
    : /boa tarde/.test(normalizedText)
      ? "Boa tarde"
      : /boa noite/.test(normalizedText)
        ? "Boa noite"
        : "Oi";
  return `${salutation}${firstName ? `, ${firstName}` : ""}! 👋`;
}

async function visibleApps(ctx: AgentContext, isFinanceEnabled: boolean): Promise<MenuApp[]> {
  const candidateApps = MENU_APPS.filter((app) => isFinanceEnabled || !app.requiresFinance);
  const visibility = await Promise.all(candidateApps.map((app) => canAstroRead(ctx, app.appKey)));
  return candidateApps.filter((_, index) => visibility[index]);
}

async function rootReply(ctx: AgentContext, opening: string, isFinanceEnabled: boolean): Promise<MenuOutcome> {
  const apps = await visibleApps(ctx, isFinanceEnabled);
  const shortcuts = apps.filter((app) => ROOT_SHORTCUT_APP_IDS.includes(app.id));
  const buttons: BotButton[] = [
    ...shortcuts.map((app) => ({ id: `${APP_ID_PREFIX}${app.id}`, text: app.shortTitle })),
    ...(apps.length > shortcuts.length ? [{ id: MENU_APPS_ID, text: "Mais opções" }] : []),
  ];
  return {
    kind: "reply",
    reply:
      `${opening}\nDiga o que precisa, por exemplo "quero agendar amanhã às 15h"` +
      (buttons.length > 0 ? ", ou escolha abaixo." : "."),
    buttons,
  };
}

async function appsReply(ctx: AgentContext, isFinanceEnabled: boolean): Promise<MenuOutcome> {
  const apps = await visibleApps(ctx, isFinanceEnabled);
  return {
    kind: "reply",
    reply: "Em qual App você quer mexer?",
    listButtonLabel: "Ver Apps",
    buttons: [
      ...apps.map((app) => ({ id: `${APP_ID_PREFIX}${app.id}`, text: app.title, description: app.description })),
      { id: MENU_ROOT_ID, text: "Voltar ao início" },
    ],
  };
}

async function appReply(ctx: AgentContext, app: MenuApp): Promise<MenuOutcome> {
  const checks = await Promise.all(
    app.items.map((item) => checkAstroPermission({ ctx, appKey: item.permission.appKey, action: item.permission.action })),
  );
  const allowedItems = app.items.filter((_, index) => checks[index].ok);
  if (allowedItems.length === 0) {
    return {
      kind: "reply",
      reply: `Você não tem permissão para usar ${app.title}. Quem libera é o administrador, em Configurações › Permissões.`,
      buttons: [{ id: MENU_ROOT_ID, text: "Menu" }],
    };
  }
  return {
    kind: "reply",
    reply: app.question,
    listButtonLabel: "Ver opções",
    buttons: [
      ...allowedItems.map((item) => ({ id: `${ITEM_ID_PREFIX}${item.id}`, text: item.title, description: item.description })),
      { id: MENU_APPS_ID, text: "Voltar ao menu" },
    ],
  };
}

async function firstNameOf(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
  return user?.name?.trim().split(/\s+/)[0] ?? "";
}

/**
 * `null` = a mensagem não é navegação do menu e segue o caminho de sempre.
 * `isAwaitingAnswer`: com pergunta do roteiro no ar, "oi" e "2" são respostas a ela, não menu.
 */
export async function resolveMenu(params: {
  ctx: AgentContext;
  bindingId: string;
  text: string;
  interactiveReplyId?: string;
  isAwaitingAnswer: boolean;
  /** A empresa ligou o Astro Financeiro pelo WhatsApp? Sem isso o Financeiro não entra no menu. */
  isFinanceEnabled: boolean;
}): Promise<MenuOutcome | null> {
  const { ctx, bindingId, isFinanceEnabled } = params;
  const normalizedText = normalize(params.text);
  const state = menuStates.get(bindingId);
  menuStates.delete(bindingId);

  let targetId = params.interactiveReplyId?.startsWith(MENU_ID_PREFIX) ? params.interactiveReplyId : undefined;
  if (!targetId && !params.interactiveReplyId && state && state.expiresAt > Date.now() && /^\d{1,2}$/.test(normalizedText)) {
    targetId = state.optionIds[Number(normalizedText) - 1];
  }
  if (!targetId && !params.interactiveReplyId) {
    if (MENU_WORD.test(normalizedText)) targetId = MENU_ROOT_ID;
    else if (!params.isAwaitingAnswer && GREETING.test(normalizedText)) targetId = MENU_ROOT_ID;
  }
  if (!targetId) return null;

  const sessionId = ctx.sessionId ?? ctx.organizationId;
  let outcome: MenuOutcome | null = null;

  if (targetId === MENU_ROOT_ID) {
    // Voltar ao início abandona a pergunta que estava no ar: senão a próxima frase viraria resposta a ela.
    clearGuidedSlot(sessionId);
    const isGreeting = GREETING.test(normalizedText);
    const opening = isGreeting ? greetingFor(normalizedText, await firstNameOf(ctx.userId)) : "Menu do Astro 🚀";
    outcome = await rootReply(ctx, opening, isFinanceEnabled);
  } else if (targetId === MENU_APPS_ID) {
    clearGuidedSlot(sessionId);
    outcome = await appsReply(ctx, isFinanceEnabled);
  } else if (targetId === MENU_END_ID) {
    clearGuidedSlot(sessionId);
    return { kind: "reply", reply: "Combinado! Quando precisar, mande *Menu*.", buttons: [] };
  } else if (targetId.startsWith(APP_ID_PREFIX)) {
    const app = MENU_APPS.find((candidate) => candidate.id === targetId.slice(APP_ID_PREFIX.length));
    if (app) {
      clearGuidedSlot(sessionId);
      const canOpenApp = (isFinanceEnabled || !app.requiresFinance) && (await canAstroRead(ctx, app.appKey));
      outcome = canOpenApp ? await appReply(ctx, app) : await rootReply(ctx, "Você não tem acesso a esse App.", isFinanceEnabled);
    }
  } else if (targetId.startsWith(ITEM_ID_PREFIX)) {
    const itemId = targetId.slice(ITEM_ID_PREFIX.length);
    const item = MENU_APPS.flatMap((app) => app.items).find((candidate) => candidate.id === itemId);
    if (item) {
      clearGuidedSlot(sessionId);
      if ("prompt" in item) return { kind: "prompt", prompt: item.prompt };
      return { kind: "reply", reply: item.hint, buttons: [{ id: MENU_ROOT_ID, text: "Menu", interactiveOnly: true }] };
    }
  }

  // Id de menu que não existe mais (botão antigo, árvore mudou): recomeça em vez de ficar mudo.
  outcome ??= await rootReply(ctx, "Esse atalho não existe mais.", isFinanceEnabled);
  if (outcome.kind === "reply") remember(bindingId, outcome.buttons);
  return outcome;
}

/**
 * Opções de uma pergunta do roteiro prontas para virar lista: acima de 10, mostra 9 e
 * "Buscar pelo nome" (RF-8); com espaço sobrando, ganha "Voltar ao menu".
 */
export function withListExtras(buttons: BotButton[]): BotButton[] {
  const isRoteiroQuestion = buttons.length > 3 && buttons.every((button) => button.id.startsWith(ANSWER_ID_PREFIX));
  if (!isRoteiroQuestion) return buttons.slice(0, MAX_LIST_OPTIONS);
  if (buttons.length > MAX_LIST_OPTIONS - 1) {
    return [
      ...buttons.slice(0, MAX_LIST_OPTIONS - 1),
      { id: SEARCH_ANSWER_ID, text: "Buscar pelo nome", description: "Digite parte do nome" },
    ];
  }
  return [...buttons, { id: MENU_ROOT_ID, text: "Voltar ao menu" }];
}
