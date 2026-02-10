import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { TagFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";
import { winLossChannel } from "@/inngest/channels/win-loss";

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
  const realTime = context.realTime as boolean;

  await step.run("tag", async () => context);

  return context;
};
