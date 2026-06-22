import { NodeExecutor } from "@/features/tracking-executions/types";
import { NonRetriableError } from "inngest";
import { TagFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";
import { tagChannel } from "@/inngest/channels/tag";
import { publishLeadChanged } from "@/features/leads/realtime/publish";

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

      // Filtra tags arquivadas — skip silencioso com log warning. Workflow
      // continua (não falha), apenas ignora as arquivadas. Resolve o cenário
      // "user arquivou tag X depois que um workflow já a usava".
      const tagsToProcess = action?.tagsIds ?? [];
      const activeTags = await prisma.tag.findMany({
        where: { id: { in: tagsToProcess }, archivedAt: null },
        select: { id: true },
      });
      const activeTagIds = activeTags.map((t) => t.id);
      const skippedCount = tagsToProcess.length - activeTagIds.length;
      if (skippedCount > 0) {
        console.warn(
          `[tag executor] Node ${nodeId} skipou ${skippedCount} tag(s) arquivadas (de ${tagsToProcess.length} configuradas)`,
        );
      }

      if (action?.type === "ADD" && activeTagIds.length > 0) {
        await prisma.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            leadTags: {
              connectOrCreate: activeTagIds.map((id) => ({
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

      if (action?.type === "REMOVE" && activeTagIds.length > 0) {
        await prisma.leadTag.deleteMany({
          where: {
            leadId: lead.id,
            tagId: {
              in: activeTagIds,
            },
          },
        });
      }

      await publishLeadChanged(publish, {
        leadId: lead.id,
        trackingId: lead.trackingId,
        statusId: lead.statusId,
        fields: ["tag"],
      });

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
