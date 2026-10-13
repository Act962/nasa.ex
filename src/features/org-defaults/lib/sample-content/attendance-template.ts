import "server-only";
import prisma from "@/lib/prisma";
import { applyAttendanceTemplate } from "@/features/tracking-chat-ai/lib/attendance-setup/apply-attendance-template";
import type { SampleSeedContext } from "./types";

const ATTENDANCE_TRACKING_NAME = "Atendimento";

/** Empresa nova: o funil de atendimento nasce com o modelo de atendimento por menu, desligado (spec 0097). */
export async function seedSampleAttendanceTemplate(context: SampleSeedContext): Promise<void> {
  // Sem cair no primeiro funil: o modelo só entra no funil de atendimento.
  const atendimentoTracking = context.trackings.find((tracking) => tracking.name === ATTENDANCE_TRACKING_NAME);
  if (!atendimentoTracking) {
    console.warn("[org-defaults] modelo de atendimento não criado: empresa sem funil Atendimento", { organizationId: context.organizationId });
    return;
  }
  const organization = await prisma.organization.findUnique({ where: { id: context.organizationId }, select: { name: true } });
  await prisma.$transaction((tx) =>
    applyAttendanceTemplate(tx, {
      organizationId: context.organizationId,
      trackingId: atendimentoTracking.id,
      userId: context.ownerUserId,
      companyName: organization?.name ?? "sua empresa",
    }),
  );
}
