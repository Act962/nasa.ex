import "server-only";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { defaultBackgroundColor, defaultPrimaryColor } from "@/features/form/constants";
import {
  BRIEFING_FORM_NAME,
  buildBriefingFormBlocks,
} from "@/features/trafego/lib/briefing-form-spec";
import { invalidateTrafegoSettingsCache, loadTrafegoSettings } from "./trafego-settings";

/**
 * Cria o formulário "Briefing TrafeGO" na org da agência com os blocos de ids
 * estáveis. `published: true` é necessário para o formulário aparecer no
 * diálogo do card. Idempotente: devolve o existente se ainda estiver lá.
 */
export async function provisionTrafegoBriefingForm(params: {
  organizationId: string;
  actorUserId: string;
}): Promise<{ formId: string; created: boolean }> {
  const settings = await loadTrafegoSettings({ fresh: true });

  if (settings.briefingFormId) {
    const existing = await prisma.form.findFirst({
      where: { id: settings.briefingFormId, organizationId: params.organizationId },
      select: { id: true },
    });
    if (existing) return { formId: existing.id, created: false };
  }

  const jsonBlock = JSON.stringify(buildBriefingFormBlocks());
  const form = await prisma.form.create({
    data: {
      name: BRIEFING_FORM_NAME,
      description: "Respostas do cliente no site do trafeGO. Preenchido automaticamente.",
      userId: params.actorUserId,
      organizationId: params.organizationId,
      jsonBlock,
      content: jsonBlock,
      published: true,
      shareUrl: uuidv4(),
      settings: {
        create: {
          primaryColor: defaultPrimaryColor,
          backgroundColor: defaultBackgroundColor,
        },
      },
    },
    select: { id: true },
  });

  await prisma.trafegoSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", briefingFormId: form.id, updatedById: params.actorUserId },
    update: { briefingFormId: form.id, updatedById: params.actorUserId },
  });
  invalidateTrafegoSettingsCache();

  return { formId: form.id, created: true };
}
