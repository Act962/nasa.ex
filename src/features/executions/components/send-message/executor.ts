import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import ky, { type Options as KyOptions } from "ky";

type SendMessageNodeData = {
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
};

export const sendMessageExecutor: NodeExecutor<SendMessageNodeData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  const result = await step.run("http-request", async () => context);

  return result;
};
