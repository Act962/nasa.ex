import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { TagFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";
import { tagChannel } from "@/inngest/channels/tag";

type TagNodeData = {
  action?: TagFormValues;
};

export const tagExecutor: NodeExecutor<TagNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const result = await step.run("tag", async () => {
    const lead = context.lead as LeadContext;
    const realTime = context.realTime as boolean;
    try {
      if (realTime) {
        await publish(
          tagChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }
      const action = data.action;

      if (action?.tagsIds.length === 0) {
        if (realTime) {
          await publish(
            tagChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Nenhuma tag selecionada");
      }

      if (action?.type === "ADD") {
        await prisma.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            leadTags: {
              connectOrCreate: action.tagsIds.map((id) => ({
                where: {
                  leadId_tagId: {
                    leadId: lead.id,
                    tagId: id,
                  },
                },
                create: {
                  tagId: id,
                },
              })),
            },
          },
        });
      }

      if (action?.type === "REMOVE") {
        await prisma.leadTag.deleteMany({
          where: {
            leadId: lead.id,
            tagId: {
              in: action.tagsIds,
            },
          },
        });
      }

      if (realTime) {
        await publish(
          tagChannel().status({
            nodeId,
            status: "success",
          }),
        );
      }

      return {
        ...context,
        action,
      };
    } catch (error) {
      if (realTime) {
        await publish(
          tagChannel().status({
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
