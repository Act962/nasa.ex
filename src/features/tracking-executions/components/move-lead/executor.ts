import { NodeExecutor } from "@/features/tracking-executions/types";
import { LeadContext } from "../../schemas";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { moveLeadChannel } from "@/inngest/channels/move-lead";
import { publishLeadMoved } from "@/features/leads/realtime/publish";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { computeSlaDeadline } from "@/features/leads/lib/sla";

type MoveLeadNodeData = {
  trackingId?: string;
  statusId?: string;
};

export const moveLeadExecutor: NodeExecutor<MoveLeadNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const result = await step.run("move-lead", async () => {
    const lead = context.lead as LeadContext;
    const realTime = context.realTime as boolean;
    try {
      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      if (!lead) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Lead not found");
      }

      const tracking = await prisma.tracking.findUnique({
        where: {
          id: data.trackingId,
        },
      });

      if (!tracking) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Tracking not found");
      }

      const status = await prisma.status.findUnique({
        where: {
          id: data.statusId,
        },
      });

      if (!status) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Status not found");
      }

      const enteredAt = new Date();
      const slaDeadline = computeSlaDeadline(
        status as unknown as { slaHours?: number | null },
        enteredAt,
      );

      const updatedLead = await prisma.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          trackingId: data.trackingId,
          statusId: data.statusId,
          ...({ statusEnteredAt: enteredAt, slaDeadline } as any),
        },
      });

      const previousStatusId = lead.statusId ?? null;
      const previousTrackingId = lead.trackingId ?? null;

      if (data.statusId && data.statusId !== previousStatusId) {
        await recordLeadEvent({
          leadId: lead.id,
          eventType: "STATUS_CHANGE",
          previousStatusId,
          newStatusId: data.statusId,
        });
      }
      if (data.trackingId && data.trackingId !== previousTrackingId) {
        await recordLeadEvent({
          leadId: lead.id,
          eventType: "TRACKING_CHANGE",
          previousTrackingId,
          newTrackingId: data.trackingId,
        });
      }

      const trackingChanged =
        !!data.trackingId && data.trackingId !== previousTrackingId;
      const statusChanged =
        !!data.statusId && data.statusId !== previousStatusId;

      if (trackingChanged || statusChanged) {
        const targetTrackingId = data.trackingId ?? previousTrackingId!;
        await publishLeadMoved(publish, {
          leadId: lead.id,
          fromTrackingId: previousTrackingId,
          toTrackingId: targetTrackingId,
          fromStatusId: previousStatusId,
          toStatusId: data.statusId ?? previousStatusId!,
          movedAt: enteredAt.toISOString(),
        });
      }

      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "success",
          }),
        );
      }

      return {
        ...context,
        lead: updatedLead,
      };
    } catch (error) {
      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }
      throw error;
    }
  });

  return result;
};
