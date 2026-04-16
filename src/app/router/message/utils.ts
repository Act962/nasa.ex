import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import { inngest } from "@/inngest/client";

export async function attendLeadIfWaiting(leadId: string, userId: string) {
  //Lógica para visualizar se o lead foi respondido antes de 5 minutos / 15 min
  return;
  // const lead = await prisma.lead.findUnique({
  //   where: { id: leadId },
  //   include: {
  //     tracking: {
  //       select: {
  //         organizationId: true,
  //       },
  //     },
  //   },
  // });

  // if (!lead || lead.statusFlow !== "WAITING") return;

  // // 1. Update status to ACTIVE
  // await prisma.lead.update({
  //   where: { id: lead.id },
  //   data: { statusFlow: "ACTIVE" },
  // });

  // // 2. Trigger gamification via Event Bus (Inngest)
  // const orgId = lead.tracking.organizationId;
  // const now = dayjs();
  // const createdAt = dayjs(lead.createdAt);
  // const diffMin = now.diff(createdAt, "minute");

  // let action = "";
  // if (diffMin <= 5) {
  //   action = "lead_attended_5min";
  // } else if (diffMin <= 15) {
  //   action = "lead_attended_15min";
  // }

  // if (action) {
  //   await inngest.send({
  //     name: "user/action.tracked",
  //     data: {
  //       userId,
  //       orgId,
  //       action,
  //       metadata: { leadId: lead.id },
  //       source: "chat",
  //     },
  //   });
  // }
}
