import { NodeExecutor } from "@/features/executions/types";
import { ResponsibleFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import { responsibleChannel } from "@/inngest/channels/responsible";
import prisma from "@/lib/prisma";

type ResponsibleNodeData = {
  action?: ResponsibleFormValues;
};

export const responsibleExecutor: NodeExecutor<ResponsibleNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const lead = context.lead as LeadContext;
  const realTime = context.realTime as boolean;

  const result = await step.run("responsible", async () => {
    try {
      if (realTime) {
        await publish(
          responsibleChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      const action = data.action;
      let updatedLead = lead;

      if (action?.type === "ADD") {
        if (action.responsible?.id) {
          const responsibleId = action.responsible.id;

          updatedLead = (await prisma.lead.update({
            where: { id: lead.id },
            data: { responsibleId },
          })) as unknown as LeadContext;
        }
      } else if (action?.type === "REMOVE") {
        if (action.responsible?.id) {
          const idToRemove = action.responsible.id;

          const currentLead = await prisma.lead.findUnique({
            where: { id: lead.id },
            select: { responsibleId: true },
          });

          if (currentLead?.responsibleId === idToRemove) {
            updatedLead = (await prisma.lead.update({
              where: { id: lead.id },
              data: { responsibleId: null },
            })) as unknown as LeadContext;
          }
        }
      }

      if (realTime) {
        await publish(
          responsibleChannel().status({
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
          responsibleChannel().status({
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
