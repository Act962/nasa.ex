import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createWorkflowFromBlueprint, type Blueprint } from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { buildTopicMenuButtons, fallbackPicks, topicMenuBody, TOPIC_MENU_NAME_PREFIX } from "../topic-menu";
import { attendanceTemplateGreeting, attendanceTemplateMenuOptions } from "./attendance-template";
import { MENU_PRESET_NAME, buildInterestFlowBlueprint, flowName, interestTags, menuTitles } from "./script-draft";

// Grava o modelo de atendimento num funil (spec 0097). Só escritas de banco, dentro de uma transação
// (Regra 18). Tudo nasce DESLIGADO, e o que já existe com o mesmo nome fica como está.

export type AttendanceTemplateResult =
  | { status: "created"; createdFlowNames: string[]; createdMenuNames: string[] }
  | { status: "already_complete" }
  | { status: "has_own_menu" };

interface FlowNodeBlueprint {
  type: string;
  data: { action?: { payload?: Record<string, unknown> } };
}

export async function applyAttendanceTemplate(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; trackingId: string; userId: string; companyName: string },
): Promise<AttendanceTemplateResult> {
  const { organizationId, trackingId } = params;
  const menuOptions = attendanceTemplateMenuOptions();
  const tags = interestTags({ menuOptions } as Parameters<typeof interestTags>[0]).map((tag) => ({ slug: tag.slug, name: tag.name, color: tag.color }));
  const templateSlugs = new Set(tags.map((tag) => tag.slug));

  const [existingMenus, existingFlows] = await Promise.all([
    tx.aiButtonPreset.findMany({ where: { trackingId }, select: { id: true, name: true, buttons: true } }),
    tx.workflow.findMany({ where: { trackingId }, select: { name: true } }),
  ]);
  const initialMenu = existingMenus.find((menu) => menu.name === MENU_PRESET_NAME);
  const initialMenuButtons = Array.isArray(initialMenu?.buttons) ? (initialMenu.buttons as { id?: unknown }[]) : [];
  // Menu inicial com assuntos que não são os do modelo: o funil já tem atendimento por menu próprio.
  if (initialMenu && !initialMenuButtons.some((button) => typeof button.id === "string" && templateSlugs.has(button.id))) {
    return { status: "has_own_menu" };
  }

  const tagResult = await findOrCreateTags(tx, organizationId, tags);
  const menuIdByName = new Map(existingMenus.map((menu) => [menu.name, menu.id]));
  const flowNames = new Set(existingFlows.map((flow) => flow.name.trim().toLowerCase()));
  const createdMenuNames: string[] = [];
  const createdFlowNames: string[] = [];

  if (!initialMenu) {
    const titles = menuTitles(menuOptions);
    await tx.aiButtonPreset.create({
      data: {
        trackingId,
        name: MENU_PRESET_NAME,
        description: "Modelo. Enviado na primeira mensagem do cliente, para ele escolher o assunto.",
        bodyText: attendanceTemplateGreeting(params.companyName),
        buttons: menuOptions.map((_option, optionIndex) => ({ id: tags[optionIndex].slug, text: titles[optionIndex], tagId: tagResult.tagMap[tags[optionIndex].slug] })),
        menuFormat: "BUTTON",
        listButton: "Ver opções",
        isActive: false,
      },
    });
    createdMenuNames.push(MENU_PRESET_NAME);
  }

  for (const [optionIndex, option] of menuOptions.entries()) {
    const tag = tags[optionIndex];
    const topicMenuName = `${TOPIC_MENU_NAME_PREFIX}${option.topicName}`;
    let topicMenuId = menuIdByName.get(topicMenuName);
    if (!topicMenuId) {
      const createdMenu = await tx.aiButtonPreset.create({
        data: {
          trackingId,
          name: topicMenuName,
          description: `Modelo. Menu de perguntas do assunto ${option.topicName}: as respostas saem deste menu, sem IA.`,
          bodyText: topicMenuBody(option.introMessage),
          buttons: buildTopicMenuButtons({ tagId: tagResult.tagMap[tag.slug], facts: option.facts, picks: fallbackPicks(option.facts), canBook: false, canTransfer: true }) as unknown as object,
          menuFormat: "LIST",
          listButton: "Ver perguntas",
          isActive: false,
        },
        select: { id: true },
      });
      topicMenuId = createdMenu.id;
      createdMenuNames.push(topicMenuName);
    }

    const name = flowName(option);
    if (flowNames.has(name.toLowerCase())) continue;
    const blueprint = buildInterestFlowBlueprint(option, { ...tag, aiDescription: "" });
    // O fluxo já nasce enviando o menu de perguntas do assunto: abertura e opções numa mensagem só.
    const nodes = (blueprint.nodes as FlowNodeBlueprint[]).map((node) =>
      node.type === "SEND_MESSAGE" ? { ...node, data: { action: { payload: { type: "BUTTONS", mode: "preset", presetId: topicMenuId, openingMessage: "" } } } } : node,
    );
    await createWorkflowFromBlueprint(tx, {
      trackingId,
      userId: params.userId,
      blueprint: { ...blueprint, nodes } as unknown as Blueprint,
      agentMode: true,
      isActive: false,
      maxRunsPerHour: 60,
      tagMap: tagResult.tagMap,
    });
    createdFlowNames.push(name);
  }

  if (createdFlowNames.length === 0 && createdMenuNames.length === 0) return { status: "already_complete" };
  return { status: "created", createdFlowNames, createdMenuNames };
}
