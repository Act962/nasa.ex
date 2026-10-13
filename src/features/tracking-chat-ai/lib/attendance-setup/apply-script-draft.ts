import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createWorkflowFromBlueprint, type Blueprint } from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { parseAiCapabilities } from "../capabilities";
import {
  MENU_PRESET_NAME,
  buildInterestFlowBlueprint,
  buildScriptAssistantPrompt,
  buildScriptKnowledge,
  flowName,
  interestTags,
  knowledgeDocumentName,
  knowledgeSourceLine,
  menuTitles,
  type ScriptDraft,
} from "./script-draft";

// Grava o que a pessoa confirmou (spec 0091). Só escritas de banco: roda dentro de uma transação
// (Regra 18). Nada aqui liga o atendimento: menu, fluxos e assistente ficam para revisão.

const DEFAULT_ASSISTANT_NAME = "Assistente";

export interface AppliedScriptDraft {
  knowledgeId: string;
  wasKnowledgeUpdated: boolean;
  droppedFacts: number;
  assistantName: string;
  keptExistingInstructions: boolean;
  createdTagNames: string[];
  reusedTagNames: string[];
  wasMenuUpdated: boolean;
  /** O menu fixo de agendamento estava ligado e foi desligado para o menu do roteiro aparecer. */
  turnedOffGuidedMenu: boolean;
  createdFlowNames: string[];
  skippedFlowNames: string[];
}

export async function applyScriptDraft(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    userId: string;
    trackingId: string;
    draft: ScriptDraft;
    /** A pessoa escolheu trocar as instruções que o funil já tinha pelas do roteiro. */
    shouldReplaceInstructions: boolean;
  },
): Promise<AppliedScriptDraft> {
  const { draft, organizationId, trackingId } = params;
  const assistantName = draft.assistantName?.trim().slice(0, 40) || DEFAULT_ASSISTANT_NAME;

  // 1. Documento na Auto Inteligência. Um por funil: mandar o roteiro de novo atualiza, não duplica.
  const knowledge = buildScriptKnowledge({ draft, trackingId, writtenAt: new Date() });
  const existingKnowledge = await tx.aiKnowledge.findFirst({
    where: { organizationId, content: { startsWith: knowledgeSourceLine(trackingId) } },
    select: { id: true },
  });
  const knowledgeData = { content: knowledge.content, name: knowledgeDocumentName(draft), status: "READY" as const };
  const savedKnowledge = existingKnowledge
    ? await tx.aiKnowledge.update({ where: { id: existingKnowledge.id }, data: knowledgeData, select: { id: true } })
    : await tx.aiKnowledge.create({
        data: { ...knowledgeData, organizationId, type: "md", createdBy: params.userId },
        select: { id: true },
      });

  // 2. Tags de interesse, uma por opção do menu.
  const tags = interestTags(draft);
  const tagResult = await findOrCreateTags(tx, organizationId, tags);

  // 3. Menu inicial salvo: cada opção aplica a tag do assunto.
  const titles = menuTitles(draft.menuOptions);
  const menuButtons = draft.menuOptions.map((_option, optionIndex) => ({
    id: tags[optionIndex].slug,
    text: titles[optionIndex],
    tagId: tagResult.tagMap[tags[optionIndex].slug],
  }));
  const menuData = {
    name: MENU_PRESET_NAME,
    description: "Enviar na primeira mensagem do cliente, junto com a saudação, para ele escolher o assunto.",
    bodyText: draft.greeting?.trim() || `Olá! Sou ${assistantName}, da ${draft.companyName}. Como posso ajudar?`,
    buttons: menuButtons,
    menuFormat: menuButtons.length > 3 ? ("LIST" as const) : ("BUTTON" as const),
    listButton: "Ver opções",
  };
  const existingMenu = await tx.aiButtonPreset.findFirst({ where: { trackingId, name: MENU_PRESET_NAME }, select: { id: true } });
  if (menuButtons.length > 0) {
    if (existingMenu) await tx.aiButtonPreset.update({ where: { id: existingMenu.id }, data: menuData });
    else await tx.aiButtonPreset.create({ data: { ...menuData, trackingId, isActive: true } });
  }

  // 4. Um fluxo por assunto, desligado. Fluxo com o mesmo nome já existente não é refeito.
  const existingFlows = await tx.workflow.findMany({ where: { trackingId }, select: { name: true } });
  const existingFlowNames = new Set(existingFlows.map((flow) => flow.name.trim().toLowerCase()));
  const createdFlowNames: string[] = [];
  const skippedFlowNames: string[] = [];
  for (const [optionIndex, option] of draft.menuOptions.entries()) {
    const name = flowName(option);
    if (existingFlowNames.has(name.toLowerCase())) {
      skippedFlowNames.push(name);
      continue;
    }
    await createWorkflowFromBlueprint(tx, {
      trackingId,
      userId: params.userId,
      blueprint: buildInterestFlowBlueprint(option, tags[optionIndex]) as unknown as Blueprint,
      agentMode: true,
      isActive: false,
      maxRunsPerHour: 60,
      tagMap: tagResult.tagMap,
    });
    createdFlowNames.push(name);
  }

  // 5. Assistente: nome e instruções do roteiro, e o documento marcado para leitura.
  const currentSettings = await tx.aiSettings.findUnique({
    where: { trackingId },
    select: { prompt: true, assistantName: true, capabilities: true },
  });
  const currentCapabilities = parseAiCapabilities(currentSettings?.capabilities);
  const capabilities = {
    ...currentCapabilities,
    knowledgeIds: [...new Set([savedKnowledge.id, ...currentCapabilities.knowledgeIds])].slice(0, 10),
    // Os dois menus convivem: o do roteiro abre a conversa e leva junto "Agendar" e "Meus horários"
    // do menu de botões (spec 0089), que continua resolvendo esses cliques sem IA.
    guidedMenu: currentCapabilities.guidedMenu,
    configuredByUserId: currentCapabilities.configuredByUserId ?? params.userId,
  };
  const hasWrittenInstructions = Boolean(currentSettings?.prompt?.trim());
  const keepsInstructions = hasWrittenInstructions && !params.shouldReplaceInstructions;
  // Funil com agenda ligada marca pela conversa: a regra do roteiro de "encaminhe ao agendamento" não entra.
  const canBookByAgenda = currentCapabilities.agenda.isEnabled && currentCapabilities.agenda.agendaIds.length > 0;
  const assistantFields = keepsInstructions ? {} : { prompt: buildScriptAssistantPrompt(draft, assistantName, { canBookByAgenda }), assistantName };
  if (currentSettings) {
    await tx.aiSettings.update({ where: { trackingId }, data: { capabilities, ...assistantFields } });
  } else {
    await tx.aiSettings.create({
      data: { trackingId, capabilities, prompt: buildScriptAssistantPrompt(draft, assistantName, { canBookByAgenda }), assistantName },
    });
    // Configuração nova nunca começa atendendo: quem liga é a empresa, depois de revisar.
    await tx.tracking.update({ where: { id: trackingId }, data: { globalAiActive: false } });
  }

  return {
    knowledgeId: savedKnowledge.id,
    wasKnowledgeUpdated: Boolean(existingKnowledge),
    droppedFacts: knowledge.droppedFacts,
    assistantName: keepsInstructions ? (currentSettings?.assistantName ?? assistantName) : assistantName,
    keptExistingInstructions: keepsInstructions,
    createdTagNames: tagResult.created.map((tag) => tag.name),
    reusedTagNames: tagResult.reused.map((tag) => tag.name),
    wasMenuUpdated: Boolean(existingMenu),
    turnedOffGuidedMenu: false,
    createdFlowNames,
    skippedFlowNames,
  };
}
